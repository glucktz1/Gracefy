"""
Iter 57 — Server-side skip counter (uncircumventable paywall) tests.
Covers /api/monetization/usage, /record-skip, /reset:

- Anonymous callers get sensible defaults (no 401 on usage/record-skip)
- Authenticated bootstrap via /api/user/register → Bearer token
- Atomic increment: 9 record-skip calls → usage_count 1..9,
  prompt_hard=True ONLY on crossing skip (usage==9),
  preview_mode_active=True at threshold and thereafter
- Post-threshold call returns usage_count=10, preview_mode_active=True,
  prompt_hard=False
- Cross-device: GET /usage reflects persisted state
- Premium bypass: promote via db.app_users.update_one; usage returns
  preview_mode_active=false, is_premium=true
- Premium reset: POST /reset with premium user's Bearer → cleared:true,
  Mongo skip_count=0, preview_mode_active=false, cleared_at set,
  total_lifetime_skips preserved
- Reset rejection: 403 for non-premium, 401 anon
- Threshold source: change hard_skip_limit=5 via
  /api/admin/app-settings/monetization → next /usage returns threshold:5

Cleanup: removes seeded test users/tokens/billing_stats, restores
hard_skip_limit=9 + preview_duration=35.
"""
import os
import uuid
import pytest
import requests
import pymongo

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://gracefy-hls-launch.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "gracefy_db")

# Baseline threshold expected in prod app_settings (per task info)
BASELINE_HARD = 9
BASELINE_PREVIEW_SECS = 35


@pytest.fixture(scope="module")
def db():
    client = pymongo.MongoClient(MONGO_URL, serverSelectionTimeoutMS=3000)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register_user(http, email_prefix="TEST_iter57"):
    email = f"{email_prefix}_{uuid.uuid4().hex[:8]}@gracefy.test"
    r = http.post(
        f"{API}/user/register",
        json={
            "email": email,
            "password": "TestPass@123",
            "name": "Iter57 Test User",
        },
        timeout=20,
    )
    assert r.status_code == 200, f"register failed {r.status_code}: {r.text}"
    body = r.json()
    token = body.get("token")
    user = body.get("user") or {}
    user_id = user.get("user_id")
    assert token and user_id, f"missing token/user_id: {body}"
    return {"email": email, "token": token, "user_id": user_id}


@pytest.fixture(scope="module")
def created_users():
    return []


@pytest.fixture(scope="module")
def restored_settings(http):
    """Baseline restore after test module."""
    yield
    try:
        http.post(
            f"{API}/admin/app-settings/monetization",
            json={
                "soft_skip_limit": 6,
                "hard_skip_limit": BASELINE_HARD,
                "preview_duration_seconds": BASELINE_PREVIEW_SECS,
            },
            timeout=10,
        )
    except Exception:
        pass


