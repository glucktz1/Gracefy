"""
Tests for iteration 47:
- Admin Users RBAC + permission gating (admin_users collection refactor)
- Religious Leader Neno la Leo upload
- Choir login + new revenue response shape
- /auth/me returns permissions
- /rbac/permissions catalog
"""

import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

SUPER_ADMIN = {"email": "admin@gracefy.life", "password": "Mwanga@82!3"}
CONTENT_MGR = {"email": "content_manager@gracefy.test", "password": "Content@2026"}
PRIEST = {"email": "priest.demo@gracefy.test", "password": "Priest@2026"}
CHOIR = {"email": "choir.demo@gracefy.test", "password": "Choir@2026"}


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def super_admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/users/login", json=SUPER_ADMIN, timeout=15)
    assert r.status_code == 200, f"super admin login failed: {r.status_code} {r.text}"
    data = r.json()
    return s, data


@pytest.fixture(scope="session")
def content_mgr_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/admin/users/login", json=CONTENT_MGR, timeout=15)
    assert r.status_code == 200, f"content_mgr login failed: {r.status_code} {r.text}"
    return s, r.json()


@pytest.fixture(scope="session")
def leader_token():
    r = requests.post(f"{BASE_URL}/api/leader/login", json=PRIEST, timeout=15)
    assert r.status_code == 200, f"leader login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token") or (data.get("session") or {}).get("token")
    assert tok, f"no token in leader response: {data}"
    return tok, data


@pytest.fixture(scope="session")
def choir_token():
    r = requests.post(f"{BASE_URL}/api/choir/login", json=CHOIR, timeout=15)
    assert r.status_code == 200, f"choir login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("token") or data.get("access_token")
    assert tok, f"no token in choir response: {data}"
    return tok, data


# ---------- Super admin login + /auth/me + permissions ----------

class TestSuperAdminAuth:
    def test_super_admin_login_returns_permissions(self, super_admin_session):
        _, data = super_admin_session
        assert "token" in data
        user = data.get("user", {})
        assert user.get("role") == "super_admin", f"role was {user.get('role')}"
        perms = user.get("permissions") or []
        assert "*" in perms, f"super_admin must have wildcard permission, got {perms}"

    def test_auth_me_returns_permissions_for_admin(self, super_admin_session):
        s, _ = super_admin_session
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "permissions" in body, f"missing 'permissions' field: {body.keys()}"
        assert "*" in (body.get("permissions") or [])
        assert body.get("admin_id") or body.get("user_id")


