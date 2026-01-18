# Gracefy - Christian Music Streaming App

## Product Overview
Gracefy (formerly Spirit Songs) is a comprehensive Christian music streaming platform with:
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

## Core Features

### Implemented ✅
1. **Music Streaming**
   - Album and song playback
   - Queue management
   - Shuffle and repeat modes
   - Background audio playback
   - Continuous playback (never stops - plays next album)
   - Resume from last position

2. **User Library**
   - Liked songs
   - Downloads (offline playback)
   - Custom playlists
   - Recently played

3. **Content Sections**
   - Hero/Featured albums
   - Quick Access grid
   - Mahubiri na Tafakari (Sermons & Reflections) - Spotify-style cards
   - Mafundisho na Katekesi (Teachings & Catechesis)
   - Top Picks (horizontal scroll)
   - New Releases
   - Bestselling
   - Churches

4. **Church System**
   - Church listings
   - Church detail pages
   - Announcements
   - Follow/unfollow churches

5. **Admin Features**
   - Layout Manager (sections, burners)
   - Content Management (albums, songs, leader content)
   - User Management
   - Permission Matrix
   - Church Management

6. **Localization**
   - Kiswahili (default)
   - English
   - Language selector in Profile

### In Progress 🔄
1. **Mobile Build v1.0.27** - Submitted, includes:
   - Gracefy branding
   - Blue color theme
   - Tafakari section design
   - Continuous playback
   - Resume from last position
   - Kiswahili default language

### Upcoming 📋
1. **Lock Screen Controls** - Requires Expo eject (user decision pending)
2. **Notification System** - Backend ready, UI needed
3. **Church Detail Screen** - Complete implementation
4. **PWA Play All buttons** - Library sections

### Backlog 📌
- Free User Daily Song Limits
- Device Limits Management
- Live Seminars
- Audio Rooms
- Community Features

## Technical Architecture

```
/app/
├── backend/
│   └── server.py           # FastAPI server (monolithic, needs refactoring)
├── frontend/
│   └── src/
│       ├── App.js          # Main app with routing
│       ├── pages/          # Admin pages
│       └── components/     # Shared components
└── mobile/
    └── SpiritSongs/
        ├── App.js          # Main app entry
        └── src/
            ├── config.js       # Gracefy colors and config
            ├── context/        # React contexts (Player, Auth, Language)
            ├── screens/        # App screens
            ├── components/     # Reusable components
            └── services/       # API and download services
```

## Key Files Modified in Latest Session
- `/app/mobile/SpiritSongs/src/config.js` - New Gracefy blue colors
- `/app/mobile/SpiritSongs/src/context/LanguageContext.js` - Kiswahili default
- `/app/mobile/SpiritSongs/src/context/PlayerContext.js` - Resume playback
- `/app/mobile/SpiritSongs/src/screens/HomeScreen.js` - Tafakari section
- `/app/mobile/SpiritSongs/app.json` - App name to Gracefy
- `/app/frontend/public/index.html` - Web title to Gracefy
- All frontend/mobile files - Brand name updated

## API Endpoints
- `/api/content/home` - Home page content
- `/api/layout/sections` - Layout configuration
- `/api/churches` - Churches listing
- `/api/churches/{id}/full` - Church details
- `/api/user/library` - User's library
- `/api/user/notifications` - Notifications

## Database Collections
- `albums`, `songs`, `choirs`
- `churches`, `church_announcements`
- `users`, `user_follows`, `user_notifications`
- `layout_sections`, `layout_burners`
- `leader_content`

## Build Status
- **v1.0.24**: https://expo.dev/artifacts/eas/qoNHcbjBrwb4uHkSB9w81L.apk (Old branding)
- **v1.0.25**: https://expo.dev/artifacts/eas/u9E4NmLEaJoxwo6uBbLvw7.apk (Language support)
- **v1.0.27**: Building (Gracefy branding + blue theme)

## Last Updated
January 18, 2026
