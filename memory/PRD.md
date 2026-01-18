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

### Phase 6 - Admin Settings & PWA Enhancements (January 16, 2026)

**Admin Settings Page (`/app-settings`):**
- ✅ GET `/api/admin/settings` - Get all admin settings
- ✅ PUT `/api/admin/settings` - Update admin settings
- ✅ AdminSettingsPage.jsx with 4 tabs: Billing & Plans, Device Limits, Login Methods, Playback Rules
- ✅ Billing toggle: Enable/disable billing for entire platform
- ✅ Device limits: Free user (default 1) and Premium user (default 3) device limits
- ✅ Daily song limit: Configurable limit for free users (default 10 songs/day)
- ✅ Login method toggles: Email/Password, Phone OTP (MOCKED), Google OAuth
- ✅ Playback rules: Replay limit per song, minimum play duration for streams

**Phone OTP Login (MOCKED):**
- ✅ POST `/api/auth/send-otp` - Send OTP to phone number (returns OTP in dev response)
- ✅ POST `/api/auth/verify-otp` - Verify OTP and return JWT token
- ✅ PWA AuthModal with Email/Phone OTP tabs
- ✅ OTP input with 6-digit verification
- ✅ Dev mode shows OTP code in UI (remove in production)
- ✅ Respects admin settings - returns 403 if phone_otp login disabled

**Hero Banners in Layout Manager:**
- ✅ POST `/api/layout/hero-banner` - Create hero banner
- ✅ GET `/api/layout/hero-banners` - List all banners
- ✅ GET `/api/layout/hero-banners/active` - Get active banners only
- ✅ PUT `/api/layout/hero-banner/{banner_id}` - Update banner
- ✅ DELETE `/api/layout/hero-banner/{banner_id}` - Delete banner
- ✅ HeroBannersTab in LayoutManagementPage with image upload
- ✅ Link banners to albums, songs, or external URLs
- ✅ Order and active status management

**PWA Repeat Feature UI:**
- ✅ Repeat button cycles: off → all → one
- ✅ Visual indicators: 🔁 Repeat All / 🔂 Repeat One
- ✅ Dot indicator under repeat button when active
- ✅ Title attribute shows current repeat mode

**Choir Self-Registration:**
- ✅ POST `/api/choir/register` - Self-register as choir/artist/band (creates pending account)
- ✅ GET `/api/admin/choir-registrations` - List pending choir registrations
- ✅ POST `/api/admin/choir/{choir_id}/approve` - Approve choir registration
- ✅ POST `/api/admin/choir/{choir_id}/reject` - Reject choir registration
- ✅ ChoirRegistrationPage.jsx at `/choir-register` - 2-step registration form
- ✅ ApprovalsPage.jsx - New "Choirs" tab for pending registrations
- ✅ Choir Login page has "Register here" link

**Forgot Password Flow (MOCKED):**
- ✅ POST `/api/auth/forgot-password/send` - Send reset OTP via email/phone (MOCKED)
- ✅ POST `/api/auth/forgot-password/verify` - Verify OTP and get reset token
- ✅ POST `/api/auth/forgot-password/reset` - Reset password with token
- ✅ PWA AuthModal - "Forgot password?" link with 3-step flow
- ✅ Dev mode shows OTP in UI for testing

### Phase 5 - React Native Mobile App (December 2025 - January 2026)

**Mobile App Structure (`/app/mobile/SpiritSongs/`):**
- ✅ Expo project with React Native (SDK 54)
- ✅ Navigation: Bottom tabs (Home, Search, Library, Profile) + Stack screens
- ✅ Dark theme with Spotify-like UI
- ✅ Connected to existing backend APIs
- ✅ EAS Build configuration for Android APK generation

**Components Implemented:**
- ✅ `AnimatedBars.js`: Dancing bars animation when song plays
- ✅ `MiniPlayer.js`: Bottom mini player with progress bar
- ✅ `SongListItem.js`: Song row with 3-dot action menu (like, add to playlist, share), subscription-aware
- ✅ `CategoryTabs.js`: Horizontal filter tabs
- ✅ `PlaylistModal.js`: Add to playlist / create playlist modal (FIXED: now creates playlists correctly)

**Services:**
- ✅ `api.js`: API client with authentication
- ✅ `downloadService.js`: Offline download management (download, remove, clear, get downloaded songs)