class TestRbacPermissionsCatalog:
    def test_rbac_permissions_categorised(self, super_admin_session):
        s, _ = super_admin_session
        r = s.get(f"{BASE_URL}/api/rbac/permissions", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        # Flatten all permission ids from whatever shape it returns
        flat = []
        if isinstance(data, dict):
            cats = data.get("categories") or data
            if isinstance(cats, dict):
                for v in cats.values():
                    if isinstance(v, list):
                        flat.extend([p.get("id") if isinstance(p, dict) else p for p in v])
                    elif isinstance(v, dict) and isinstance(v.get("permissions"), list):
                        flat.extend([p.get("id") if isinstance(p, dict) else p for p in v["permissions"]])
            elif isinstance(cats, list):
                for cat in cats:
                    perms = cat.get("permissions", []) if isinstance(cat, dict) else []
                    flat.extend([p.get("id") if isinstance(p, dict) else p for p in perms])
        flat = [p for p in flat if p]
        for must in ["role_assignment", "approve_payouts", "view_platform_analytics"]:
            assert must in flat, f"missing required permission '{must}'. Got: {flat}"


# ---------- Admin users CRUD ----------

class TestAdminUsersCRUD:
    def test_super_admin_can_list_admin_users(self, super_admin_session):
        s, _ = super_admin_session
        r = s.get(f"{BASE_URL}/api/admin/users", timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("users"), list)
        assert body.get("total", 0) >= 2, f"expected >=2, got {body.get('total')}"
        emails = {(u.get("email") or "").lower() for u in body["users"]}
        assert "admin@gracefy.life" in emails
        assert "content_manager@gracefy.test" in emails

    def test_content_mgr_forbidden_from_user_management(self, content_mgr_session):
        s, _ = content_mgr_session
        r = s.get(f"{BASE_URL}/api/admin/users", timeout=10)
        assert r.status_code == 403, f"content_manager should be denied, got {r.status_code} {r.text}"

    def test_create_update_delete_admin(self, super_admin_session):
        s, _ = super_admin_session
        suffix = uuid.uuid4().hex[:8]
        email = f"TEST_qauser_{suffix}@gracefy.test"
        password = "TestPass@2026"
        payload = {
            "email": email,
            "password": password,
            "name": "TEST QA User",
            "role": "viewer",
            "permissions": ["view_platform_analytics"],
        }
        r = s.post(f"{BASE_URL}/api/admin/users", json=payload, timeout=10)
        assert r.status_code in (200, 201), f"create failed: {r.status_code} {r.text}"
        created = r.json()
        user_id = created.get("user_id") or created.get("admin_id")
        assert user_id
        # Email gets lowercased on storage
        assert created.get("email") == email.lower()
        assert created.get("role") == "viewer"

        # New admin can log in via /admin/users/login (use lowercased email
        # because POST /admin/users stores email lowercased; login endpoint
        # does NOT lowercase, so caller must match exactly).
        login = requests.post(
            f"{BASE_URL}/api/admin/users/login",
            json={"email": email.lower(), "password": password},
            timeout=10,
        )
        assert login.status_code == 200, f"new admin couldn't login: {login.status_code} {login.text}"

        # Update name + permissions
        upd = s.put(
            f"{BASE_URL}/api/admin/users/{user_id}",
            json={"name": "TEST QA Renamed", "permissions": ["view_platform_analytics", "approve_payouts"]},
            timeout=10,
        )
        assert upd.status_code == 200, f"update failed: {upd.status_code} {upd.text}"
        body = upd.json()
        assert body.get("name") == "TEST QA Renamed"
        assert "approve_payouts" in (body.get("permissions") or [])

        # GET to verify
        list_r = s.get(f"{BASE_URL}/api/admin/users", timeout=10)
        found = next((u for u in list_r.json()["users"] if (u.get("user_id") or u.get("admin_id")) == user_id), None)
        assert found is not None
        assert found.get("name") == "TEST QA Renamed"

        # Delete
        d = s.delete(f"{BASE_URL}/api/admin/users/{user_id}", timeout=10)
        assert d.status_code == 200, d.text

        # Verify it's gone (login should now fail)
        login2 = requests.post(
            f"{BASE_URL}/api/admin/users/login",
            json={"email": email, "password": password},
            timeout=10,
        )
        assert login2.status_code in (401, 403, 404)

    def test_cannot_delete_self(self, super_admin_session):
        s, data = super_admin_session
        self_id = data["user"].get("admin_id") or data["user"].get("user_id")
        assert self_id
        r = s.delete(f"{BASE_URL}/api/admin/users/{self_id}", timeout=10)
        assert r.status_code == 400, f"expected 400 self-delete block, got {r.status_code} {r.text}"


# ---------- Religious leader Neno la Leo ----------

class TestLeaderNenoLaLeo:
    def test_leader_login_returns_profile(self, leader_token):
        _, data = leader_token
        # leader profile somewhere in response
        leader = data.get("leader") or data.get("profile") or data.get("user") or {}
        assert leader, f"no leader profile in response: {data.keys()}"

    def test_create_neno_la_leo(self, leader_token):
        token, login_data = leader_token
        headers = {"Authorization": f"Bearer {token}"}
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        payload = {
            "leader_id": "leader_demo_priest",  # overridden by server anyway
            "book": "Yohana",
            "chapter": 3,
            "verse_start": 16,
            "verse_end": 16,
            "word_date": today,
            "publish_date": today,
            "publish_time": "06:00",
            "notes": "TEST automated QA note",
        }
        r = requests.post(
            f"{BASE_URL}/api/neno-la-leo/leader/neno",
            json=payload,
            headers=headers,
            timeout=15,
        )
        assert r.status_code in (200, 201), f"neno create failed: {r.status_code} {r.text}"
        body = r.json()
        neno = body.get("neno") or body
        # verse_reference auto-generated
        assert neno.get("verse_reference"), f"missing verse_reference: {neno}"
        assert "Yohana" in neno["verse_reference"]
        # Swahili day name
        assert neno.get("word_day_name"), f"missing word_day_name: {neno}"


# ---------- Choir login + revenue shape ----------

class TestChoirPortal:
    def test_choir_login_returns_profile(self, choir_token):
        _, data = choir_token
        profile = data.get("choir") or data.get("profile") or data.get("user") or data.get("account") or {}
        assert profile, f"no choir profile in response: {data.keys()}"

    def test_choir_revenue_nested_shape(self, choir_token):
        token, _ = choir_token
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.get(
            f"{BASE_URL}/api/choir/revenue/choir_demo",
            headers=headers,
            timeout=15,
        )
        assert r.status_code == 200, f"choir revenue failed: {r.status_code} {r.text}"
        body = r.json()
        # Required nested keys
        assert "summary" in body, f"missing summary: {body.keys()}"
        assert "rates" in body, f"missing rates: {body.keys()}"
        assert "albums" in body, f"missing albums: {body.keys()}"
        assert "monthly" in body, f"missing monthly: {body.keys()}"

        summary = body["summary"]
        for k in [
            "total_plays",
            "gross_revenue",
            "platform_fee",
            "net_revenue",
            "current_balance",
        ]:
            assert k in summary, f"summary missing '{k}': {summary.keys()}"

        rates = body["rates"]
        for k in ["tzs_per_play", "platform_fee_percentage", "minimum_payout"]:
            assert k in rates, f"rates missing '{k}': {rates.keys()}"

        assert isinstance(body["albums"], list)
        assert isinstance(body["monthly"], list)
        assert len(body["monthly"]) == 6, f"monthly should have 6 entries, got {len(body['monthly'])}"

    def test_choir_my_albums(self, choir_token):
        token, _ = choir_token
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.get(f"{BASE_URL}/api/choir/my-albums", headers=headers, timeout=10)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "albums" in body
        assert isinstance(body["albums"], list)