# ---------- Anonymous behavior ----------
class TestAnonymous:
    def test_usage_no_auth_returns_defaults(self, http):
        r = http.get(f"{API}/monetization/usage", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("authenticated") is False
        assert d.get("usage_count") == 0
        assert d.get("preview_mode_active") is False
        assert d.get("is_premium") is False
        assert isinstance(d.get("threshold"), int)
        assert isinstance(d.get("preview_duration_seconds"), int)

    def test_record_skip_no_auth_returns_defaults(self, http):
        r = http.post(f"{API}/monetization/record-skip", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("authenticated") is False
        assert d.get("usage_count") == 0
        assert d.get("preview_mode_active") is False
        assert d.get("prompt_hard") is False
        assert d.get("is_premium") is False

    def test_reset_no_auth_returns_401(self, http):
        r = http.post(f"{API}/monetization/reset", timeout=15)
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"


# ---------- Threshold source verification ----------
class TestThresholdSource:
    def test_threshold_from_app_settings(self, http):
        # Set hard_skip_limit=5 via admin panel endpoint
        r = http.post(
            f"{API}/admin/app-settings/monetization",
            json={"soft_skip_limit": 3, "hard_skip_limit": 5, "preview_duration_seconds": 35},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # /usage should now report threshold=5
        u = http.get(f"{API}/monetization/usage", timeout=15)
        assert u.status_code == 200
        assert u.json().get("threshold") == 5, u.json()

        # Restore baseline (9) so subsequent tests use the documented threshold
        http.post(
            f"{API}/admin/app-settings/monetization",
            json={
                "soft_skip_limit": 6,
                "hard_skip_limit": BASELINE_HARD,
                "preview_duration_seconds": BASELINE_PREVIEW_SECS,
            },
            timeout=15,
        )
        u2 = http.get(f"{API}/monetization/usage", timeout=15)
        assert u2.json().get("threshold") == BASELINE_HARD


# ---------- Authenticated flow: increment + threshold ----------
class TestAuthenticatedIncrement:
    @pytest.fixture(scope="class")
    def user_a(self, http, db, request):
        u = _register_user(http, "TEST_iter57_incr")
        yield u
        # cleanup
        try:
            db.user_billing_stats.delete_one({"user_id": u["user_id"]})
            db.user_tokens.delete_many({"user_id": u["user_id"]})
            db.app_users.delete_one({"user_id": u["user_id"]})
        except Exception:
            pass

    def _auth(self, token):
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    def test_bootstrap_usage_zero(self, http, user_a):
        r = http.get(f"{API}/monetization/usage", headers=self._auth(user_a["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("authenticated") is True
        assert d.get("usage_count") == 0
        assert d.get("preview_mode_active") is False
        assert d.get("is_premium") is False
        assert d.get("threshold") == BASELINE_HARD

    def test_record_skip_9_times_atomic_increment(self, http, user_a):
        headers = self._auth(user_a["token"])
        for i in range(1, BASELINE_HARD + 1):  # 1..9
            r = http.post(f"{API}/monetization/record-skip", headers=headers, timeout=15)
            assert r.status_code == 200, r.text
            d = r.json()
            assert d.get("authenticated") is True
            assert d.get("usage_count") == i, f"call #{i}: expected usage={i}, got {d}"
            if i < BASELINE_HARD:
                assert d.get("prompt_hard") is False, f"call #{i}: prompt_hard should be False, got {d}"
                assert d.get("preview_mode_active") is False, f"call #{i}: preview_mode_active should be False, got {d}"
            else:
                # Crossing skip
                assert d.get("prompt_hard") is True, f"call #{i} (threshold): prompt_hard should be True, got {d}"
                assert d.get("preview_mode_active") is True, f"call #{i} (threshold): preview_mode_active should be True, got {d}"

    def test_post_threshold_no_reprompt(self, http, user_a):
        # 10th call
        headers = self._auth(user_a["token"])
        r = http.post(f"{API}/monetization/record-skip", headers=headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("usage_count") == 10, d
        assert d.get("preview_mode_active") is True, d
        assert d.get("prompt_hard") is False, d

    def test_cross_device_state_persists(self, http, user_a):
        # New session (fresh Session object simulating another device)
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.get(
            f"{API}/monetization/usage",
            headers={"Authorization": f"Bearer {user_a['token']}"},
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert d.get("usage_count") == 10, d
        assert d.get("preview_mode_active") is True, d
        assert d.get("is_premium") is False

    def test_reset_rejected_for_non_premium(self, http, user_a):
        headers = self._auth(user_a["token"])
        r = http.post(f"{API}/monetization/reset", headers=headers, timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


# ---------- Premium bypass + reset ----------
class TestPremiumBypassAndReset:
    @pytest.fixture(scope="class")
    def user_b(self, http, db):
        u = _register_user(http, "TEST_iter57_prem")
        # Pre-seed some skips so we can verify bypass (usage shown as 0 despite doc)
        # Do 3 skips
        headers = {"Authorization": f"Bearer {u['token']}"}
        for _ in range(3):
            http.post(f"{API}/monetization/record-skip", headers=headers, timeout=15)
        yield u
        try:
            db.user_billing_stats.delete_one({"user_id": u["user_id"]})
            db.user_tokens.delete_many({"user_id": u["user_id"]})
            db.app_users.delete_one({"user_id": u["user_id"]})
        except Exception:
            pass

    def test_promote_to_premium_bypasses_paywall(self, http, db, user_b):
        # Verify skip_count was incremented before promotion
        stats_before = db.user_billing_stats.find_one({"user_id": user_b["user_id"]}) or {}
        assert stats_before.get("skip_count", 0) >= 3, stats_before

        # Promote to premium directly in Mongo
        db.app_users.update_one(
            {"user_id": user_b["user_id"]},
            {"$set": {"is_premium": True}},
        )

        headers = {"Authorization": f"Bearer {user_b['token']}"}
        r = http.get(f"{API}/monetization/usage", headers=headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("authenticated") is True
        assert d.get("is_premium") is True, d
        assert d.get("preview_mode_active") is False, d
        assert d.get("usage_count") == 0, d  # bypassed accounting

    def test_record_skip_premium_bypasses(self, http, user_b):
        headers = {"Authorization": f"Bearer {user_b['token']}"}
        r = http.post(f"{API}/monetization/record-skip", headers=headers, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("is_premium") is True, d
        assert d.get("preview_mode_active") is False, d
        assert d.get("prompt_hard") is False, d

    def test_reset_clears_counters_preserves_lifetime(self, http, db, user_b):
        # Ensure user_billing_stats currently has some skip_count + lifetime
        # (from pre-seeded 3 skips before promotion). Simulate carrying a
        # lingering skip_count > 0 to verify reset zeros it.
        db.user_billing_stats.update_one(
            {"user_id": user_b["user_id"]},
            {"$set": {"skip_count": 7, "preview_mode_active": True}},
            upsert=True,
        )
        pre = db.user_billing_stats.find_one({"user_id": user_b["user_id"]}) or {}
        lifetime_pre = pre.get("total_lifetime_skips", 0)
        assert pre.get("skip_count") == 7

        headers = {"Authorization": f"Bearer {user_b['token']}"}
        r = http.post(f"{API}/monetization/reset", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json() == {"cleared": True}

        post = db.user_billing_stats.find_one({"user_id": user_b["user_id"]}) or {}
        assert post.get("skip_count") == 0, post
        assert post.get("preview_mode_active") is False, post
        assert post.get("cleared_at"), post
        # total_lifetime_skips must NOT be zeroed
        assert post.get("total_lifetime_skips", 0) == lifetime_pre, (
            f"total_lifetime_skips should be preserved: pre={lifetime_pre} post={post.get('total_lifetime_skips')}"
        )
