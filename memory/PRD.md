# Gracefy - Christian Music Streaming App PRD

## Original Problem Statement
Build a complete Christian music mobile app called "Gracefy" with a Spotify-like look and feel, connected to an existing FastAPI backend. The app serves Christian communities with music streaming, Bible content, church management, and religious leader content.

## Architecture Overview
```
/app/
├── backend/           # FastAPI backend (monolithic server.py)
├── frontend/          # React Admin Panel
└── mobile/
    └── SpiritSongs/   # React Native Mobile App (Expo)
```

## Tech Stack
- **Backend:** FastAPI, MongoDB, Bunny CDN, FFmpeg
- **Admin Panel:** React, TailwindCSS, Shadcn/UI
- **Mobile App:** React Native (Expo SDK 54), EAS Build
- **Auth:** Google OAuth (Emergent-managed)
- **TTS:** Google Cloud Text-to-Speech

---

## What's Been Implemented

### Admin Panel (React)
- [x] Dashboard with analytics
- [x] User management
- [x] Content management (Albums, Songs, Leader Content, Bible)
- [x] Church management
- [x] Choir/Singer management with accounts
- [x] Role-based access control (RBAC)
- [x] Layout management for mobile app sections
- [x] Special mixes management
- [x] Revenue analytics
- [x] Monetization settings
- [x] CDN management
- [x] **Sidebar reorganization (Jan 2026):**
  - Reports & Analytics (Dashboard, Analytics, Revenue, Transactions, Withdrawals)
  - Contents (Albums & Songs, Leader Content, Biblia na Vitabu, Special Mixes, Song Categories)
  - Control & Management (Role Management, Approvals, Layout Management, CDN Management)
  - Settings (System Settings, App Settings, Monetization)
  - Choir & Singers (Singers & Choirs, Choir Management, Choir Accounts)
- [x] **User Navigation Analytics (Jan 2026):**
  - Toggle between Overview and User Navigation sections
  - Most visited pages with view counts
  - Entry points (first page visited)
  - Platform distribution (mobile/web)
  - Daily page views trend chart
  - Common user journeys/flows

### Mobile App (React Native/Expo)
- [x] Spotify-like dark theme UI
- [x] Dynamic home screen with Layout Manager integration
  - Hero Carousel
  - Quick Access Grid
  - Mafundisho na Katekesi section
  - Special Mixes section
  - Churches section
  - Lent/Christmas songs sections
- [x] Category filter chips
- [x] Now Playing screen (Spotify-style)
- [x] Album/Playlist screens with "Play All" button
- [x] Add to Playlist modal with auth-gating
- [x] Three-dots action menu (like, share, download)
- [x] Bible section with Text-to-Speech (Google TTS)
- [x] Churches screen with announcements, thumbnails, follow buttons
- [x] Auth prompts for playlist creation and downloads
- [x] Fixed taskbar interference with system navigation
- [x] Library screen improvements

### Backend (FastAPI)
- [x] Authentication endpoints
- [x] Content management APIs
- [x] Layout Manager API
- [x] Bible TTS endpoint
- [x] Streaming and playback APIs
- [x] User analytics tracking
- [x] Revenue and transaction APIs
- [x] Church management APIs

### Build & Deployment
- [x] EAS Build pipeline established (gracefy12 account)
- [x] Android keystore credentials configured
- [x] Automated credential generation scripts

---

## Current Status (January 2026)

### Latest Mobile Build
- **Version:** 1.0.51
- **Status:** 🔄 Building
- **Build ID:** e60a7ac7-ce3a-44ba-b768-3aa1c661c943
- **Logs:** https://expo.dev/accounts/gracefy2/projects/SpiritSongs/builds/e60a7ac7-ce3a-44ba-b768-3aa1c661c943
- **Account:** gracefy2

### Recently Completed (This Session)
- ✅ **CRITICAL FIX:** Background playback - app now continues to next song when in background/screen locked
  - Refactored `onPlaybackStatusUpdate` to handle track end directly with refs
  - Added `playTrackInternal` function for background-safe playback
  - All queue/index operations now use refs to avoid stale closure issues
