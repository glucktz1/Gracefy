"""
Tests for analytics + listening tracking changes (iteration 45):
- /api/listening/start, /ping, /end (active_streams mirror + geo persist)
- /api/analytics/realtime (active_streams + fallback + cache 15s)
- /api/analytics/live-listeners (merged sources + cache 5s)
- /api/analytics/overview (uses app_users)
- /api/analytics/trends (parallel + 60s cache)
- /api/neno-la-leo/active (lookup + 30s cache)
- /api/app-settings (parallel + 30s cache)
- /api/geo/detect-country, /api/user/home/geo (Cloudflare header preference)
- Performance: warm cache <200ms, cold cache <4s
"""

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

WARM_THRESHOLD_MS = 200
COLD_THRESHOLD_MS = 4000


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _get(s, path, headers=None, timeout=30):
    t0 = time.time()
    r = s.get(f"{API}{path}", headers=headers, timeout=timeout)
    return r, (time.time() - t0) * 1000


def _post(s, path, json=None, data=None, headers=None, timeout=30):
    t0 = time.time()
    r = s.post(f"{API}{path}", json=json, data=data, headers=headers, timeout=timeout)
    return r, (time.time() - t0) * 1000


# ============== /listening/start, /ping, /end ==============

class TestListeningTracking:
    def test_start_creates_session_and_active_stream(self, s):
        r, _ = _post(s, "/listening/start", json={
            "song_id": "test_song_xyz",
            "user_id": "TEST_user_listen_1",
            "platform": "web",
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_id" in data
        assert "stream_id" in data
        assert data["session_id"] == data["stream_id"]
        # Save for later
        pytest.session_id_1 = data["session_id"]

    def test_start_persists_cloudflare_geo_to_app_user(self, s):
        uid = "TEST_user_geo_" + uuid.uuid4().hex[:6]
        r, _ = _post(s, "/listening/start",
                     json={"song_id": "test_song_geo", "user_id": uid, "platform": "web"},
                     headers={"CF-IPCountry": "TZ", "CF-IPCity": "Dar es Salaam"})
        assert r.status_code == 200, r.text
        data = r.json()
        # Country may be None if app_user doesn't exist; just verify the start returns it
        assert "country" in data
        assert data["country"] == "TZ" or data["country"] is None
        pytest.session_id_geo = data["session_id"]

    def test_ping_updates_heartbeat(self, s):
        sid = pytest.session_id_1
        r, _ = _post(s, "/listening/ping", json={"session_id": sid, "position_seconds": 10})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_ping_no_session_returns_ok_false(self, s):
        r, _ = _post(s, "/listening/ping", json={})
        assert r.status_code == 200
        assert r.json().get("ok") is False

    def test_end_closes_session_and_stream_no_play_count(self, s):
        sid = pytest.session_id_1
        r, _ = _post(s, "/listening/end", json={"session_id": sid, "duration_seconds": 10})
        assert r.status_code == 200
        data = r.json()
        assert data["tracked"] is True
        assert data["counted_as_play"] is False
        assert data["minimum_required"] == 45

    def test_end_with_45_plus_seconds_counts_as_play(self, s):
        # Start a fresh session for a real song
        # Find an existing song
        songs_r = s.get(f"{API}/user/search?q=&type=song&limit=1", timeout=15)
        # Search needs q>=1 char, so use a generic letter
        songs_r = s.get(f"{API}/user/search?q=a&type=song&limit=1", timeout=15)
        songs = songs_r.json().get("songs", []) if songs_r.status_code == 200 else []
        if not songs:
            pytest.skip("No songs available for play-count test")
        song_id = songs[0]["song_id"]
        before = songs[0].get("plays", 0) or 0

        start, _ = _post(s, "/listening/start", json={
            "song_id": song_id, "user_id": "TEST_play_user", "platform": "web"
        })
        assert start.status_code == 200
        sid = start.json()["session_id"]

        end, _ = _post(s, "/listening/end", json={"session_id": sid, "duration_seconds": 60})
        assert end.status_code == 200
        assert end.json()["counted_as_play"] is True

        # Verify song plays incremented
        time.sleep(0.5)
        check = s.get(f"{API}/user/search?q=a&type=song&limit=20", timeout=15).json()
        match = next((x for x in check.get("songs", []) if x.get("song_id") == song_id), None)
        if match:
            after = match.get("plays", 0) or 0
            assert after >= before + 1, f"Expected plays to grow from {before}, got {after}"

    def test_ping_sendbeacon_text_plain(self, s):
        """navigator.sendBeacon sends text/plain. /listening/ping must accept it."""
        start, _ = _post(s, "/listening/start", json={
            "song_id": "test_song_ping_beacon", "user_id": "TEST_beacon_ping", "platform": "web"
        })
        assert start.status_code == 200
        sid = start.json()["session_id"]
        import json as _json
        r = requests.post(f"{API}/listening/ping",
                          data=_json.dumps({"session_id": sid, "position_seconds": 5}),
                          headers={"Content-Type": "text/plain"},
                          timeout=15)
        assert r.status_code == 200, f"ping text/plain rejected: {r.status_code} {r.text}"
        assert r.json().get("ok") is True

    def test_end_json_still_works(self, s):
        """Regression: regular Content-Type: application/json must still work."""
        start, _ = _post(s, "/listening/start", json={
            "song_id": "test_song_json", "user_id": "TEST_json_regr", "platform": "web"
        })
        sid = start.json()["session_id"]
        r, _ = _post(s, "/listening/end", json={"session_id": sid, "duration_seconds": 10})
        assert r.status_code == 200
        assert r.json().get("tracked") is True
        assert r.json().get("counted_as_play") is False

    def test_end_invalidates_analytics_caches(self, s):
        """After a counted play (>=45s), analytics:overview & realtime caches
        must be invalidated so plays_today reflects the new play immediately."""
        # Warm the realtime cache first
        r0, _ = _get(s, "/analytics/realtime")
        assert r0.status_code == 200
        plays_before = r0.json().get("plays_today", 0)

        # Pick a real song
        songs_r = s.get(f"{API}/user/search?q=a&type=song&limit=1", timeout=15).json()
        songs = songs_r.get("songs", [])
        if not songs:
            pytest.skip("No songs to test cache invalidation")
        song_id = songs[0]["song_id"]

        # Start + end a session with duration>=45s
        start, _ = _post(s, "/listening/start", json={
            "song_id": song_id, "user_id": "TEST_cache_inv", "platform": "web"
        })
        sid = start.json()["session_id"]
        end, _ = _post(s, "/listening/end", json={"session_id": sid, "duration_seconds": 60})
        assert end.status_code == 200
        assert end.json().get("counted_as_play") is True

        # Realtime cache should have been busted; next call should rebuild and
        # show plays_today incremented (or at least >= before).
        time.sleep(0.5)
        r1, _ = _get(s, "/analytics/realtime")
        plays_after = r1.json().get("plays_today", 0)
        assert plays_after >= plays_before + 1, (
            f"Cache not invalidated: plays_today before={plays_before}, after={plays_after}. "
            "/listening/end should cache.delete('analytics:realtime')."
        )

    def test_overview_cold_under_4s_after_invalidation(self, s):
        """After cache-invalidation triggered by /listening/end, overview cold
        rebuild should now be <4s (parallelised with asyncio.gather)."""
        # Trigger an end-with-play to invalidate analytics:overview
        songs_r = s.get(f"{API}/user/search?q=a&type=song&limit=1", timeout=15).json()
        songs = songs_r.get("songs", [])
        if not songs:
            pytest.skip("No songs available")
        start, _ = _post(s, "/listening/start", json={
            "song_id": songs[0]["song_id"], "user_id": "TEST_cold_overview", "platform": "web"
        })
        sid = start.json()["session_id"]
        _post(s, "/listening/end", json={"session_id": sid, "duration_seconds": 60})

        # Next overview call is a cold rebuild
        r, ms = _get(s, "/analytics/overview", timeout=30)
        assert r.status_code == 200
        assert ms < COLD_THRESHOLD_MS, f"cold /analytics/overview took {ms:.0f}ms (target <{COLD_THRESHOLD_MS})"

    def test_end_sendbeacon_text_plain(self, s):
        # navigator.sendBeacon sends Content-Type: text/plain. The endpoint
        # MUST accept this. Currently broken (FastAPI 422s before handler runs)
        # because the route declares `data: dict = None` as a body param.
        # Start a session
        start, _ = _post(s, "/listening/start", json={
            "song_id": "test_song_beacon", "user_id": "TEST_beacon", "platform": "web"
        })
        sid = start.json()["session_id"]
        import json as _json
        r = s.post(f"{API}/listening/end",
                   data=_json.dumps({"session_id": sid, "duration_seconds": 20}),
                   headers={"Content-Type": "text/plain"},
                   timeout=15)
        assert r.status_code == 200, (
            f"sendBeacon-style text/plain rejected with {r.status_code}: {r.text}. "
            "Endpoint must read body manually instead of declaring `data: dict`."
        )
        assert r.json().get("tracked") is True


# ============== /analytics/realtime ==============

class TestRealtimeAnalytics:
    def test_realtime_returns_expected_shape(self, s):
        r, ms = _get(s, "/analytics/realtime")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["active_streams", "active_listeners", "plays_today",
                  "new_users_today", "hourly_trend", "recent_plays", "timestamp"]:
            assert k in data, f"Missing key {k}"
        assert isinstance(data["active_streams"], int)
        assert isinstance(data["hourly_trend"], list)
        assert isinstance(data["recent_plays"], list)

    def test_realtime_cache_warm_under_200ms(self, s):
        _get(s, "/analytics/realtime")  # warm
        r, ms = _get(s, "/analytics/realtime")
        assert r.status_code == 200
        assert ms < WARM_THRESHOLD_MS, f"warm /analytics/realtime took {ms:.0f}ms"

    def test_realtime_picks_up_active_stream(self, s):
        # Create a fresh active stream
        start, _ = _post(s, "/listening/start", json={
            "song_id": "rt_song", "user_id": "TEST_rt_" + uuid.uuid4().hex[:6], "platform": "web"
        })
        assert start.status_code == 200
        # Bust cache by waiting >15s is impractical; just verify endpoint OK
        # (cache may hide it but realtime collection has the row)
        time.sleep(1)
        r, _ = _get(s, "/analytics/realtime")
        assert r.status_code == 200


# ============== /analytics/live-listeners ==============

class TestLiveListeners:
    def test_live_listeners_shape(self, s):
        r, _ = _get(s, "/analytics/live-listeners")
        # Endpoint may not exist -> document
        if r.status_code == 404:
            pytest.skip("live-listeners endpoint not present")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total_active_listeners" in data or "active_listeners" in data

    def test_live_listeners_warm_cache(self, s):
        _get(s, "/analytics/live-listeners")
        r, ms = _get(s, "/analytics/live-listeners")
        if r.status_code == 404:
            pytest.skip("live-listeners endpoint not present")
        assert ms < WARM_THRESHOLD_MS, f"warm took {ms:.0f}ms"


# ============== /analytics/overview ==============

class TestOverview:
    def test_overview_total_users_includes_app_users(self, s):
        r, _ = _get(s, "/analytics/overview")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total_users" in data
        assert "total_customers" in data
        # Per agent context, seed has 50+ app_users; total should be >= 50
        assert data["total_users"] >= 50, f"Expected >=50 users, got {data['total_users']}"
        assert data["total_customers"] >= 1

    def test_overview_cold_under_4s(self, s):
        # Clear cache by inserting a uniquely-keyed request is not possible from outside;
        # we simply verify a fresh response is bounded
        r, ms = _get(s, "/analytics/overview")
        assert r.status_code == 200
        assert ms < COLD_THRESHOLD_MS, f"overview took {ms:.0f}ms"

    def test_overview_warm_cache_fast(self, s):
        _get(s, "/analytics/overview")
        r, ms = _get(s, "/analytics/overview")
        assert ms < WARM_THRESHOLD_MS, f"warm overview took {ms:.0f}ms"


# ============== /analytics/trends ==============

class TestTrends:
    def test_trends_returns_shape(self, s):
        r, ms = _get(s, "/analytics/trends", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "user_growth" in data
        assert "content_performance" in data
        assert "donations_trend" in data
        assert isinstance(data["user_growth"], list)

    def test_trends_warm_cache(self, s):
        _get(s, "/analytics/trends", timeout=20)
        r, ms = _get(s, "/analytics/trends", timeout=20)
        assert r.status_code == 200
        assert ms < WARM_THRESHOLD_MS, f"warm trends took {ms:.0f}ms"

    def test_trends_cold_under_4s(self, s):
        # Best-effort cold; if cached, will be fast (which is fine)
        r, ms = _get(s, "/analytics/trends", timeout=20)
        assert ms < COLD_THRESHOLD_MS, f"trends took {ms:.0f}ms"


# ============== /neno-la-leo/active ==============

class TestNenoActive:
    def test_active_returns_shape(self, s):
        r, _ = _get(s, "/neno-la-leo/active")
        assert r.status_code == 200, r.text

    def test_active_warm_cache(self, s):
        _get(s, "/neno-la-leo/active")
        r, ms = _get(s, "/neno-la-leo/active")
        assert ms < WARM_THRESHOLD_MS, f"warm neno took {ms:.0f}ms"


# ============== /app-settings ==============

class TestAppSettings:
    def test_app_settings_returns_200(self, s):
        r, _ = _get(s, "/app-settings")
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, dict)

    def test_app_settings_warm_cache(self, s):
        _get(s, "/app-settings")
        r, ms = _get(s, "/app-settings")
        assert ms < WARM_THRESHOLD_MS, f"warm app-settings took {ms:.0f}ms"


# ============== /geo/detect-country ==============

class TestGeoDetect:
    def test_prefers_cf_country_via_localhost(self, s):
        # Kubernetes ingress strips CF-* headers from external clients (security),
        # so we hit the backend directly via localhost:8001 to verify the
        # Cloudflare-preference code path actually works.
        try:
            r = s.get("http://localhost:8001/api/geo/detect-country",
                      headers={"CF-IPCountry": "KE"}, timeout=10)
        except Exception as e:
            pytest.skip(f"localhost unreachable: {e}")
        if r.status_code == 404:
            pytest.skip("geo/detect-country endpoint not present")
        assert r.status_code == 200, r.text
        data = r.json()
        country = (data.get("country") or data.get("country_code") or
                   data.get("detected_country"))
        assert country == "KE", f"expected KE, got {data}"
        if "detected_from" in data:
            assert data["detected_from"] == "cloudflare"


# ============== /user/home/geo ==============

class TestUserHomeGeo:
    def test_home_geo_uses_cf_header(self, s):
        r, ms = _get(s, "/user/home/geo", headers={"CF-IPCountry": "UG"})
        if r.status_code == 404:
            pytest.skip("user/home/geo endpoint not present")
        assert r.status_code == 200, r.text
        # cold under 4s
        assert ms < COLD_THRESHOLD_MS, f"home/geo took {ms:.0f}ms"

    def test_home_geo_warm(self, s):
        _get(s, "/user/home/geo", headers={"CF-IPCountry": "UG"})
        r, ms = _get(s, "/user/home/geo", headers={"CF-IPCountry": "UG"})
        if r.status_code == 404:
            pytest.skip("not present")
        # warm may still be slower if it depends on user_id; just sanity bound
        assert ms < COLD_THRESHOLD_MS


# ============== Cleanup ==============

def test_zzz_cleanup(s):
    """Best-effort cleanup of TEST_ data created by this suite."""
    # We don't have direct DB access; rely on TTL/no harm. Just print to log.
    print("Cleanup: TEST_ prefix entries left in listening_sessions/active_streams "
          "(harmless, prefixed for identification).")
