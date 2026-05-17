# Test Credentials

## Admin (Gracefy) — FRESH DB
- URL: `/admin/login`
- Email: `admin@gracefy.life`
- Password: (empty - leave blank, allow_empty_password=true)
- **CHANGE THIS IMMEDIATELY AFTER FIRST LOGIN**

## MongoDB
- New cluster: `mongodb+srv://infogracefy_db_user:****@gracefy.epl9vya.mongodb.net/gracefy_db`
- DB Name: `gracefy_db`
- ⚠️ Network Access in Atlas: must include `0.0.0.0/0` (or Railway's egress IPs) for production
- Bootstrap script: `/app/backend/scripts/bootstrap_fresh_db.py`
- Catalog rebuild script: `/app/backend/scripts/rebuild_catalog_from_cdn.py`

## Recovered from CDN (no user data, audio still playable)
- 119 songs in album "Recovered Catalog" — all retitled as "Recovered #XXXXXX" — needs manual relabeling
- 18 teachings — unassigned to any leader
- 12 Neno la Leo entries — inactive, unassigned leader

## Bunny CDN (unchanged)
- Zone: `gracefy-media`
- URL: `https://gracefy-cdn.b-cdn.net`
- 119 HLS streams, 56 audio MP3s, 185 general/* files all intact

## Expo
- Token: `Qyveswj9plZU7ZQYzf_qFJJyUpD60aDposMWOKeL`
- Last build: v1.0.178 (versionCode 169)

## Test User
- Email: `glucktz1904@gmail.com`
- Password: `G73ce7y@2026`
- Note: This account no longer exists in the fresh DB — user must re-register
