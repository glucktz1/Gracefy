# Spirit Songs - Christian App Admin Dashboard PRD

## Original Problem Statement
Build a comprehensive Christian app with features similar to Spotify, Clubhouse, and Facebook. Build admin dashboard for managing content, choir dashboard for artists, and a user-facing streaming app for listeners with a modern dark theme design.

## User Choices
- **Authentication**: 
  - Admin: Emergent-managed Google OAuth
  - Choir: Email/Password JWT
  - Users: Email/Phone/Password + Google OAuth
- **Design**: Dark mode, modern music streaming UI
- **Storage**: Firebase Cloud Storage (MOCKED - using MongoDB base64)
- **Live Seminars**: Google Meet integration (scheduling only)
- **Payments**: M-Pesa mobile money (API placeholder with MOCK OTP)
- **SMS**: MOCK implementation (logs to database)
- **Mobile**: PWA + React Native (Android/iOS) planned

## Architecture
- **Backend**: FastAPI (Python) with Motor async MongoDB driver
- **Frontend**: React with Shadcn UI components
- **Database**: MongoDB
- **Authentication**: 
  - Admin: Emergent Google OAuth
  - Choir: Email/Password JWT with session management
  - App Users: Email/Phone/Password with JWT tokens

## What's Been Implemented

### Phase 4 - Enhanced Analytics & User Streaming App (January 14, 2026)

**Enhanced Analytics Dashboard:**
- ✅ GET `/api/analytics/enhanced` - Comprehensive analytics with period filtering (7d, 30d, 90d, 1y)
- ✅ GET `/api/analytics/realtime` - Real-time streaming stats
- ✅ Metrics: total streams, unique listeners, stream hours, revenue breakdown
- ✅ Daily trends, top songs, top choirs, category distribution
- ✅ Platform stats: albums, songs, choirs, users count
- ✅ Frontend: EnhancedAnalyticsPage (`/analytics`) with charts and tables

**User Streaming App (PWA):**
- ✅ POST `/api/user/register` - Register with email or phone
- ✅ POST `/api/user/login` - Login with email/phone + password
- ✅ GET `/api/user/me` - Get authenticated user profile
- ✅ GET `/api/user/home` - Home screen with layout sections and burners
- ✅ GET `/api/user/browse/categories` - Browse all categories
- ✅ GET `/api/user/browse/category/{id}` - Get category albums
- ✅ GET `/api/user/album/{id}` - Get album with all songs
- ✅ GET `/api/user/search` - Search songs, albums, artists
- ✅ POST `/api/user/favorites/add` - Add to favorites
- ✅ POST `/api/user/favorites/remove` - Remove from favorites
- ✅ GET `/api/user/library` - User library (favorites, playlists, recently played)
- ✅ POST `/api/user/playlist/create` - Create playlist
- ✅ POST `/api/user/playlist/{id}/add` - Add song to playlist
- ✅ GET `/api/user/playlist/{id}` - Get playlist with songs

**Frontend - UserStreamingApp (`/app`):**
- ✅ Modern dark theme design
- ✅ Sidebar navigation: Home, Search, Library
- ✅ Home screen with sections and promotional burners
- ✅ Album view with play button, favorites, song list
- ✅ Search view with results for albums, songs, artists
- ✅ Library view with favorites, playlists, recently played
- ✅ Player bar UI with play/pause, skip, shuffle, repeat, progress, volume
- ✅ Auth modal with email/phone/password + Google OAuth
- ✅ Mobile responsive with bottom navigation

### Phase 4.5 - User App UI Improvements (January 14, 2026)

**UI Components:**
- ✅ HeroSection: Full-width hero with centered CTA, dynamic content from burners
- ✅ QuickAccessCard: Grid items right below greeting (linked to layout manager)
- ✅ CategoryFilters: Filter pills (All, Prayers, Christmas, Lent, Catechism, etc.)
- ✅ SectionHeader: Title with "Show all" button for sections with many items
- ✅ AlbumCardWide: Wide rectangular cards for featured carousel (max 5)
- ✅ AlbumCardSquare: Standard square album cards
- ✅ ListItem: Compact list-style cards for variety
- ✅ ArtistCard: Circular artist cards
- ✅ Different section layouts alternate for visual variety

