# Spirit Songs - Christian App Admin Dashboard PRD

## Original Problem Statement
Build a comprehensive Christian app admin dashboard with capabilities for managing religious content (songs, sermons, podcasts), churches, religious leaders, singers/choirs, live seminars, audio rooms, donation campaigns, community moderation, and priest bookings.

## User Choices
- **Authentication**: Emergent-managed Google OAuth (Admin), Email/Password JWT (Choir)
- **Design**: Dark mode, Spotify-like sleek design
- **Storage**: Firebase Cloud Storage (MOCKED - using MongoDB base64)
- **Live Seminars**: Google Meet integration (scheduling only)
- **Payments**: M-Pesa mobile money (API placeholder with MOCK OTP)
- **SMS**: MOCK implementation (logs to database, provision for future integration)

## Architecture
- **Backend**: FastAPI (Python) with Motor async MongoDB driver
- **Frontend**: React with Shadcn UI components
- **Database**: MongoDB
- **Authentication**: 
  - Admin: Emergent Google OAuth
  - Choir: Email/Password JWT with session management

## What's Been Implemented

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

### SMS Notifications (MOCK)
- GET `/api/admin/sms-logs` - View SMS logs
- POST `/api/admin/sms/send` - Manual SMS (for testing)

## Next Tasks (Priority Order)
1. **P0 - User-Facing App**: Build main front-end for listeners to stream content
2. **P1 - Google Meet Integration**: Auto-generate meeting links for Live Seminars
3. **P1 - Real SMS Integration**: Integrate Africa's Talking or Twilio for actual SMS
4. **P1 - Real M-Pesa Integration**: Implement actual mobile money payouts

## Future/Backlog
- Audio Rooms (Clubhouse-style)
- Christian Community features (Facebook-like)
- Push notifications
- Mobile app/PWA
- Audio preview/playback improvements

## Testing Status
- ✅ Phase 1 & 2: 45/45 tests passed (100%)
- ✅ Choir authentication working
- ✅ All monetization endpoints working
- ✅ SMS logs endpoint working
- ✅ Admin choir management working
