# Gracefy - Christian Music Streaming App

## Product Overview
Gracefy is a comprehensive Christian music streaming platform with:
- **Mobile App**: React Native (Expo) for Android/iOS
- **Web PWA**: React-based progressive web app for streaming
- **Admin Panel**: React admin dashboard for content management
- **Backend**: FastAPI (Python) with MongoDB

## Brand Identity
- **App Name**: Gracefy
- **Primary Color**: #3498DB (Blue)
- **Secondary Color**: #1A295E (Dark Blue)
- **Background**: #0A0A1A (Dark with blue tint)
- **Default Language**: Kiswahili (with English option)

## Latest Updates (Jan 20, 2026)

### 🐰 Bunny CDN Integration (NEW)
Implemented Bunny CDN for fast global media delivery:

**Features:**
- **Automatic CDN Upload**: All audio/image uploads now go to Bunny CDN by default
- **Global Edge Delivery**: Files served from worldwide edge locations
- **MongoDB Fallback**: Automatically falls back if CDN unavailable
- **Admin Dashboard**: View CDN stats, file counts, storage usage
- **Max File Size**: 100MB for audio, 10MB for images

**Configuration:**
- Storage Zone: `gracefy-media`
- CDN URL: `https://gracefy-cdn.b-cdn.net`
- Region: Germany (de)

**New API Endpoints:**
- `POST /api/upload` - Auto-uploads to CDN (with fallback)
- `POST /api/upload/cdn` - Direct CDN upload
- `GET /api/admin/cdn/status` - Check CDN configuration
- `GET /api/admin/cdn/stats` - Storage statistics
- `GET /api/admin/cdn/files?folder=audio` - List CDN files
- `DELETE /api/admin/cdn/files/{folder}/{filename}` - Delete CDN file

**Files Created:**
- `/app/backend/services/bunny_cdn_service.py` - CDN service

**Environment Variables Added:**
- `BUNNY_STORAGE_ZONE` - Storage zone name
- `BUNNY_API_KEY` - Storage API key
- `BUNNY_CDN_URL` - Pull zone URL
- `BUNNY_STORAGE_REGION` - Storage region (de, ny, la, sg, etc.)

---

### 🎛️ Dynamic Layout Manager System
Comprehensive layout management system allowing admin to control all mobile app sections:

**New Features:**
- **Default Sections Auto-Created**: 15 pre-configured sections matching mobile app design
- **Layout Styles**: Admin can choose how each section is displayed:
  - `horizontal_small` - Small horizontal scrollable tiles
  - `horizontal_large` - Large horizontal cards
  - `horizontal_cards` - Standard horizontal cards
  - `vertical_list` - Vertical scrollable list
  - `grid` - 2x2 grid layout
  - `tafakari_cards` - Tafakari style cards
- **Sync Defaults Button**: One-click to add all missing default sections
- **Bilingual Labels**: Support for Swahili (display_name_sw) and English (display_name_en)

**Default Sections Created:**
1. Hero Section
2. Quick Access
3. Biblia na Masomo (Bible & Lessons)
4. Makanisa (Churches)
5. Endelea Kusikiliza (Continue Listening)
6. Albam Maarufu (Popular Albums)
7. Mpya Chaguo Bora (New Top Picks)
8. Albam Zinazosikilizwa Zaidi (Most Listened Albums)
9. Nyimbo za Krismasi (Christmas Songs)
10. Nyimbo za Kwaresima (Lent Songs)
11. Mahubiri na Tafakari (Sermons & Reflections)
12. Mafundisho na Katekesi (Teachings & Catechesis)
13. Mpya (New Releases)
14. Kwaya na Wasanii (Choirs & Artists)
15. Viongozi wa Dini (Religious Leaders)

**New API Endpoints:**
- `POST /api/layout/sections/sync-defaults` - Add missing default sections
- `POST /api/layout/sections/reset-all` - Reset all sections to defaults

**Files Modified:**
- `/app/backend/server.py` - New DEFAULT_SECTIONS, sync/reset endpoints
- `/app/frontend/src/pages/LayoutManagementPage.jsx` - Layout style selector, sync button
- `/app/mobile/SpiritSongs/src/screens/HomeScreen.js` - Dynamic section rendering

---

### 📱 Mobile App Bug Fixes & Bible Search
Fixed critical mobile app issues and added Bible book search functionality:

