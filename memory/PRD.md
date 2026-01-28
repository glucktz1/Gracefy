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
- **Backend**: FastAPI (Python) - Monolithic `/app/backend/server.py`
- **Frontend/Admin Panel**: React - `/app/frontend/`
- **Mobile App**: React Native (Expo) - `/app/mobile/SpiritSongs/`
- **Database**: MongoDB
- **CDN**: Bunny CDN for media storage
- **TTS**: Google Cloud TTS for Bible audio
- **Payments**: Azam Pay (Mobile Money - M-Pesa, Tigo Pesa, Airtel Money, Halo Pesa)

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
  - POST /api/payment/azampay/checkout - Initiate mobile money payment
  - POST /api/payment/callback/azampay - Handle Azam Pay webhooks
  - GET /api/payment/azampay/status/{id} - Check payment status
  - POST /api/payment/azampay/test-confirm/{id} - Test mode confirmation

## Payment System (2026-01-28)

### Azam Pay Integration
- **Test Mode**: Currently running in test mode (AZAMPAY_TEST_MODE=true)
- **MNO Support**: M-Pesa, Tigo Pesa, Airtel Money, Halo Pesa, Ezy Pesa
- **Phone Auto-Detection**: Detects MNO from phone prefix
- **Demo Checkout**: Users can test the flow with manual confirmation button

### Checkout Flow
1. User selects subscription plan
2. User enters phone number (+255)
3. System detects MNO automatically
4. Payment initiated → USSD prompt sent to phone
5. User confirms on phone OR uses test confirm button (demo)
6. Subscription activated upon successful payment

### Admin Controls
- Billing can be toggled on/off from Admin Settings
- When billing is disabled:
  - All users get premium features free
  - Payment screens hidden in mobile app
  - Subscription section not shown in profile

## Known Issues

### P0 - Critical
- **Background audio advancement** - App doesn't play next song when screen is locked
  - Cause: expo-av JavaScript gets suspended on mobile OS
  - Required Solution: `react-native-track-player` integration
  - Status: BLOCKED - EAS build failures with native modules

### P1 - High Priority
- **Azam Pay Credentials** - Current credentials may need verification with Azam Pay support
  - Test mode working, production mode requires valid credentials

### P2 - Medium Priority
- Animated splash screen needed
- Admin filter toggles for homepage

## Upcoming Tasks
1. Fix background audio advancement (P0)
2. Animated splash screen (P2)
3. Admin filter toggles for homepage categories

## Future/Backlog
- Backend refactoring (server.py is 13,000+ lines)
- PWA "Play All" button
- Live audio/video rooms (Agora/100ms)
- Remove unused Supabase code
- Production Azam Pay credentials setup

## Technical Notes

### Payment Configuration
```
AZAMPAY_CLIENT_ID=<configured>
AZAMPAY_CLIENT_SECRET=<configured>
AZAMPAY_TOKEN=<configured>
AZAMPAY_CALLBACK_URL=https://faith-audio-3.preview.emergentagent.com/api/payment/callback/azampay
AZAMPAY_TEST_MODE=true
```

### EAS Build
- Project uses `gracefy15` Expo account
- Current version: 1.0.66
- Build profiles in `/app/mobile/SpiritSongs/eas.json`

### Test Credentials
- Choir Portal: demo@gracefy.com / demo123456
- Expo Token: Ocf09mEKf7N8E9Pjwyf5-hQYLOevZO3OYEsrr9Bq

### Key Files
- `/app/mobile/SpiritSongs/src/screens/CheckoutScreen.js` - Payment checkout (NEW)
- `/app/mobile/SpiritSongs/src/screens/SubscriptionPlansScreen.js` - Plans selection
- `/app/mobile/SpiritSongs/src/screens/ProfileScreen.js` - User profile with transactions
- `/app/mobile/SpiritSongs/src/context/BillingContext.js` - Billing state management
- `/app/mobile/SpiritSongs/src/services/api.js` - Billing API endpoints
- `/app/frontend/src/pages/AdminSettingsPage.jsx` - Billing toggle
- `/app/frontend/src/pages/TransactionsPage.jsx` - Transaction tracking
- `/app/backend/server.py` - Azam Pay endpoints (lines 4315-4700)

### MNO Phone Prefixes (Tanzania)
```
Vodacom (M-Pesa): 74, 75, 76
Tigo (Tigo Pesa): 65, 67, 71
Airtel (Airtel Money): 68, 69, 78, 79
Halotel (Halo Pesa): 62
Zantel (Ezy Pesa): 77
```
