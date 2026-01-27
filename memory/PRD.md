# Gracefy - Christian Music Streaming App

## Overview
A Christian music streaming mobile app with a Spotify-like interface, featuring:
- Music streaming with choirs and albums
- Bible reader with TTS (Text-to-Speech)
- Church discovery and follow features
- Mafundisho (Teachings) with series and episodes
- Admin panel for content management
- Choir portal for artists

## Architecture
- **Backend**: FastAPI (Python) - Monolithic `/app/backend/server.py`
- **Frontend/Admin Panel**: React - `/app/frontend/`
- **Mobile App**: React Native (Expo) - `/app/mobile/SpiritSongs/`
- **Database**: MongoDB
- **CDN**: Bunny CDN for media storage
- **TTS**: Google Cloud TTS for Bible audio

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
- [x] **Animated Equalizer Bars** (Added 2026-01-27)
  - Dancing bars on MiniPlayer when playing
  - Replaces song number in song lists when playing
- [x] **Download Status Indicators** (Added 2026-01-27)
  - Checkmark badge on downloaded song thumbnails
  - "Imepakuliwa" tag under song title
  - Green checkmark on download button when downloaded
  - Delete downloaded songs option
- [x] **Fixed Downloads Persistence** (Added 2026-01-27)
  - DownloadContext for persistent tracking
  - Downloads appear in Library screen
- [x] **Profile Functions Working** (Added 2026-01-27)
  - Real stats (playlists, likes, downloads)
  - Language toggle with persistence
  - Theme selector
  - Clear downloads
  - Proper navigation

### Admin Panel
- [x] Dashboard with analytics
- [x] Album and song management
- [x] Church management and approval
- [x] Choir/Singer management
- [x] Layout management for app sections
- [x] Revenue settings
- [x] User management with RBAC
- [x] Leader Content Management
  - ONE thumbnail per series (applies to all episodes)
  - Series = Main Topic, Episodes = Subtopics
  - Thumbnail & audio upload to Bunny CDN

### Backend APIs
- [x] Authentication endpoints
- [x] Music streaming endpoints
- [x] Bible content and TTS endpoints
- [x] Church and choir endpoints
- [x] Layout configuration endpoints
- [x] Revenue and analytics endpoints
- [x] Bible listening history endpoints
- [x] Mafundisho endpoints

## Known Issues

### P0 - Critical
- **Background audio advancement** - App doesn't play next song when screen is locked
  - Cause: expo-av JavaScript gets suspended on mobile OS
  - Required Solution: `react-native-track-player` integration
  - Status: BLOCKED - EAS build failures with native modules

### P1 - High Priority
- **Azam Pay integration** - Billing system needs payment processing

### P2 - Medium Priority
- Animated splash screen needed
- Intermittent app crashes to investigate

## Upcoming Tasks
1. Fix background audio advancement (P0)
2. Azam Pay payment integration (P1)
3. Animated splash screen (P2)

## Future/Backlog
- Backend refactoring (server.py is 13,000+ lines)
- PWA "Play All" button
- Live audio/video rooms (Agora/100ms)
- Remove unused Supabase code

## Technical Notes

### EAS Build
- Project uses `gracefy15` Expo account
- Current version: 1.0.65
- Build profiles in `/app/mobile/SpiritSongs/eas.json`

### Test Credentials
- Choir Portal: demo@gracefy.com / demo123456

### Key Files
- `/app/mobile/SpiritSongs/src/screens/BibleScreen.js` - Bible reader
- `/app/mobile/SpiritSongs/src/screens/MafundishoDetailScreen.js` - Teachings detail
- `/app/mobile/SpiritSongs/src/context/PlayerContext.js` - Audio player
- `/app/mobile/SpiritSongs/src/context/DownloadContext.js` - Download management
- `/app/mobile/SpiritSongs/src/components/AnimatedEqualizer.js` - Dancing bars
- `/app/mobile/SpiritSongs/src/screens/ChurchesScreen.js` - Churches
- `/app/mobile/SpiritSongs/src/screens/ProfileScreen.js` - User profile
- `/app/backend/server.py` - Main backend
- `/app/frontend/src/pages/ContentManagementPage.jsx` - Admin leader content

### Content Structure (Mafundisho)
```
Container (Course/Teaching)
  └── Series (Main Topic) - HAS ONE THUMBNAIL
       └── Episode 1 (Subtopic) - HAS AUDIO
       └── Episode 2 (Subtopic) - HAS AUDIO
  └── Series (Main Topic) - HAS ONE THUMBNAIL
       └── Episode 1 (Subtopic) - HAS AUDIO
```

### Download System
- Downloads stored in `${FileSystem.documentDirectory}downloads/`
- Metadata tracked in AsyncStorage (`@gracefy_downloads`)
- DownloadContext provides: downloads, isDownloaded(), addDownload(), removeDownload()