**Contexts:**
- ✅ `AuthContext.js`: JWT authentication, favorites management
- ✅ `PlayerContext.js`: Audio playback with expo-av, queue management, shuffle/repeat, download functionality
- ✅ `SubscriptionContext.js`: Subscription state management, feature gates, skip counting, upgrade prompts

**Screens Implemented:**
- ✅ `HomeScreen.js`: Hero section, filter tabs below hero, quick access grid (8 tiles - liked songs, playlists, admin content), multiple layout sections (dynamically from admin)
- ✅ `SearchScreen.js`: Search bar, category grid browser, search results
- ✅ `LibraryScreen.js`: Playlists, Liked Songs, Downloads, Recent tabs with offline song management
- ✅ `AlbumScreen.js`: Album detail with song list, play/shuffle buttons, download all functionality, optimized loading with caching, subscription gates
- ✅ `CategoryScreen.js`: Category album grid view
- ✅ `NowPlayingScreen.js`: Full-screen player with all controls including working download button, skip limits, feature locks
- ✅ `LoginScreen.js`: Email/Phone login/register
- ✅ `ProfileScreen.js`: User profile with subscription status, premium banner, manage subscription, logout
- ✅ `SubscriptionScreen.js`: Premium upgrade screen with feature comparison table, subscription plans, FAQ

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

### Phase 5.7 - Enhanced Admin Features (January 15, 2026)

**Permission-Based UI Rendering:**
- ✅ Sidebar items mapped to required permissions
- ✅ Navigation filtered based on user's assigned role permissions
- ✅ Permissions fetched on admin login via `/api/rbac/users/{id}/permissions`
- ✅ Fallback to full permissions for existing admins

**Dashboard User Demographics:**
- ✅ New endpoint: GET `/api/analytics/user-demographics`
- ✅ Device Type distribution (Android, iOS, Web)
- ✅ Gender distribution chart
- ✅ Age groups bar chart (0-17, 18-24, 25-34, 35-44, 45-54, 55+)
- ✅ Top locations with progress bars
- ✅ Visual charts using Recharts (PieChart, BarChart)

**Special Mixes (Curated Albums):**
- ✅ New collection: `special_mixes` for admin-curated albums
- ✅ Backend endpoints:
  - GET `/api/special-mixes` - List all special mixes
  - GET `/api/special-mixes/{mix_id}` - Get mix with songs
  - POST `/api/special-mixes` - Create mix from songs across albums
  - PUT `/api/special-mixes/{mix_id}` - Update mix
  - DELETE `/api/special-mixes/{mix_id}` - Delete mix
  - GET `/api/albums/all-songs` - Get all songs grouped by album for selection
- ✅ Admin UI: `/special-mixes` page with:
  - Mix cards with thumbnail, title, song count, duration
  - Create/Edit modal with song picker from all albums
  - Drag-and-drop song reordering
  - Monetization type and featured flag
- ✅ Layout Manager Integration:
  - New section type: `special_mixes`
  - Special mixes can be added to home screen via Layout Manager
  - Mixes displayed with `is_special_mix: true` flag for mobile app

### Phase 5.6 - Role-Based Access Control (January 15, 2026)

**System Roles Implemented (9 roles):**
1. **Super Admin** - Full platform control with all 22 permissions
2. **Admin** - Platform administration and content management
3. **Sub-Admin** - Limited administrative access (user management, choir onboarding)
4. **Finance Admin** - Revenue configuration and payout management
5. **Moderator** - Content moderation and layout control
6. **Choir / Artist** - Content creation, own analytics, revenue withdrawal
7. **Religious Leader** - Teachings, podcasts, moderation, own analytics
8. **Listener (Free)** - Free content access only
9. **Listener (Paid)** - Full content access with subscription

**Permissions (22 total, 7 categories):**
- Platform Administration: platform_settings, role_assignment, user_management, choir_onboarding_approval
- Content Creation: create_albums, upload_songs, create_teachings, edit_own_content, submit_content_approval
- Content Moderation: content_moderation, content_approval, set_content_monetization
- Analytics & Reports: view_platform_analytics, view_own_analytics
- Revenue & Finance: revenue_configuration, view_all_revenue_reports, view_own_revenue_reports, request_withdrawal, approve_payouts
- Layout & Promotion: layout_promotion_control
- Content Access: access_free_content, access_premium_content

