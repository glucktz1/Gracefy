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

### Session: April 2, 2026 (Latest)
- ✅ **HLS Transcoding Status Display** - Fixed backend to return `hls_status` and `hls_url` in song listings:
  - Updated `SONG_LIST_PROJECTION` in `/app/backend/routes/music.py` to include `hls_status` and `hls_url` fields
  - GET /api/songs now returns: `hls_status: "completed"` and `hls_url: "https://gracefy-cdn.b-cdn.net/hls/..."`
  - Admin can now see HLS transcoding status (ongoing/failed/completed) for each song

- ✅ **Analytics Crash Fix** - Fixed `TypeError: unhashable type: 'dict'` in analytics endpoints:
  - `/app/backend/routes/analytics.py` - Updated `get_user_demographics()` and `get_device_distribution()` 
  - Now handles dict-type location values gracefully by converting to string before using as dict key
  - Both endpoints now return 200 OK with proper location distribution data

- ✅ **Mobile Playlist Authentication Fix** - Improved auth token handling for playlist operations:
  - Added `makeAuthenticatedRequest()` helper function in `/app/mobile/SpiritSongs/src/services/api.js`
  - This explicitly fetches and attaches auth token before critical API calls
  - Updated `libraryAPI` to use this helper for: `getPlaylists`, `createPlaylist`, `deletePlaylist`, `addToPlaylist`, `removeFromPlaylist`
  - Updated fallback API URL to production (`https://gracefy.net`)

- ✅ **Android Build v1.0.182 Triggered** - Build ID: `4693ea34-f2e4-4066-acb4-4bc6633b2ef8`

### Session: March 24, 2026
- ✅ **Neno la Leo (Today's Word) Feature - COMPLETE**:
  - **Backend APIs** (`/app/backend/routes/neno_la_leo.py`):
    - Admin CRUD for leaders and Neno entries
    - Leader portal authentication and content management
    - Public API for active entries (`/api/neno-la-leo/active`)
    - Play tracking (`/api/neno-la-leo/play`)
  - **Admin UI** (`/app/frontend/src/pages/NenoLaLeoPage.jsx`):
    - Stats dashboard (Total Entries, Active, Leaders, Pending)
    - Tabbed interface (Content, Leaders, Pending approvals)
    - Create/Edit Neno entries with Bible book selector
    - Audio recording and upload functionality
    - Leader management with temporary password generation
  - **Leader Portal** (`/app/frontend/src/pages/LeaderDashboardPage.jsx`):
    - Dedicated login at `/leader/login`
    - Dashboard with stats and recent entries
    - Create/Edit Neno entries with audio recording
    - Analytics view (total plays, reading/reflection counts)
  - **User App (Web)** - NenoLaLeoSection in `UserStreamingApp.jsx`:
    - Horizontal scrollable cards with gradient backgrounds
    - Shows verse reference, leader name, date
    - "Kusoma" (Reading) and "Tafakari" (Reflection) play buttons
    - "Inakuja Hivi Karibuni" (Coming Soon) for entries without audio
  - **Mobile App** - NenoLaLeoSection in `HomeScreen.js`:
    - Matching design with gradient cards
    - Integrated with player context for audio playback
    - Play tracking API calls
  - **Testing**: 100% pass rate (20/20 backend tests, all frontend features verified)

### Session: March 21, 2026
- ✅ **Guest Limit Enforcement (5 songs/skips) - INDEPENDENT OF BILLING** - Updated on BOTH web and mobile:
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
- **Dev URL**: https://neno-la-leo.preview.emergentagent.com
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
2. **P0: Fix Playlist Creation Bug** - Mobile app sends requests without Auth header
3. Bible TTS voice selection from admin settings
4. Admin language file upload feature
5. Audio Ad integration
6. SendGrid email campaigns
7. Consolidate `users`/`app_users` collections
8. Publish app to stores (generate AAB build for Google Play)
9. Start HLS transcoding batch process
10. Authorize `gracefy.net` in Firebase for production Google OAuth

## Key Files
- `/app/frontend/src/pages/UserStreamingApp.jsx` - Main web app (6500+ lines - NEEDS REFACTORING)
- `/app/backend/routes/monetization.py` - Subscription & payment APIs
- `/app/backend/server.py` - Background tasks

## Test Credentials
- **Admin**: admin@gracefy.life / G73ce7y@2026
- **Test User**: glucktz1904@gmail.com / G73ce7y@2026
- **Expo Token**: UZJmgfqPYVW2XJssC0C7D7XVwBiXyB6wpi1Io_bx
