"""
Iteration 50 — Campaign targeting filter fixes
Covers:
  - Case-insensitive country / region match
  - $or no longer clobbers (premium + region AND'd)
  - listened_content_ids OR (default) vs 'all' AND semantics
  - not_listened_content_ids excludes listeners
  - /analytics/realtime exposes guests/devices fields
  - Permission gating on /campaigns/preview-users (admin cookie)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
PREVIEW = f"{BASE_URL}/api/advertising/campaigns/preview-users"
REALTIME = f"{BASE_URL}/api/analytics/realtime"
LOGIN = f"{BASE_URL}/api/admin/users/login"

ADMIN_EMAIL = "admin@gracefy.life"
ADMIN_PASS = "Mwanga@82!3"

SEEDED_USER_ID = "user_44b6727624be"
SONG_KUTOKA = "song_03ee102b6e8e"
SONG_NASIKIA = "song_ae29119ca85a"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(LOGIN, json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:200]}")
    return s


@pytest.fixture(scope="module")
def anon_session():
    return requests.Session()


# --- country / region: case-insensitive ---
def test_country_tanzania_email_returns_26plus(admin_session):
    r = admin_session.post(PREVIEW, json={
        "filter_type": "all", "country": "Tanzania", "campaign_type": "email"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total"] >= 26, f"Expected >=26 TZ email users, got {data['total']}"
    for u in data["users"]:
        assert u["country"].lower() == "tanzania"
        assert u["email"]


def test_country_lowercase_tanzania_same_result(admin_session):
    r1 = admin_session.post(PREVIEW, json={
        "filter_type": "all", "country": "Tanzania", "campaign_type": "email"
    }).json()
    r2 = admin_session.post(PREVIEW, json={
        "filter_type": "all", "country": "tanzania", "campaign_type": "email"
    }).json()
    assert r1["total"] == r2["total"], (
        f"Case-insensitive country broken: 'Tanzania'={r1['total']} 'tanzania'={r2['total']}"
    )


def test_region_dar_es_salaam_case_insensitive(admin_session):
    r = admin_session.post(PREVIEW, json={
        "filter_type": "all", "country": "Tanzania",
        "region": "dar es salaam", "campaign_type": "email"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["total"] > 0, "Expected >0 users in Dar es Salaam (case-insensitive)"
    for u in data["users"]:
        rgn = (u.get("region") or "").lower()
        assert "dar es sala" in rgn, f"User region {rgn!r} does not match Dar es Salaam"


# --- $or clobber regression ---
def test_premium_country_region_anded_not_orclobber(admin_session):
    """
    Premium TZ user is in Zanzibar (not Dar es Salaam). Free TZ users in
    Dar es Salaam = 5. If region used to clobber the premium $or, this would
    return ~5 free Dar users. Correct AND'd behaviour returns 0.
    """
    r = admin_session.post(PREVIEW, json={
        "filter_type": "premium", "country": "Tanzania",
        "region": "Dar es Salaam", "campaign_type": "email"
    })
    assert r.status_code == 200
    data = r.json()
    # Verify ANDed result: premium TZ users in Dar es Salaam
    for u in data["users"]:
        assert u["is_premium"] is True
        assert u["country"].lower() == "tanzania"
        rgn = (u.get("region") or "").lower()
        assert "dar es sala" in rgn

    # And cross-check: free TZ + Dar exists (proves region filter would have matched)
    r_free = admin_session.post(PREVIEW, json={
        "filter_type": "free", "country": "Tanzania",
        "region": "Dar es Salaam", "campaign_type": "email"
    }).json()
    assert r_free["total"] >= 1, "Expected free TZ users in Dar es Salaam"


# --- listened_content_ids: OR default ---
def test_listened_any_semantics_default(admin_session):
    r = admin_session.post(PREVIEW, json={
        "filter_type": "all", "country": "Tanzania",
        "campaign_type": "email",
        "listened_content_ids": [SONG_KUTOKA, SONG_NASIKIA],
    })
    assert r.status_code == 200
    data = r.json()
    ids = [u["user_id"] for u in data["users"]]
    assert SEEDED_USER_ID in ids, (
        f"Seeded user {SEEDED_USER_ID} should be returned under default OR semantics; got {ids}"
    )


def test_listened_match_mode_all_intersection(admin_session):
    r = admin_session.post(PREVIEW, json={
        "filter_type": "all", "country": "Tanzania",
        "campaign_type": "email",
        "listened_content_ids": [SONG_KUTOKA, SONG_NASIKIA],
        "listened_match_mode": "all",
    })
    assert r.status_code == 200
    data = r.json()
    ids = [u["user_id"] for u in data["users"]]
    assert SEEDED_USER_ID not in ids, (
        "Seeded user listened to only 1/2 songs; match_mode=all should exclude them"
    )


# --- not_listened_content_ids ---
def test_not_listened_excludes_listener(admin_session):
    baseline = admin_session.post(PREVIEW, json={
        "filter_type": "all", "country": "Tanzania", "campaign_type": "email"
    }).json()
    excluded = admin_session.post(PREVIEW, json={
        "filter_type": "all", "country": "Tanzania",
        "campaign_type": "email",
        "not_listened_content_ids": [SONG_KUTOKA],
    }).json()
    ids = [u["user_id"] for u in excluded["users"]]
    assert SEEDED_USER_ID not in ids
    assert excluded["total"] == baseline["total"] - 1, (
        f"Expected exactly 1 listener excluded; baseline={baseline['total']} "
        f"after_excl={excluded['total']}"
    )


# --- /analytics/realtime ---
def test_realtime_exposes_guests_and_devices(anon_session):
    r = anon_session.get(REALTIME)
    assert r.status_code == 200
    data = r.json()
    for k in ("active_visitors", "anonymous_plays_today", "device_brands",
              "active_listeners", "new_users_today", "plays_today"):
        assert k in data, f"Missing {k} in realtime payload"
    assert isinstance(data["active_visitors"], int)
    assert isinstance(data["anonymous_plays_today"], int)
    assert isinstance(data["device_brands"], list)


# --- permission gating ---
def test_preview_users_requires_admin_auth(anon_session):
    """
    The review request asserts that POST /campaigns/preview-users without an
    admin cookie returns 401. Verifying current behaviour.
    """
    r = anon_session.post(PREVIEW, json={
        "filter_type": "all", "campaign_type": "email"
    })
    # Expected 401/403; otherwise this endpoint is publicly exposed (BUG).
    assert r.status_code in (401, 403), (
        f"preview-users is publicly accessible (got {r.status_code}); "
        f"admin auth gating is MISSING."
    )