**Audio Player (WORKING):**
- ✅ HTML5 Audio API with real playback
- ✅ MiniPlayer: Fixed at bottom with progress bar, song info, controls
- ✅ FullPlayer: Full-screen modal with large album art, all controls
- ✅ Controls: Play/Pause, Next, Previous, Shuffle, Repeat (off/all/one)
- ✅ Progress: Seekable slider with time display
- ✅ Volume: Desktop slider control
- ✅ Sample audio fallback when no audio_url in song data

**Backend Updates:**
- ✅ DEFAULT_CATEGORIES: Prayers, Christmas, Lent, Catechism, Worship, Gospel, Hymns, Praise, Easter, Marian
- ✅ DEFAULT_SECTIONS with content_ids for admin-controlled quick access and carousel
- ✅ Featured albums carousel limited to 5 items
- ✅ Auto-creation of default categories and sections if empty

### Phase 3 - Layout Management System (January 14, 2026)

**Backend - Layout Sections:**
- ✅ Full CRUD for layout sections
- ✅ Section types: hero, quick_access, featured_albums, seasonal, trending, cta, custom
- ✅ Section reordering, toggle visibility, content assignment
- ✅ Platform targeting (app/web)

**Backend - Layout Burners:**
- ✅ Full CRUD for promotional banners
- ✅ Full styling: gradients, colors, icons, CTA buttons
- ✅ Click/impression tracking

**Frontend - LayoutManagementPage (`/layout-management`):**
- ✅ Three tabs: Sections, Burners, Preview
- ✅ Drag-to-reorder sections
- ✅ Content assignment modal
- ✅ Live burner preview

### Phase 1 - Core Admin Analytics & Choir Management (January 14, 2026)

**Backend:**
- ✅ Enhanced Singer/Choir model with:
  - Denomination (Roman Catholic, Lutheran, Anglican, etc.)
  - Treasurer name & phone
  - Chairman name & phone
  - Parish Priest name & phone
- ✅ Admin choir analytics endpoints:
  - GET `/api/admin/choirs` - List all choirs with performance stats
  - GET `/api/admin/choirs/{choir_id}` - Detailed choir view with albums, revenue, withdrawals
  - POST `/api/admin/choirs` - Create choir with all enhanced fields
  - PUT `/api/admin/choirs/{choir_id}` - Update, approve, suspend choirs
- ✅ Admin album/song management:
  - GET `/api/admin/albums` - List all albums with songs and stats
  - PUT `/api/admin/albums/{album_id}` - Enable/disable albums
  - PUT `/api/admin/songs/{song_id}` - Enable/disable songs
  - POST `/api/admin/albums/{album_id}/approve` - Approve album with all songs
