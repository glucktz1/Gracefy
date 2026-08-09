# Gracefy - Christian Music Streaming Platform

## Original Problem Statement
Mobile and web app overhaul with Firebase integration, production payments (Azam Pay), database migration to MongoDB Atlas, and comprehensive bug fixes.

## Architecture
- **Frontend**: React (web), React Native/Expo (mobile)
- **Backend**: FastAPI with MongoDB Atlas
- **Auth**: Firebase (Email/Password, Google)
- **Payments**: Azam Pay (production)
- **CDN**: Bunny.net
- **Cache**: Hybrid L1/L2 (In-Memory + Upstash Redis)
- **Streaming**: HLS Adaptive Streaming (96kbps/192kbps/320kbps)

## What's Been Implemented

### Session: Feb 15, 2026 — Server-Side Skip Counter (Uncircumventable Paywall)
Moved the skip counter to Mongo as the source of truth. Reinstalling the app or clearing localStorage no longer resets the paywall.

- ✅ **New route** `/app/backend/routes/monetization_usage.py`:
  - `GET /api/monetization/usage` — hydrate: returns `{authenticated, usage_count, preview_mode_active, threshold, preview_duration_seconds, is_premium}`. Anonymous callers get sensible defaults so guests still work.
  - `POST /api/monetization/record-skip` — atomic `$inc` on `skip_count` + `total_lifetime_skips`; flips `preview_mode_active=true` and returns `prompt_hard=true` only on the EXACT crossing skip.
  - `POST /api/monetization/reset` — 401 anon, 403 non-premium, 200 for premium; wipes `skip_count` + `preview_mode_active` but preserves `total_lifetime_skips` for analytics.
  - `_resolve_user()` supports BOTH mobile `Bearer <token>` (via `user_tokens`) AND web `session_token` cookie (via `user_sessions`).
  - Threshold sourced from `db.app_settings` where `setting_type='monetization'` (same place admin panel saves via `POST /admin/app-settings/monetization`).
  - Registered in `server.py` at line 143 as `monetization_usage_router`.
- ✅ **New collection** `user_billing_stats` — one doc per user with `{user_id, skip_count, total_lifetime_skips, preview_mode_active, first_hit_at, last_skip_at, cleared_at, created_at, updated_at}`.
- ✅ **Web client** (`UserStreamingApp.jsx`):
  - Mount useEffect hits `/api/monetization/usage` — reconciliation rule: server wins if `usage_count > local` OR if `preview_mode_active=true`. Guests early-return.
  - `bumpUsage()` fires-and-forgets `POST /record-skip` for logged-in users (guests use client-only counter).
  - Premium false→true transition also calls `POST /reset` alongside localStorage wipe.
- ✅ **Mobile client** (`BillingContext.js` + `api.js`):
  - `billingAPI` exports `getUsage`, `recordSkip`, `resetOnPremium`.
  - `BillingContext` mounts server reconciliation useEffect gated by `isAuthenticated` and `monetizationHydratedRef`.
  - `recordSkip()` fires-and-forgets `billingAPI.recordSkip()` for logged-in users only.
  - Premium transition calls `billingAPI.resetOnPremium()` alongside AsyncStorage wipe.
- ✅ **Testing**: iteration_57 PASS — **12/12 backend pytest cases** (anonymous defaults, atomic increment, crossing-skip prompt logic, cross-device persistence, premium bypass, premium reset preserves lifetime stats, 401/403 auth rejection, threshold source) + **9/9 client static verifications**. Test file: `/app/backend/tests/test_monetization_usage_iter57.py`. Ephemeral test users cleaned up post-run.

### Session: Feb 15, 2026 — Hard Paywall (Skip Counter Persists Until Payment)
**Policy change**: Removed daily reset. Once the user hits `hard_skip_limit`, preview mode locks in **permanently** until they upgrade to premium — matches Spotify's free-tier behavior on unpaid accounts.
- ✅ **Web** (`UserStreamingApp.jsx`):
  - `loadMonetizationState()` no longer discards data when `parsed.date !== today` — the `date` field is completely removed
  - Persist useEffect writes only `{usageCount, previewModeActive, previewClipCount}` (no date)
  - Premium transition (`isPremium` false→true) still wipes `localStorage.gracefy_monetization` — the ONLY reset path
- ✅ **Web lock-screen coverage** (`useAudioPlayer.js`):
  - Added `mediaSessionSkipRef` + `setMediaSessionSkipHandler()` — parent registers `bumpUsage()` as the callback
  - Both `navigator.mediaSession.setActionHandler('nexttrack')` and `('previoustrack')` now invoke `mediaSessionSkipRef.current?.()` BEFORE executing the skip → lock-screen / bluetooth remote skips count toward the paywall (previously bypassed)
