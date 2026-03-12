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
- ✅ Fixed billing status display - correctly shows "Bure" for non-premium users
- ✅ Fixed subscription status check to run immediately after login
- ✅ Added debug logging for continuous playback troubleshooting
- ✅ Fixed autoplay handling for browser policy compliance
- ✅ Added client-side caching (5-min TTL) for faster page loads
- ✅ Cached home data, categories, and billing status

### Previous Sessions
- ✅ Firebase Auth migration (web + mobile)
- ✅ Blue theme across all platforms
- ✅ Custom Gracefy loading animation
- ✅ Admin password change feature
- ✅ SubscriptionRequiredModal for non-premium users
- ✅ Billing triggers for skip/like/download actions

## Pending Issues

### P0 - Critical
- Android builds queued (v1.0.167 with debug logging)
- Google Sign-In needs Firebase authorized domain added

### P1 - High
- Azam Pay production payments failing (blocked on user confirming callback URL)
- Continuous playback needs user testing

### P2 - Medium
- Device information for fraud prevention (awaiting user clarification)

## Backlog / Future Tasks
1. Bible TTS voice selection from admin settings
2. Admin language file upload feature
3. Audio Ad integration
4. SendGrid email campaigns

## Technical Debt
- **CRITICAL**: `/app/frontend/src/pages/UserStreamingApp.jsx` is 6000+ lines
- Multiple user collections (`users`, `app_users`) should be consolidated

## Key Files
- `/app/frontend/src/pages/UserStreamingApp.jsx` - Main web app
- `/app/backend/routes/monetization.py` - Subscription status API
- `/app/mobile/SpiritSongs/` - React Native app

## Test Credentials
- **Admin**: admin@gracefy.life / G73ce7y@2026
- **Test User**: glucktz1904@gmail.com / G73ce7y@2026

## API Endpoints
- `/api/billing-status` - Returns billing_enabled, web_billing_enabled
- `/api/user/subscription-status?user_id=X` - Returns user's premium status
- `/api/user/home` - Home page data
