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

## Known Issues

### P0 - Critical
- **Background audio** - App doesn't play next song when screen locked
  - Cause: expo-av JavaScript suspended on mobile
  - Solution: `react-native-track-player` (blocked by EAS build issues)

### P2 - Medium
- Animated splash screen needed

## Upcoming Tasks
1. Fix background audio advancement (P0 - blocked)
2. Animated splash screen (P2)
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
