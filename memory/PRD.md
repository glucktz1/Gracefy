# SpiritSongs/Gracefy Mobile App - Product Requirements Document

## Original Problem Statement
Build and maintain a React Native mobile application (SpiritSongs/Gracefy) with a Python/FastAPI backend and MongoDB database. The app is a religious music streaming platform with features including:
- Music streaming and downloads
- Bible reading with TTS (Text-to-Speech)
- Religious teachings (Mafundisho na Katekesi)
- Church management
- User subscriptions and monetization
- Admin panel with comprehensive analytics

## What's Been Implemented

### December 2025 - February 2026

#### Core Features
- ✅ Music streaming with player controls
- ✅ Album and playlist management
- ✅ Search functionality
- ✅ User authentication (email/phone, Google OAuth)
- ✅ Library management (likes, playlists, downloads)
- ✅ Bible reading with Swahili translation
- ✅ Bible TTS (Text-to-Speech) generation and caching
- ✅ Religious teachings (Mafundisho) with audio lessons
- ✅ Church directory
- ✅ Subscription/billing system with AzamPay
- ✅ Error Boundaries for crash prevention

### Fixes Applied (February 2, 2026)

#### Mobile App Fixes (Build v1.0.76)
1. **Bible Section** - Fixed API endpoint to return chapters as array instead of count
2. **Mafundisho na Katekesi** - Fixed data structure conversion (topics/lessons to series/episodes)
3. **App Crashes** - Fixed React hooks ordering violation in AlbumScreen.js (hooks must be called unconditionally)
4. **ErrorBoundary** - Moved wrapper components outside TabNavigator to prevent recreation on every render
5. **expo-file-system** - Removed `/legacy` import which was causing compatibility issues

#### Admin Panel Backend Fixes
1. **Transactions Management** - Added complete transaction management endpoints:
   - `GET /api/admin/transactions` - List with filtering
   - `GET /api/admin/transactions/{id}` - Transaction details
   - `POST /api/admin/transactions/{id}/refund` - Process refunds
   - `GET /api/admin/transactions/export` - Export as CSV/JSON
   - `GET /api/admin/payment/gateways` - List payment gateways

2. **Analytics Enhancement** - Added comprehensive analytics endpoints:
   - `GET /api/analytics/enhanced` - Dashboard analytics with trends
   - `GET /api/analytics/realtime` - Real-time streaming stats
   - `GET /api/analytics/revenue-breakdown` - Revenue by plan/method
   - `GET /api/analytics/content-revenue/{type}` - Per-content revenue
   - `GET /api/admin/analytics/navigation` - Page view analytics

3. **User Management Enhancement** - Enhanced user detail endpoint with:
   - Listening history (`GET /api/admin/users/{id}/listening-history`)
   - Transaction history (`GET /api/admin/users/{id}/transactions`)
   - User playlists (`GET /api/admin/users/{id}/playlists`)
   - Liked songs (`GET /api/admin/users/{id}/liked-songs`)
   - Analytics summary in user detail

4. **Revenue Admin** - Added revenue management endpoints:
   - `GET /api/revenue/admin/overview` - Revenue overview
   - `GET /api/revenue/admin/daily` - Daily revenue trend
   - `GET /api/revenue/admin/choirs` - Choir earnings
   - `GET /api/revenue/settings` - Revenue sharing settings
   - `POST /api/demo/generate-listening-data` - Demo data generator

5. **Settings & Translations** - Added missing endpoints:
   - `GET /api/admin/translations/languages` - Translation stats
   - `GET /api/admin/translations/download` - Download translations
   - `GET /api/translations` - Public translations endpoint
   - `PUT /api/admin/translations/{lang}` - Update translations

## Latest Build
- **Version**: 1.0.76 (Build 76)
- **APK**: https://expo.dev/artifacts/eas/77HeRsagQeoYF2kCkJBT14.apk

## Known Issues / Blockers

### P2 - Medium Priority
1. **Hero section images** - Placeholder gradient shown (blocked until proper image URL system implemented)

## Prioritized Backlog

### P0 - Critical
- None currently

### P1 - High Priority
- Test and verify Bible & Mafundisho sections work in new build
- Test Library, Search, Playlist screens for crashes

### P2 - Medium Priority
- Implement proper image upload/CDN pipeline for hero images
- Add offline mode for Bible reading

### P3 - Future
- Push notifications
- Social features (sharing, comments)
- Audio quality settings

## Architecture

### Frontend (Mobile)
- React Native with Expo (SDK 54)
- State management: React Context
- Navigation: React Navigation v7
- UI: Custom components with theme system

### Backend
- Python FastAPI
- MongoDB database
- Redis caching (optional)
- Bunny CDN for media files

### Admin Panel (Web)
- React with Vite
- Shadcn/UI components
- Tailwind CSS

### Key Files
- `/app/backend/routes/admin.py` - Admin panel endpoints
- `/app/backend/routes/analytics.py` - Analytics endpoints
- `/app/backend/routes/monetization.py` - Revenue/billing endpoints
- `/app/backend/routes/bible.py` - Bible API endpoints
- `/app/mobile/SpiritSongs/App.js` - Main app entry
- `/app/mobile/SpiritSongs/src/screens/` - All screen components

## 3rd Party Integrations
- Expo (EAS Build) - App building and distribution
- MongoDB - Primary database
- Bunny CDN - Media file storage
- OpenAI TTS - Bible text-to-speech
- AzamPay - Payment processing (Tanzania)