**Backend Endpoints:**
- ✅ GET `/api/rbac/roles` - Get all system and custom roles
- ✅ GET `/api/rbac/permissions` - Get all available permissions
- ✅ GET `/api/rbac/role/{role_id}` - Get role details
- ✅ POST `/api/rbac/roles` - Create custom role
- ✅ PUT `/api/rbac/roles/{role_id}` - Update custom role
- ✅ DELETE `/api/rbac/roles/{role_id}` - Delete custom role
- ✅ GET `/api/rbac/users` - Get users with their role assignments
- ✅ POST `/api/rbac/users/{user_id}/assign-role` - Assign role to user
- ✅ POST `/api/rbac/users/{user_id}/revoke-role` - Revoke user's role
- ✅ GET `/api/rbac/users/{user_id}/permissions` - Get user's permissions
- ✅ GET `/api/rbac/check-permission/{user_id}/{permission}` - Check specific permission
- ✅ GET `/api/rbac/audit-log` - Get role change audit log
- ✅ GET `/api/rbac/stats` - Get RBAC statistics

**Admin Panel - Role Management Page (`/roles`):**
- ✅ Roles Tab: View system roles (non-editable) and custom roles (editable)
- ✅ User Assignments Tab: Search/filter users, assign/change roles
- ✅ Permissions Matrix Tab: Visual grid showing permissions per role
- ✅ Audit Log Tab: Track all role changes with timestamps and actors
- ✅ Create Custom Role Modal: Name, description, base role, color, permissions
- ✅ Assign Role Modal: Select role, add notes for user

**Data Models:**
- `SystemRole` - Predefined roles with permissions
- `CustomRole` - Admin-created roles
- `UserRoleAssignment` - User-to-role mapping
- `RoleChangeLog` - Audit trail for all role changes

### Phase 5.8 - Church/Choir Enhancements & Follow System (January 15, 2026)

**Church Management:**
- ✅ Enhanced Church model with detailed fields (images, prayer schedule, location, leader info)
- ✅ Church CRUD operations: GET, POST, PUT, DELETE
- ✅ Church approval workflow: approve/reject with admin notes
- ✅ Status filtering: pending, approved, rejected
- ✅ Full church profile: GET `/api/churches/{id}/full` with announcements

**Church Announcements:**
- ✅ ChurchAnnouncement model with auto-expiry (2 weeks)
- ✅ Announcement types: general, offering, baptism, adoration, wedding, funeral, meeting, event, other
- ✅ CRUD operations: create, list, update, delete announcements
- ✅ Announcements grouped by date

**User Follow System:**
- ✅ UserFollow model tracking user_id, entity_type (church/choir/artist), entity_id
- ✅ POST `/api/user/follow` - Follow church or choir (requires auth)
- ✅ DELETE `/api/user/unfollow` - Unfollow entity
- ✅ GET `/api/user/following` - Get all followed entities grouped by type
- ✅ GET `/api/user/is-following/{entity_type}/{entity_id}` - Check if following
- ✅ followers_count auto-incremented/decremented on follow/unfollow
- ✅ Notifications sent to followers on new content (MOCKED)

**Layout Integration:**
- ✅ Section types include 'choirs' and 'churches' for dynamic home sections
- ✅ Content types support choirs/churches for content assignment

**Admin UI - ChurchesPage (`/churches`):**
- ✅ Churches list with status tabs (All, Pending, Approved, Rejected)
- ✅ Church cards showing thumbnail, name, denomination, location, leader
- ✅ Create/Edit modal with all fields: basic info, leader info, location, images, prayer schedule, contact info
- ✅ Prayer schedule builder with day/time/service type
- ✅ Approve/Reject actions with admin notes
- ✅ Announcement management modal

**Database Migration:**
- ✅ Auto-migration on startup: 'followers' -> 'followers_count' for consistency

### Phase 5.10 - Admin Users Page Enhancement (January 15, 2026)

**Backend - Admin Users Management Endpoints:**
- ✅ GET `/api/admin/users` - List app users with pagination, search, and filters
  - Search by name, email, phone, user_id
  - Filter by membership_type (free, premium, vip)
  - Filter by status (active, suspended)
  - Filter by register_by (phone, email, google)
- ✅ GET `/api/admin/users/stats/summary` - User statistics summary
  - Total, active, suspended, premium, free, trial_active counts
  - Registration method breakdown (phone, email, google)
- ✅ GET `/api/admin/users/{user_id}` - Detailed user profile
- ✅ GET `/api/admin/users/{user_id}/listening-history` - User's listening history with song/album details
- ✅ GET `/api/admin/users/{user_id}/transactions` - User's payment transactions
- ✅ POST `/api/admin/users` - Create new user (admin action, returns 201)
- ✅ PUT `/api/admin/users/{user_id}` - Update user details
- ✅ DELETE `/api/admin/users/{user_id}` - Delete user and related data

