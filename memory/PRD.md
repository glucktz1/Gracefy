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

### Session: March 11, 2026
- ✅ Added SubscriptionRequiredModal for logged-in non-premium users
- ✅ Fixed guest skip limit enforcement (incrementGuestSkipCount now called)
- ✅ Fixed billing triggers for like/download/playlist actions
- ✅ Fixed /api/user/subscription-status to query both users and app_users collections
- ✅ Billing API confirmed working: billing_enabled=true, web_billing_enabled=true

### Previous Sessions
- ✅ Firebase Auth migration (web + mobile)
- ✅ Blue theme across all platforms
- ✅ Custom Gracefy loading animation
- ✅ Admin password change feature (Security Settings)
- ✅ Removed "Made with Emergent" branding
- ✅ Updated native app icon
- ✅ Corrected Google login flow in native app

## Pending Issues (P0-P2)

### P0 - Critical
- Android builds v1.0.165 & v1.0.166 queued in Expo (check status)

### P1 - High
- Azam Pay production payments failing (blocked on user confirming callback URL)

### P2 - Medium  
- Device information for fraud prevention (awaiting user clarification)

### P3 - Low
- iOS build failure (needs Apple Developer credentials)

## Backlog / Future Tasks
1. Bible TTS voice selection from admin settings
2. Admin language file upload feature
3. Audio Ad integration
4. SendGrid email campaigns

## Technical Debt
- **CRITICAL**: `/app/frontend/src/pages/UserStreamingApp.jsx` is 6000+ lines and needs modularization
- Multiple user collections (`users`, `app_users`) should be consolidated

## Key Files
- `/app/frontend/src/pages/UserStreamingApp.jsx` - Main web app (billing logic at lines ~4490-4525)
- `/app/backend/routes/monetization.py` - Subscription status API
- `/app/mobile/SpiritSongs/` - React Native app

## Test Credentials
- **Admin**: admin@gracefy.life / G73ce7y@2026
- **Test User**: glucktz1904@gmail.com / G73ce7y@2026
