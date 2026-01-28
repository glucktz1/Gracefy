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

## Architecture
- **Backend**: FastAPI (Python) - Modular architecture with routers
  - Main: `/app/backend/server.py` (legacy endpoints)
  - Core: `/app/backend/core/` (database, caching)
  - Routes: `/app/backend/routes/` (music, home, payment)
  - Models: `/app/backend/models/` (Pydantic schemas)
  - Services: `/app/backend/services/` (CDN, encoding, TTS)
- **Frontend/Admin Panel**: React - `/app/frontend/`
- **Mobile App**: React Native (Expo) - `/app/mobile/SpiritSongs/`
- **Database**: MongoDB with indexes for optimal performance
- **CDN**: Bunny CDN for media storage
- **TTS**: Google Cloud TTS for Bible audio
- **Payments**: Azam Pay (Mobile Money - M-Pesa, Tigo Pesa, Airtel Money, Halo Pesa)
- **Caching**: In-memory LRU cache with TTL

## Performance Optimizations (2026-01-28)

### Database Indexes Created
- 175 total indexes across 68 collections
- Compound indexes for common query patterns
- TTL indexes for session/analytics auto-cleanup
- Sparse indexes for optional fields

### Caching Strategy
- Home screen: 60 second cache
- Albums list: 120 second cache
- Album detail: 300 second cache
- Categories: 600 second cache
- LRU eviction when max entries (10,000) reached
- Background cleanup every 5 minutes

### Query Optimizations
- Minimal projections (exclude large fields)
- Parallel async queries where possible
- Connection pooling (100 max connections)
- GZIP compression for responses > 500 bytes
- Rate limiting (100 requests/minute per IP)

### Performance Results
- Home endpoint: ~170ms first call → ~70ms cached
- Albums endpoint: ~80ms first call → ~45ms cached

## Completed Features

### Mobile App
- [x] Music player with expo-av
- [x] Albums and songs browsing
- [x] Bible reader with book/chapter/verse navigation
- [x] Bible TTS with verse range selection
- [x] Voice selection (Kike/Kiume - Female/Male)
- [x] Quick select buttons (1-5, 1-10, Sura Nzima)
- [x] User listening history tracking to database
- [x] Churches screen with announcements, choirs, leaders
- [x] Church follow/unfollow feature
- [x] User authentication (Google OAuth)
- [x] Billing plans UI
- [x] Mafundisho screen with series/episodes
- [x] Animated Equalizer Bars
- [x] Download Status Indicators
- [x] Fixed Downloads Persistence
- [x] Profile Functions Working
- [x] **Checkout Screen with Phone Input** (Added 2026-01-28)
- [x] **MNO Auto-Detection** (Vodacom, Tigo, Airtel, Halotel)
- [x] **Transaction History in Profile**
- [x] **Conditional Payment UI** (hidden when billing disabled)

### Admin Panel
- [x] Dashboard with analytics
- [x] Album and song management
- [x] Church management and approval
- [x] Choir/Singer management
- [x] Layout management for app sections
- [x] Revenue settings
- [x] User management with RBAC
- [x] Leader Content Management
- [x] **Billing Toggle** - Enable/disable billing system globally
- [x] **Transaction Tracking** - View all payment transactions with filters
- [x] **Cache Monitoring** - View cache stats at `/api/admin/cache/stats`

### Backend APIs
- [x] Authentication endpoints
- [x] Music streaming endpoints
- [x] Bible content and TTS endpoints
- [x] Church and choir endpoints
- [x] Layout configuration endpoints
- [x] Revenue and analytics endpoints
- [x] Bible listening history endpoints
- [x] Mafundisho endpoints
- [x] Content upload endpoints verified
- [x] **Azam Pay Payment Endpoints** (Added 2026-01-28)
- [x] **Cache Stats Endpoint** (Added 2026-01-28)

## Payment System (2026-01-28)

### Azam Pay Integration
- **Test Mode**: Currently running in test mode (AZAMPAY_TEST_MODE=true)
- **MNO Support**: M-Pesa, Tigo Pesa, Airtel Money, Halo Pesa, Ezy Pesa
- **Phone Auto-Detection**: Detects MNO from phone prefix
- **Demo Checkout**: Users can test the flow with manual confirmation button

## Known Issues

### P0 - Critical
- **Background audio advancement** - App doesn't play next song when screen is locked
  - Cause: expo-av JavaScript gets suspended on mobile OS
  - Required Solution: `react-native-track-player` integration
  - Status: BLOCKED - EAS build failures with native modules

### P1 - High Priority
- **Azam Pay Credentials** - Current credentials may need verification with Azam Pay support

### P2 - Medium Priority
- Animated splash screen needed
- Admin filter toggles for homepage

## Upcoming Tasks
1. Fix background audio advancement (P0)
2. Animated splash screen (P2)
3. Admin filter toggles for homepage categories

## Future/Backlog
- Continue backend modularization (more routes to extract)
- PWA "Play All" button
- Live audio/video rooms (Agora/100ms)
- Remove unused Supabase code
- Production Azam Pay credentials setup

## Technical Notes

### New Backend Structure
```
/app/backend/
├── server.py              # Main app + legacy routes
├── core/
│   ├── __init__.py
│   ├── database.py        # MongoDB connection with pooling
│   └── cache.py           # In-memory LRU cache
├── models/
│   ├── __init__.py
│   └── schemas.py         # Pydantic models
├── routes/
│   ├── __init__.py
│   ├── music.py           # Albums, songs endpoints
│   ├── home.py            # Home screen data
│   └── payment.py         # Azam Pay integration
├── services/
│   ├── bunny_cdn_service.py
│   ├── encoding_service.py
│   └── tts_service.py
└── create_indexes.py      # Database index creation
```

### Cache Configuration
```python
CACHE_TTL = {
    'home': 60,           # 1 minute
    'albums': 120,        # 2 minutes
    'album_detail': 300,  # 5 minutes
    'songs': 120,         # 2 minutes
    'categories': 600,    # 10 minutes
    'churches': 300,      # 5 minutes
    'settings': 300,      # 5 minutes
    'bible': 3600,        # 1 hour
}
```

### Test Credentials
- Choir Portal: demo@gracefy.com / demo123456
- Expo Token: Ocf09mEKf7N8E9Pjwyf5-hQYLOevZO3OYEsrr9Bq