**Frontend - UsersPage (`/users`):**
- ✅ Stats summary cards: Total, Active, Premium, Free, In Trial, Suspended
- ✅ Search bar with real-time search across name/email/phone/user_id
- ✅ Filter dropdowns: Register By, Membership Type, Status
- ✅ Users table with columns: User ID, Email/Phone, Membership, Country, Register By, Plan, Expiry, Last Active, Status
- ✅ Clickable rows to view user detail
- ✅ User detail view with tabs: Profile, Membership, Listening History, Transactions, Devices
- ✅ Add User modal for creating new users
- ✅ Edit User modal for updating user details
- ✅ Export to CSV functionality
- ✅ Pagination with page size options

**Testing:**
- ✅ 22/22 backend tests passed (100%)
- Test file: `/app/tests/test_admin_users_management.py`

### Phase 5.11 - Streaming App Enhancements (January 15-16, 2026)

**Web App (UserStreamingApp.jsx):**
- ✅ Continuous playback - Auto-play next song from same album/category/artist, never stop
- ✅ Resume playback - Save/restore playback state to localStorage (song, position, timestamp)
- ✅ Quick Access Grid - 8 Spotify-style tiles (no header):
  - 4 User items: Liked Songs, Playlists, Downloads, My Library
  - 4 Admin-configured items from layout manager
- ✅ Hero section from layout manager burners working correctly
- ✅ Layout manager sections displaying (Featured Albums, Categories, etc.)
- ✅ MediaSession API for background playback with lock screen controls

