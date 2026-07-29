"""
E2E tests for billing/payment toggle propagation.

Covers 3 recently fixed bugs:
  1. PUT /api/monetization/settings existed as 405 → must return 200
  2. When master billing=ON but no monetization doc, sub-flags defaulted to False
     → must default to True
  3. save_monetization_settings did not invalidate Redis billing cache
     → up to 10s stale reads
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gracefy-hls-launch.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@gracefy.life"
ADMIN_PASSWORD = "Mwanga@82!3"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/admin/users/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or data.get("access_token") or data.get("session_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="module")
def mongo_db():
    """Direct MongoDB access for cleanup + count assertions."""
    from pymongo import MongoClient
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "gracefy_db")
    client = MongoClient(mongo_url)
    return client[db_name]


def _get_billing_status(session):
    r = session.get(f"{BASE_URL}/api/billing-status", timeout=15)
    assert r.status_code == 200, f"billing-status failed: {r.status_code} {r.text}"
    return r, r.json()


# -------- Scenario 1: Toggle ON/OFF propagates, cache invalidates --------
class TestBillingToggleE2E:
    def test_1_toggle_on_off_propagates(self, admin_session):
        for i in range(3):
            r = admin_session.put(f"{BASE_URL}/api/admin/settings",
                                  json={"billing_enabled": True}, timeout=15)
            assert r.status_code == 200, f"toggle ON #{i} failed: {r.text}"
            _, status = _get_billing_status(admin_session)
            assert status["billing_enabled"] is True, \
                f"iter {i}: expected billing_enabled=True got {status}"

            r = admin_session.put(f"{BASE_URL}/api/admin/settings",
                                  json={"billing_enabled": False}, timeout=15)
            assert r.status_code == 200
            _, status = _get_billing_status(admin_session)
            assert status["billing_enabled"] is False, \
                f"iter {i}: expected billing_enabled=False got {status} (cache stale?)"

    # -------- Scenario 2: Sub-flags default TRUE when no monetization doc --------
    def test_2_subflag_defaults_when_no_monetization_doc(self, admin_session, mongo_db):
        # Clear monetization_settings entirely
        mongo_db.monetization_settings.delete_many({})
        # Turn master ON
        r = admin_session.put(f"{BASE_URL}/api/admin/settings",
                              json={"billing_enabled": True}, timeout=15)
        assert r.status_code == 200

        _, status = _get_billing_status(admin_session)
        assert status["billing_enabled"] is True
        assert status["app_billing_enabled"] is True, \
            f"expected app_billing_enabled default True, got {status}"
        assert status["web_billing_enabled"] is True, \
            f"expected web_billing_enabled default True, got {status}"
        assert status["billing_mode"] == "full", \
            f"expected billing_mode='full', got {status['billing_mode']}"

        # Master OFF → sub-flags all False
        r = admin_session.put(f"{BASE_URL}/api/admin/settings",
                              json={"billing_enabled": False}, timeout=15)
        assert r.status_code == 200
        _, status = _get_billing_status(admin_session)
        assert status["billing_enabled"] is False
        assert status["app_billing_enabled"] is False
        assert status["web_billing_enabled"] is False
        assert status["billing_mode"] == "disabled"

    # -------- Scenario 3: PUT /monetization/settings → 200 + reflected --------
    def test_3_put_monetization_settings_returns_200(self, admin_session, mongo_db):
        # Ensure master ON so effect is visible
        admin_session.put(f"{BASE_URL}/api/admin/settings",
                          json={"billing_enabled": True}, timeout=15)

        payload = {
            "billing_enabled": True,
            "billing_mode": "full",
            "app_billing_enabled": True,
            "web_billing_enabled": False,
        }
        r = admin_session.put(f"{BASE_URL}/api/monetization/settings",
                              json=payload, timeout=15)
        assert r.status_code == 200, \
            f"PUT /monetization/settings expected 200, got {r.status_code}: {r.text}"

        _, status = _get_billing_status(admin_session)
        assert status["app_billing_enabled"] is True, status
        assert status["web_billing_enabled"] is False, status
        assert status["billing_mode"] == "full", status

    # -------- Scenario 4: Upsert - collection stays at 1 doc --------
    def test_4_upsert_pattern_no_bloat(self, admin_session, mongo_db):
        mongo_db.monetization_settings.delete_many({})
        for i in range(3):
            payload = {
                "billing_enabled": True,
                "billing_mode": "full",
                "app_billing_enabled": True,
                "web_billing_enabled": (i % 2 == 0),
            }
            r = admin_session.put(f"{BASE_URL}/api/monetization/settings",
                                  json=payload, timeout=15)
            assert r.status_code == 200

        count = mongo_db.monetization_settings.count_documents({})
        assert count == 1, f"expected 1 doc (upsert), found {count}"
        doc = mongo_db.monetization_settings.find_one({})
        assert doc.get("setting_id") == "monetization", \
            f"expected setting_id='monetization', got {doc.get('setting_id')}"

    # -------- Scenario 5: Legacy POST still works --------
    def test_5_legacy_post_still_works(self, admin_session, mongo_db):
        mongo_db.monetization_settings.delete_many({})
        admin_session.put(f"{BASE_URL}/api/admin/settings",
                          json={"billing_enabled": True}, timeout=15)

        payload = {
            "billing_enabled": True,
            "billing_mode": "full",
            "app_billing_enabled": False,
            "web_billing_enabled": True,
        }
        r = admin_session.post(f"{BASE_URL}/api/monetization-settings",
                               json=payload, timeout=15)
        assert r.status_code == 200, f"POST legacy failed: {r.status_code} {r.text}"

        _, status = _get_billing_status(admin_session)
        assert status["app_billing_enabled"] is False, status
        assert status["web_billing_enabled"] is True, status
        # upsert should keep count at 1
        assert mongo_db.monetization_settings.count_documents({}) == 1

    # -------- Scenario 6: Cache-Control headers on /billing-status --------
    def test_6_billing_status_cache_headers(self, admin_session):
        r, _ = _get_billing_status(admin_session)
        cc = r.headers.get("Cache-Control", "").lower()
        assert "no-cache" in cc, f"missing no-cache: {cc}"
        assert "no-store" in cc, f"missing no-store: {cc}"
        assert "must-revalidate" in cc, f"missing must-revalidate: {cc}"

    # -------- Scenario 7: Regression - PUT /admin/settings persists master flag --------
    def test_7_regression_admin_settings_persists(self, admin_session, mongo_db):
        r = admin_session.put(f"{BASE_URL}/api/admin/settings",
                              json={"billing_enabled": True}, timeout=15)
        assert r.status_code == 200
        doc = mongo_db.admin_settings.find_one({})
        assert doc is not None
        assert doc.get("billing_enabled") is True, doc

        r = admin_session.put(f"{BASE_URL}/api/admin/settings",
                              json={"billing_enabled": False}, timeout=15)
        assert r.status_code == 200
        doc = mongo_db.admin_settings.find_one({})
        assert doc.get("billing_enabled") is False, doc
