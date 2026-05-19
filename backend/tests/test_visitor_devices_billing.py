"""Iter 49 — visitor + device tracking + billing-off short-circuit tests."""
import os
import sys
import asyncio
import pytest
import requests

sys.path.insert(0, "/app/backend")
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
CHOIR_ID = "sing_819ad8e12623"
USER_ID = "user_b7a83cedbc75"

UA_SAMSUNG = "Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014) AppleWebKit/537.36"
UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15"
UA_INFINIX = "Mozilla/5.0 (Linux; Android 12; Infinix X670 Build/SP1A.210812.016)"
UA_TECNO = "Mozilla/5.0 (Linux; Android 11; TECNO CK7n Build/RP1A.200720.011)"


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def db(event_loop):
    client = AsyncIOMotorClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/users/login",
                      json={"email": "admin@gracefy.life", "password": "Mwanga@82!3"},
                      timeout=20)
    assert r.status_code == 200, r.text
    return r.json().get("session_token") or r.json().get("token")


# ---------- 1. Samsung anonymous listening session persists device fields ----
def test_listening_start_samsung_anonymous(event_loop, db):
    r = requests.post(
        f"{BASE_URL}/api/listening/start",
        json={"song_id": "demo_song", "platform": "web"},
        headers={"User-Agent": UA_SAMSUNG},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]

    async def check():
        sess = await db.listening_sessions.find_one({"session_id": sid})
        stream = await db.active_streams.find_one({"stream_id": sid})
        return sess, stream

    sess, stream = event_loop.run_until_complete(check())
    assert sess and sess["device_brand"] == "Samsung", f"got {sess and sess.get('device_brand')}"
    assert "SM-A536B" in (sess.get("device_model") or ""), sess.get("device_model")
    assert "Android 13" in (sess.get("device_os") or ""), sess.get("device_os")
    assert sess.get("is_anonymous") is True
    assert stream and stream["device_brand"] == "Samsung"
    assert stream.get("is_anonymous") is True


# ---------- 2. iPhone with real user_id pushes into devices[] ----
def test_listening_start_iphone_user_pushes_device(event_loop, db):
    # Reset devices array first to validate the push from scratch
    async def reset():
        await db.app_users.update_one({"user_id": USER_ID},
                                      {"$set": {"devices": []}})
    event_loop.run_until_complete(reset())

    r = requests.post(
        f"{BASE_URL}/api/listening/start",
        json={"user_id": USER_ID, "song_id": "demo_song", "device_id": "test_iphone_001"},
        headers={"User-Agent": UA_IPHONE},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]

    async def check():
        sess = await db.listening_sessions.find_one({"session_id": sid})
        u = await db.app_users.find_one({"user_id": USER_ID})
        return sess, u

    sess, user = event_loop.run_until_complete(check())
    assert sess["device_brand"] == "Apple"
    assert sess["device_model"] == "iPhone"
    assert "iOS" in (sess.get("device_os") or "")
    assert sess.get("is_anonymous") is False
    assert user is not None, "user_b7a83cedbc75 not found"
    devices = user.get("devices") or []
    iphones = [d for d in devices if d.get("device_id") == "test_iphone_001"]
    assert len(iphones) == 1, f"Expected 1 iphone device, got {len(iphones)}: {devices}"
    assert iphones[0]["brand"] == "Apple"
    assert iphones[0]["model"] == "iPhone"
    assert user.get("last_device", {}).get("device_id") == "test_iphone_001"
    assert user.get("last_seen_at") is not None


# ---------- 3. Same user_id+device_id twice = no duplicate device ----
def test_listening_start_same_device_dedupes(event_loop, db):
    # Call /listening/start again with same device_id
    r = requests.post(
        f"{BASE_URL}/api/listening/start",
        json={"user_id": USER_ID, "song_id": "demo_song", "device_id": "test_iphone_001"},
        headers={"User-Agent": UA_IPHONE},
        timeout=15,
    )
    assert r.status_code == 200

    async def check():
        u = await db.app_users.find_one({"user_id": USER_ID})
        return u

    user = event_loop.run_until_complete(check())
    devices = user.get("devices") or []
    iphones = [d for d in devices if d.get("device_id") == "test_iphone_001"]
    assert len(iphones) == 1, f"Expected dedupe, got {len(iphones)}: {[d.get('device_id') for d in devices]}"


# ---------- 4. /api/analytics/realtime returns visitor + device fields ----
def test_realtime_visitor_and_devices():
    # Clear cache by hitting again after 16s isn't viable -- just check current
    r = requests.get(f"{BASE_URL}/api/analytics/realtime", timeout=15)
    assert r.status_code == 200
    data = r.json()
    for k in ("active_visitors", "anonymous_plays_today", "device_brands"):
        assert k in data, f"missing key {k} in {list(data.keys())}"
    assert isinstance(data["device_brands"], list)
    # Visitor count must be >=0 integer
    assert isinstance(data["active_visitors"], int)


