# Test Credentials

## Admin
- URL: `/admin/login`
- Email: `admin@gracefy.life`
- Password: `Mwanga@82!3`
- API: `POST /api/admin/users/login` returns `{ token, user }`
- Token cookie is set automatically. `GET /api/auth/me` verifies session.

## Notes
- `allow_empty_password` is **disabled** on this account — empty password
  is rejected with 401. Always supply the password.
- Token is stored in an httpOnly cookie called `admin_token`.
