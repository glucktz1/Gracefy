# Test Credentials

## Admin (Gracefy)
- URL: `/admin/login`
- Email: `admin@gracefy.life`
- Password: (empty - leave blank)
- **CHANGE IMMEDIATELY AFTER FIRST LOGIN**

## App User (Web/Mobile registration & login)
- Endpoint: `POST /api/user/register`, `POST /api/user/login`
- Fresh registration works: confirmed
- Just-registered user can immediately log in: confirmed
- 48 user accounts restored from March 5 backup (their original passwords work)

## Test user (created in this session)
- Email: `mobile_test_<timestamp>@example.com`
- Password: `Test1234`

## MongoDB
- New cluster: `mongodb+srv://infogracefy_db_user:****@gracefy.epl9vya.mongodb.net/gracefy_db`

## Bunny CDN
- Zone: `gracefy-media`
- URL: `https://gracefy-cdn.b-cdn.net`

## Radio stations (10 active)
- Radio Maria Tanzania, Radio Tumaini, Radio Upendo (NEW), Radio Uhai,
  Jesus Is Lord, Heaven FM, Favour FM, Voice of Heaven, Prayer Tower, Gospel Kingz
- Proxy: `GET /api/radio/stream/{station_id}` (HTTP-only stations are proxied through HTTPS backend)

## Backup
- Source: `/app/backups/backup_20260305_100650/` (179 MB, March 5 2026)
- Restored to fresh cluster via mongorestore

## Expo
- Token: `Qyveswj9plZU7ZQYzf_qFJJyUpD60aDposMWOKeL`
- Last APK: v1.0.178 (versionCode 169)
