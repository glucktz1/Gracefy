# Gracefy - Christian Music Streaming App

## Overview
A Christian music streaming mobile app with a Spotify-like interface, featuring:
- Music streaming with choirs and albums
- Bible reader with TTS (Text-to-Speech)
- Church discovery and follow features
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
- [x] **User listening history tracking to database** (Added 2026-01-27)
- [x] Churches screen with announcements, choirs, leaders
- [x] Church follow/unfollow feature
- [x] User authentication (Google OAuth)
- [x] Billing plans UI

### Admin Panel
- [x] Dashboard with analytics
- [x] Album and song management
- [x] Church management and approval
- [x] Choir/Singer management
- [x] Layout management for app sections
- [x] Revenue settings
- [x] User management with RBAC

### Backend APIs
- [x] Authentication endpoints
- [x] Music streaming endpoints
- [x] Bible content and TTS endpoints
- [x] Church and choir endpoints
- [x] Layout configuration endpoints
- [x] Revenue and analytics endpoints
- [x] **Bible listening history endpoints** (Added 2026-01-27)
  - POST /api/bible/listening-history
  - GET /api/bible/listening-history/{user_id}

## Known Issues

### P0 - Critical
- **Background audio advancement** - App doesn't play next song when screen is locked
  - Cause: expo-av JavaScript gets suspended on mobile OS
  - Required Solution: `react-native-track-player` integration
  - Status: BLOCKED - EAS build failures with native modules

### P1 - High Priority
- **Admin panel thumbnail upload** - Leader Contents thumbnail upload not working
- **Azam Pay integration** - Billing system needs payment processing

### P2 - Medium Priority
- Animated splash screen needed
- Intermittent app crashes to investigate

## Upcoming Tasks
1. Fix background audio advancement (P0)
2. Azam Pay payment integration (P1)
3. Fix thumbnail upload in admin (P1)
4. Animated splash screen (P2)

## Future/Backlog
- Backend refactoring (server.py is 13,000+ lines)
- PWA "Play All" button
- PWA repeat logic review
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
- `/app/mobile/SpiritSongs/src/context/PlayerContext.js` - Audio player
- `/app/mobile/SpiritSongs/src/screens/ChurchesScreen.js` - Churches
- `/app/backend/server.py` - Main backend
