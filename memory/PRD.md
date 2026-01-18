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

## Latest Updates (Jan 19, 2026)

### 📖 Biblia na Vitabu vya Dini Module (NEW)
Complete Bible reading and listening module with AI text-to-speech:

**User Features:**
- **Browse Bible books** (26 books, 7853 verses - Swahili New Testament)
- **Navigate chapters and verses** with intuitive UI
- **AI Audio Reading** - Listen to any verse with OpenAI TTS
- **Featured Snippets** - Admin-curated passages with pre-generated audio
- **Language support** - Swahili with localized book names (Mathayo, Marko, Luka, etc.)

**Admin Features:**
- **Bible Snippet Management** - Create, edit, delete curated passages
- **TTS Voice Selection** - 9 voices (alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer)
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
- `GET /api/bible/snippets` - Get featured snippets (user)
- `POST /api/admin/bible/snippets` - Create snippet with audio
- `GET /api/admin/bible/analytics` - Bible listening analytics

**Files Created:**
- `/app/backend/services/bible_service.py` - Bible data management
- `/app/backend/services/tts_service.py` - TTS generation via OpenAI/Emergent
- `/app/frontend/src/pages/BibleManagementPage.jsx` - Admin page
- BibleView component in `UserStreamingApp.jsx` - User Bible interface

**Technical Notes:**
- Bible data from SourceForge public domain (Swahili NT)
- TTS uses OpenAI via Emergent LLM Key (EMERGENT_LLM_KEY)
- Audio cached in MongoDB to avoid regeneration
- Analytics tracked with time-of-day classification

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

## Last Updated
January 18, 2026
