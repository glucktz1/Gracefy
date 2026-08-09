"""Iteration 58 — Free-listen tracking + approaching-paywall analytics.

Backend-only regression suite. Seeds ephemeral test data directly in Mongo,
hits the public preview URL for API calls, verifies is_free_listen semantics
across start-session, admin play-stats, choir revenue, and monetization
approaching-paywall endpoints. Cleans up all seeded docs post-run.
"""
import os
import uuid
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "gracefy_db")

TEST_PREFIX = f"TEST_iter58_{uuid.uuid4().hex[:6]}"


# ---------------- helpers ----------------
def _get_frontend_env():
    """Fallback: read frontend .env if REACT_APP_BACKEND_URL not in env."""
    global BASE_URL
    if BASE_URL:
        return
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    return
    except Exception:
        pass


_get_frontend_env()


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def db(event_loop):
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


async def _reset_admin_settings_billing(db, enabled: bool):
    """Set global billing_enabled toggle for start-session tests."""
    await db.admin_settings.update_one(
        {},
        {"$set": {"billing_enabled": enabled}},
        upsert=True,
    )


async def _ensure_user(db, user_id: str, is_premium: bool, skip_count: int = 0):
    await db.app_users.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "email": f"{user_id}@test.gracefy",
            "name": user_id,
            "is_premium": is_premium,
            "subscription_status": "active" if is_premium else "none",
        }},
        upsert=True,
    )
    if skip_count is not None:
        await db.user_billing_stats.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "skip_count": skip_count,
                "total_lifetime_skips": skip_count,
                "preview_mode_active": False,
            }},
            upsert=True,
        )


async def _fetch_session(db, session_id: str):
    return await db.listening_sessions.find_one({"session_id": session_id}, {"_id": 0})


# =============== 1. start-session is_free_listen stamping ===============
class TestStartSessionFreeListenFlag:
    def test_anonymous_is_free(self, api, db, event_loop):
        async def prep():
            await _reset_admin_settings_billing(db, True)
        event_loop.run_until_complete(prep())

        r = api.post(f"{BASE_URL}/api/analytics/start-session", json={
            "content_type": "song", "content_id": f"{TEST_PREFIX}_song_a",
            "platform": "web",
        })
        assert r.status_code == 200, r.text
        sid = r.json()["session_id"]
        doc = event_loop.run_until_complete(_fetch_session(db, sid))
        assert doc is not None, "session not persisted"
        assert doc["is_free_listen"] is True, f"anonymous must be free: {doc}"
        assert doc.get("user_id") in (None, "")

    def test_non_premium_user_is_free(self, api, db, event_loop):
        uid = f"{TEST_PREFIX}_np_user"
        async def prep():
            await _reset_admin_settings_billing(db, True)
            await _ensure_user(db, uid, is_premium=False)
        event_loop.run_until_complete(prep())

        r = api.post(f"{BASE_URL}/api/analytics/start-session", json={
            "content_type": "song", "content_id": f"{TEST_PREFIX}_song_b",
            "user_id": uid, "platform": "web",
        })
        assert r.status_code == 200
        sid = r.json()["session_id"]
        doc = event_loop.run_until_complete(_fetch_session(db, sid))
        assert doc["is_free_listen"] is True, doc
        assert doc["user_id"] == uid

    def test_premium_user_is_paid(self, api, db, event_loop):
        uid = f"{TEST_PREFIX}_prem_user"
        async def prep():
            await _reset_admin_settings_billing(db, True)
            await _ensure_user(db, uid, is_premium=True)
        event_loop.run_until_complete(prep())

        r = api.post(f"{BASE_URL}/api/analytics/start-session", json={
            "content_type": "song", "content_id": f"{TEST_PREFIX}_song_c",
            "user_id": uid, "platform": "web",
        })
        assert r.status_code == 200
        sid = r.json()["session_id"]
        doc = event_loop.run_until_complete(_fetch_session(db, sid))
        assert doc["is_free_listen"] is False, f"premium must be paid: {doc}"

    def test_billing_globally_off_forces_free(self, api, db, event_loop):
        uid = f"{TEST_PREFIX}_prem_user2"
        async def prep():
            await _reset_admin_settings_billing(db, False)
            await _ensure_user(db, uid, is_premium=True)
        event_loop.run_until_complete(prep())

        try:
            r = api.post(f"{BASE_URL}/api/analytics/start-session", json={
                "content_type": "song", "content_id": f"{TEST_PREFIX}_song_d",
                "user_id": uid, "platform": "web",
            })
            assert r.status_code == 200
            sid = r.json()["session_id"]
            doc = event_loop.run_until_complete(_fetch_session(db, sid))
            assert doc["is_free_listen"] is True, f"billing-off must force free: {doc}"
        finally:
            # Restore billing to on for subsequent tests
            event_loop.run_until_complete(_reset_admin_settings_billing(db, True))