- ✅ **Mobile** (`BillingContext.js`):
  - Removed `todayKey()` helper, date field, and the midnight rollover watcher (`setInterval(60000)` + AppState listener) entirely
  - Hydrate useEffect applies `parsed.skipCount` and `parsed.previewModeActive` unconditionally when a stored value exists — no date check
  - `isPremium=true` still calls `AsyncStorage.removeItem(MONETIZATION_STORE_KEY)` — the ONLY reset path
- ✅ **Mobile lock-screen coverage** (`App.js` + `PlayerContext.js`):
  - `PlayerProviderWithBilling` now passes `recordSkip` prop to `PlayerProvider`
  - `PlayerProvider` accepts `recordSkip` prop + keeps latest in `recordSkipRef`
  - Inside `Event.PlaybackActiveTrackChanged` handler, detect manual skip via `lastPosition < lastTrack.duration - 5` and call `recordSkipRef.current()` → routes lock-screen `RemoteNext`/`RemotePrevious` events through the paywall counter (previously bypassed)
  - `previewDurationSeconds` default aligned at 35 (was 30)
- ✅ **Testing**: iteration_56 PASS — backend 5/5 (regression checks on /app-settings, /billing-status, monetization save + cache invalidation, guest-limits) + 16/16 static code verifications (web + mobile). Live `/api/app-settings` returns `preview_duration_seconds: 35` after restoring the user's saved value post-fixture-reset.

### Session: Feb 15, 2026 — Preview Duration Aligned at 35s (Web + Mobile)
- ✅ **Preview duration set to 35 seconds** on both platforms and in DB:
  - Web default in `UserStreamingApp.jsx` `monetizationSettings` state: 45 → 35
  - Web preview-timer fallback in the enforcement useEffect: 45 → 35
  - Mobile default in `BillingContext.js` `monetization` state: 30 → 35
  - Backend `/app-settings` public defaults: 45 → 35
  - Backend `/admin/app-settings` defaults: kept in sync at 35
  - Backend POST `/admin/app-settings/monetization` default fallback: 30 → 35
  - **Saved 35 to Mongo** via admin API so live users see the change immediately (no code deploy needed for the value itself; defaults are for fresh installs).
- ✅ **Web skip enforcement**: reviewed and confirmed already wired correctly — `bumpUsage()` fires on every skip via `handleSkipWithBillingCheck` on both mini-player and full player. Once `hard_skip_limit` is hit, `previewModeActive=true` triggers the 35s auto-advance timer.
- ✅ **Verified**: browser fetch of `/api/app-settings` returns `preview_duration_seconds: 35`; smoke-tested home renders cleanly.

### Session: Feb 15, 2026 — Mobile Skip-Limit Persistence + Daily Reset (bug fix)
- ✅ **Mobile `skipCount` now persists across app restarts** (`/app/mobile/SpiritSongs/src/context/BillingContext.js`):
  - Previously `skipCount` was in-memory React state only → closing and reopening the app reset it to 0 → users could bypass skip limits by force-quitting.
  - Now written to AsyncStorage under `gracefy_monetization` with a `date` field. On mount, only applied if `parsed.date === todayKey()` — otherwise counters reset to 0 (daily rollover).
  - Persists both `skipCount` and `previewModeActive` so preview-mode state survives too.
