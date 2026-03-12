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

### Session: March 12, 2026
- ✅ Profile shows subscription packages when billing ON + not premium
  - "Chagua Kifurushi Chako" / "Ufurahie maudhui yote kwa uhuru"
  - Daily (TZS 500), Weekly (TZS 2,000), Monthly (TZS 5,500)
- ✅ Subscription expiry push notifications
  - Background task runs hourly
  - Message: "Kifurushi chako kimeisha muda wake. Jiunge tena uendelee kufurahia"
  - Supports FCM and Expo push tokens
- ✅ Fixed billing status display ("Bure" for non-premium)
- ✅ Added continuous playback debug logging
- ✅ Page caching for faster loads (5-min TTL)

### Previous Sessions
- ✅ Firebase Auth migration (web + mobile)
- ✅ Blue theme across all platforms
- ✅ Custom Gracefy loading animation
- ✅ Admin password change feature
- ✅ SubscriptionRequiredModal for non-premium users

## Pending Issues

### P0 - Critical
- Google Sign-In needs Firebase authorized domain added

### P1 - High
- Azam Pay production payments failing (blocked on user confirming callback URL)
- Continuous playback needs user testing

### P2 - Medium
- Android app not loading data (debugging build queued)

## API Endpoints - Subscription
- `GET /api/subscription-plans` - Get active subscription plans
- `GET /api/user/subscription-status?user_id=X` - User's premium status
- `POST /api/admin/send-expiry-notifications` - Trigger expiry notifications
- `GET /api/admin/check-expiring-subscriptions` - View expiring/expired subs

## Backlog / Future Tasks
1. Bible TTS voice selection from admin settings
2. Admin language file upload feature
3. Audio Ad integration
4. SendGrid email campaigns

## Technical Debt
- **CRITICAL**: `/app/frontend/src/pages/UserStreamingApp.jsx` is 6000+ lines

## Key Files
- `/app/frontend/src/pages/UserStreamingApp.jsx` - Main web app (ProfileView with packages)
- `/app/backend/routes/monetization.py` - Subscription plans and expiry notifications
- `/app/backend/server.py` - Background task for expiry check

## Test Credentials
- **Admin**: admin@gracefy.life / G73ce7y@2026
- **Test User**: glucktz1904@gmail.com / G73ce7y@2026
