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

### Session: Feb 22, 2026 — Guest HARD BLOCK + Campaign Preview UI Fix
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

## Key Files
- `/app/frontend/src/pages/UserStreamingApp.jsx` - Main web app (6500+ lines - NEEDS REFACTORING)
- `/app/backend/routes/monetization.py` - Subscription & payment APIs
- `/app/backend/server.py` - Background tasks

## Test Credentials
- **Admin**: admin@gracefy.life / G73ce7y@2026
- **Test User**: glucktz1904@gmail.com / G73ce7y@2026
- **Expo Token**: UZJmgfqPYVW2XJssC0C7D7XVwBiXyB6wpi1Io_bx
