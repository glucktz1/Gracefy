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

### Phase 5: Download Feature Redesign (Completed - Feb 2026)
- [x] Complete rewrite of download system (Spotify-like design)
- [x] DownloadContext with queue-based download manager
- [x] Individual song download from 3-dot menu (SongActionsSheet)
- [x] Album/playlist bulk download button on AlbumScreen
- [x] New "Downloads" tab in LibraryScreen
- [x] Offline playback from local files
- [x] Download progress indicators on song items
- [x] Storage size tracking in ProfileScreen
- [x] Clear all downloads functionality
- [x] AsyncStorage persistence for download metadata
- [x] File verification after download
- [x] PlaylistPickerSheet for adding songs to playlists

## Current App Version
- **Mobile App**: v1.0.92 ✅ BUILD COMPLETE
- **APK Download**: https://expo.dev/artifacts/eas/dxMssAw6Ry9JEs7u2GZmnN.apk
- **Features**: Spotify-like downloads, offline playback, background audio

## Latest Updates (Feb 5, 2026)

### Session Update 1: Dashboard & Analytics Fix
- [x] Cleaned up 14,000+ demo listening sessions from database
- [x] Dashboard now shows real data (0 active streams when none active)
- [x] Realtime analytics endpoint returns accurate counts

### Session Update 2: Choir Management Fix
- [x] Fixed `/api/singers` endpoint to calculate real album/song/play counts
- [x] Albums count now aggregated from albums collection by artist_id/artist_name
- [x] Songs count now aggregated from songs in choir's albums
- [x] Play counts now summed from song plays in choir's catalog

### Session Update 3: Admin User Management
- [x] Added `/api/admin/users` endpoints (GET, POST, PUT, DELETE)
- [x] Created AdminUsersPage.jsx for managing system users
- [x] Support for roles: admin, choir_admin, church_admin, content_manager, viewer, user
- [x] Password-based login for admin-created users
- [x] Added to sidebar navigation as "Admin Users"

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
- [ ] ~~Test download functionality~~ (Implemented, build pending)
- [ ] Verify background playback works when app locked (code ready, needs APK testing)

### P1 - High Priority
- [ ] Bible offline reading mode
- [ ] Push notifications
- [ ] Performance optimization for app startup
- [ ] Admin dashboard data verification from user

### P2 - Medium Priority  
- [ ] Admin panel: Withdrawal request management
- [ ] Admin panel: Cron job for periodic revenue calculation
- [ ] Hero section images from CDN
- [ ] Azam Pay live integration (UI ready)

### P3 - Future
- [ ] Social features (sharing, comments)
- [ ] Advanced recommendation system
- [ ] Multi-language support
- [ ] Choir-specific dashboards for earnings tracking

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
REACT_APP_BACKEND_URL=https://songfix-spirit.preview.emergentagent.com
```

## EAS Build Credentials
- Account: gracefy21
- Token: PW6T-YrsehtxX4cEvRrB2SnQwS_4xQL86LQDpBaL

## Known Issues
1. Some songs (10) still have internal `/api/files/` URLs - need migration
2. 3 songs have no audio URL - disabled
3. ~~Hero section images may not display properly~~ (FIXED - Feb 10, 2026)

## Latest Updates (Feb 11, 2026)

### Play Count & Revenue Fixes
- [x] Fixed play count recording to update both `play_count` and `plays` fields
- [x] When a song is played, album's `total_plays` is also incremented
- [x] Added `/api/admin/recalculate-play-counts` endpoint to fix historical data
- [x] Added `/api/admin/revenue-settings` endpoint for revenue configuration
- [x] Revenue now calculated from listening sessions with proper settings

### Mobile App Fixes  
- [x] Fixed special mixes play button - now has `onPress` handler
- [x] Fixed category filters - navigate to filtered view when tapped
- [x] Added auto-search with 500ms debounce to SearchScreen
- [x] Google login now uses external browser via `Linking.openURL`
- [x] Added deep link handler in App.js for auth callbacks

### Performance Optimization
- [x] **Hero Content API: 86MB → 2.6KB (32,000x faster)**
- [x] Removed all debug info from mobile app

### Admin Panel
- [x] Added App Control & Management page
- [x] Revenue settings now accessible via API

## Testing Notes
- Use "Generate Data" button in analytics to create demo listening sessions
- Revenue only calculates when billing is enabled in subscription_settings
- CDN stats now count from songs/albums collections, not legacy files collection
- Hero banners have 9 duplicate entries with large base64 images - consider cleanup
