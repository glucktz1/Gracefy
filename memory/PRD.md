# Spirit Songs - Christian App Admin Dashboard PRD

## Original Problem Statement
Build a comprehensive Christian app admin dashboard with capabilities for managing religious content (songs, sermons, podcasts), churches, religious leaders, singers/choirs, live seminars, audio rooms, donation campaigns, community moderation, and priest bookings.

## User Choices
- **Authentication**: Emergent-managed Google OAuth
- **Design**: Dark mode, Spotify-like sleek design
- **Storage**: Firebase Cloud Storage (MOCKED - using MongoDB base64)
- **Live Seminars**: Google Meet integration (scheduling only)
- **Payments**: M-Pesa mobile money (API placeholder)

## Architecture
- **Backend**: FastAPI (Python) with Motor async MongoDB driver
- **Frontend**: React with Shadcn UI components
- **Database**: MongoDB
- **Authentication**: Emergent Google OAuth

## User Personas
1. **Admin**: Full access to all features, user management, approvals
2. **Content Manager**: Manage albums, songs, categories
3. **Moderator**: Community post moderation, audio room management

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

## What's Been Implemented (January 2026)
### Backend (server.py)
- ✅ All 45+ API endpoints working
- ✅ Emergent Google OAuth authentication
- ✅ Session management with cookies
- ✅ CRUD for: Users, Categories, Albums, Songs, Churches, Leaders, Singers, Seminars, Audio Rooms, Donations, Community Posts, Bookings
- ✅ Analytics endpoints
- ✅ File upload endpoint (base64 storage)
- ✅ Approvals workflow

### Frontend
- ✅ Login page with Google OAuth
- ✅ Dashboard with analytics charts (Recharts)
- ✅ Users management (split tabs: Customers/System Users)
- ✅ Categories management with icon picker
- ✅ Albums & Songs management
- ✅ Churches management with schedules
- ✅ Religious Leaders with verification
- ✅ Singers & Choirs
- ✅ Live Seminars scheduling
- ✅ Audio Rooms management
- ✅ Donation Campaigns with progress bars
- ✅ Community moderation
- ✅ Priest Bookings
- ✅ Approvals queue
- ✅ Responsive sidebar navigation
- ✅ Dark "Midnight Cathedral" theme

## Prioritized Backlog
### P0 (Critical)
- [x] Admin authentication
- [x] Dashboard analytics
- [x] Core CRUD operations

### P1 (High Priority)
- [ ] Implement actual Firebase Storage integration
- [ ] Google Meet API integration for auto-generating meeting links
- [ ] M-Pesa payment gateway integration
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

## Next Tasks
1. Get Firebase credentials from user and implement actual cloud storage
2. Implement Google Calendar API for automated Meet link generation
3. Integrate M-Pesa API for donation processing
4. Build customer-facing mobile app
