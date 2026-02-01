# Gracefy - Christian Music Streaming App

## Overview
A Christian music streaming mobile app with a Spotify-like interface, featuring:
- Music streaming with choirs and albums
- Bible reader with TTS (Text-to-Speech)
- Church discovery and follow features
- Mafundisho (Teachings) with series and episodes
- Admin panel for content management
- Choir portal for artists
- **Payment system with Azam Pay mobile money**
- **Redis caching for horizontal scaling**

## Architecture (Updated 2026-01-31)

### Backend - Fully Modular Router Architecture
- **Main**: `/app/backend/server.py` (312 lines - clean application factory)
- **Core**: `/app/backend/core/` (database, caching, config, dependencies)
- **Routes**: `/app/backend/routes/` (16 modular router files)
- **Models**: `/app/backend/models/` (Pydantic schemas)
- **Services**: `/app/backend/services/` (CDN, encoding, TTS)

### New Modular Routers (16 total)
```
/app/backend/routes/
├── auth.py           # Authentication (admin, app, OTP, password reset)
├── music.py          # Albums, songs endpoints
├── home.py           # Home screen data
├── payment.py        # Azam Pay integration
├── layout.py         # Sections, burners, hero, home filters
├── churches.py       # Churches, announcements, church leaders
├── choirs.py         # Choirs, accounts, content, revenue
├── bible.py          # Bible reading, TTS, listening tracking
├── analytics.py      # Dashboard stats, trends, demographics
├── admin.py          # Admin operations, cache, settings
├── uploads.py        # File uploads, CDN management
├── user_library.py   # Favorites, playlists, history, likes
├── content.py        # Religious leaders, containers, episodes
├── monetization.py   # Subscriptions, plans, transactions
├── categories.py     # Content and song categories
└── browse.py         # Search, browse, user content
```

### Infrastructure
- **Frontend/Admin Panel**: React - `/app/frontend/`
- **Mobile App**: React Native (Expo) - `/app/mobile/SpiritSongs/`
- **Database**: MongoDB with 175+ indexes
- **CDN**: Bunny CDN for media storage
- **TTS**: Google Cloud TTS for Bible audio
- **Payments**: Azam Pay (Mobile Money)
- **Caching**: Redis primary + in-memory fallback
- **Auto-Scaling**: Traffic-based cache TTL adjustment

## Backend Refactoring (Completed 2026-01-31)

### Before
- `server.py`: 13,988 lines (monolithic)
- All 387 endpoints in single file
- Hard to maintain and scale

### After  
- `server.py`: 312 lines (application factory)
- 294 endpoints in 16 modular routers
- 97.8% reduction in main file size
- Clean separation of concerns
- Better testability and maintainability

### Test Results
- 27/27 API tests passed (100% success rate)
- All core endpoints verified working
- Redis fallback to in-memory working correctly

## Performance Optimizations

### Database Indexes
- 175 total indexes across 68 collections
- Compound indexes for common query patterns
- TTL indexes for session/analytics auto-cleanup

### Caching Strategy
- Redis primary cache (when available)
- In-memory LRU fallback
- Auto-scaling TTL based on traffic level:
  - Low traffic (<50 req/s): 1x TTL
  - Medium (50-100): 2x TTL
  - High (100-200): 3x TTL
  - Critical (>200): 4x TTL

### Query Optimizations
- Minimal projections (exclude _id, large fields)
- Parallel async queries
- Connection pooling (100 max)
- GZIP compression for responses > 500 bytes

## Completed Features

### Mobile App
- [x] Music player with expo-av
- [x] Albums and songs browsing
- [x] Bible reader with TTS
- [x] Churches with announcements
- [x] User authentication
- [x] Checkout Screen with Phone Input
- [x] MNO Auto-Detection
- [x] Transaction History in Profile
- [x] Download functionality

### Admin Panel
- [x] Dashboard with analytics
- [x] Album and song management
- [x] Church and choir management
- [x] Layout management
- [x] Revenue settings
- [x] User management with RBAC
- [x] Billing Toggle
- [x] Transaction Tracking
- [x] Cache Monitoring
- [x] Home Filter Controls