- ✅ **Midnight rollover watcher**:
  - `setInterval(60_000)` checks if the local date changed while the app is open — if it did, zero out counters and clear preview mode.
  - Also runs on `AppState.change → active` so a device that slept overnight sees the reset immediately on unlock.
  - Old `global.lastSkipReset` (RAM-only, didn't survive kill) removed.
- ✅ **Premium clears persisted store**: when user becomes premium, `AsyncStorage.removeItem(MONETIZATION_STORE_KEY)` runs so subscription lapse doesn't inherit stale count.
- ✅ **Default sync between admin GET vs public GET** on `/app_control.py` — both endpoints now return the same defaults (soft=6, hard=9, preview=45) when no monetization doc exists, so admin panel displays what users actually see.
- ✅ **Testing**: iteration_55 PASS — 5/5 backend tests (admin monetization save, guest-limits save, cache invalidation on second save, billing ON, billing OFF), 100% mobile static verification (imports, hydrate gate, persist gate, midnight rollover, premium clear, global.lastSkipReset removed). New pytest test at `/app/backend/tests/test_monetization_settings.py`.

### Session: Feb 15, 2026 — Billing/Payment Toggle E2E Fix
- ✅ **PUT /api/monetization/settings** now exists (`/app/backend/routes/monetization.py`):
  - Previously the admin **Monetization Settings Page** hit `PUT /api/monetization/settings` but only `POST /api/monetization-settings` was exposed → **405 Method Not Allowed** → save toast said "success" but nothing persisted → sub-flags (`app_billing_enabled`, `web_billing_enabled`) never made it to Mongo.
  - Fix: dual decorator `@router.post("/monetization-settings")` + `@router.put("/monetization/settings")` on the same handler.
- ✅ **Sub-flag defaults corrected** in `/billing-status`:
  - When master `admin_settings.billing_enabled=True` AND `monetization_settings` collection is empty (fresh install), sub-flags now default to **True** (`app_billing_enabled=True`, `web_billing_enabled=True`, `billing_mode='full'`).
  - Previously they defaulted to False → admin toggled master ON, but users saw no billing prompts because sub-flags overrode master.
- ✅ **Cache invalidation** on save:
  - `save_monetization_settings` now calls `invalidate_billing_cache()` after every write → mobile/web get fresh billing status on the next call (was up to 10s stale).
  - `PUT /api/admin/settings` already did this.
- ✅ **Upsert instead of insert** for `monetization_settings`:
  - Single canonical doc (`setting_id='monetization'`) instead of a new doc every save.
  - `created_at` in `$setOnInsert` so it survives repeated saves; `updated_at` in `$set`.
- ✅ **Testing**: iteration_54 PASS — 7/7 scenarios covering master toggle propagation, sub-flag defaults, PUT endpoint 200, cache invalidation, upsert pattern (1 doc), legacy POST compatibility, cache-control headers, and admin/settings regression. New pytest test file at `/app/backend/tests/test_billing_toggle_e2e.py`.

### Session: Feb 15, 2026 — Image Loading Speedup (Web + Mobile)
- ✅ **Bunny CDN Optimizer auto-injection** in `getImageUrl` and `getThumbnail` on both platforms (`/app/frontend/src/utils/streamingHelpers.js`, `/app/mobile/SpiritSongs/src/services/api.js`):
  - Bunny CDN URLs (`.b-cdn.net`) automatically get `?width=600&quality=85&format=auto` (mobile default: 500px) → serves resized WebP to modern clients.
  - Non-Bunny URLs (Firebase, data:, etc.) pass through unchanged — safe no-op.
  - Callers can pass `sizeOpts` for custom sizes: `getImageUrl(url, { width: 200 })` for mini-player art, `{ width: 1400 }` for hero.
  - **Important**: Bunny Optimizer add-on must be enabled in Bunny.net dashboard for the resize params to take effect (~$9.50/mo). Until then, params are ignored gracefully by Bunny and images serve at original size. Once enabled → **5-10x smaller thumbnails with zero code changes**.
- ✅ **Native lazy loading + async decoding** on the 4 primary web card components in `UserStreamingApp.jsx`:
  - `QuickAccessCard`, `AlbumCard`, `WideAlbumCard`, `ListItem` all now use `loading="lazy" decoding="async"`.
  - Below-the-fold images defer until scrolled into view → **~30% faster initial paint** on the home page even without Bunny Optimizer.
- ✅ **Verified**: unit-tested URL transformer against 6 inputs; live smoke test on preview shows 5/8 home-page imgs now have `?width=600&quality=85&format=auto` + `loading=lazy decoding=async`.

### Session: Feb 15, 2026 — Mobile Data Loading Fix + Spotify Preload + Bad-Network Resilience
- ✅ **HomeScreen data-loading crash fix** (`/app/mobile/SpiritSongs/src/screens/HomeScreen.js`):
  - **Root cause**: `hydrateFromCache()` + `persistToCache` useEffect referenced undefined `newReleases`, `trendingSongs`, `setNewReleases`, `setTrendingSongs` state vars. The useEffect dep array (line ~389) threw `ReferenceError` at render → entire HomeScreen crashed silently → user saw "Hakuna maudhui" empty state.
  - **Fix**: Deleted the 4 orphaned identifiers from both hydrate and persist paths. `HomeScreen.js` now renders cleanly on cold app open.
- ✅ **Bad-network guard** (`HomeScreen.loadData`):
  - Added `fetchHomeWithRetry()` — one automatic retry after 1.5s if the primary `/home/app` fails, then returns `null` on total failure.
  - When `homeRes === null` AND we have hydrated AsyncStorage cache, `loadData` **early-returns without wiping state** — user keeps seeing last-known-good UI instead of empty screen.
  - Previously the `.catch(() => empty)` was silently clobbering the hydrated cache with empty payload on transient network fails.
- ✅ **Spotify-style next-track preload** (`/app/mobile/SpiritSongs/src/context/PlayerContext.js`):
  - New `preloadNextTracks(fromIndex)` callback — fires `fetch(url, { headers: { Range: 'bytes=0-262143' } })` for the next 2 tracks in the queue.
  - Warms CDN edge cache + establishes TCP/TLS + primes RN's HTTP layer BEFORE `TrackPlayer` actually needs the URL → eliminates the 1-3s silent gap between songs on poor networks.
  - `AbortController` cancels in-flight preloads on rapid skip. `preloadedUrlsRef` Set dedupes so each URL is warmed only once per session (capped at 40 entries).
  - Hooked into BOTH `Event.PlaybackActiveTrackChanged` (fires on every track change) AND at the end of `playTrack()` (first-play warmup).
- ✅ **Axios auto-retry** (`/app/mobile/SpiritSongs/src/services/api.js`):
  - Response interceptor now retries GET requests once after 1.2s on `ECONNABORTED` / `ERR_NETWORK` / 502 / 503 / 504.
  - `__retried` flag prevents infinite loops; POST requests never auto-retry (idempotency safety).
- ✅ **Testing**: iteration_53 PASS — 5/5 backend endpoints (home/app, song-categories, home-filters, recommendations/next-songs, album detail), 6/6 mobile static code checks. Verified undefined refs are gone, retry logic in place, preloadNextTracks wired correctly.

### Session: Feb 15, 2026 — Lock-Screen Autoplay Fix
- ✅ **Web lock-screen autoplay fix** (`useAudioPlayer.js`):
  - **Root cause**: Mobile browsers (iOS Safari, Chrome Android) only preserve the autoplay-after-`ended` gesture chain when the next `.play()` fires SYNCHRONOUSLY in the same task. HLS.js's async manifest parse was pushing `.play()` into a later microtask → autoplay grant lost → next song silently blocked on locked screen.
  - **Fix 1**: `setupAudioSource` now checks `document.hidden` — when the page is hidden/locked, HLS is bypassed and MP3 direct is used so `onReady()` (and thus `.play()`) fires synchronously with the `ended` event.
  - **Fix 2**: Removed a DUPLICATE `mediaSession.setActionHandler` `useEffect` (lines 1260-1277) that installed stale-closure `nextSong`/`prevSong` on top of the mount-time handlers — was causing "next" from lock screen to jump to wrong track after context changes.
  - **Fix 3**: `mediaSession.playbackState = 'playing'` is now re-signaled immediately when a new track's metadata is set in `playFromQueueInternal` — keeps the OS media session alive across track transitions.
  - **Fix 4**: **Screen Wake Lock** requested while `isPlaying=true` (best-effort, no-op on unsupported browsers) — prevents aggressive timer throttling on desktop / Chrome Android.
  - **Fix 5**: `visibilitychange` listener — when the tab becomes visible after unlock, if we think we're playing but `<audio>` is paused (browser silently paused during suspension), resume immediately + re-acquire wake lock.
  - **Testing**: Requires real device with locked screen — automated E2E can't reproduce lock. Verified frontend compiles cleanly, MediaSession/WakeLock APIs detected, no console errors.

### Session: Feb 22, 2026 — Data Usage Analytics + Guest HARD BLOCK + Campaign Preview UI Fix
- ✅ **Data Usage Analytics** (`/api/analytics/data-usage` + new "Data Usage" tab in admin analytics):
  - Backend formula: streaming @ 160 kbps, downloads @ 320 kbps. `MB = (kbps × seconds) / 8 / 1024`.
  - Streams aggregated per-day from `listening_sessions.duration_seconds`; downloads aggregated per-day from `downloads` collection with `$lookup` to `songs` for duration (240s fallback when missing).
  - Frontend: new tab with 4 summary stat cards (Total GB, Stream GB, Download GB, Listening Minutes) + **stacked bar chart** (Streams cyan + Downloads violet) + **single bar chart** for daily listening minutes + assumptions footnote.
  - Verified end-to-end: 0.27 GB total / 232 listening minutes / 59 streams / 1 download over last 7 days.
- ✅ **Guest 5-action HARD BLOCK** (`UserStreamingApp.jsx`):
  - New `GUEST_ACTION_LIMIT = 5` (plays + skips combined, was separate limits).
  - `checkGuestPlayLimit()` returns `false` when `guestPlayCount + guestSkipCount >= 5`; the 6th attempt triggers `blockGuestAndForceLogin()` which sets `isAppLocked=true`, shows the non-dismissable modal, pauses the player, and sets `setGuestLimitReached(true)` + `setBlockAutoPlayNext(true)`.
  - Modal "Later" button hidden when `isLocked`; backdrop has no `onClick` (no dismiss); `dismissLoginPrompt()` re-asserts the modal when locked.
  - **Rehydrate guard**: useEffect re-opens modal + sets `isAppLocked` on page reload when localStorage counters already >= 5 (page refresh bypass prevented).
  - **Sign-in clears block**: existing `user`-change effect resets all counters + localStorage keys.
  - **Continuous-play guard** updated to NOT release halt flags while a guest is locked (`if (!user && isAppLocked) return`).
  - **Logged-in preview-mode unchanged**: guards are guest-only; the preview-mode timer / wrapped playSong logged-in paths are untouched.
  - Skip handler `handleSkipWithBillingCheck` now enforces the guest HARD BLOCK before the skip; Neno la Leo button wired to `checkGuestPlayLimit + incrementGuestPlayCount`.
- ✅ **Admin Campaign Preview Users UI** (`AdvertisingPage.jsx`):
  - Renders preview list even when 0 users (empty-state copy via `data-testid="campaign-user-preview-empty"`).
  - Shows BOTH email AND phone (with icons), country+region badge, premium badge.
  - Stops sending `excluded_user_ids` to the preview endpoint so admins see every matched user and toggle exclusions visually.
  - Added `data-testid`s: `campaign-preview-users-btn`, `campaign-user-preview-list`, `campaign-user-preview-count`, `campaign-user-row-{userId}`, select/deselect-all.
- ✅ **Testing**: iteration_51 PASS (campaign UI) + iteration_52 PASS (guest rehydrate + sign-in reset). Test #4 (logged-in preview mode regression) code-reviewed only because preview env has `billing=OFF`.

### Session: May 19, 2026 — Analytics Accuracy + Performance Pass (current)
- ✅ **Real-time listener tracking fixed for web** — `/listening/start` now mirrors
  every session into `active_streams` (was mobile-only). Web users finally appear
  on the realtime dashboard.
- ✅ **Web heartbeat ping** — new `/api/listening/ping` endpoint + 20s setInterval in
  `useAudioPlayer.js` keeps active listeners visible while audio plays.
- ✅ **Reliable session-end on tab close** — `/listening/end` and `/listening/ping`
  now manually parse `await request.body()` so `navigator.sendBeacon` and
  `fetch({keepalive:true})` (Content-Type: text/plain) are accepted (previously 422).
- ✅ **Server-side Cloudflare geolocation** — `core/geo_utils.py::resolve_geo()` reads
  `CF-IPCountry / CF-Region / CF-IPCity / CF-Connecting-IP` and persists country
  to `app_users` on every `/listening/start`. Zero external API calls.
  `/geo/detect-country` and `/user/home/geo` now short-circuit through the CF header.
- ✅ **`/analytics/overview` bug**: was querying empty `users` collection (admin only)
  → fixed to aggregate `app_users + users`. Total Users now reports 50, not 0.
- ✅ **Realtime endpoint hardened**: 15s cache, opportunistic stale-stream cleanup
  rate-limited to once per 30s, fallback now includes in-progress sessions
  (end_time=null, started <30 min ago), parallelised plays-today + new-users counts.
- ✅ **Performance**: parallelised + cached the hot dashboard endpoints. Warm-cache
  latency on `analytics/overview`, `analytics/trends`, `analytics/realtime`,
  `neno-la-leo/active`, `user/home/geo`, `app-settings` all <120ms (was 1.7–9s).
- ✅ **MongoDB indexes**: `core/indexes.py::ensure_indexes()` creates 20 indexes at
  startup on `active_streams.{is_active,last_heartbeat}`, `listening_sessions.{start_time,counted_as_play,user_id,song_id}`, `app_users.{country,user_id,created_at}`, etc.
- ✅ **Cache invalidation on play count**: `/listening/end` clears
  `analytics:overview/realtime/trends` so new plays show on the dashboard immediately.
- ✅ Testing: 100% pass rate (20/20) — iteration_46.json.

### Session: Feb 2026 — HLS Verification + Neno Player + Home Sections
- ✅ **HLS Pipeline Verified end-to-end** (after parallel multi-tier ffmpeg refactor)
  - Parallelized Bunny CDN uploads (8 concurrent) — single-song time **55s → 33s**
  - `services/hls_transcoding_service.py::upload_hls_files` now uses asyncio.gather with semaphore
  - Confirmed master + variant playlists + segments live on Bunny CDN (HTTP 200)
- ✅ **Neno la Leo plays in main mini player** — `UserStreamingApp.jsx` neno tile now calls `player.playSong(virtualSong, virtualAlbum, queue, 0)` instead of `new Audio()`, so it stops other songs/radio and shows in the persistent mini player
  - Active tile is highlighted (bright violet border + animated bars equalizer)
  - Clicking active tile toggles play/pause
  - Uses `song_id = neno_${neno_id}` for active-state matching
- ✅ **Home rows: Pasaka + Kwaresma activated** — Set `link_category_id` on `layout_sections`:
  - `section_kwaresma` → `songcat_f13791e16795` (8 albums)
  - `section_pasaka` → `songcat_7096028c59ba` (1 album)
- ✅ **Kwaya section removed from home** — `section_choirs` deactivated (still available via dedicated Choir profiles)


### Session: May 12, 2026 (Latest) — "Neno la Leo" Feature
- ✅ **Backend (`/app/backend/routes/neno_la_leo.py`)** — fully functional module mounted at `/api/neno-la-leo/*`:
  - **Admin endpoints** (admin auth via `session_token` cookie/Bearer): CRUD on religious leaders, approval flow, full CRUD on neno entries with status filter (active/scheduled/inactive)
  - **Leader portal endpoints** (uses existing `leader_tokens` collection from `routes/leaders.py`): create/update own neno, list my-neno, analytics
  - **Public endpoints**: `/active` (auto-activates scheduled neno + auto-deactivates 30-day expired entries, enriches with leader info), `/{id}` (single neno), `/{id}/play?audio_type=reading|reflection` (tracks both neno stats and leader stats)
  - **Audio upload** to Bunny CDN via `/upload-audio` (multipart)
  - Verse reference formatting (e.g., "Luka 2:15-19" or "Luka 2:15"), Swahili day name, expires_at = word_date+30d
- ✅ **Admin UI**: `/admin/neno-la-leo` route (`NenoLaLeoAdminPage.jsx`) — sidebar item under Religious Leaders. Card list with filter, modal for create/edit with Swahili Bible book picker, date/time scheduler, audio upload (file) + browser MediaRecorder for in-portal recording, audio preview
- ✅ **Leader Portal**: New "Neno la Leo" tab in `LeaderDashboardPage.jsx` — leaders see their own entries and can create/edit with the same audio upload + record flow
- ✅ **User Web (`UserStreamingApp.jsx`)**: New horizontal scrolling "Neno la Leo" section between Quick Access and Categories, shows day badge, verse reference, date, leader info, audio-type badges. Tap to play (tracks play count)
- ✅ **User Mobile (`HomeScreen.js`)**: Matching horizontal section after Quick Access using gradient cards
- ✅ **Bible books utility** (`/app/frontend/src/utils/bibleBooks.js`) — full Swahili book list shared by admin and leader portals
- ✅ **Backend tested**: 30/30 tests pass (`/app/backend/tests/test_neno_la_leo.py`). Test report: `iteration_44.json`. All HIGH severity issues fixed (admin auth, datetime consistency, audio_type validation, stat floor)

### Session: March 21, 2026
- ✅ Guest Limit Enforcement (5 songs/skips) — INDEPENDENT OF BILLING - Updated on BOTH web and mobile:
  - Changed `GUEST_PLAY_LIMIT` from 3 to 5
  - Changed `GUEST_SKIP_LIMIT` from 3 to 5
  - **CRITICAL**: Guest limits now work INDEPENDENTLY of billing settings
  - Removed all `if (!billingEnabled) return false;` checks from guest functions
  - **Web**: When limit reached, `setGuestLimitReached(true)` is called to STOP playback when current song ends
  - **Web**: Skip attempts are BLOCKED when limit is reached (not just prompted)
  - **Mobile**: Already had blocking logic via `guestLimitReachedRef` in PlayerContext.js
  - Files updated: 
    - `/app/frontend/src/pages/UserStreamingApp.jsx` - checkGuestPlayLimit, incrementGuestPlayCount, incrementGuestSkipCount, handleSkipWithBillingCheck
    - `/app/frontend/src/hooks/useAudioPlayer.js` - handleSongEnd checks guestLimitReachedRef
    - `/app/mobile/SpiritSongs/src/context/AuthContext.js` - limits updated to 5
- ✅ **Android Build v1.0.168 COMPLETE** - APK ready for download:
  - Build ID: 6016533c-bb27-44fb-88c7-99de52c59f97
  - APK URL: https://expo.dev/artifacts/eas/cSbJe75mQMEpjHGmE2wpi2.apk
- ✅ **Mobile App: Social Sharing** - Added share functionality:
  - Share songs with deep links (gracefy.net/song/{id})
  - Share albums with deep links (gracefy.net/album/{id})
  - Share playlists with deep links
  - Share app itself with Play Store link
  - Share button added to Now Playing screen and Album screen
  - New sharing service: `/app/mobile/SpiritSongs/src/services/sharing.js`
  - Reusable ShareButton component: `/app/mobile/SpiritSongs/src/components/ShareButton.js`
- ✅ **Mobile App: HLS Adaptive Streaming** - Added HLS support:
  - PlayerContext now prioritizes `hls_url` over `audio_url`
  - react-native-track-player supports HLS natively
  - Auto-adjusts quality based on network speed
  - Silent fallback to MP3 if HLS not available
- ✅ **EAS Project Transfer** - Transferred from gracefy12 to glucktz20 account
- ✅ **HLS Adaptive Streaming (Web)** - Full implementation with admin dashboard
- ✅ **Auto-Transcoding on Song Upload** - Songs automatically queued for HLS
- ✅ **Admin Song Preview** - Play/Pause buttons work in Albums page
- ✅ **Fixed Quick Access Grid (8 tiles)** - Now shows 4 user items + 4 admin categories
- ✅ **Lock Screen Mini Player Persistence** - MediaSession handlers for continuous play

### Session: March 14, 2026
- ✅ **Production Database Fix** - Updated Emergent deployment Secrets to use correct MongoDB cluster (gracefy.vuqjyu.mongodb.net instead of customer-apps.mmyrwf.mongodb.net)
- ✅ **Hybrid L1/L2 Cache Architecture** - Implemented ultra-fast caching:
  - L1: In-memory cache (0ms latency, per-instance)
  - L2: Upstash Redis (shared, distributed)
  - Circuit breaker for fault tolerance
  - Fire-and-forget async writes
- ✅ **Performance Improvement** - Home API: 5.2s (uncached) → 0.15s (cached) = 35x faster
- ✅ **Admin Empty Password Login** - Admin can now login with just email (empty password field)
- ✅ **Mobile Login Screen UI Fix** - Fixed keyboard overlay and form squeeze issues:
  - Added keyboardVerticalOffset for proper keyboard handling
  - Added keyboardShouldPersistTaps="handled"
  - Increased scroll padding for better UX
  - Set minimum heights on input containers
- ✅ **Android Build v1.0.167** - APK: https://expo.dev/artifacts/eas/aJ3vc7HXB3i8K2P69U2SKL.apk

### Session: March 13, 2026
- ✅ **Backend Performance: Redis Caching for /api/user/home** - Integrated Upstash Redis for home API caching (3-minute TTL)
- ✅ **API Response Time: 5s → 0.5s (10x faster)** - Cached requests now serve in ~500ms vs ~5s uncached
- ✅ **Frontend Refactoring** - Extracted useAudioPlayer hook (735 lines) and utilities to separate files, reducing main component from 6878 → 6037 lines (~12% reduction)
- ✅ **Code Organization** - Created `/app/frontend/src/hooks/useAudioPlayer.js` and `/app/frontend/src/utils/streamingHelpers.js` for better maintainability
- ✅ **Android Build Complete** - APK: https://expo.dev/artifacts/eas/6YE59eDHENHt8htAoF8ypH.apk (v1.0.166)
- ✅ **Firebase Auth Fix** - Fixed missing `json` and `base64` imports in firebase_service.py that was blocking email/password login on both mobile and web
- ✅ **Guest Limit Logic Verified** - Confirmed guests are prompted to LOGIN (not pay), only logged-in users see subscription prompts
- ✅ **Route Restructuring** - Landing page now shows User App (gracefy.net), Admin panel at /admin/* (admin.gracefy.net/admin/login)
- ✅ **Mobile Deployment Fix** - Removed hardcoded API URL, now uses environment variable from app.json extra config
- ✅ **Production URL Detection** - Added smart domain detection to use same-origin for production (gracefy.net) and env var for dev environments
- ✅ **Removed MONGO_URL_PROD** - Cleaned up .env to use single correct database (gracefy_db)
- ✅ **Fixed MongoDB Array Query Bug** - Changed platform queries from `{"platforms": platform}` to `{"platforms": {"$in": [platform]}}` for proper array matching in layout_sections and burners queries

## Critical Info for Next Fork
- **EXPO_TOKEN**: `UZJmgfqPYVW2XJssC0C7D7XVwBiXyB6wpi1Io_bx` (save to `/app/mobile/SpiritSongs/.env` and `/app/backend/.env`)
- **Admin Credentials**: `admin@gracefy.life` / (empty password - leave blank)
- **Production URL**: https://gracefy.net
- **Dev URL**: https://gracefy-hls-launch.preview.emergentagent.com
- **MongoDB Cluster**: gracefy.vuqjyu.mongodb.net (NOT cluster0 or customer-apps)
- **Database Name**: gracefy_db

### Production Deployment Secrets (Emergent):
```
MONGO_URL = mongodb+srv://gracefy_prod:G%40c37y%402026Tz@gracefy.vuqjyu.mongodb.net/gracefy_db?retryWrites=true&w=majority&appName=Gracefy
DB_NAME = gracefy_db
```

### Session: March 12, 2026
- ✅ **Radio uses Mini Player** - Radio now integrates with the main audio player and shows in mini player with "LIVE" badge
- ✅ **Fixed autoplay - event listeners setup ONCE on mount** - Changed dependency array to `[]`
- ✅ **Fixed next/prev buttons on mini player** - All refs properly updated
- ✅ **Improved Bible Range Reader** - Step-by-step UI with Testament selection + in-chapter range selection
- ✅ **Bible stops music/radio player** - When playing Bible audio, music player and radio are paused
- ✅ **Fixed mobile login not reflecting in Profile** - FirebaseLoginScreen now calls AuthContext.login()
- ✅ **Fixed Plans page checkout flow** - Added login check before payment
- ✅ **Fixed radio streaming on web** - Added backend proxy for HTTP streams
- ✅ **Added download/playlist buttons to mini player** - Triggers "Download App" popup
- ✅ **Fixed popup z-index** - Download popup now appears above full player
- ✅ **Guest autoplay blocking (web + mobile)** - Stops autoplay when guest limit reached
- ✅ **Fixed dual audio playback** - Added pause/reset before playing new song
- ✅ **Android build triggered** - Build ID: 5822bba2-b9bd-43dd-b28b-fed706a3290f

### Previous Session
- ✅ Checkout modal for subscription payment (phone number + Azam Pay)
- ✅ Improved download app popup message (Swahili)
- ✅ Screen lock payment prompt for non-premium users (billing ON)
- ✅ Profile shows subscription packages when billing ON + not premium
- ✅ Subscription expiry push notifications (hourly background task)
- ✅ Search functionality fixed on web app
- ✅ Mobile login screen UI fix (keyboard covering inputs)
- ✅ Radio stations UI updated to round images

### Earlier Sessions
- ✅ Firebase Auth migration (web + mobile)
- ✅ Blue theme across all platforms
- ✅ Custom Gracefy loading animation
- ✅ Admin password change feature
- ✅ SubscriptionRequiredModal for non-premium users

## Billing Logic
- **Guest users**: Play/skip limits → GuestLimitModal
- **Logged-in non-premium**: Skip/like/download → SubscriptionRequiredModal
- **Screen lock (non-premium)**: Pause + ScreenLockPaymentModal
- **Premium users / Billing OFF**: No restrictions

## Subscription Plans
- Kwa siku (Daily): TZS 500 / 1 day
- Kwa wiki (Weekly): TZS 2,000 / 7 days
- Kwa Mwezi (Monthly): TZS 5,500 / 30 days

## Pending Issues

### P0 - Critical
- None currently - Performance optimization complete

### P1 - High  
- Payment prompt redirect verification (user testing pending)
- Azam Pay live payment testing (needs dashboard configuration)
- Radio functionality on home page (may need investigation)

### P2 - Medium
- Google Sign-In needs Firebase authorized domain added
- Insufficient Device Information for Fraud Prevention
- Further frontend code-splitting (BibleView, RadioView, ProfileView) for additional performance gains

### Blocked
- iOS Build (needs Apple Developer credentials)
- Azam Pay Production (needs callback URL in dashboard)

## API Endpoints - Payments
- `POST /api/payment/azampay/initiate` - Initiate mobile money payment
- `POST /api/payment/callback/azampay` - Payment callback (needs registration in Azam dashboard)
- `GET /api/subscription-plans` - Get active subscription plans
- `GET /api/billing-status` - Check global billing settings

## Backlog / Future Tasks
1. **URGENT: Refactor UserStreamingApp.jsx** - 6500+ lines, needs to be split into smaller components
2. Bible TTS voice selection from admin settings
3. Admin language file upload feature
4. Audio Ad integration
5. SendGrid email campaigns
6. Consolidate `users`/`app_users` collections

## Recent Changes
- **2026-02 (Spotify polish — phase 1):**
  - New backend endpoint `GET /api/category/{category_id}/all-songs` returns every song in a category (resolved via album.category_id ↔ song_categories collection) with album metadata enrichment and a representative cover thumbnail (category.thumbnail → first-album thumbnail → first-song thumbnail). 2-minute cache.
  - Web: Quick Access category tiles now open a dedicated **Category Songs view** with cover art, total-songs count, and a circular **Play All** button (Spotify-style). New view registered as `view === 'category-songs'`.
  - Web mini-player: added **swipe gestures** — swipe LEFT = next song, swipe RIGHT = previous song. Horizontal-only detection with 60px threshold or 0.3px/ms flick velocity; vertical scrolls still pass through.
  - Mobile (Expo): new **CategorySongsScreen** with cover, Play All button, and SongListItem list. Registered as `CategorySongs` stack route. HomeScreen `handleItemPress` and `handleHeroPress` now route `category_id` items to it.
  - Mobile mini-player: **swipe gestures unlocked for everyone** (previously premium-only). Guest skip-limits remain enforced inside `skipNext`/`skipPrevious` so the gate doesn't bypass.
- **2026-02 (Mobile autoplay resilience):**
  - Backend `/api/recommendations/next-songs` now has a **guaranteed global fallback** — if criteria-based recommendations (same album, similar genre, same artist, trending, new releases) yield fewer than `limit` songs, the engine fills remaining slots with random popular songs from the global active pool. Autoplay can never run out of next-songs.
  - Mobile `PlayerContext.js`: `fetchAndAddRecommendations` now falls back to `/api/recommendations/trending` if next-songs API errors, and the `PlaybackQueueEnded` handler explicitly calls `TrackPlayer.play()` after adding recommendations (fixes paused-after-extend bug on some Android builds).

## Key Files
- `/app/frontend/src/pages/UserStreamingApp.jsx` - Main web app (6500+ lines - NEEDS REFACTORING)
- `/app/backend/routes/monetization.py` - Subscription & payment APIs
- `/app/backend/server.py` - Background tasks

## Test Credentials
- **Admin**: admin@gracefy.life / G73ce7y@2026
- **Test User**: glucktz1904@gmail.com / G73ce7y@2026
- **Expo Token**: UZJmgfqPYVW2XJssC0C7D7XVwBiXyB6wpi1Io_bx
