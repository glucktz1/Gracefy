# Gracefy - Christian Music Streaming Platform

## Original Problem Statement
Mobile and web app overhaul with Firebase integration, production payments (Azam Pay), database migration to MongoDB Atlas, and comprehensive bug fixes.

## Architecture
- **Frontend**: React (web), React Native/Expo (mobile)
- **Backend**: FastAPI with MongoDB Atlas
- **Auth**: Firebase (Email/Password, Google)
- **Payments**: Azam Pay (production)
- **CDN**: Bunny.net
- **Cache**: Upstash Redis

## What's Been Implemented

### Session: March 13, 2026 (Latest)
- ✅ **Backend Performance: Redis Caching for /api/user/home** - Integrated Upstash Redis for home API caching (3-minute TTL)
- ✅ **API Response Time: 4s → 0.4s (10x faster)** - Cached requests now serve in ~400ms vs ~4s uncached
- ✅ **Android Build Complete** - APK: https://expo.dev/artifacts/eas/bTeDTmDTaLrkQXqVAhWNqX.apk

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
- ⚠️ **Frontend Code-Splitting** - `UserStreamingApp.jsx` is 6800+ lines and needs to be split into smaller components using `React.lazy()` for better load times

### P1 - High  
- Payment prompt redirect verification (user testing pending)
- Azam Pay live payment testing (needs dashboard configuration)
- Radio functionality inconsistency on home page (reported by user)

### P2 - Medium
- Google Sign-In needs Firebase authorized domain added
- Insufficient Device Information for Fraud Prevention

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