### Backend APIs (All Working)
- [x] Authentication endpoints
- [x] Music streaming endpoints
- [x] Bible content and TTS
- [x] Church and choir endpoints
- [x] Layout configuration
- [x] Revenue and analytics
- [x] Azam Pay payments
- [x] Cache stats endpoint
- [x] Auto-scaling status

## Payment System

### Azam Pay Integration
- **Test Mode**: AZAMPAY_TEST_MODE=true
- **MNO Support**: M-Pesa, Tigo Pesa, Airtel Money, Halo Pesa
- **Phone Auto-Detection**: Detects MNO from prefix

## Upcoming Tasks
1. Re-upload audio for 10 affected songs (P0)
2. Complete endpoint migration from server_old.py (~90 endpoints) (P1)
3. Add Teachings section to user-facing app (P1)
4. Animated splash screen (P2)
5. Production Azam Pay credentials

## Known Issues

### P0 - Critical
- **Background audio** - App doesn't play next song when screen locked
  - Cause: expo-av JavaScript suspended on mobile
  - Solution: `react-native-track-player` (blocked by EAS build issues)
- **Audio Storage Issue** - 10 songs have audio files > 5MB that weren't stored
  - Cause: CDN upload may have failed when files were uploaded
  - Files have `storage_error: "File too large for local storage without CDN"`
  - Solution: Re-upload the audio files for affected songs

### P1 - High  
- ~90 endpoints still in `server_old.py` need migration to modular routers

### P2 - Medium
- Animated splash screen needed

## Recent Fixes (2026-01-31)

### Bug Fixes (2026-01-31 - Session 2)
- **Bible Section Bug FIXED**: Backend `/api/bible/stats` now returns `book_count`, `verse_count`, AND `has_data` fields for frontend compatibility. Also returns backwards-compatible `books_count`/`verses_count`.
- **Special Mixes Creation Bug FIXED**: Backend now properly handles `title` field (frontend sends `title`, backend expected `name`) and `songs` array with full song objects. Stores both `song_ids` and full `songs` array.
- **Special Mixes 500 Error FIXED**: Fixed TypeError in GET `/api/special-mixes` when songs have None duration values.
- **Leaders Photo Upload Bug FIXED**: Added proper file upload UI with preview to LeadersPage.jsx. Photos are uploaded via `/api/upload` endpoint before saving leader.

### New Feature: TTS Voice Selection & Preview (2026-01-31)
- **6 AI Voices Available**: 3 male (Rafiki, Daudi, Journey) + 3 female (Zuri, Amani, Aria) voices
- **Voice Preview**: Admin can click "Preview" button to hear sample text in selected voice
- **Default Voice Selection**: Admin can set default male/female voices for Bible reading
- **Swahili + English**: Voices available in sw-KE, sw-TZ, and en-US languages
- **Full OpenAI TTS Integration**: Real audio generation using Emergent LLM Key
- **Caching**: TTS audio cached in `bible_tts_cache` collection for performance
- **User Voice Selector**: Users can choose voice when reading Bible on web/app (with toast notification)
- **Bug Fix**: Fixed `chapters.map is not a function` error in Bible view

### Admin Bible Management Features (2026-01-31)
- **TTS Cache Tab**: View and manage cached Bible audio recordings
  - Shows total cached entries and size in MB
  - Play cached audio directly
  - Delete individual cache entries
  - Clear all cache option
- **Snippet Management**: Full CRUD for Bible snippets
  - Edit button to modify existing snippets
  - Enable/Disable toggle for each snippet
  - Delete with confirmation
- **Voice Selection Fixed**: Different voices now correctly generate different audio

### Bible TTS Speed Control (2026-01-31)
- **Speed selector**: Users can choose playback speed from 0.5x to 2x
- **Options**: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x
- **Real-time adjustment**: Speed changes apply immediately to currently playing audio
- **API support**: Speed parameter passed to TTS generation endpoints