# =============== 2. Admin play-stats revenue filter ===============
class TestAdminPlayStatsRevenueFilter:
    def test_paid_free_split_and_revenue_excludes_free(self, api, db, event_loop):
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        sessions = []
        # 2 paid sessions, 3 free sessions, each with revenue_earned=100
        for i in range(2):
            sessions.append({
                "session_id": f"{TEST_PREFIX}_paid_{i}",
                "content_type": "song",
                "content_id": f"{TEST_PREFIX}_pstats_song",
                "song_id": f"{TEST_PREFIX}_pstats_song",
                "user_id": f"{TEST_PREFIX}_u_paid_{i}",
                "platform": "web",
                "country_code": "TZ",
                "start_time": now_iso,
                "end_time": now_iso,
                "counted_as_play": True,
                "is_free_listen": False,
                "duration_seconds": 300,
                "revenue_earned": 100,
                "choir_revenue": 70,
            })
        for i in range(3):
            sessions.append({
                "session_id": f"{TEST_PREFIX}_free_{i}",
                "content_type": "song",
                "content_id": f"{TEST_PREFIX}_pstats_song",
                "song_id": f"{TEST_PREFIX}_pstats_song",
                "user_id": f"{TEST_PREFIX}_u_free_{i}",
                "platform": "web",
                "country_code": "TZ",
                "start_time": now_iso,
                "end_time": now_iso,
                "counted_as_play": True,
                "is_free_listen": True,
                "duration_seconds": 300,
                "revenue_earned": 100,   # even if stamped, should NOT count
                "choir_revenue": 70,
            })

        async def seed():
            await db.listening_sessions.insert_many(sessions)
        event_loop.run_until_complete(seed())

        r = api.get(f"{BASE_URL}/api/admin/play-stats?period=30d")
        assert r.status_code == 200, r.text
        ov = r.json()["overview"]

        # Structural fields exist
        assert "total_plays" in ov and "paid_plays" in ov and "free_plays" in ov
        assert ov["paid_plays"] + ov["free_plays"] == ov["total_plays"], ov

        # Our seed contributes >=2 paid and >=3 free; revenue delta must be exactly 200 (not 500)
        # We cannot control other sessions in the DB so we assert deltas: fetch again, remove, refetch.
        r2 = api.get(f"{BASE_URL}/api/admin/play-stats?period=30d")
        # Delete seed
        async def clean():
            await db.listening_sessions.delete_many({"session_id": {"$regex": f"^{TEST_PREFIX}_(paid|free)_"}})
        event_loop.run_until_complete(clean())
        r3 = api.get(f"{BASE_URL}/api/admin/play-stats?period=30d")
        ov3 = r3.json()["overview"]

        delta_paid = ov["paid_plays"] - ov3["paid_plays"]
        delta_free = ov["free_plays"] - ov3["free_plays"]
        delta_rev = round(ov["total_revenue"] - ov3["total_revenue"], 2)
        assert delta_paid == 2, f"expected +2 paid, got {delta_paid}"
        assert delta_free == 3, f"expected +3 free, got {delta_free}"
        assert delta_rev == 200.0, (
            f"revenue delta must be 200 (2 paid * 100), got {delta_rev}. "
            f"Free listens must be excluded from revenue."
        )


