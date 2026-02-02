# SpiritSongs Mobile App - Product Requirements Document

## Original Problem Statement
Build and maintain a React Native mobile application (SpiritSongs/Gracefy) with a Python/Flask backend and MongoDB database. The app is a religious music streaming platform with features including:
- Music streaming and downloads
- Bible reading with TTS (Text-to-Speech)
- Religious teachings (Mafundisho na Katekesi)
- Church management
- User subscriptions and monetization

## What's Been Implemented

### December 2025 - February 2026

#### Core Features
- ✅ Music streaming with player controls
- ✅ Album and playlist management
- ✅ Search functionality
- ✅ User authentication (email/phone, Google OAuth)
- ✅ Library management (likes, playlists, downloads)
- ✅ Bible reading with Swahili translation
- ✅ Bible TTS (Text-to-Speech) generation and caching
- ✅ Religious teachings (Mafundisho) with audio lessons
- ✅ Church directory
- ✅ Subscription/billing system with AzamPay
- ✅ Error Boundaries for crash prevention

#### Recent Fixes (February 2, 2026)

**Bible Section Fix**
- Issue: Bible chapters API returned a number instead of array
- Fix: Modified `/api/bible/books/{book_name}/chapters` to return chapters as array `[1, 2, 3, ...]`
- File: `/app/backend/routes/bible.py`

**Mafundisho na Katekesi Fix**
- Issue: Frontend expected `series/episodes` but backend returns `topics/lessons`
- Fix: Added data structure conversion in `MafundishoDetailScreen.js`
- File: `/app/mobile/SpiritSongs/src/screens/MafundishoDetailScreen.js`

#### Optimizations Applied
- Removed base64 images from hero content API (reduced 84MB to ~2KB response)
- Added layout_style support for dynamic home sections
- Implemented thumbnail streaming endpoints

## Known Issues / Blockers

### P1 - In Progress
1. **App crashes on some screens** - Error Boundaries added but root cause unknown
2. **Slow app loading** - API optimized but may have other causes

### P2 - Blocked
3. **Hero section images** - Placeholder gradient shown (blocked until proper image URL system implemented)

## Prioritized Backlog

### P0 - Critical
- None currently

### P1 - High Priority
- Investigate and fix root cause of app crashes on navigation
- Further optimize app load time

### P2 - Medium Priority
- Implement proper image upload/CDN pipeline for hero images
- Add offline mode for Bible reading

### P3 - Future
- Push notifications
- Social features (sharing, comments)
- Audio quality settings

## Architecture

### Frontend (Mobile)
- React Native with Expo
- State management: React Context
- Navigation: React Navigation
- UI: Custom components with theme system

### Backend
- Python FastAPI
- MongoDB database
- Redis caching
- Bunny CDN for media files

### Key Files
- `/app/backend/routes/bible.py` - Bible API endpoints
- `/app/backend/routes/teachings.py` - Teachings/Mafundisho API
- `/app/backend/routes/home.py` - Home screen data API
- `/app/mobile/SpiritSongs/src/screens/BibleScreen.js` - Bible UI
- `/app/mobile/SpiritSongs/src/screens/MafundishoDetailScreen.js` - Teachings UI

## 3rd Party Integrations
- Expo (EAS Build) - App building and distribution
- MongoDB - Primary database
- Bunny CDN - Media file storage
- OpenAI TTS - Bible text-to-speech
- AzamPay - Payment processing (Tanzania)