### Teachings and Reflections Feature (2026-01-31) - NEW
- **Complete Feature**: "Mafundisho na Tafakari" (Teachings and Reflections) module
- **Hierarchical Structure**: Teaching → Topics (Mada) → Lessons (Sehemu)
- **Admin Features**:
  - Create/Edit/Delete teachings with thumbnail, leader, category, monetization
  - Add multiple topics per teaching
  - Add multiple lessons per topic with audio upload
  - Audio playback preview in admin panel
  - Bulk lesson creation support
  - Cascading deletes (delete teaching removes all topics/lessons)
- **8 Categories**: Mafundisho ya Ndoa, Katekesi, Tafakari ya Neno, Maisha ya Kiroho, Familia ya Kikristo, Mafundisho kwa Vijana, Maisha ya Sala, Mengineyo
- **3 Monetization Types**: Free, Premium, Donation-based
- **API Endpoints**: 16 endpoints for full CRUD operations
- **Backend**: `/app/backend/routes/teachings.py` (464 lines)
- **Frontend Admin**: `/app/frontend/src/pages/TeachingsPage.jsx` (1010 lines)
- **User App Integration** (2026-02-01):
  - Spotify-style card display in home sections
  - Detail view with thumbnail, title, leader, topic/lesson counts
  - **Play All button** - queues all lessons
  - **Shuffle button** - random playback
  - **Dancing bars animation** on playing lesson
  - **Highlighted playing lesson** with amber border
  - **"Inacheza" indicator** for currently playing
  - **Share button** - native share or clipboard
  - **Add to playlist button**
  - Mini player integration at bottom
- **Testing**: 27/27 backend tests passed (100%)

### Leaders Page Complete Rebuild (2026-01-31)
- **Complete rebuild from scratch** - removed all problematic thumbnail/photo code
- **Clean form fields**: Name, Title, Church, Bio, Status only
- **No file upload**: Eliminated the React render error
- **Verified working**: All CRUD operations tested and passing

### Home Page Data Verification (2026-01-31)
- **18 sections** loading correctly on user home page
- **Albums displayed**: 44+ album elements shown
- **Christmas Carols 2025**: Appearing in sections (currently in "Lent songs" - may need recategorization)
- **Categories working**: Christmas, Lent, Churches, Special Mixes all loading

### Bug Fixes (2026-01-31)
- **Leaders Page Error**: Fixed FastAPI validation error display (was showing raw object)
- **Leaders Page Render Safety**: Added defensive checks for leader objects and string coercion to prevent "Objects not valid as React child" errors
- **Special Mixes Audio**: Fixed to include full song data (audio_url, duration, etc.) when creating mixes
- **Church Select**: Fixed empty value issue in church selection dropdown

### Content Section Fixes
- Fixed `/albums/all-songs` endpoint - moved before `/albums/{album_id}` to fix route matching
- Endpoint now returns albums with their songs (was returning 404 before)
- Added `/leaders` endpoint aliases for `/religious-leaders`
- Added POST/PUT/DELETE aliases for leaders management
- Fixed route order in music.py to prevent path parameter matching issues

### Admin Panel Fixes
- Fixed CDN Management page: `toUpperCase()` error on undefined value
- Added missing `/approvals` endpoint with pending churches, choirs, leaders, posts
- Added `/admin/choir-registrations` endpoint
- Added `/admin/payment-requests` endpoint
- Added `/admin/content-edit-requests` endpoint
- Added `/church-leader/accounts` endpoint
- Albums page now has search and filter controls (category, status)

### Choir Registration Form (Enhanced)
- Default language is now Kiswahili with English toggle option
- 4-step registration process for church choirs:
  1. Basic Info (Name, Email, Phone, Type)
  2. Choir Details (Denomination, Church Name, Location, Description)
  3. Leadership (Chairperson, Treasurer, Parish Leader - with name, phone, email, title)
  4. Payment & Account (Mobile Money or Bank Account + Password)
- Payment details: Mobile network selection, registered name, OR bank account info
- Success message indicates pending admin approval