# ---------- 5. /api/analytics/overview returns visitor totals ----
def test_overview_visitor_totals(event_loop, db):
    # Bust cache - cache key is analytics:overview, 60s. We just verify shape.
    r = requests.get(f"{BASE_URL}/api/analytics/overview", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "total_visitor_plays" in data
    assert "visitor_plays_today" in data
    assert isinstance(data["total_visitor_plays"], int)


# ---------- 6. /api/analytics/devices for each period ----
@pytest.mark.parametrize("period", ["7d", "30d", "90d", "all"])
def test_devices_endpoint_periods(period):
    r = requests.get(f"{BASE_URL}/api/analytics/devices?period={period}", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("by_brand", "by_os", "by_platform", "total"):
        assert k in data, f"missing {k}"
    assert isinstance(data["by_brand"], list)
    assert isinstance(data["total"], int)
    assert data["period"] == period


# ---------- 7. Billing OFF → revenue zeroed ----
def test_choir_revenue_billing_off(event_loop, db):
    async def set_billing(enabled):
        await db.app_settings.update_one(
            {"setting_type": "billing"},
            {"$set": {"setting_type": "billing", "enabled": enabled}},
            upsert=True,
        )
    event_loop.run_until_complete(set_billing(False))

    r = requests.get(f"{BASE_URL}/api/choir/revenue/{CHOIR_ID}", timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    # billing_enabled should be on top-level OR in summary
    be = data.get("billing_enabled")
    if be is None:
        be = data.get("summary", {}).get("billing_enabled")
    assert be is False, f"expected billing_enabled False, got {be}"

    s = data["summary"]
    assert s["gross_revenue"] == 0, s
    assert s["net_revenue"] == 0
    assert s["platform_fee"] == 0
    assert s["current_balance"] == 0
    assert s["total_earned"] == 0
    assert s["total_withdrawn"] == 0
    assert s["total_plays"] > 0, "Plays should still be counted"
    for a in data["albums"]:
        assert a["revenue"] == 0, a


# ---------- 8. Billing ON → revenue computed via 5 TZS * 0.7 ----
def test_choir_revenue_billing_on(event_loop, db):
    async def set_billing(enabled):
        await db.app_settings.update_one(
            {"setting_type": "billing"},
            {"$set": {"setting_type": "billing", "enabled": enabled}},
            upsert=True,
        )
    event_loop.run_until_complete(set_billing(True))

    r = requests.get(f"{BASE_URL}/api/choir/revenue/{CHOIR_ID}", timeout=20)
    assert r.status_code == 200
    data = r.json()
    s = data["summary"]
    be = data.get("billing_enabled") or s.get("billing_enabled")
    assert be is True
    assert s["total_plays"] > 0
    expected_gross = s["total_plays"] * 5
    assert s["gross_revenue"] == expected_gross, f"{s['gross_revenue']} != {expected_gross}"
    expected_net = expected_gross - int(expected_gross * 30 / 100)
    assert s["net_revenue"] == expected_net


# ---------- 9. /admin/choirs/{id}.analytics.billing_enabled reflects ----
def test_admin_choirs_billing_flag(admin_token, event_loop, db):
    async def set_billing(enabled):
        await db.app_settings.update_one(
            {"setting_type": "billing"},
            {"$set": {"setting_type": "billing", "enabled": enabled}},
            upsert=True,
        )
    event_loop.run_until_complete(set_billing(True))

    headers = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(f"{BASE_URL}/api/admin/choirs/{CHOIR_ID}",
                     headers=headers, cookies={"session_token": admin_token}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    analytics = data.get("analytics") or {}
    # billing_enabled may be inside summary or top-level of analytics
    be = analytics.get("billing_enabled")
    if be is None:
        be = analytics.get("summary", {}).get("billing_enabled")
    assert be is True, f"Expected billing_enabled True; got {be} (keys={list(analytics.keys())})"

    # Flip to False, recheck
    event_loop.run_until_complete(set_billing(False))
    r = requests.get(f"{BASE_URL}/api/admin/choirs/{CHOIR_ID}",
                     headers=headers, cookies={"session_token": admin_token}, timeout=20)
    analytics = r.json().get("analytics") or {}
    be = analytics.get("billing_enabled")
    if be is None:
        be = analytics.get("summary", {}).get("billing_enabled")
    assert be is False, f"Expected billing_enabled False after flip; got {be}"


# ---------- 10. /admin/users/{user_id} returns devices[] ----
def test_admin_user_returns_devices(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    r = requests.get(f"{BASE_URL}/api/admin/users/{USER_ID}",
                     headers=headers, cookies={"session_token": admin_token}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "devices" in data, f"keys={list(data.keys())}"
    assert isinstance(data["devices"], list)
    # Should contain the iphone we just pushed
    iphones = [d for d in data["devices"] if d.get("device_id") == "test_iphone_001"]
    assert len(iphones) >= 1


# ---------- 11. Devices endpoint public (no auth) ----
def test_devices_endpoint_public():
    r = requests.get(f"{BASE_URL}/api/analytics/devices", timeout=15)
    assert r.status_code == 200


# ---------- 12. UA parser sanity: Infinix + Tecno + empty UA ----
def test_ua_parser_infinix(event_loop, db):
    r = requests.post(f"{BASE_URL}/api/listening/start",
                      json={"song_id": "demo_song"},
                      headers={"User-Agent": UA_INFINIX}, timeout=15)
    assert r.status_code == 200
    sid = r.json()["session_id"]

    async def fetch(): return await db.listening_sessions.find_one({"session_id": sid})
    sess = event_loop.run_until_complete(fetch())
    assert sess["device_brand"] == "Infinix", sess.get("device_brand")


def test_ua_parser_tecno(event_loop, db):
    r = requests.post(f"{BASE_URL}/api/listening/start",
                      json={"song_id": "demo_song"},
                      headers={"User-Agent": UA_TECNO}, timeout=15)
    assert r.status_code == 200
    sid = r.json()["session_id"]
    async def fetch(): return await db.listening_sessions.find_one({"session_id": sid})
    sess = event_loop.run_until_complete(fetch())
    assert sess["device_brand"] == "Tecno", sess.get("device_brand")


def test_ua_parser_empty(event_loop, db):
    r = requests.post(f"{BASE_URL}/api/listening/start",
                      json={"song_id": "demo_song"},
                      headers={"User-Agent": ""}, timeout=15)
    assert r.status_code == 200  # must not crash
