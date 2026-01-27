# Gracefy - Christian Music Streaming App

## Overview
A Christian music streaming mobile app with a Spotify-like interface, featuring:
- Music streaming with choirs and albums
- Bible reader with TTS (Text-to-Speech)
- Church discovery and follow features
- **Mafundisho (Teachings) with series and episodes**
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
- [x] **Mafundisho screen with series/episodes** (Added 2026-01-27)

### Admin Panel
- [x] Dashboard with analytics
- [x] Album and song management
- [x] Church management and approval
- [x] Choir/Singer management
- [x] Layout management for app sections
- [x] Revenue settings
- [x] User management with RBAC
- [x] **Leader Content Management** (Updated 2026-01-27)
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
- [x] **Mafundisho endpoints** (Updated 2026-01-27)
  - GET /api/mafundisho - Returns series_count, episode_count, total_classes
  - GET /api/mafundisho/{id} - Returns container with series->episodes structure
  - POST /api/content/upload-thumbnail - Bunny CDN upload
  - POST /api/content/upload-audio - Bunny CDN upload

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
- Current version: 1.0.64
- Build profiles in `/app/mobile/SpiritSongs/eas.json`

### Test Credentials
- Choir Portal: demo@gracefy.com / demo123456

### Key Files
- `/app/mobile/SpiritSongs/src/screens/BibleScreen.js` - Bible reader
- `/app/mobile/SpiritSongs/src/screens/MafundishoDetailScreen.js` - Teachings detail
- `/app/mobile/SpiritSongs/src/context/PlayerContext.js` - Audio player
- `/app/mobile/SpiritSongs/src/screens/ChurchesScreen.js` - Churches
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