- ✅ Billing/Subscription System implemented:
  - Created `BillingContext.js` for global billing state
  - Created `SubscriptionPlansScreen.js` with 4 plan tiers (Daily/Weekly/Monthly/Yearly)
  - Updated `SubscriptionRequiredModal` to navigate to plans screen
  - Integrated billing checks in AlbumScreen, NowPlayingScreen, LibraryScreen
- ✅ Premium feature gating - download, add to playlist, like now show subscription modal
- ✅ Special mixes rendering on web app - VERIFIED working
- ✅ Leader Content linking
- ✅ Toast notifications, keyboard fix, audio prevention

### Completed Builds
- v1.0.48 APK: Latest build with UI improvements
- v1.0.47 APK: Core features working (download, likes, playlists)
- v1.0.45 APK: Session persistence fix

---

## Prioritized Backlog

### P0 (Critical)
- [x] ~~Toast notification system~~ ✅ DONE
- [x] ~~Keyboard overlap fix~~ ✅ DONE  
- [x] ~~Subscription modal with Swahili message~~ ✅ DONE
- [x] ~~Simultaneous audio prevention~~ ✅ DONE

### P1 (High Priority)
- [ ] Implement billing logic with Azam Pay integration
  - Show subscription plans
  - Enable/disable premium features based on subscription status
- [ ] Bible Screen Enhancements (Testament → Book → Verse range selection)
- [x] ~~Churches Screen Overhaul (choirs, songs, announcements)~~ ✅ DONE (Jan 2026)
- [ ] Album/Song Actions (download/add entire album/playlist)
- [ ] Background audio advancement when screen locked (requires react-native-track-player)

### P2 (Medium Priority)
- [ ] Animated Splash Screen
- [ ] PWA "Play All" button for library sections
- [ ] Investigate intermittent app crashes

### P3 (Low Priority / Backlog)
- [ ] Admin: Enforce free user daily song limits
- [ ] Admin: Device limits per user
- [ ] Remove unused Supabase integration
- [ ] Backend refactoring (break down monolithic server.py into routers)
- [ ] PWA repeat logic review

---

## Known Issues

### Recurring
1. **Corrupted File in Build Environment**
   - Workaround: Added to .gitignore and .easignore
   - Root cause: Unknown

### Resolved
- EAS authentication issues (fixed with gracefy12 account)
- Android keystore credential generation (automated with pexpect)
- Taskbar interference on mobile (fixed in App.js)
- Bible TTS endpoint consumption bug (fixed in api.js)

---

## 3rd Party Integrations

| Service | Status | Purpose |
|---------|--------|---------|
| Bunny CDN | ✅ Active | Media storage |
| FFmpeg | ✅ Active | Audio transcoding |
| Google Cloud TTS | ✅ Active | Bible audio generation |
| Expo EAS | ✅ Active | Mobile cloud builds (gracefy2) |
| Azam Pay | 🔲 Planned | Payment processing (Tanzania) |
| Emergent Google Auth | ✅ Active | Google OAuth login |

---

## Key Files Reference

### Admin Panel
- `/app/frontend/src/App.js` - Main app with sidebar navigation
- `/app/frontend/src/pages/` - All admin pages

### Mobile App
- `/app/mobile/SpiritSongs/src/screens/HomeScreen.js`
- `/app/mobile/SpiritSongs/src/screens/BibleScreen.js`
- `/app/mobile/SpiritSongs/src/screens/NowPlayingScreen.js`
- `/app/mobile/SpiritSongs/src/screens/AlbumScreen.js`
- `/app/mobile/SpiritSongs/src/screens/LibraryScreen.js`
- `/app/mobile/SpiritSongs/src/components/AddToPlaylistModal.js`
- `/app/mobile/SpiritSongs/src/components/Toast.js` - Custom toast notification system
- `/app/mobile/SpiritSongs/src/context/PlayerContext.js` - Audio playback management
- `/app/mobile/SpiritSongs/src/context/AuthContext.js` - Authentication state
- `/app/mobile/SpiritSongs/src/services/api.js`
- `/app/mobile/SpiritSongs/app.json`

### Backend
- `/app/backend/server.py` - Monolithic backend (needs refactoring)

---

## User Preferences
- **Language:** English with Swahili terms for UI elements
- **Design:** Spotify-like dark theme
- **Build Account:** gracefy12 (Expo)

---

*Last Updated: January 26, 2026*
