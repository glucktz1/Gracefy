# SpiritSongs / Gracefy - Product Requirements Document

## Original Problem Statement
Build a music streaming platform (SpiritSongs/Gracefy) with:
1. Mobile app for streaming and downloading Christian music
2. Admin web panel for managing content, analytics, and revenue
3. CDN-based content delivery for audio and images
4. Monetization system with revenue tracking and choir payouts

## Core Architecture

### Frontend (Admin Panel)
- React 18 with Vite
- Shadcn UI components
- Recharts for analytics visualization
- Located at `/app/frontend`

### Backend
- Python FastAPI
- MongoDB database
- Bunny CDN integration
- Located at `/app/backend`

### Mobile App
- React Native with Expo
- expo-av for audio playback
- expo-file-system for downloads
- Located at `/app/mobile/SpiritSongs`

## What's Been Implemented

### Phase 1: Core App Functionality (Completed)
- [x] User authentication (JWT-based)
- [x] Song streaming with background playback
- [x] Download functionality with CDN URLs
- [x] Like/Unlike songs
- [x] Add songs to playlists
- [x] Album browsing and playback

### Phase 2: CDN Migration (Completed - Feb 2026)
- [x] Bunny CDN integration for audio files
- [x] 73/86 songs migrated to CDN
- [x] 10/14 album thumbnails on CDN
- [x] 24 song thumbnails on CDN
- [x] CDN Management page showing real stats
- [x] Auto-propagation of album thumbnails to songs

### Phase 3: Analytics & Dashboard (Completed - Feb 2026)
- [x] Dashboard with real user growth data
- [x] Customer growth chart (total vs active users)
- [x] Content performance chart
- [x] Live streaming banner (active streams, listeners)
- [x] Enhanced analytics with streaming stats
- [x] Daily trend charts with real data
- [x] Top songs and choirs rankings

### Phase 4: Revenue System (Completed - Feb 2026)
- [x] Play tracking (45+ second rule)
- [x] Three monetization modes:
  - Time-based (pay per listening hour)
  - Percentage-based (share of platform revenue)
  - Pay-per-bundle (premium content)
- [x] Revenue calculation with billing toggle
- [x] Platform revenue vs choir payouts tracking
- [x] Revenue settings in admin panel

## Current App Version
- **Mobile App**: v1.0.87
- **APK Download**: https://expo.dev/artifacts/eas/azPmMm7Xxz4tNnDtZEFXqW.apk

## Database Collections

### Content
- `songs`: Song metadata, audio_url (CDN), thumbnails
- `albums`: Album metadata, thumbnails
- `singers`: Choir/artist information
- `playlists`: User playlists

### Users
- `app_users`: Mobile app users
- `users`: Admin/system users

### Analytics
- `listening_sessions`: Play tracking with duration, revenue
- `navigation_events`: Page view analytics

### Settings
- `subscription_settings`: billing_enabled, trial settings
- `revenue_settings`: rates, monetization mode

## API Endpoints

### Analytics
- `GET /api/analytics/overview` - Dashboard stats
- `GET /api/analytics/trends` - User growth & content performance
- `GET /api/analytics/enhanced` - Comprehensive analytics
- `GET /api/analytics/realtime` - Live streaming data
- `POST /api/demo/generate-listening-data` - Generate test data

### CDN Management
- `GET /api/admin/cdn/stats` - CDN file counts and sizes
- `GET /api/admin/cdn/audit/songs` - Song audio URL audit
- `POST /api/admin/cdn/migrate-internal-to-cdn` - Migrate files
- `POST /api/admin/cdn/propagate-album-thumbnails` - Copy album art to songs

### Revenue
- `GET /api/revenue/settings` - Revenue configuration
- `GET /api/billing-status` - Check if billing enabled
- `POST /api/analytics/track-play` - Record a song play

## Remaining Tasks (Prioritized)

### P0 - Critical
- [ ] Test download functionality in v1.0.87 build
- [ ] Verify background playback works when app locked

### P1 - High Priority
- [ ] Bible offline reading mode
- [ ] Push notifications
- [ ] Performance optimization for app startup

### P2 - Medium Priority  
- [ ] Admin panel: Withdrawal request management
- [ ] Admin panel: Cron job for periodic revenue calculation
- [ ] Hero section images from CDN

### P3 - Future
- [ ] Social features (sharing, comments)
- [ ] Advanced recommendation system
- [ ] Multi-language support

## Environment Variables

### Backend (.env)
```
MONGO_URL=mongodb://...
DB_NAME=test_database
BUNNY_API_KEY=...
BUNNY_STORAGE_ZONE=gracefy-media
BUNNY_CDN_URL=https://gracefy-cdn.b-cdn.net
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://musichealers.preview.emergentagent.com
```

## EAS Build Credentials
- Account: gracefy21
- Token: PW6T-YrsehtxX4cEvRrB2SnQwS_4xQL86LQDpBaL

## Known Issues
1. Some songs (10) still have internal `/api/files/` URLs - need migration
2. 3 songs have no audio URL - disabled
3. Hero section images may not display properly

## Testing Notes
- Use "Generate Data" button in analytics to create demo listening sessions
- Revenue only calculates when billing is enabled in subscription_settings
- CDN stats now count from songs/albums collections, not legacy files collection