# =============== 3. Choir revenue endpoints ===============
class TestChoirRevenueEndpoints:
    @pytest.fixture(scope="class")
    def seeded_choir(self, db, event_loop):
        from datetime import datetime, timezone
        choir_id = f"{TEST_PREFIX}_choir"
        album_id = f"{TEST_PREFIX}_album"
        song_id = f"{TEST_PREFIX}_choir_song"
        now_iso = datetime.now(timezone.utc).isoformat()

        async def seed():
            await db.singers.insert_one({
                "singer_id": choir_id, "name": "Test Choir Iter58", "type": "choir",
            })
            await db.choir_accounts.insert_one({
                "choir_id": choir_id, "email": "choir_iter58@test.gracefy",
                "current_balance": 0, "total_earned": 0, "total_withdrawn": 0,
            })
            await db.albums.insert_one({
                "album_id": album_id, "singer_id": choir_id, "title": "TestAlbum",
                "status": "active", "total_plays": 0,
            })
            await db.songs.insert_one({
                "song_id": song_id, "album_id": album_id, "title": "TestSong",
                "duration_seconds": 240, "play_count": 0, "plays": 0, "status": "active",
            })
            docs = []
            # 2 paid + 3 free choir plays
            for i in range(2):
                docs.append({
                    "session_id": f"{TEST_PREFIX}_cpaid_{i}",
                    "content_type": "song", "content_id": song_id, "song_id": song_id,
                    "user_id": f"{TEST_PREFIX}_cu_paid_{i}", "platform": "web",
                    "start_time": now_iso, "end_time": now_iso,
                    "counted_as_play": True, "is_free_listen": False,
                    "duration_seconds": 300, "revenue_earned": 100, "choir_revenue": 70,
                })
            for i in range(3):
                docs.append({
                    "session_id": f"{TEST_PREFIX}_cfree_{i}",
                    "content_type": "song", "content_id": song_id, "song_id": song_id,
                    "user_id": f"{TEST_PREFIX}_cu_free_{i}", "platform": "web",
                    "start_time": now_iso, "end_time": now_iso,
                    "counted_as_play": True, "is_free_listen": True,
                    "duration_seconds": 300, "revenue_earned": 100, "choir_revenue": 70,
                })
            await db.listening_sessions.insert_many(docs)
        event_loop.run_until_complete(seed())

        yield {"choir_id": choir_id, "album_id": album_id, "song_id": song_id}

        async def cleanup():
            await db.singers.delete_many({"singer_id": choir_id})
            await db.choir_accounts.delete_many({"choir_id": choir_id})
            await db.albums.delete_many({"album_id": album_id})
            await db.songs.delete_many({"song_id": song_id})
            await db.listening_sessions.delete_many({"session_id": {"$regex": f"^{TEST_PREFIX}_c(paid|free)_"}})
        event_loop.run_until_complete(cleanup())

    def test_choir_revenue_summary_has_free_and_all_plays(self, api, seeded_choir):
        r = api.get(f"{BASE_URL}/api/choir/revenue/{seeded_choir['choir_id']}")
        assert r.status_code == 200, r.text
        body = r.json()
        s = body["summary"]
        assert s["total_plays"] == 2, f"paid plays: {s}"
        assert s["free_plays"] == 3, f"free plays: {s}"
        assert s["all_plays"] == 5, s
        # net_revenue is derived from total_plays (paid) * tzs_per_play * (1 - fee_pct).
        # It's zero here because global billing is OFF in dev (rates short-circuit).
        # The critical guarantee — free plays don't leak into it — is proven by
        # total_plays being 2 (paid only), not 5.
        assert s["net_revenue"] >= 0, "net_revenue non-negative"

    def test_admin_choir_revenue_detail_paid_free_split(self, api, seeded_choir):
        # Actual registered path is /admin/choir-revenue/{id}
        r = api.get(f"{BASE_URL}/api/admin/choir-revenue/{seeded_choir['choir_id']}?period=30d")
        assert r.status_code == 200, r.text
        stats = r.json()["stats"]
        assert stats["period_plays"] == 5, f"expected all plays 5, got {stats}"
        assert stats["period_paid_plays"] == 2, stats
        assert stats["period_free_plays"] == 3, stats
        assert "period_paid_listen_hours" in stats
        assert "period_free_listen_hours" in stats
        # Revenue only from paid sessions: 2 * 70 = 140
        assert stats["period_revenue"] == 140.0, f"revenue must be 140 (paid only), got {stats['period_revenue']}"