- ✅ SMS notification service (MOCK):
  - Logs to database with status 'mock_sent'
  - Provision for future SMS provider integration (Twilio, Africa's Talking, Beem)
  - Withdrawal notifications to treasurer, chairman, and parish priest

**Frontend:**
- ✅ ChoirManagementPage (`/admin/choirs`):
  - List all choirs with stats (albums, songs, hours, revenue)
  - Search and filter by status
  - Create/edit choir with enhanced fields
  - Approve/suspend choirs
- ✅ ChoirDetailsPage (`/admin/choirs/{choirId}`):
  - Overview with monthly revenue chart
  - Albums tab with songs list and audio preview
  - Enable/disable albums and individual songs
  - Approve albums with all songs
  - Withdrawals history
  - Contacts tab (treasurer, chairman, priest)

### Phase 2 - Monetization Settings (January 14, 2026)

**Backend - MonetizationSettings Model with 14 Sections:**
1. ✅ Subscription Settings (price, billing cycle, free trial, auto-renew, grace period)
2. ✅ Platform Revenue Settings (platform fee %, effective date, apply to subscriptions/donations)
3. ✅ Content Revenue Rates (premium/standard rates per hour, effective date)
4. ✅ Premium Content Rules (duration days, auto-downgrade, approval required)
5. ✅ Listening Time Rules (min 45 seconds, max hours per user)
6. ✅ Payout Settings (minimum threshold, frequency, cutoff day, fee handling)
7. ✅ Payout Methods (Mobile Money, Bank Transfer, PayPal toggles)
8. ✅ Tips & Donations (enable tips, suggested amounts, platform fee)
9. ✅ Album Monetization Controls (subscription-only, free promotional, geo-restricted)
10. ✅ Tax & Compliance (VAT, withholding tax, invoice generation)
11. ✅ Currency & Rounding (base currency TZS, rounding precision)
12. ✅ Analytics & Reporting (aggregation interval, data retention)
13. ✅ Alerts & Monitoring (revenue drop, unusual spikes, failed payouts)
14. ✅ Permissions & Safety (freeze monetization, pause payouts, emergency rollback)

**Subscription Plans:**
- ✅ Default plans: Daily (500 TZS), Weekly (2000 TZS), Monthly (5000 TZS), Yearly (50000 TZS)
- ✅ CRUD operations for subscription plans
- ✅ Plan features list

**Frontend - MonetizationSettingsPage (`/monetization`):**
- ✅ 6 organized tabs: General, Subscriptions, Content Rates, Payouts, Tax, Safety
- ✅ Subscription plans management with create/edit/delete
- ✅ Rate change history viewer
- ✅ Emergency controls (pause all payouts, freeze monetization)
- ✅ Save all changes with single button

### Phase 3 - Layout Management System (January 14, 2026)

**Backend - Layout Sections:**
- ✅ LayoutSection model with section types: hero, quick_access, featured_albums, seasonal, trending, cta, custom
- ✅ GET `/api/layout/sections` - List all sections with platform/active filtering
- ✅ GET `/api/layout/sections/{section_id}` - Get specific section with content items
- ✅ POST `/api/layout/sections` - Create section with auto-ordering
- ✅ PUT `/api/layout/sections/{section_id}` - Update section properties
- ✅ DELETE `/api/layout/sections/{section_id}` - Delete section
- ✅ PUT `/api/layout/sections/{section_id}/toggle` - Toggle active status
- ✅ POST `/api/layout/sections/reorder` - Reorder sections with new sort_order
- ✅ POST `/api/layout/sections/{section_id}/assign-content` - Assign categories/albums/songs

**Backend - Layout Burners (Promotional Banners):**
- ✅ LayoutBurner model with full styling options (gradients, colors, icons)
- ✅ GET `/api/layout/burners` - List all burners with platform/active filtering
- ✅ GET `/api/layout/burners/{burner_id}` - Get specific burner
- ✅ POST `/api/layout/burners` - Create burner with auto-ordering
- ✅ PUT `/api/layout/burners/{burner_id}` - Update burner properties
- ✅ DELETE `/api/layout/burners/{burner_id}` - Delete burner
- ✅ PUT `/api/layout/burners/{burner_id}/toggle` - Toggle active status

**Backend - Layout Config & Analytics:**
- ✅ GET `/api/layout/config/{platform}` - Get complete layout for app/web platform
- ✅ POST `/api/layout/sections/{section_id}/track-click` - Analytics tracking
- ✅ POST `/api/layout/burners/{burner_id}/track-click` - Click tracking
- ✅ POST `/api/layout/burners/{burner_id}/track-impression` - Impression tracking

**Frontend - LayoutManagementPage (`/layout-management`):**
- ✅ Three tabs: Sections, Burners, Preview
- ✅ Platform filter toggle (App/Web)
- ✅ Section management: Create, edit, delete, reorder, toggle visibility
- ✅ Content assignment modal for categories/albums
- ✅ Burner management: Create, edit, delete with live preview
- ✅ Full styling options: Gradients, colors, icons, CTA buttons
- ✅ Preview mode showing sections and burners in order

### Previously Implemented (Phase 0)

- ✅ Admin Dashboard MVP with 45+ API endpoints
- ✅ Choir JWT authentication (email/password)
- ✅ Choir Dashboard with tabs: Overview, My Content, Requests
- ✅ Revenue calculation with 45-second minimum stream rule
- ✅ Payment details submission with OTP verification (MOCK)
- ✅ Content upload with admin approval
- ✅ Withdrawal requests with priest notifications

## Revenue Model
- **Calculation**: Time-based (listening hours × rate per hour)
- **Content Types**: Premium (higher rate) and Standard
- **Platform Share**: Configurable (default 30%)
- **Minimum Withdrawal**: Configurable (default TZS 10,000)
- **45-Second Rule**: Only streams >= 45 seconds count toward revenue

## Test Credentials
- **Test Choir Account**: testchoir@example.com / test123
- **Test Choir with Full Details**: St. Mary Cathedral Choir (sing_6ac984c0ee0e)
- **Admin**: Google OAuth (Emergent-managed)

## Mocked Features
1. **OTP Verification**: Returns OTP code in API response (mock_otp field)
2. **SMS Notifications**: Logged to database with status 'mock_sent'
3. **Mobile Money/Bank Payouts**: Withdrawal requests created but payouts require manual processing

## API Endpoints Summary

### Admin Choir Management
- GET `/api/admin/choirs` - List all choirs with stats
- GET `/api/admin/choirs/{choir_id}` - Detailed choir view
- POST `/api/admin/choirs` - Create choir
- PUT `/api/admin/choirs/{choir_id}` - Update/approve/suspend choir

### Admin Album/Song Management
- GET `/api/admin/albums` - List all albums
- GET `/api/admin/albums/{album_id}` - Album details with songs
- PUT `/api/admin/albums/{album_id}` - Update/enable/disable album
- PUT `/api/admin/songs/{song_id}` - Update/enable/disable song
- POST `/api/admin/albums/{album_id}/approve` - Approve album with all songs

### Monetization Settings
- GET `/api/monetization/settings` - Get all settings
- PUT `/api/monetization/settings` - Update settings
- GET `/api/monetization/rate-history` - Rate change history
- GET `/api/monetization/plans` - List subscription plans
- POST `/api/monetization/plans` - Create plan
- PUT `/api/monetization/plans/{plan_id}` - Update plan
- DELETE `/api/monetization/plans/{plan_id}` - Delete plan
- POST `/api/monetization/pause-all-payouts` - Emergency pause
- POST `/api/monetization/resume-payouts` - Resume payouts
- POST `/api/monetization/freeze-choir/{choir_id}` - Freeze choir monetization
- GET `/api/monetization/feature-controls` - Get free vs paid feature settings
- PUT `/api/monetization/feature-controls` - Update feature controls (admin)
- GET `/api/user/subscription-status` - Get user subscription tier and features

### SMS Notifications (MOCK)
- GET `/api/admin/sms-logs` - View SMS logs
- POST `/api/admin/sms/send` - Manual SMS (for testing)

### Layout Management
- GET `/api/layout/sections` - List sections
- POST `/api/layout/sections` - Create section
- PUT `/api/layout/sections/{section_id}` - Update section
- DELETE `/api/layout/sections/{section_id}` - Delete section
- PUT `/api/layout/sections/{section_id}/toggle` - Toggle active
- POST `/api/layout/sections/reorder` - Reorder sections
- POST `/api/layout/sections/{section_id}/assign-content` - Assign content
- GET `/api/layout/burners` - List burners
- POST `/api/layout/burners` - Create burner
- PUT `/api/layout/burners/{burner_id}` - Update burner
- DELETE `/api/layout/burners/{burner_id}` - Delete burner
- PUT `/api/layout/burners/{burner_id}/toggle` - Toggle active
- GET `/api/layout/config/{platform}` - Get layout for app/web

### User Streaming App
- POST `/api/user/register` - Register with email/phone
- POST `/api/user/login` - Login with email/phone
- GET `/api/user/me` - Get authenticated user profile
- GET `/api/user/home` - Home screen data with layout sections
- GET `/api/user/browse/categories` - Browse categories
- GET `/api/user/browse/category/{id}` - Category albums
- GET `/api/user/album/{id}` - Album with songs
- GET `/api/user/search?q={query}` - Search content
- POST `/api/user/favorites/add` - Add to favorites
- POST `/api/user/favorites/remove` - Remove from favorites
- GET `/api/user/library` - User library
- POST `/api/user/playlist/create` - Create playlist
- POST `/api/user/playlist/{id}/add` - Add to playlist
- GET `/api/user/playlist/{id}` - Get playlist

### Enhanced Analytics
- GET `/api/analytics/enhanced` - Comprehensive analytics (7d/30d/90d/1y)
- GET `/api/analytics/realtime` - Real-time streaming stats

### File Upload
- POST `/api/upload` - Single file upload (images→data URL, audio→streaming URL)
- POST `/api/upload/multiple` - Bulk upload with song name extraction from filenames
- GET `/api/files/{file_id}/stream` - Audio streaming with Range header support
- GET `/api/files/{file_id}` - File metadata

### Phase 5 - React Native Mobile App (December 2025 - January 2026)

**Mobile App Structure (`/app/mobile/SpiritSongs/`):**
- ✅ Expo project with React Native (SDK 54)
- ✅ Navigation: Bottom tabs (Home, Search, Library, Profile) + Stack screens
- ✅ Dark theme with Spotify-like UI
- ✅ Connected to existing backend APIs
- ✅ EAS Build configuration for Android APK generation

**Screens Implemented:**
- ✅ `HomeScreen.js`: Hero section, filter tabs below hero, quick access grid (8 tiles - liked songs, playlists, admin content), multiple layout sections
- ✅ `SearchScreen.js`: Search bar, category grid browser, search results
- ✅ `LibraryScreen.js`: Playlists, Liked Songs, Downloads, Recent tabs with offline song management
- ✅ `AlbumScreen.js`: Album detail with song list, play/shuffle buttons, download all functionality, optimized loading with caching
- ✅ `CategoryScreen.js`: Category album grid view
- ✅ `NowPlayingScreen.js`: Full-screen player with all controls including working download button
- ✅ `LoginScreen.js`: Email/Phone login/register
- ✅ `ProfileScreen.js`: User profile with subscription plans, account settings, logout

**Components Implemented:**
- ✅ `AnimatedBars.js`: Dancing bars animation when song plays
- ✅ `MiniPlayer.js`: Bottom mini player with progress bar
- ✅ `SongListItem.js`: Song row with 3-dot action menu (like, add to playlist, share)
- ✅ `CategoryTabs.js`: Horizontal filter tabs
- ✅ `PlaylistModal.js`: Add to playlist / create playlist modal (FIXED: now creates playlists correctly)

**Services:**
- ✅ `api.js`: API client with authentication
- ✅ `downloadService.js`: Offline download management (download, remove, clear, get downloaded songs)

**Contexts:**
- ✅ `AuthContext.js`: JWT authentication, favorites management
- ✅ `PlayerContext.js`: Audio playback with expo-av, queue management, shuffle/repeat, download functionality

**Features (v1.0.3):**
- ✅ Audio player with play/pause, next/previous, shuffle, repeat (off/all/one)
- ✅ Progress bar with seek functionality
- ✅ Like/favorite songs (working)
- ✅ Add to playlist / create new playlist (FIXED)
- ✅ Share songs (working)
- ✅ Queue management
- ✅ Album art rotation animation
- ✅ Dancing bars animation while playing
- ✅ Background/lock screen playback (Android)
- ✅ **Offline downloads**: Download songs for offline listening
- ✅ **Quick access grids**: 8 tiles (4 per row) below hero - Liked Songs, Playlists + admin content
- ✅ **Filter tabs below hero**: Category filters positioned after hero section
- ✅ **Profile tab in bottom navigation**: Easy access to user profile and subscription
- ✅ **Album loading optimization**: Caching for faster repeat loads

## Next Tasks (Priority Order)
1. **P1 - Build & Test New APK**: Build APK with monetization features and test on device
2. **P1 - Choir Album/Song Editing**: Allow choirs to edit their existing albums/songs (pending admin approval)
3. **P2 - Google Meet Integration**: Auto-generate meeting links for Live Seminars
4. **P2 - Real SMS Integration**: Integrate Africa's Talking or Twilio for actual SMS
5. **P2 - Real M-Pesa Integration**: Implement actual mobile money payouts
6. **P2 - Google OAuth for Users**: Add Google OAuth option to user streaming app

## Future/Backlog
- Audio Rooms (Clubhouse-style)
- Christian Community features (Facebook-like)
- Push notifications
- Backend refactoring (break down server.py into modular structure)

### Phase 5.5 - Monetization & Feature Gates (January 15, 2026)

**Backend - Monetization Feature Controls:**
- ✅ GET `/api/monetization/feature-controls` - Get free vs paid feature settings
- ✅ PUT `/api/monetization/feature-controls` - Update feature controls (admin)
- ✅ GET `/api/user/subscription-status` - Get user's subscription tier and applicable features

**Admin Panel - MonetizationSettingsPage (`/monetization`):**
- ✅ Feature Controls tab with side-by-side Free vs Premium comparison
- ✅ Configurable settings: skips per hour, preview duration (seconds), song selection, shuffle control
- ✅ Toggle controls for: downloads, playlists, premium content, ads, offline mode, background play
- ✅ Select options for: play mode (preview/limited/full), album playback, audio quality, background play
- ✅ Reset to defaults functionality
- ✅ Save Feature Controls button

**Mobile App - Subscription Integration:**
- ✅ `SubscriptionContext.js`: Context for managing subscription state and feature checks
- ✅ `SubscriptionScreen.js`: Premium upgrade screen with feature comparison and subscription plans
- ✅ Feature gate checks throughout the app
- ✅ Upgrade prompts with "Maybe Later" and "Upgrade Now" options
- ✅ Skip counter display for free users (e.g., "6 skips left this hour")
- ✅ Lock icons on restricted features for free users

**Feature Gates Implemented (Free Users):**
- ✅ Limited skips per hour (admin configurable, default 6)
- ✅ Cannot select specific songs (shuffle only)
- ✅ Preview playback only (configurable duration, default 30 sec)
- ✅ Cannot download songs for offline
- ✅ Cannot create playlists
- ✅ Forced shuffle mode
- ✅ Ads shown (placeholder)
- ✅ Standard audio quality only
- ✅ Limited background play

**Updated Screens:**
- ✅ `NowPlayingScreen.js`: Skip limit display, upgrade prompts for downloads/playlists, lock icons
- ✅ `AlbumScreen.js`: Song selection gates, shuffle-only for free users, upgrade prompts
- ✅ `ProfileScreen.js`: Premium banner, subscription status display, manage subscription link
- ✅ `SongListItem.js`: Custom onSongPress handler for subscription checks

**Layout Management Integration:**
- ✅ HomeScreen fetches dynamic content from `/api/user/home` (uses admin-configured layout sections)
- ✅ Sections, burners, and content controlled via admin Layout Management page

## Testing Status
- ✅ Phase 1 & 2: 45/45 tests passed (100%)
- ✅ Phase 3 Layout Management: 29/29 tests passed (100%)
- ✅ Phase 4 Enhanced Analytics & User App: 39/39 tests passed (100%)
- ✅ Phase 4.5 UI Improvements: 22/22 tests passed (100%)
- ✅ Phase 4.6 Audio Player: 19/21 tests passed (90%)
- ✅ File Upload System: 13/13 tests passed (100%)
- ✅ Audio streaming with Range header support - WORKING
- ✅ Bulk song upload with name extraction - WORKING
- ✅ Phase 5 React Native Mobile App: Structure complete (requires Android emulator testing)
- Test files: 
  - `/app/tests/test_layout_management.py`
  - `/app/tests/test_user_app_and_analytics.py`
  - `/app/tests/test_user_streaming_ui_improvements.py`
  - `/app/tests/test_audio_player_improvements.py`
  - `/app/tests/test_file_upload.py`

## Mobile App Testing & Build Instructions

### Development Testing
To test the React Native app in development:
1. Navigate to `/app/mobile/SpiritSongs`
2. Run `npm install` (if not already done)
3. Run `npx expo start`
4. Press `a` to open Android emulator or scan QR code with Expo Go app

### Building APK for Distribution
To build an APK for testing on physical devices:
1. Navigate to `/app/mobile/SpiritSongs`
2. Login to Expo: `npx eas login`
   - Email: `gcmgoodluck@gmail.com`
   - Password: `Fausta@8213`
3. Build APK: `npx eas build --platform android --profile preview`
4. Wait for build to complete (10-15 minutes)
5. Download the APK from the provided URL

### App Version History
- **v1.0.0**: Initial release
- **v1.0.1**: Fixed audio player, basic UI
- **v1.0.2**: Enhanced home screen with dynamic layouts, background playback
- **v1.0.3**: Fixed album navigation, song playback, playlist creation, added offline downloads, profile tab