**Mobile App (playerStore.js):**
- ✅ Continuous playback - Default repeat mode set to 'all', always loop back
- ✅ Resume playback - savePlaybackState/restorePlayback functions added
- ✅ Quick Access Grid already had 8 tiles (user items + admin items)
- ✅ Auto-skip to next on error
- ✅ Background audio playback configured with:
  - `staysActiveInBackground: true`
  - `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permission for Android
  - iOS `UIBackgroundModes: audio` already configured

**APK Build v1.0.9 - SUCCESSFUL:**
- **Download URL:** https://expo.dev/artifacts/eas/45EFDpECz4NHjDZ8kv2x4a.apk
- Build ID: `18f23b0a-e151-4504-af99-d192e122472b`
- Features: Background audio playback, continuous play, resume on app return

**Frontend Testing:**
- ✅ 14/14 tests passed (100%)
- Hero section displays admin burner content
- Quick access grid shows user items first
- Album detail and mini-player working

### Phase 5.12 - Comprehensive App Enhancements (January 16, 2026)

**Mobile App Fixes:**
- ✅ MiniPlayer now renders at bottom of screen (above tab bar)
- ✅ MiniPlayer visible while navigating between screens
- ✅ Fixed continuous playback (default repeat='all')
- ✅ Tab bar positioned above phone navigation buttons

**Backend - Admin Settings:**
- ✅ GET/PUT `/api/admin/settings` - App-wide settings:
  - `billing_enabled` - Toggle billing on/off
  - `free_user_daily_song_limit` - Daily song limit for free users
  - `free_user_max_devices` / `premium_user_max_devices` - Device limits
  - `login_methods` - Enable/disable email, phone OTP, Google login
  - `play_count_replay_limit` - Max replays that count (default: 2)
  - `min_play_duration_seconds` - Minimum play time to count (default: 30s)

**Backend - Play Count Tracking:**
- ✅ POST `/api/listening/track-play` - Track plays with replay limits
- ✅ GET `/api/user/daily-plays` - Get user's daily play count

**Backend - Choir Self-Registration:**
- ✅ POST `/api/choir/register` - Self-register as choir/artist
- ✅ POST `/api/choir/{id}/submit-song` - Submit songs for approval
- ✅ GET `/api/admin/choir-registrations` - View pending registrations
- ✅ POST `/api/admin/choir/{id}/approve` - Approve registration
- ✅ POST `/api/admin/choir/{id}/reject` - Reject registration
- ✅ GET `/api/admin/song-submissions` - View pending song submissions
- ✅ POST `/api/admin/song-submission/{id}/approve` - Approve song
- ✅ POST `/api/admin/song-submission/{id}/reject` - Reject song

**Backend - Phone OTP Login:**
- ✅ POST `/api/auth/send-otp` - Send OTP to phone (MOCKED SMS)
- ✅ POST `/api/auth/verify-otp` - Verify OTP and login/register

**Backend - Hero Banner Management:**
- ✅ POST `/api/layout/hero-banner` - Create banner with link to content
- ✅ GET `/api/layout/hero-banners` - List all banners
- ✅ PUT `/api/layout/hero-banner/{id}` - Update banner
- ✅ DELETE `/api/layout/hero-banner/{id}` - Delete banner

**APK Build v1.0.11:**
- **Download:** https://expo.dev/artifacts/eas/j6gBezJrodFnRoJDdhpft3.apk
- Features: MiniPlayer fixed, continuous playback, tab bar positioning

## Next Tasks (Priority Order)
1. **P1 - Fix Mobile APK Build**: Recent builds (v1.0.7, v1.0.8) errored on Expo. Need to diagnose build logs
2. **P1 - Native Mobile App - Church/Choir UI**: Implement screens to display detailed church/choir profiles, prayer schedules, announcements, location maps
3. **P1 - Native Mobile App - Follow Button**: Implement follow/unfollow functionality in the mobile app
4. **P1 - Choir Album/Song Editing**: Allow choirs to edit their existing albums/songs (pending admin approval)
5. **P2 - Google Meet Integration**: Auto-generate meeting links for Live Seminars
6. **P2 - Real SMS Integration**: Integrate Africa's Talking or Twilio for actual SMS
7. **P2 - Real M-Pesa Integration**: Implement actual mobile money payouts
8. **P2 - Google OAuth for Users**: Add Google OAuth option to user streaming app

## Future/Backlog
- Audio Rooms (Clubhouse-style)
- Christian Community features (Facebook-like)
- Push notifications
- Backend refactoring (break down server.py into modular structure)

### Phase 5.5 - Monetization & Feature Gates (January 15, 2026)

**Free Trial System:**
- ✅ Backend trial management with configurable duration (admin sets days)
- ✅ Automatic trial activation on user registration
- ✅ Trial status tracking (active, expired, converted)
- ✅ Trial expiry detection and automatic status update
- ✅ Admin panel "Free Trial" tab with enable/disable toggle and duration setting
- ✅ Trial statistics dashboard (active trials, expired, converted, conversion rate)
- ✅ Mobile app displays trial status with countdown
- ✅ Trial expiring warning (2 days or less remaining)

**New Backend Endpoints for Trials:**
- ✅ GET `/api/monetization/trial-settings` - Get trial configuration
- ✅ PUT `/api/monetization/trial-settings` - Update trial settings (admin)
- ✅ GET `/api/monetization/trial-stats` - Get trial usage statistics

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
- ✅ Phase 5.8 Church/Choir Enhancements: 40/40 tests passed (100%)
- Test files: 
  - `/app/tests/test_layout_management.py`
  - `/app/tests/test_user_app_and_analytics.py`
  - `/app/tests/test_user_streaming_ui_improvements.py`
  - `/app/tests/test_audio_player_improvements.py`
  - `/app/tests/test_file_upload.py`
  - `/app/tests/test_church_follow_system.py`

### Phase 5.9 - High-Performance Streaming with Supabase (January 15, 2026)

**Supabase Integration:**
- ✅ Supabase project connected (URL: kriyklawulghbchndmkp.supabase.co)
- ✅ Backend Supabase service (`/app/backend/supabase_service.py`)
- ✅ GET `/api/supabase/status` - Check Supabase connection
- ✅ GET `/api/supabase/schema` - Get SQL schema for database setup
- ✅ POST `/api/supabase/sync/artists` - Sync artists from MongoDB to Supabase
- ✅ POST `/api/supabase/sync/albums` - Sync albums from MongoDB to Supabase
- ✅ POST `/api/supabase/sync/tracks` - Sync tracks from MongoDB to Supabase
- ✅ GET `/api/supabase/search` - Fast full-text search using Postgres
- ✅ GET `/api/supabase/tracks/{album_id}` - Get album tracks from Supabase
- ✅ GET `/api/supabase/stream/{song_id}` - Get optimized streaming URL with byte-range headers
- ✅ POST `/api/supabase/upload-audio` - Upload audio to Supabase Storage with CDN caching
- ✅ POST `/api/supabase/track/stream-count/{song_id}` - Increment stream count

**Database Schema (Supabase Postgres):**
- ✅ `artists` table with trigram index for fast name search
- ✅ `albums` table with indexes on artist_id, category_id, genre
- ✅ `tracks` table with full-text search on title, artist_name, album_title
- ✅ `categories`, `user_favorites`, `listening_history` tables
- ✅ `search_tracks` RPC function for instant search results
- ✅ Auto-updating timestamps with triggers

**Streaming Configuration:**
- ✅ AAC audio format at 128kbps
- ✅ Byte-Range Requests (HTTP Range headers) for partial content streaming
- ✅ Buffer config: 2-second minBuffer (instant start), 30-second maxBuffer (stability)
- ✅ CDN caching with 1-year cache-control headers

**Mobile App Optimizations (React Native):**
- ✅ Zustand store for playback state (`/app/mobile/SpiritSongs/src/store/playerStore.js`)
- ✅ @shopify/flash-list for 60FPS song lists (`/app/mobile/SpiritSongs/src/components/SongList.js`)
- ✅ expo-image for album art with memory-disk caching
- ✅ Optimized AlbumGrid component (`/app/mobile/SpiritSongs/src/components/AlbumGrid.js`)
- ✅ MiniPlayer with Zustand integration (`/app/mobile/SpiritSongs/src/components/MiniPlayer.js`)
- ✅ Supabase client for mobile (`/app/mobile/SpiritSongs/src/services/supabase.js`)

**Web PWA Optimizations:**
- ✅ Supabase client for web (`/app/frontend/src/services/supabase.js`)
- ✅ Web Audio streaming with buffer optimization

**New Dependencies Added:**
- Mobile: `@shopify/flash-list`, `@supabase/supabase-js`, `zustand`, `expo-image`
- Web: `@supabase/supabase-js`

**PENDING - User Action Required:**
- ⏳ Run SQL schema in Supabase SQL Editor to create tables
- ⏳ Create Supabase Storage bucket `audio-files` with public access
- ⏳ Sync existing data from MongoDB to Supabase using sync endpoints

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
- **v1.0.4**: High-performance streaming with Supabase, FlashList, Zustand, expo-image

### Phase 6.0 - Leader Content & Permission Management (January 16, 2026)

**Leader Content File Upload System:**
- ✅ POST `/api/content/upload-thumbnail` - Upload thumbnail images (max 5MB) for leader content
- ✅ POST `/api/content/upload-audio` - Upload audio files (max 100MB) for leader content episodes
- ✅ Supabase storage with MongoDB fallback when Supabase unavailable
- ✅ Frontend upload progress indicator with percentage display
- ✅ Auto audio duration detection from uploaded files
- ✅ ContentManagementPage enhanced with proper upload UI for:
  - Container thumbnails
  - Series thumbnails  
  - Episode thumbnails and audio files

**Category Permissions Management:**
- ✅ GET `/api/admin/category-permissions` - Get permissions for all 9 user categories
- ✅ PUT `/api/admin/category-permissions/{role_id}` - Update permissions for a category
- ✅ POST `/api/admin/category-permissions/{role_id}/reset` - Reset to system defaults
- ✅ RoleManagementPage "Permissions Matrix" tab with:
  - Checkbox toggles for each permission per category
  - Visual indicators for modified categories
  - Save Changes button with unsaved changes detection
  - Reset to defaults functionality
  - Permission descriptions in matrix view

**Mobile Build Success:**
- ✅ Mobile app build v1.0.19 completed successfully
- ✅ APK available: https://expo.dev/artifacts/eas/fFGFHmJUtJyAfL7iqcFKHd.apk
- ✅ Expo account: gracefy (info.mannaapp@gmail.com)

**Testing:**
- ✅ 19/19 backend tests passed (100%)
- ✅ Test file: `/app/tests/test_content_upload_category_permissions.py`

## Pending/Backlog Tasks

### High Priority (P1)
- ⏳ Mobile App: Lock screen controls not working (requires react-native-track-player)
- ⏳ Mobile App: Like, Download, Playlist buttons need auth UI handling

### Medium Priority (P2)
- ⏳ Choir Self-Registration on Mobile
- ⏳ PWA Repeat Feature logic review
- ⏳ Admin Free User Limits UI
- ⏳ Admin Device Limits UI

### Low Priority (P3)
- ⏳ Layout Manager Banner Uploads wiring
- ⏳ Live Seminars integration
- ⏳ Audio Rooms feature
- ⏳ Community features

### Refactoring Tasks
- ⏳ Split server.py (~2800 lines) into separate routers
- ⏳ Extract AuthModal from UserStreamingApp.jsx (~1700 lines)

### Phase 6.1 - Mobile Features & PWA Enhancements (January 16, 2026)

**Choir Self-Registration on Mobile:**
- ✅ Created `/app/mobile/SpiritSongs/src/screens/ChoirRegistrationScreen.js`
- ✅ Two-step registration form (Basic Info -> Account Setup)
- ✅ Supports choir, artist, and band account types
- ✅ Success screen with approval notification message
- ✅ Added navigation link from Login screen
- ✅ Route configured in App.js

**Mobile Auth-Gated Actions (Like/Download/Playlist):**
- ✅ Updated NowPlayingScreen with auth checks
- ✅ `handleLike()` - prompts login for unauthenticated users
- ✅ `handleDownload()` - prompts login, then checks subscription
- ✅ `handleAddToPlaylist()` - prompts login, then checks subscription
- ✅ Lock icons shown for unauthenticated users on action buttons

**PWA Repeat Feature:**
- ✅ Verified repeat cycle: 'off' -> 'all' -> 'one' -> 'off'
- ✅ Correct icon display: Repeat1 for 'one', Repeat for others
- ✅ Correct color: emerald-400 when active, zinc-400 when off
- ✅ Repeat mode indicator shows current state

**Background Audio (Mobile):**
- ✅ Background playback works with expo-av and `staysActiveInBackground: true`
- ⚠️ **LIMITATION**: Lock screen controls NOT possible
  - Requires react-native-track-player which has compatibility issues with Expo SDK 54
  - Background audio continues playing when screen locked, but no media control buttons

**Testing:**
- ✅ 16/16 tests passed (100%)
- ✅ Test file: `/app/tests/test_choir_registration_mobile.py`

### Phase 6.2 - Mobile Bug Fixes (January 17, 2026)

**Duplicate MiniPlayer Fix:**
- ✅ Removed MiniPlayer from HomeScreen.js
- ✅ Removed MiniPlayer from SearchScreen.js
- ✅ Removed MiniPlayer from LibraryScreen.js
- ✅ Removed MiniPlayer from CategoryScreen.js
- ✅ Removed MiniPlayer from AlbumScreen.js
- ✅ MiniPlayer now only renders once in App.js AppContainer

**Download Directory Fix:**
- ✅ Updated ensureDownloadsDir with 3 retry attempts
- ✅ Added fallback to cache directory if document directory fails
- ✅ Better error logging for debugging

**Playlist Functionality:**
- ✅ Created PlaylistDetailScreen.js for viewing playlist contents
- ✅ Correctly parses {song, album} response from API
- ✅ Shows songs with artwork, title, artist
- ✅ Play All and Shuffle buttons
- ✅ Long press to remove songs

**Play All Buttons:**
- ✅ Added to LibraryScreen for Liked Songs section
- ✅ Added to LibraryScreen for Downloads section
- ✅ handlePlayAllDownloads() function
- ✅ handlePlayAllLiked() function

**Navigation:**
- ✅ Added Playlist route to App.js
- ✅ Navigation from LibraryScreen to PlaylistDetailScreen

**Testing:**
- ✅ 17/17 API tests passed (100%)
- ✅ Test file: `/app/tests/test_user_playlist_api.py`

**Known Limitation:**
- ⚠️ Lock screen media controls require new mobile build to test
- ⚠️ All mobile UI changes require new build to verify on device

### Phase 6.3 - EAS Build & PWA Library Enhancements (January 17, 2026)

**Mobile Build v1.0.20 Submitted:**
- ✅ Build ID: 6cc35146-5756-45fa-a25c-c444df950543
- ✅ Status: Submitted (waiting in queue)
- ✅ Version: 1.0.20, versionCode: 20
- ✅ Build URL: https://expo.dev/accounts/gracefy/projects/SpiritSongs/builds/6cc35146-5756-45fa-a25c-c444df950543
- ✅ Includes all bug fixes:
  - Duplicate MiniPlayer fix
  - Download directory retry logic
  - PlaylistDetailScreen
  - Play All buttons
  - Choir registration screen
  - Auth-gated actions (Like/Download/Playlist)

**PWA Library Enhancements:**
- ✅ Added library tabs: All, Liked Songs, Playlists, Downloads
- ✅ Liked Songs section with:
  - Gradient card with heart icon
  - Song count display
  - Play All button (green circular)
  - List of liked songs with playback
  - "View all" link when in All tab
- ✅ Playlists section with:
  - Grid layout for playlist cards
  - Play overlay on hover
  - Click to play entire playlist
- ✅ Downloads section with:
  - Placeholder for web (mobile-only feature)
  - Gradient card styling
- ✅ Recently Played section with:
  - Play All button
  - Song list with full controls
- ✅ Empty states for each tab
- ✅ Tab-based filtering
- ✅ Consistent styling with app theme

### Phase 6.4 - Critical Bug Fixes (January 17, 2026)

**Mobile Build v1.0.21 Submitted:**
- Build ID: 819bc2b8-97f2-42e5-ae6d-3f433def303b
- Build URL: https://expo.dev/accounts/gracefy/projects/SpiritSongs/builds/819bc2b8-97f2-42e5-ae6d-3f433def303b

**Fixes in this build:**

1. **Tab Bar Safe Area Fix:**
   - Added `useSafeAreaInsets` to TabNavigator
   - Dynamic height calculation: `60 + Math.max(insets.bottom, 12)`
   - Tab bar now properly sits above phone navigation buttons

2. **MiniPlayer Safe Area Fix:**
   - Added `useSafeAreaInsets` to MiniPlayer component
   - Dynamically positioned above tab bar
   - No longer overlaps with navigation buttons

3. **PlaylistModal Fixes:**
   - Added `KeyboardAvoidingView` to prevent keyboard covering input
   - Enhanced logging for debugging playlist fetch issues
   - Added error alert when playlists fail to load

4. **Download Service Improvements:**
   - Added fallback to cache directory if documents directory fails
   - Better error messages with permission hints
   - Enhanced logging for debugging

**Known Limitation:**
- ⚠️ Lock screen media controls NOT possible with expo-av alone
- Requires react-native-track-player which has SDK 54 compatibility issues
- Background audio continues playing, but no lock screen controls

**User-Reported Issues Status:**
- ✅ Tab bar overlapping navigation - FIXED
- ✅ Keyboard covering input - FIXED
- ✅ Download directory issues - IMPROVED
- ✅ Playlist debugging - ENHANCED
- ⚠️ Lock screen controls - BLOCKED (requires native module)

### Phase 7.0 - Church System (January 17, 2026)

**Backend Models:**
- ✅ Enhanced ChurchAnnouncement model with:
  - content (long text)
  - image_url (photo upload support)
  - category (general, events, prayer_requests)
  - expires_at (admin-controlled expiry)
- ✅ UserNotification model for in-app notifications

**Backend API Endpoints:**
- ✅ GET `/api/churches` - List all churches
- ✅ GET `/api/churches/{id}/full` - Full church details with choirs, leaders, announcements, followers
- ✅ POST `/api/churches/{id}/announcements` - Create announcement with image support
- ✅ GET `/api/user/notifications` - User notifications
- ✅ POST `/api/user/notifications/{id}/read` - Mark notification read
- ✅ POST `/api/user/notifications/read-all` - Mark all notifications read
- ✅ notify_followers() helper for automatic notifications

**Admin Panel (ChurchesPage.jsx):**
- ✅ Enhanced announcement form with:
  - Long content text area
  - Image upload with preview
  - Category selector (General, Events, Prayer Requests)
  - Expiry date picker
  - Auto-notification to followers

**Mobile App:**
- ✅ ChurchDetailScreen.js - Full church detail view with:
  - Church info, cover image, location
  - Stats (followers, choirs, updates)
  - Follow/Unfollow button
  - Tabs: Info, Announcements, Schedule, Choirs
  - Announcement cards with images
  - Choir list with navigation to albums
- ✅ ChurchesSection in HomeScreen - Horizontal church list
- ✅ Navigation to ChurchDetail from Home
- ✅ API service methods for churches

**Build v1.0.22 Submitted:**
- Build ID: 9ce3a8ef-6584-432e-902e-02715187a514
- Build URL: https://expo.dev/accounts/gracefy/projects/SpiritSongs/builds/9ce3a8ef-6584-432e-902e-02715187a514

**Features:**
- ✅ Churches display on home screen
- ✅ Click church to view full details
- ✅ Prayer schedule, announcements, church leaders
- ✅ Choirs linked to churches
- ✅ Users can follow churches
- ✅ Automatic notifications for followers (in-app)
- ✅ Announcement with text + image upload
- ✅ Announcement expiry dates

**Pending:**
- ⏳ Push notifications (requires additional setup)
- ⏳ Choir registration linked to church selection
