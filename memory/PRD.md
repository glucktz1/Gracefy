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
- **Version:** 1.0.34
- **Status:** IN_QUEUE (EAS Build)
- **Account:** gracefy12

### Completed Builds
- v1.0.32 APK: https://expo.dev/artifacts/eas/2TJf9ULWDB31zAnDwFGHEK.apk
- v1.0.31 APK: https://expo.dev/artifacts/eas/iCKtV3kMbY8g1A87c3rzRV.apk

---

## Prioritized Backlog

### P0 (Critical)
- [ ] Monitor and deliver v1.0.34 build APK

### P1 (High Priority)
- [ ] Complete Checkout and Transaction System
  - Build CheckoutScreen UI (mobile)
  - Build TransactionsPage UI (admin)
  - Integrate payment provider (Stripe/PayPal)
- [ ] Complete User Navigation Analytics Page
  - Build frontend UI to visualize navigation data

### P2 (Medium Priority)
- [ ] PWA "Play All" button for library sections
- [ ] Mobile lock screen controls
- [ ] Notification system implementation

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
| Expo EAS | ✅ Active | Mobile cloud builds |
| Stripe | 🔲 Planned | Payment processing |
| PayPal | 🔲 Planned | Payment processing |

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
- `/app/mobile/SpiritSongs/src/components/AddToPlaylistModal.js`
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

*Last Updated: January 23, 2026*
