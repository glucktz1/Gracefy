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

### February 3, 2026 - Major Feature Redevelopment

#### Complete Redevelopment of Download, Like, and Playlist Features
As requested by the user, the previous buggy implementations were completely removed and rebuilt from scratch with a Spotify-like experience:

**1. New Download System (`DownloadContext.js`)**
- Real-time download progress tracking with visual progress rings
- Download queue management (max 2 concurrent downloads)
- Album/batch download capability (download entire album)
- Automatic file verification on app launch
- Proper file storage in app's document directory
- Download status indicators: QUEUED, DOWNLOADING, COMPLETED, FAILED
- Format file sizes for display

**2. New Song Actions UI (`SongActionsSheet.js`)**
- Spotify-style bottom sheet with smooth animations
- Like/Unlike songs with instant visual feedback
- Download with real-time progress indication
- Add to playlist flow with playlist picker
- Share functionality
- View album option

**3. Updated Library Screen (`LibraryScreen.js`)**
- Three tabs: Playlists, Liked Songs, Downloads
- Quick access cards for Liked Songs and Downloads
- Active download count badge on Downloads tab
- Download storage size display
- Create playlist modal with proper keyboard handling
- Playlist picker for adding songs

**4. Updated Album Screen (`AlbumScreen.js`)**
- Download entire album button
- Song actions sheet integration
- Create playlist from album

**5. Updated Song List Item (`Cards.js`)**
- Real-time download progress indicators
- Visual distinction for downloaded songs
- Queued state indication
- Mini progress ring component

#### Backend Improvements
- Updated `/api/library/likes` endpoint to return full song details (not just like references)
- Added album info enrichment for liked songs

### December 2025 - February 2026 (Previous Work)

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
- ✅ Comprehensive admin panel analytics

## Latest Changes
- **Date**: February 3, 2026
- **Files Modified**:
  - `/app/mobile/SpiritSongs/src/context/DownloadContext.js` - Complete rewrite
  - `/app/mobile/SpiritSongs/src/components/SongActionsSheet.js` - New file
  - `/app/mobile/SpiritSongs/src/screens/LibraryScreen.js` - Complete rewrite
  - `/app/mobile/SpiritSongs/src/screens/AlbumScreen.js` - Updated
  - `/app/mobile/SpiritSongs/src/components/Cards.js` - Updated with progress indicators
  - `/app/backend/routes/user_library.py` - Fixed likes endpoint, enhanced play tracking
  - `/app/mobile/SpiritSongs/src/context/PlayerContext.js` - Added proper play tracking with duration
  - `/app/mobile/SpiritSongs/src/services/api.js` - Updated playerAPI to include duration
  - `/app/backend/routes/admin.py` - Added comprehensive play stats endpoints

## Play Tracking & Revenue System

### How Play Counting Works
1. **Minimum Duration**: A play is only counted if the user listens for **45+ seconds**
2. **Automatic Tracking**: PlayerContext tracks playback duration and sends to backend at 45 seconds
3. **Revenue Calculation**: Based on monetization mode selected by admin

---

## Monetization System (3 Options)

### Option 1: Time-Based Earning
- **Formula**: `choir_earning = listening_hours × rate_per_hour`
- **Example**: 12 hours × TZS 10 = TZS 120 for the choir
- Revenue is calculated and credited **per play**
- Settings: `premium_rate_per_hour`, `standard_rate_per_hour`

### Option 2: Percentage-Based Earning
- **Formula**: `choir_earning = (choir_minutes / total_platform_minutes) × (total_revenue × choir_share%)`
- Revenue is calculated **periodically** (not per-play)
- Admin defines percentage split (e.g., 70% choir, 30% platform)
- Call `/api/revenue/calculate-choir-earnings` to calculate and distribute

### Option 3: Pay-Per-Content Bundle
- Admin creates content bundles (albums or songs)
- Users pay for specific bundles
- Revenue goes directly to content owner minus platform fee
- Can be enabled alongside Option 1 OR Option 2

### Compatibility Rules
- ✅ Option 1 + Option 3 (can be enabled together)
- ✅ Option 2 + Option 3 (can be enabled together)
- ❌ Option 1 + Option 2 (mutually exclusive)
- Option 3 can be disabled anytime

### Admin Endpoints
- `GET /api/revenue/settings` - Get monetization settings
- `POST /api/revenue/settings` - Update monetization settings
- `GET /api/admin/monetization-summary` - Full monetization dashboard
- `POST /api/revenue/calculate-choir-earnings` - Calculate choir earnings (for percentage-based)
- `GET /api/admin/content-bundles` - Get all bundles
- `POST /api/admin/content-bundles` - Create bundle
- `PUT /api/admin/content-bundles/{id}` - Update bundle
- `DELETE /api/admin/content-bundles/{id}` - Delete bundle
- `GET /api/content-bundles` - Public bundles list (for app)
- `POST /api/content-bundles/{id}/purchase` - Purchase a bundle
- `GET /api/user/purchased-bundles` - User's purchased bundles
- `GET /api/content/{type}/{id}/access` - Check content access

## Known Issues / Blockers

### P2 - Medium Priority
1. **Hero section images** - Placeholder gradient shown (blocked until proper image URL system implemented)
2. **Some albums may not show songs** - Needs verification in new build

## Prioritized Backlog

### P0 - Critical
- Build new APK and test the redeveloped features (downloads, likes, playlists)

### P1 - High Priority
- Verify all redeveloped features work correctly in production build
- Test offline playback with downloaded songs
- Test album download functionality

### P2 - Medium Priority
- Implement proper image upload/CDN pipeline for hero images
- Add offline mode for Bible reading
- App startup performance optimization

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
- `/app/backend/routes/user_library.py` - Library/likes/playlists API
- `/app/mobile/SpiritSongs/App.js` - Main app entry
- `/app/mobile/SpiritSongs/src/screens/` - All screen components
- `/app/mobile/SpiritSongs/src/context/DownloadContext.js` - Download management
- `/app/mobile/SpiritSongs/src/components/SongActionsSheet.js` - Song actions UI

## 3rd Party Integrations
- Expo (EAS Build) - App building and distribution
- MongoDB - Primary database
- Bunny CDN - Media file storage
- OpenAI TTS - Bible text-to-speech
- AzamPay - Payment processing (Tanzania)

## API Endpoints

### Library APIs
- `GET /api/library/likes` - Get liked songs with full details
- `POST /api/library/like/{song_id}` - Like a song
- `DELETE /api/library/like/{song_id}` - Unlike a song
- `GET /api/library/playlists` - Get user playlists
- `POST /api/library/playlists` - Create playlist
- `POST /api/library/playlists/{id}/songs/{song_id}` - Add song to playlist
- `DELETE /api/library/playlists/{id}/songs/{song_id}` - Remove song from playlist
- `GET /api/songs/{song_id}/download` - Get download URL for song
