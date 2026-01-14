# Spirit Songs - Christian App Admin Dashboard PRD

## Original Problem Statement
Build a comprehensive Christian app admin dashboard with capabilities for managing religious content (songs, sermons, podcasts), churches, religious leaders, singers/choirs, live seminars, audio rooms, donation campaigns, community moderation, and priest bookings.

## User Choices
- **Authentication**: Emergent-managed Google OAuth (Admin), Email/Password JWT (Choir)
- **Design**: Dark mode, Spotify-like sleek design
- **Storage**: Firebase Cloud Storage (MOCKED - using MongoDB base64)
- **Live Seminars**: Google Meet integration (scheduling only)
- **Payments**: M-Pesa mobile money (API placeholder with MOCK OTP)

## Architecture
- **Backend**: FastAPI (Python) with Motor async MongoDB driver
- **Frontend**: React with Shadcn UI components
- **Database**: MongoDB
- **Authentication**: 
  - Admin: Emergent Google OAuth
  - Choir: Email/Password JWT with session management

## User Personas
1. **Admin**: Full access to all features, user management, approvals
2. **Content Manager**: Manage albums, songs, categories
3. **Moderator**: Community post moderation, audio room management
4. **Choir**: Revenue dashboard, content upload, payment management

## Core Requirements (Static)
- User management (Customers vs System Users)
- Content categories CRUD
- Albums & Songs management with file upload
- Churches management with schedules & announcements
- Religious leaders with verification badges
- Singers/Choirs management
- Live seminars scheduling
- Audio rooms management
- Donation campaigns with progress tracking
- Community post moderation
- Priest booking management
- Approvals queue

## What's Been Implemented

### Admin Dashboard MVP (January 2026)
- ✅ All 45+ API endpoints working
- ✅ Emergent Google OAuth authentication
- ✅ Session management with cookies
- ✅ CRUD for: Users, Categories, Albums, Songs, Churches, Leaders, Singers, Seminars, Audio Rooms, Donations, Community Posts, Bookings
- ✅ Analytics endpoints
- ✅ File upload endpoint (base64 storage)
- ✅ Approvals workflow

### Choir Dashboard & Revenue System (January 14, 2026)
**Backend:**
- ✅ Choir JWT authentication (email/password login)
- ✅ Choir session management
- ✅ Revenue calculation with 45-second minimum stream rule
- ✅ Payment details submission with OTP verification (MOCK)
- ✅ Mobile Money and Bank transfer support
- ✅ Withdrawal request system with priest notifications
- ✅ Content upload requests (albums/songs) requiring admin approval
- ✅ Admin approval endpoints for content and payment changes
- ✅ Priest notification system for choir activities

**Frontend:**
- ✅ Choir Login page with JWT auth
- ✅ Choir Dashboard with tabs: Overview, My Content, Requests
- ✅ Revenue metrics: Actual Revenue, Stream Time, Unique Streams (>45s), Total Plays
- ✅ Monthly revenue trend chart
- ✅ Revenue split pie chart (Choir vs Platform)
- ✅ Album performance breakdown
- ✅ Payment details modal with OTP verification flow
- ✅ Album creation modal with category, monetization type
- ✅ Song upload modal
- ✅ Withdrawal request modal with payment method selection
- ✅ Enhanced Admin Approvals page with Content Requests, Payment Requests, Notifications tabs

## Revenue Model
- **Calculation**: Time-based (listening hours × rate per hour)
- **Content Types**: Premium (higher rate) and Standard
- **Platform Share**: Configurable (default 30%)
- **Minimum Withdrawal**: Configurable (default TZS 10,000)
- **45-Second Rule**: Only streams >= 45 seconds count toward revenue

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- [x] Admin authentication
- [x] Dashboard analytics
- [x] Core CRUD operations
- [x] Choir login/authentication
- [x] Choir revenue dashboard
- [x] Payment details management

### P1 (High Priority)
- [ ] Implement actual Firebase Storage integration
- [ ] Google Meet API integration for auto-generating meeting links
- [ ] M-Pesa payment gateway integration (real SMS OTP, real payouts)
- [ ] Real-time audio rooms (WebRTC/similar)

### P2 (Medium Priority)
- [ ] Customer-facing mobile app/PWA
- [ ] Push notifications
- [ ] Email notifications for bookings
- [ ] Advanced analytics with date filters
- [ ] Bulk song upload
- [ ] Playlist management

### P3 (Nice to Have)
- [ ] AI-powered content recommendations
- [ ] Lyrics synchronization
- [ ] Multi-language support
- [ ] Offline mode for mobile app

## Test Credentials
- **Test Choir Account**: testchoir@example.com / test123
- **Admin**: Google OAuth (Emergent-managed)

## Mocked Features
1. **OTP Verification**: Returns OTP code in API response for testing (mock_otp field)
2. **Mobile Money/Bank Payouts**: Withdrawal requests created but payouts are manual

## API Endpoints Summary

### Choir Authentication
- POST `/api/choir/login` - Choir JWT login
- GET `/api/choir/me` - Get choir profile
- POST `/api/choir/logout` - Choir logout

### Choir Revenue & Analytics
- GET `/api/choir/revenue/{choir_id}` - Get choir revenue analytics

### Payment Details
- GET `/api/choir/payment-details` - Get current payment details
- POST `/api/choir/payment-details/request-otp` - Request OTP (MOCK)
- POST `/api/choir/payment-details/verify-otp` - Verify OTP
- POST `/api/choir/payment-details/submit` - Submit payment details for approval

### Content Upload (Requires Admin Approval)
- POST `/api/choir/albums/create` - Request album creation
- POST `/api/choir/songs/upload` - Request song upload
- GET `/api/choir/my-content-requests` - Get content request history
- GET `/api/choir/my-albums` - Get choir's albums

### Withdrawals
- POST `/api/withdrawal/request` - Create withdrawal request
- GET `/api/withdrawal/my-requests` - Get withdrawal history

### Admin Approvals
- GET `/api/admin/content-requests` - Get pending content requests
- PUT `/api/admin/content-requests/{id}` - Approve/reject content
- GET `/api/admin/payment-requests` - Get pending payment changes
- PUT `/api/admin/payment-requests/{id}` - Approve/reject payment details
- GET `/api/admin/notifications` - Get priest notifications

## Next Tasks
1. User-facing application for listeners
2. Live Seminars with Google Meet integration
3. Audio Rooms (Clubhouse-style)
4. Real Mobile Money API integration (Mpesa)
