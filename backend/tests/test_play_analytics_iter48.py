"""Iteration 48: choir + leader play analytics, content-performance fix."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
CHOIR_ID = "sing_819ad8e12623"  # Kwaya Katoliki
LEADER_ID = "leader_demo_priest"

ADMIN_EMAIL = "admin@gracefy.life"
ADMIN_PASS = "Mwanga@82!3"
LEADER_EMAIL = "priest.demo@gracefy.test"
LEADER_PASS = "Priest@2026"


# ---- fixtures -------------------------------------------------------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(
        f"{BASE_URL}/api/admin/users/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASS},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    token = r.json().get("token") or r.json().get("access_token")
    if token:
        s.headers["Authorization"] = f"Bearer {token}"
    return s


@pytest.fixture(scope="session")
def leader_token():
    r = requests.post(
        f"{BASE_URL}/api/leader/login",
        json={"email": LEADER_EMAIL, "password": LEADER_PASS},
        timeout=15,
    )
    assert r.status_code == 200, f"leader login failed: {r.status_code} {r.text}"
    return r.json()["token"]


# ---- choir analytics ------------------------------------------------------
class TestChoirAnalytics:
    def test_admin_choir_details_returns_analytics(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/choirs/{CHOIR_ID}", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "analytics" in body, "analytics missing from /admin/choirs/{id}"
        a = body["analytics"]
        assert {"summary", "rates", "albums", "top_songs", "monthly"} <= set(a.keys())

        s = a["summary"]
        assert s["total_plays"] >= 34, f"total_plays={s['total_plays']} expected>=34"
        assert s["album_count"] >= 23, f"album_count={s['album_count']} expected>=23"
        assert s["song_count"] >= 76, f"song_count={s['song_count']} expected>=76"

        # revenue math
        tzs = a["rates"]["tzs_per_play"]
        fee = a["rates"]["platform_fee_percentage"]
        assert tzs == 5
        assert fee == 30
        assert s["gross_revenue"] == s["total_plays"] * tzs
        assert s["net_revenue"] == s["gross_revenue"] - int(s["gross_revenue"] * fee / 100)

    def test_admin_choir_albums_sorted_desc_with_fields(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/choirs/{CHOIR_ID}", timeout=20)
        assert r.status_code == 200
        albums = r.json()["analytics"]["albums"]
        assert len(albums) >= 23
        plays = [a["plays"] for a in albums]
        assert plays == sorted(plays, reverse=True), "albums not sorted by plays desc"
        keys = {"album_id", "title", "thumbnail", "plays", "revenue", "revenue_percentage"}
        assert keys <= set(albums[0].keys())

    def test_admin_choir_top_songs_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/choirs/{CHOIR_ID}", timeout=20)
        top = r.json()["analytics"]["top_songs"]
        assert isinstance(top, list)
        if top:
            t = top[0]
            assert {"song_id", "title", "album_id", "plays", "revenue"} <= set(t.keys())
            plays = [x["plays"] for x in top]
            assert plays == sorted(plays, reverse=True)

    def test_admin_choir_monthly_six(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/choirs/{CHOIR_ID}", timeout=20)
        monthly = r.json()["analytics"]["monthly"]
        assert len(monthly) == 6
        for m in monthly:
            assert {"month", "plays", "gross_revenue", "net_revenue"} <= set(m.keys())

    def test_choir_self_revenue_endpoint(self, admin_session):
        # /api/choir/revenue/{id} should return canonical + legacy fields.
        # No choir auth required per main agent context — admin cookie acceptable.
        r = admin_session.get(f"{BASE_URL}/api/choir/revenue/{CHOIR_ID}", timeout=20)
        # try anonymous if admin gets 401/403
        if r.status_code in (401, 403):
            r = requests.get(f"{BASE_URL}/api/choir/revenue/{CHOIR_ID}", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        # canonical shape
        for k in ("summary", "rates", "albums", "monthly"):
            assert k in body, f"missing canonical key {k}"
        # legacy backward compat keys
        for legacy in ("current_balance", "total_earned", "monthly_revenue", "top_albums"):
            assert legacy in body, f"missing legacy key {legacy}"


# ---- leader analytics -----------------------------------------------------
class TestLeaderAnalytics:
    def test_admin_leader_details_includes_analytics(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/leaders/{LEADER_ID}", timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "analytics" in body
        a = body["analytics"]
        assert {"summary", "top_teachings", "top_neno", "monthly"} <= set(a.keys())
        assert "total_plays" in a["summary"]
        # 5 neno seeded
        assert len(a["top_neno"]) >= 5, f"expected 5 neno, got {len(a['top_neno'])}"

    def test_admin_leader_standalone_analytics(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/leaders/{LEADER_ID}/analytics", timeout=20)
        assert r.status_code == 200, r.text
        a = r.json()
        assert {"summary", "top_teachings", "top_neno", "monthly"} <= set(a.keys())
        assert len(a["monthly"]) == 6

    def test_leader_self_analytics(self, leader_token):
        r = requests.get(
            f"{BASE_URL}/api/leader/analytics",
            headers={"Authorization": f"Bearer {leader_token}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # canonical
        for k in ("summary", "top_teachings", "top_neno", "monthly"):
            assert k in body
        # legacy compat
        for legacy in ("total_teachings", "total_plays", "current_balance", "teaching_breakdown"):
            assert legacy in body, f"missing legacy key {legacy}"


# ---- content performance --------------------------------------------------
class TestContentPerformance:
    @pytest.mark.parametrize("period", ["7d", "30d", "90d", "all"])
    def test_content_performance_periods(self, admin_session, period):
        r = admin_session.get(
            f"{BASE_URL}/api/analytics/content-performance?period={period}", timeout=25
        )
        assert r.status_code == 200, f"{period}: {r.status_code} {r.text}"
        body = r.json()
        assert "top_songs" in body

    def test_content_performance_uses_listening_sessions(self, admin_session):
        r = admin_session.get(
            f"{BASE_URL}/api/analytics/content-performance?period=30d", timeout=25
        )
        assert r.status_code == 200
        top = r.json().get("top_songs") or []
        assert len(top) >= 1, "no top_songs returned"
        first = top[0]
        for k in ("plays", "album_title", "artist_name"):
            assert k in first, f"missing {k} in top_songs[0]"
        # Should be a Kwaya Katoliki song since they own most plays
        artist = (first.get("artist_name") or "").lower()
        assert "kwaya" in artist or "katoliki" in artist, (
            f"top song artist not Kwaya Katoliki: {first}"
        )