**Bug Fixes:**
1. **Continuous Playback Fix**: Refactored `PlayerContext.js` to use inline status handler within `loadAndPlaySong` to ensure fresh closure captures current queue/index state
2. **Download Permission Fix**: Improved `downloadService.js` with better Android permission handling for API 29-33+, clearer error messages, and robust directory creation with proper error catching

**Bible Book Search Feature:**
- Added search input in Bible screen to filter books by typing
- Added search functionality in Range Reader modal for quick book selection
- Added "no results" feedback when search doesn't match any books
- Swahili placeholder: "Tafuta kitabu..."

**Files Modified:**
- `/app/mobile/SpiritSongs/src/context/PlayerContext.js` - Continuous playback fix
- `/app/mobile/SpiritSongs/src/services/downloadService.js` - Download permission fix
- `/app/mobile/SpiritSongs/src/screens/BibleScreen.js` - Added book search
- `/app/mobile/SpiritSongs/src/screens/HomeScreen.js` - Added missing Bible card styles

---

### 🎵 Audio Encoding Service
Implemented asynchronous audio encoding with FFmpeg for adaptive streaming:

**Feature Details:**
- **Async Encoding**: Upload returns immediately, encoding happens in background
- **Multiple Quality Variants**: Creates 6 variants for each uploaded audio file
  - Low quality: 128kbps (MP3 + AAC)
  - Medium quality: 256kbps (MP3 + AAC)
  - High quality: 320kbps (MP3 + AAC)
- **Dual Formats**: Both MP3 and M4A (AAC) for maximum device compatibility
- **Range Request Support**: Proper HTTP range headers for audio seeking
- **Admin Dashboard Stats**: View encoding jobs, variant counts, storage usage

**New API Endpoints:**
- `GET /api/encoding/job/{job_id}` - Get encoding job status and progress
- `GET /api/files/{file_id}/variants` - List all variants for a file
- `GET /api/files/{file_id}/variant/{quality}/{format}` - Stream specific variant
- `GET /api/files/{file_id}/best-variant` - Get best available variant URL
- `GET /api/admin/encoding/stats` - Encoding statistics for admin
- `POST /api/admin/encoding/retry/{job_id}` - Retry failed encoding job

**Files Created/Modified:**
- `/app/backend/services/encoding_service.py` (NEW) - FFmpeg encoding service
- `/app/backend/server.py` - Upload endpoints updated with encoding integration

**Database Collections:**
- `encoding_jobs` - Tracks encoding job status and progress
- `audio_variants` - Stores encoded file variants

---

### 🎛️ Layout Manager Enhancements
Extended the Layout Manager with new section types and content types:

**New Section Types:**
- `religious_leaders` - Religious Leaders section
- `bible_content` - Biblia na Vitabu (Bible and Books) section

**New Content Types:**
- `religious_leaders` - Religious Leaders
- `bible_content` - Bible Content (Snippets)

**New API Endpoints:**
- `GET /api/layout/religious-leaders` - Fetch leaders for layout manager
- `GET /api/layout/bible-content` - Fetch bible snippets for layout
- `GET /api/layout/special-mixes` - Fetch special mixes for layout

**Content Assignment Modal Updates:**
- Added Religious Leaders selection tab
- Added Biblia na Vitabu (Bible snippets) selection tab
- Added Special Mixes selection tab
- Fixed choir ID handling (singer_id vs choir_id)

**Files Modified:**
- `/app/frontend/src/pages/LayoutManagementPage.jsx` - New section types, content types, and modal updates
- `/app/backend/server.py` - New layout endpoints

## Previous Updates (Jan 19, 2026)

### ⏱️ Bible Listening Limits & Donation Prompt
Implemented listening time limits and donation prompts to manage TTS costs:

**Feature Details:**
- **Free Users**: Get configurable initial minutes (default: 5 mins) of free Bible audio
- **Donation Prompt**: After time expires, shows Swahili message: "Kusikiliza biblia ni bure lakini teknolojia hii ina gharama, changia kidogo kuwezesha uendelee kufurahia"
- **Dismiss & Continue**: Free users get additional minutes (default: 2 mins) after dismissing the prompt
- **Paid Users**: Configurable limits - daily (default: 60 mins), monthly, or unlimited
- **Daily Reset**: Listening counters reset at midnight