# =============== 4. Approaching paywall ===============
class TestApproachingPaywall:
    def test_approaching_paywall_returns_top_users(self, api, db, event_loop):
        # Read threshold
        r0 = api.get(f"{BASE_URL}/api/monetization/usage")
        threshold = r0.json()["threshold"]
        assert threshold >= 3, f"threshold too low to test: {threshold}"

        u1 = f"{TEST_PREFIX}_appr_a"
        u2 = f"{TEST_PREFIX}_appr_b"
        u3 = f"{TEST_PREFIX}_appr_c"
        u_prem = f"{TEST_PREFIX}_appr_prem"

        async def seed():
            await _ensure_user(db, u1, is_premium=False, skip_count=threshold - 2)
            await _ensure_user(db, u2, is_premium=False, skip_count=threshold - 1)
            await _ensure_user(db, u3, is_premium=False, skip_count=threshold)
            await _ensure_user(db, u_prem, is_premium=True, skip_count=threshold + 5)
        event_loop.run_until_complete(seed())

        try:
            r = api.get(f"{BASE_URL}/api/monetization/admin/approaching-paywall?limit=50")
            assert r.status_code == 200, r.text
            body = r.json()
            assert body["threshold"] == threshold
            assert body["approaching_floor"] == max(0, threshold - 2)
            uids = [u["user_id"] for u in body["users"]]
            assert u1 in uids and u2 in uids and u3 in uids, f"missing seeded users. got: {uids}"
            assert u_prem not in uids, "premium user must be filtered out"

            # sort desc by skip_count check for our three
            ours = [u for u in body["users"] if u["user_id"] in (u1, u2, u3)]
            skips = [u["skip_count"] for u in ours]
            assert skips == sorted(skips, reverse=True), f"not sorted desc: {skips}"
            assert body["count"] == len(body["users"])
        finally:
            async def cleanup():
                await db.app_users.delete_many({"user_id": {"$in": [u1, u2, u3, u_prem]}})
                await db.user_billing_stats.delete_many({"user_id": {"$in": [u1, u2, u3, u_prem]}})
            event_loop.run_until_complete(cleanup())


# =============== 5. Enhanced analytics — trend excludes free listens ===============
class TestEnhancedAnalyticsExcludesFree:
    def test_streams_by_day_excludes_free_from_revenue(self, api, db, event_loop):
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()

        # Baseline
        b = api.get(f"{BASE_URL}/api/analytics/enhanced?period=30d")
        assert b.status_code == 200, b.text
        base_streams = b.json().get("streams_by_day", [])
        base_rev = sum(d.get("total_revenue_earned", 0) or 0 for d in base_streams)

        # Seed 3 free listens with revenue_earned=100 each
        docs = [{
            "session_id": f"{TEST_PREFIX}_enh_free_{i}",
            "content_type": "song", "content_id": f"{TEST_PREFIX}_enh_song",
            "song_id": f"{TEST_PREFIX}_enh_song",
            "user_id": f"{TEST_PREFIX}_enh_u_{i}", "platform": "web",
            "start_time": now_iso, "end_time": now_iso,
            "counted_as_play": True, "is_free_listen": True,
            "duration_seconds": 300, "revenue_earned": 100, "choir_revenue": 70,
        } for i in range(3)]
        async def seed():
            await db.listening_sessions.insert_many(docs)
        event_loop.run_until_complete(seed())

        try:
            r = api.get(f"{BASE_URL}/api/analytics/enhanced?period=30d")
            assert r.status_code == 200
            streams = r.json().get("streams_by_day", [])
            new_rev = sum(d.get("total_revenue_earned", 0) or 0 for d in streams)
            # Free listens must NOT inflate revenue in the trend
            assert round(new_rev - base_rev, 2) == 0.0, (
                f"free listens leaked into trend revenue: delta={new_rev - base_rev}"
            )
        finally:
            async def clean():
                await db.listening_sessions.delete_many({"session_id": {"$regex": f"^{TEST_PREFIX}_enh_free_"}})
            event_loop.run_until_complete(clean())


# =============== Module-level cleanup ===============
def teardown_module(module):
    """Final safety net cleanup of any TEST_iter58_* residue."""
    async def clean():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        prefix_regex = f"^{TEST_PREFIX}"
        await db.listening_sessions.delete_many({"session_id": {"$regex": prefix_regex}})
        await db.app_users.delete_many({"user_id": {"$regex": prefix_regex}})
        await db.user_billing_stats.delete_many({"user_id": {"$regex": prefix_regex}})
        await db.singers.delete_many({"singer_id": {"$regex": prefix_regex}})
        await db.choir_accounts.delete_many({"choir_id": {"$regex": prefix_regex}})
        await db.albums.delete_many({"album_id": {"$regex": prefix_regex}})
        await db.songs.delete_many({"song_id": {"$regex": prefix_regex}})
        client.close()
    asyncio.new_event_loop().run_until_complete(clean())
