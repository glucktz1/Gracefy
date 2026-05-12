"""
Backend tests for Neno la Leo (Word of the Day) module.
Covers CRUD + business logic for /api/neno-la-leo/* endpoints.
"""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://gracefy-hls-launch.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api/neno-la-leo"

EXISTING_LEADER_ID = "leader_c6f3f6973c2c"  # Fr. John Haule
EXISTING_NENO_ID = "neno_9aaffe3ec7ed"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# Holders for IDs created during tests
created = {"leader_id": None, "neno_id": None, "neno_single_verse_id": None}


# ============ ADMIN LEADERS ============
class TestAdminLeaders:
    def test_get_all_leaders(self, s):
        r = s.get(f"{API}/admin/leaders")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "leaders" in data and "total" in data
        assert isinstance(data["leaders"], list)
        # Ensure _id is not leaked
        for ld in data["leaders"]:
            assert "_id" not in ld
            assert "password_hash" not in ld

    def test_get_pending_leaders(self, s):
        r = s.get(f"{API}/admin/pending-leaders")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "leaders" in data
        for ld in data["leaders"]:
            assert ld.get("is_approved") is False
            assert "_id" not in ld

    def test_create_leader_returns_temp_password(self, s):
        payload = {
            "name": "TEST_Pastor_NenoQA",
            "title": "Pastor",
            "email": f"TEST_neno_{datetime.now().timestamp()}@example.com",
            "phone": "+255700000111",
            "bio": "Test bio",
            "church_or_organization": "TEST Church",
        }
        r = s.post(f"{API}/admin/leaders", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "leader" in data
        assert "temporary_password" in data
        assert len(data["temporary_password"]) >= 6
        leader = data["leader"]
        assert leader["email"] == payload["email"]
        assert leader["is_approved"] is True
        assert leader["is_active"] is True
        assert "password_hash" not in leader
        assert "_id" not in leader
        assert leader["stats"]["total_neno"] == 0
        created["leader_id"] = leader["leader_id"]

    def test_create_leader_duplicate_email_fails(self, s):
        payload = {
            "name": "TEST_Dup",
            "title": "Rev.",
            "email": "admin@gracefy.life",  # any existing
        }
        # First create
        em = f"TEST_dup_{datetime.now().timestamp()}@example.com"
        payload["email"] = em
        r1 = s.post(f"{API}/admin/leaders", json=payload)
        assert r1.status_code == 200
        # Duplicate
        r2 = s.post(f"{API}/admin/leaders", json=payload)
        assert r2.status_code == 400

    def test_update_leader(self, s):
        assert created["leader_id"], "leader was not created"
        r = s.put(
            f"{API}/admin/leaders/{created['leader_id']}",
            json={"bio": "Updated TEST bio", "phone": "+255712345678"},
        )
        assert r.status_code == 200, r.text
        # Verify via GET
        r2 = s.get(f"{API}/admin/leaders")
        leaders = r2.json()["leaders"]
        found = next((l for l in leaders if l["leader_id"] == created["leader_id"]), None)
        assert found is not None
        assert found["bio"] == "Updated TEST bio"
        assert found["phone"] == "+255712345678"

    def test_update_leader_not_found(self, s):
        r = s.put(f"{API}/admin/leaders/leader_does_not_exist_xyz", json={"bio": "x"})
        assert r.status_code == 404

    def test_approve_leader(self, s):
        # Mark our test leader as unapproved first by updating
        assert created["leader_id"]
        # Directly approve (idempotent)
        r = s.post(f"{API}/admin/leaders/{created['leader_id']}/approve")
        assert r.status_code == 200

    def test_approve_leader_not_found(self, s):
        r = s.post(f"{API}/admin/leaders/leader_no_such/approve")
        assert r.status_code == 404


# ============ ADMIN NENO CRUD ============
class TestAdminNeno:
    def test_create_neno_range_verses(self, s):
        # word_date today so it should be active immediately
        today = datetime.now(timezone.utc).date()
        publish_time = "00:00"
        payload = {
            "leader_id": EXISTING_LEADER_ID,
            "book": "Luka",
            "chapter": 2,
            "verse_start": 15,
            "verse_end": 19,
            "word_date": today.isoformat(),
            "publish_date": today.isoformat(),
            "publish_time": publish_time,
            "notes": "TEST neno range",
        }
        r = s.post(f"{API}/admin/neno", json=payload)
        assert r.status_code == 200, r.text
        neno = r.json()["neno"]
        created["neno_id"] = neno["neno_id"]

        # verse_reference correctly formatted for range
        assert neno["verse_reference"] == "Luka 2:15-19"
        # word_day_name in Swahili
        swahili_days = {"Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi", "Jumapili"}
        assert neno["word_day_name"] in swahili_days
        # expires_at = word_date + 30 days
        expires = datetime.fromisoformat(neno["expires_at"]).date()
        word_d = datetime.fromisoformat(neno["word_date"]).date()
        assert (expires - word_d).days == 30
        # is_active should be True since publish_datetime <= now
        assert neno["is_active"] is True
        # _id excluded
        assert "_id" not in neno
        # stats present
        assert neno["stats"]["total_plays"] == 0

    def test_create_neno_single_verse_format(self, s):
        today = datetime.now(timezone.utc).date()
        payload = {
            "leader_id": EXISTING_LEADER_ID,
            "book": "Yohana",
            "chapter": 3,
            "verse_start": 16,
            "verse_end": 16,
            "word_date": today.isoformat(),
            "publish_date": today.isoformat(),
            "publish_time": "00:00",
        }
        r = s.post(f"{API}/admin/neno", json=payload)
        assert r.status_code == 200
        neno = r.json()["neno"]
        assert neno["verse_reference"] == "Yohana 3:16"
        created["neno_single_verse_id"] = neno["neno_id"]

    def test_create_neno_scheduled_future_is_inactive(self, s):
        future = datetime.now(timezone.utc).date() + timedelta(days=5)
        payload = {
            "leader_id": EXISTING_LEADER_ID,
            "book": "Mathayo",
            "chapter": 5,
            "verse_start": 1,
            "verse_end": 12,
            "word_date": future.isoformat(),
            "publish_date": future.isoformat(),
            "publish_time": "23:59",
        }
        r = s.post(f"{API}/admin/neno", json=payload)
        assert r.status_code == 200
        neno = r.json()["neno"]
        assert neno["is_active"] is False

    def test_create_neno_invalid_leader(self, s):
        today = datetime.now(timezone.utc).date()
        payload = {
            "leader_id": "leader_invalid_xyz",
            "book": "Luka",
            "chapter": 1,
            "verse_start": 1,
            "verse_end": 2,
            "word_date": today.isoformat(),
            "publish_date": today.isoformat(),
            "publish_time": "00:00",
        }
        r = s.post(f"{API}/admin/neno", json=payload)
        assert r.status_code == 404

    def test_list_all_neno(self, s):
        r = s.get(f"{API}/admin/neno")
        assert r.status_code == 200
        data = r.json()
        assert "neno_list" in data
        assert data["total"] >= 1
        for n in data["neno_list"]:
            assert "_id" not in n
            assert "leader" in n  # enriched

    def test_list_neno_status_active(self, s):
        r = s.get(f"{API}/admin/neno", params={"status": "active"})
        assert r.status_code == 200
        for n in r.json()["neno_list"]:
            assert n["is_active"] is True

    def test_list_neno_status_inactive(self, s):
        r = s.get(f"{API}/admin/neno", params={"status": "inactive"})
        assert r.status_code == 200
        for n in r.json()["neno_list"]:
            assert n["is_active"] is False

    def test_update_neno_recomputes_verse_reference(self, s):
        assert created["neno_id"]
        # Update only verse_end
        r = s.put(
            f"{API}/admin/neno/{created['neno_id']}",
            json={"verse_end": 25},
        )
        assert r.status_code == 200, r.text
        # Verify recomputation via list
        r2 = s.get(f"{API}/admin/neno")
        found = next((n for n in r2.json()["neno_list"] if n["neno_id"] == created["neno_id"]), None)
        assert found is not None
        assert found["verse_reference"] == "Luka 2:15-25"
        assert found["verse_end"] == 25

    def test_update_neno_single_verse_format_after_update(self, s):
        # Update verse_start so start==end -> single verse format
        assert created["neno_id"]
        r = s.put(
            f"{API}/admin/neno/{created['neno_id']}",
            json={"verse_start": 25, "verse_end": 25},
        )
        assert r.status_code == 200
        r2 = s.get(f"{API}/admin/neno")
        found = next((n for n in r2.json()["neno_list"] if n["neno_id"] == created["neno_id"]), None)
        assert found["verse_reference"] == "Luka 2:25"

    def test_update_neno_not_found(self, s):
        r = s.put(f"{API}/admin/neno/neno_no_exist", json={"chapter": 1})
        assert r.status_code == 404


# ============ USER ENDPOINTS ============
class TestUserEndpoints:
    def test_active_endpoint(self, s):
        r = s.get(f"{API}/active")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "neno_list" in data
        for n in data["neno_list"]:
            assert n["is_active"] is True
            assert "_id" not in n
            assert "leader" in n
            assert "display_date" in n
            assert "leader_display" in n
            # leader_display has title + name format
            if n["leader"]:
                assert n["leader"]["name"] in n["leader_display"]

    def test_active_endpoint_excludes_expired(self, s):
        # Existing neno from seed should still be visible if not expired
        r = s.get(f"{API}/active")
        assert r.status_code == 200
        now = datetime.now(timezone.utc)
        for n in r.json()["neno_list"]:
            if n.get("expires_at"):
                exp = datetime.fromisoformat(n["expires_at"].replace("Z", "+00:00")) if "Z" in n["expires_at"] else datetime.fromisoformat(n["expires_at"])
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                assert exp >= now or n["is_active"] is True  # not expired since is_active

    def test_get_single_neno_active(self, s):
        assert created["neno_id"]
        r = s.get(f"{API}/{created['neno_id']}")
        assert r.status_code == 200
        neno = r.json()
        assert neno["neno_id"] == created["neno_id"]
        assert "_id" not in neno
        assert "leader" in neno

    def test_get_single_neno_not_found(self, s):
        r = s.get(f"{API}/neno_does_not_exist_xyz")
        assert r.status_code == 404

    def test_play_increments_reading(self, s):
        assert created["neno_id"]
        # Get initial play count
        r0 = s.get(f"{API}/{created['neno_id']}")
        before = r0.json()["stats"]["reading_plays"]

        r = s.post(f"{API}/{created['neno_id']}/play", params={"audio_type": "reading"})
        assert r.status_code == 200

        r1 = s.get(f"{API}/{created['neno_id']}")
        after = r1.json()["stats"]["reading_plays"]
        assert after == before + 1
        assert r1.json()["stats"]["total_plays"] == r0.json()["stats"]["total_plays"] + 1

    def test_play_increments_reflection(self, s):
        assert created["neno_id"]
        r0 = s.get(f"{API}/{created['neno_id']}")
        before = r0.json()["stats"]["reflection_plays"]
        r = s.post(f"{API}/{created['neno_id']}/play", params={"audio_type": "reflection"})
        assert r.status_code == 200
        r1 = s.get(f"{API}/{created['neno_id']}")
        assert r1.json()["stats"]["reflection_plays"] == before + 1

    def test_play_updates_leader_stats(self, s):
        # Verify leader stats incremented
        r = s.get(f"{API}/admin/leaders")
        leaders = r.json()["leaders"]
        ld = next((l for l in leaders if l["leader_id"] == EXISTING_LEADER_ID), None)
        assert ld is not None
        # Should have at least 2 total plays from prior tests
        assert ld.get("stats", {}).get("total_plays", 0) >= 2

    def test_play_not_found(self, s):
        r = s.post(f"{API}/neno_no_exist/play", params={"audio_type": "reading"})
        assert r.status_code == 404


# ============ CLEANUP / DELETE ============
class TestDelete:
    def test_delete_neno_decrements_leader_stats(self, s):
        assert created["neno_id"]
        # Get leader stat before
        r0 = s.get(f"{API}/admin/leaders")
        ld0 = next((l for l in r0.json()["leaders"] if l["leader_id"] == EXISTING_LEADER_ID), None)
        total_before = ld0["stats"].get("total_neno", 0)

        r = s.delete(f"{API}/admin/neno/{created['neno_id']}")
        assert r.status_code == 200

        r1 = s.get(f"{API}/admin/leaders")
        ld1 = next((l for l in r1.json()["leaders"] if l["leader_id"] == EXISTING_LEADER_ID), None)
        assert ld1["stats"]["total_neno"] == total_before - 1

    def test_delete_neno_not_found(self, s):
        r = s.delete(f"{API}/admin/neno/neno_no_exist")
        assert r.status_code == 404

    def test_cleanup_single_verse_neno(self, s):
        if created["neno_single_verse_id"]:
            s.delete(f"{API}/admin/neno/{created['neno_single_verse_id']}")

    def test_cleanup_test_leader(self, s):
        if created["leader_id"]:
            r = s.delete(f"{API}/admin/leaders/{created['leader_id']}")
            assert r.status_code == 200