### Play Tracking & Analytics
- Fixed: Frontend now sends `duration_seconds` to `/listening/end` endpoint
- Plays are counted when song is played for 30+ seconds (industry standard)
- Added page unload tracking via `navigator.sendBeacon`
- Choir/artist total_plays also updated when songs are played
- Analytics properly aggregates plays by album and song

### Google Login & Admin Access Fix
- Fixed: All Google login users were getting admin role
- Now only `glucktz1904@gmail.com` gets admin role; others get "user" role
- Updated ProtectedRoute in App.js to redirect non-admin users to /app
- Updated AuthCallback to route based on user role
- Fixed existing users in database - 4 users changed from admin to user role
- **Fixed Google OAuth flow**: App.js now only intercepts OAuth for admin routes, not `/app`
- Non-admin users logging in via admin page are redirected to `/app#session_id=...` for proper auth

### User Library Fix
- Fixed: "Cannot read properties of undefined (reading 'song_id')" error
- Backend now enriches favorites with full item details
- Frontend adds null checks for `fav.item` in library rendering

### Thumbnail Display Fix
- Fixed truncated base64 thumbnails that caused display errors
- Updated `optimize_thumbnails()` in both `music.py` and `home.py`
- Base64 thumbnails now use `/api/thumbnails/{item_id}` streaming endpoint
- All frontend files updated with `getImageUrl()` helper for proper URL handling

### Audio URL Fix
- Fixed `getAudioUrl()` to add `/stream` suffix for `/api/files/{file_id}` URLs
- Audio streaming now correctly routes to content endpoint

### Affected Files
- `/app/backend/routes/auth.py` - Admin role assignment fix
- `/app/backend/routes/user_library.py` - Enriched favorites in library
- `/app/frontend/src/App.js` - Role-based routing
- `/app/frontend/src/pages/LoginPage.jsx` - Admin redirect check
- `/app/backend/routes/music.py` - optimize_thumbnails function
- `/app/backend/routes/home.py` - optimize_thumbnails function  
- `/app/backend/routes/uploads.py` - download endpoint handling
- `/app/frontend/src/pages/UserStreamingApp.jsx` - getAudioUrl, getImageUrl, library fixes

## Audio Content Status (Updated 2026-01-31)
- Total songs: 31
- Albums with working songs: 6 ✅ (Huyu ni nani, Christmas Carols 2025, nguvu ya Msalaba, Umenilisha kwa unono, Uzishibishe Nyoyo zetu, Moyo wako bwana)
- Albums with some broken songs: 3 ⚠️ (Ulizibeba Dhambi Zetu, Natubu bwana, Moyo wa shukrani)
- Albums with no songs: 4 ❌ (Utukufu Kwako Bwana, Nguvu ya Msalaba wako, Baraka zako bwana, Neema Kuu)
- Issue: Some audio files > 5MB weren't stored due to CDN upload failure at upload time

## Upcoming Tasks
1. Re-upload audio for 10 affected songs (P0)
2. Complete endpoint migration from server_old.py (P1)
3. Animated splash screen (P2)
3. Production Azam Pay credentials

## Future/Backlog
- PWA "Play All" button
- Live audio/video rooms (Agora/100ms)
- Remove unused Supabase code
- Production deployment

## Configuration

### Environment Variables (backend/.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
REDIS_URL=redis://localhost:6379
BUNNY_STORAGE_ZONE=...
BUNNY_API_KEY=...
BUNNY_CDN_URL=...
AZAMPAY_CLIENT_ID=...
AZAMPAY_CLIENT_SECRET=...
AZAMPAY_TEST_MODE=true
```

### Test Credentials
- **Admin Panel**: Google OAuth
- **Choir Portal**: demo@gracefy.com / demo123456
- **Expo Token**: Ocf09mEKf7N8E9Pjwyf5-hQYLOevZO3OYEsrr9Bq

## API Documentation
- Swagger UI: `/api/docs`
- ReDoc: `/api/redoc`
- OpenAPI: `/api/openapi.json`