**Admin Controls (Settings Tab):**
- Enable/disable listening limits
- Set free user minutes before prompt
- Set additional minutes after dismiss
- Configure paid user limits (daily/monthly/unlimited)
- Customize donation messages (Swahili & English)
- View listening statistics (total listeners, today's listeners, total hours, prompts shown)

**API Endpoints (NEW):**
- `GET /api/admin/bible/settings` - Get listening limit settings
- `PUT /api/admin/bible/settings` - Update listening settings
- `GET /api/bible/listening-status` - Get user's remaining time
- `POST /api/bible/listening-track` - Track listening time
- `POST /api/bible/prompt-shown` - Record prompt display
- `GET /api/admin/bible/listening-stats` - Overall statistics

**Mobile App Integration:**
- Real-time countdown timer displayed in header
- Automatic audio pause when limit reached
- Beautiful donation modal with "Changia Sasa" button
- Navigation to Subscription page for payment

### 📖 Biblia na Vitabu vya Dini Module
Complete Bible reading and listening module with AI text-to-speech:

**User Features:**
- **Browse Bible books** (26 books, 7853 verses - Swahili New Testament)
- **Navigate chapters and verses** with intuitive UI
- **AI Audio Reading** - Listen to any verse with Google Cloud TTS
- **Featured Snippets** - Admin-curated passages with pre-generated audio
- **Verse Range Selection** - Select custom range (e.g., Matthew 9:13-25) for continuous playback
- **Voice Gender Selection** - Choose male or female voice
- **Language support** - Swahili with localized book names (Mathayo, Marko, Luka, etc.)

**Admin Features:**
- **Bible Snippet Management** - Create, edit, delete curated passages
- **TTS Voice Selection** - Google Cloud Chirp3-HD voices (male/female)
- **Devotional Cards** - Create featured cards for home page with custom headings
- **Analytics Dashboard** - Track listening patterns
  - Total listens (30-day period)
  - Most popular Bible books
  - Listening times (morning/afternoon/evening/night)
  - Daily trends
  - Top snippets by play count

**API Endpoints:**
- `GET /api/bible/stats` - Bible data statistics
- `GET /api/bible/books` - List all Bible books
- `GET /api/bible/books/{book}/chapters` - Get chapters for a book
- `GET /api/bible/books/{book}/chapters/{chapter}` - Get verses
- `POST /api/bible/tts/verse` - Generate TTS audio for a verse
- `POST /api/bible/tts/passage` - Generate TTS for a passage
- `POST /api/bible/tts/passage-range` - Generate TTS for custom verse range
- `GET /api/bible/snippets` - Get featured snippets (user)
- `GET /api/bible/featured-snippets` - Get devotional cards for home page
- `POST /api/admin/bible/snippets` - Create snippet with audio
- `GET /api/admin/bible/analytics` - Bible listening analytics

**Files Created:**
- `/app/backend/services/bible_service.py` - Bible data management
- `/app/backend/services/tts_service.py` - TTS generation via Google Cloud
- `/app/frontend/src/pages/BibleManagementPage.jsx` - Admin page with settings
- `/app/mobile/SpiritSongs/src/screens/BibleScreen.js` - Mobile Bible screen with listening limits
- BibleView component in `UserStreamingApp.jsx` - User Bible interface

**Technical Notes:**
- Bible data from SourceForge public domain (Swahili NT)
- TTS uses **Google Cloud TTS** with Chirp3-HD Swahili voices
- Audio cached in MongoDB to avoid regeneration
- Listening time tracked per user in `bible_listening` collection
- Analytics tracked with time-of-day classification
- Supports 11 voices including 8 Swahili and 3 English options

### Translation Management System
Complete internationalization (i18n) system for mobile app and PWA:

**Features:**
- **135+ translatable strings** covering all UI elements
- **Swahili as default language** with English option
- **Admin can download/upload Excel translations** in System Settings
- **Custom translations override defaults** automatically
- **Language selector** in both mobile and PWA navigation

**API Endpoints:**
- `GET /api/translations?lang=sw` - Get translations for a language
- `GET /api/admin/translations/download` - Download Excel template
- `POST /api/admin/translations/upload` - Upload translated Excel
- `GET /api/admin/translations/languages` - List available languages

**Files Created/Modified:**
- `/app/frontend/src/context/LanguageContext.jsx` - PWA translation context
- `/app/frontend/src/pages/SystemSettingsPage.jsx` - Translation management UI
- `/app/backend/server.py` - Translation API endpoints
- `/app/mobile/SpiritSongs/src/context/LanguageContext.js` - Updated to fetch from API

### Admin Sidebar Reorganization
Combined Choir-related menu items into one collapsible group:
- **Choir & Singers** (expandable)
  - Singers & Choirs
  - Choir Management
  - Choir Accounts

### Hero Section Configuration
Admin can now configure the hero section to display either:
1. **Static Banners** - Custom promotional banners with images, titles, and links
2. **Dynamic Content** - Select specific albums to feature in the hero carousel

API Endpoints:
- `GET /api/layout/hero-config` - Get hero configuration
- `POST /api/layout/hero-config` - Save hero configuration
- `GET /api/layout/hero-content` - Get hero content for app

### Mobile App Fixes (v1.0.28)
1. **Image Display Fixed** - Added `getItemThumbnail()` helper to handle optimized thumbnail URLs (`thumbnail_url` field)
2. **Download Issue Fixed** - Improved download service with better directory handling and error recovery
   - Uses `cacheDirectory` on Android for better compatibility
   - Better error messages and fallback locations
   - Validates downloaded files

## Performance Optimizations (Implemented Jan 18, 2026)

### Backend Optimizations
| Optimization | Status | Impact |
|-------------|--------|--------|
| MongoDB Indexes | ✅ | 47 indexes created |
| GZIP Compression | ✅ | Responses > 500 bytes |
| Rate Limiting | ✅ | 100 req/min per IP |
| Redis Caching | ✅ | With in-memory fallback |
| Optimized Projections | ✅ | No base64 in list queries |
| Thumbnail API | ✅ | Separate endpoint for images |

### Performance Results
| Endpoint | Before | After | Improvement |
|----------|--------|-------|-------------|
| Home API | 29MB, 1.4s | 1.6KB, 0.03s | **99.99% smaller, 46x faster** |
| Albums API | 14MB | 948B | **99.99% smaller** |
| Layout API | 15MB | 1.1KB | **99.99% smaller** |

### Frontend Optimizations
- Code splitting with React.lazy()
- Suspense for loading states
- CDN configuration ready
- Performance monitoring utilities

### CDN Setup (Production)
Set these environment variables:
```
REACT_APP_CDN_ENABLED=true
REACT_APP_MEDIA_CDN_URL=https://your-cdn.com/media
REACT_APP_AUDIO_CDN_URL=https://your-cdn.com/audio
REACT_APP_STATIC_CDN_URL=https://your-cdn.com/static
```

### Redis Setup (Production)
Set in backend/.env:
```
REDIS_ENABLED=true
REDIS_URL=redis://your-redis-server:6379
```

## Core Features

### Implemented ✅
1. **Music Streaming** - Albums, songs, playlists, queue management
2. **User Library** - Liked songs, downloads, custom playlists
3. **Content Sections** - Mahubiri na Tafakari, Mafundisho na Katekesi
4. **Church System** - Church listings, announcements, follow/unfollow
5. **Admin Features** - Layout Manager, Content Management, Permissions
6. **Localization** - Kiswahili (default), English
7. **System Settings** - Geo-locking, payments, branding
8. **Bible Module** - Read and listen to Bible with AI TTS (Swahili)
9. **Bible Analytics** - Track listening patterns, popular books, time-of-day distribution

### Mobile Builds
- **v1.0.27 (Gracefy branding)**: https://expo.dev/artifacts/eas/ddSvbwbMofCQALkYxkHvHd.apk

## Technical Architecture

```
/app/
├── backend/
│   ├── server.py           # FastAPI server
│   ├── cache_service.py    # Redis caching
│   └── create_indexes.py   # DB index script
├── frontend/
│   └── src/
│       ├── App.js          # Code splitting
│       └── utils/
│           ├── cdn.js      # CDN utilities
│           └── performance.js  # Web Vitals
└── mobile/
    └── SpiritSongs/
        └── src/
            ├── config.js   # Gracefy colors
            └── context/    # Language, Player
```

## API Endpoints (Key)
- `GET /api/user/home` - Home page (cached 60s)
- `GET /api/albums` - Albums list (paginated)
- `GET /api/thumbnails/{id}` - Image serving
- `GET /api/admin/cache/stats` - Cache statistics
- `POST /api/admin/cache/clear` - Clear cache
- `GET /api/bible/books` - Bible books list
- `POST /api/bible/tts/verse` - Generate verse audio
- `GET /api/admin/bible/analytics` - Bible analytics

## Last Updated
January 19, 2026
