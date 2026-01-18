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

## Latest Updates (Jan 18, 2026)

### Hero Section Configuration (NEW)
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

### Files Modified
- `/app/backend/server.py` - Added hero config endpoints
- `/app/frontend/src/pages/LayoutManagementPage.jsx` - Added Hero Config tab
- `/app/mobile/SpiritSongs/src/services/api.js` - Added `getItemThumbnail()` helper
- `/app/mobile/SpiritSongs/src/services/downloadService.js` - Fixed download directory issues
- `/app/mobile/SpiritSongs/src/screens/HomeScreen.js` - Uses hero config from API
- Updated all screens/components to use `getItemThumbnail()`

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
