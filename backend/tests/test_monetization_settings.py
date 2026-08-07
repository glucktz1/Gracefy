"""
Backend E2E tests for admin monetization + guest limits pipeline
and cache invalidation for /api/app-settings.
Covers billing ON/OFF gating contract.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gracefy-hls-launch.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _get_public_settings(session):
    r = session.get(f"{API}/app-settings", timeout=15)
    assert r.status_code == 200, f"GET /app-settings -> {r.status_code}: {r.text}"
    return r.json()


# ---------- Monetization save + reflect ----------
class TestMonetizationSave:
    def test_save_monetization_reflects_in_public(self, session):
        payload = {"soft_skip_limit": 2, "hard_skip_limit": 4, "preview_duration_seconds": 20}
        r = session.post(f"{API}/admin/app-settings/monetization", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        # public endpoint must show new values (cache invalidated)
        data = _get_public_settings(session)
        mon = data.get("monetization") or {}
        assert mon.get("soft_skip_limit") == 2, mon
        assert mon.get("hard_skip_limit") == 4, mon
        assert mon.get("preview_duration_seconds") == 20, mon

    def test_cache_invalidation_on_second_save(self, session):
        # First save
        session.post(f"{API}/admin/app-settings/monetization",
                     json={"soft_skip_limit": 3, "hard_skip_limit": 4, "preview_duration_seconds": 25},
                     timeout=15)
        d1 = _get_public_settings(session)
        assert d1["monetization"]["hard_skip_limit"] == 4

        # Immediately save different value - must NOT return cached old value
        session.post(f"{API}/admin/app-settings/monetization",
                     json={"soft_skip_limit": 3, "hard_skip_limit": 7, "preview_duration_seconds": 25},
                     timeout=15)
        d2 = _get_public_settings(session)
        assert d2["monetization"]["hard_skip_limit"] == 7, (
            f"Cache not invalidated - still shows {d2['monetization']['hard_skip_limit']}"
        )


# ---------- Guest limits save + reflect ----------
class TestGuestLimitsSave:
    def test_save_guest_limits_reflects_in_public(self, session):
        payload = {"max_plays": 2, "max_skips": 2, "max_listen_minutes": 5}
        r = session.post(f"{API}/admin/app-settings/guest-limits", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("success") is True

        data = _get_public_settings(session)
        assert data.get("guest_play_limit") == 2, data
        assert data.get("guest_skip_limit") == 2, data
        assert data.get("guest_listen_minutes") == 5, data


# ---------- Billing ON/OFF gating ----------
class TestBillingGating:
    def test_billing_enabled_true_reflects(self, session):
        r = session.put(f"{API}/admin/settings", json={"billing_enabled": True}, timeout=15)
        assert r.status_code == 200, r.text
        # small wait for cache invalidation
        time.sleep(0.5)

        bs = session.get(f"{API}/billing-status", timeout=15)
        assert bs.status_code == 200, bs.text
        assert bs.json().get("billing_enabled") is True, bs.json()

        # monetization still exposed
        data = _get_public_settings(session)
        assert "monetization" in data
        assert "hard_skip_limit" in data["monetization"]

    def test_billing_enabled_false_still_exposes_monetization(self, session):
        r = session.put(f"{API}/admin/settings", json={"billing_enabled": False}, timeout=15)
        assert r.status_code == 200, r.text
        time.sleep(0.5)

        bs = session.get(f"{API}/billing-status", timeout=15)
        assert bs.status_code == 200
        assert bs.json().get("billing_enabled") is False, bs.json()

        # monetization contract must remain stable even when billing off
        data = _get_public_settings(session)
        assert "monetization" in data
        mon = data["monetization"]
        for key in ("soft_skip_limit", "hard_skip_limit", "preview_duration_seconds"):
            assert key in mon, f"Missing {key} in monetization when billing off"


# ---------- Cleanup: restore reasonable defaults ----------
@pytest.fixture(scope="module", autouse=True)
def restore_defaults(session):
    yield
    try:
        session.post(f"{API}/admin/app-settings/monetization",
                     json={"soft_skip_limit": 6, "hard_skip_limit": 9, "preview_duration_seconds": 45},
                     timeout=10)
        session.post(f"{API}/admin/app-settings/guest-limits",
                     json={"max_plays": 3, "max_skips": 3, "max_listen_minutes": 10},
                     timeout=10)
        # leave billing enabled=True (production state - restore per test_credentials expectations)
        session.put(f"{API}/admin/settings", json={"billing_enabled": True}, timeout=10)
    except Exception:
        pass
