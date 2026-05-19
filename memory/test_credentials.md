# Test Credentials

## Super Admin (full access)
- URL: `/admin/login`
- Email: `admin@gracefy.life`
- Password: `Mwanga@82!3`
- Role: `super_admin` — all permissions (`*`)

## Content Manager (admin portal, restricted to content)
- URL: `/admin/login`
- Email: `content_manager@gracefy.test`
- Password: `Content@2026`
- Role: `content_manager`
- Permissions: content_moderation, content_approval, create_albums, manage_songs,
  manage_own_content, bulk_upload, view_platform_analytics, view_own_analytics,
  layout_promotion_control, featured_content, manage_banners

## Religious Leader (priest demo for Neno la Leo)
- URL: `/leader/login`
- Email: `priest.demo@gracefy.test`
- Password: `Priest@2026`
- Leader profile: `leader_demo_priest` ("Fr. Demo Priest", Catholic)
- Auto-approved (can upload Neno la Leo immediately)

## Choir Demo
- URL: `/choir/login`
- Email: `choir.demo@gracefy.test`
- Password: `Choir@2026`
- Choir profile: `choir_demo` ("Demo Choir", Tanzania)
- Auto-approved (can create albums, upload songs, view revenue analytics)

## Notes
- All accounts use SHA-256 password hashing (matches existing auth.py).
- Admin tokens are prefixed with `admin_`, leader tokens with `leader_`, choir with `choir_`.
- Cookie name for admin: `session_token` (HTTP-only, set on POST /api/admin/users/login).
- Leader / Choir use `Authorization: Bearer <token>` header.
- Seed script: `/app/backend/scripts/seed_demo_accounts.py` (idempotent — safe to re-run).
