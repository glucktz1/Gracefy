"""Backend tests for audio ads and Bible TTS endpoints (iteration_48)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://neno-la-leo.preview.emergentagent.com").rstrip("/")


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ============ Advertising endpoints ============
class TestAdvertising:
    def test_next_ad_returns_ads_disabled_by_default(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/advertising/next-ad",
            params={"platform": "web", "songs_played": 1, "last_ad_time": ""},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Must indicate not to play ad when disabled
        assert data.get("should_play_ad") is False
        # Optional reason/flag
        assert ("reason" in data) or ("ads_disabled" in data) or ("settings" in data)

    def test_next_ad_different_platforms(self, api_client):
        for platform in ["web", "mobile"]:
            r = api_client.get(
                f"{BASE_URL}/api/advertising/next-ad",
                params={"platform": platform, "songs_played": 2, "last_ad_time": ""},
                timeout=15,
            )
            assert r.status_code == 200, f"{platform} -> {r.text}"
            data = r.json()
            assert "should_play_ad" in data

    def test_advertising_settings(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/advertising/settings", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # Settings may be wrapped under 'settings' key or returned directly
        settings = data.get("settings", data)
        assert "enabled" in settings
        # Per problem statement ads are disabled by default
        assert settings["enabled"] is False


# ============ Bible TTS voices ============
class TestBibleTTSVoices:
    def test_tts_voices_returns_six(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/bible/tts/voices", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        voices = data.get("voices", data if isinstance(data, list) else [])
        assert isinstance(voices, list)
        assert len(voices) == 6, f"Expected 6 voices, got {len(voices)}"
        # Validate availability flag
        if isinstance(data, dict) and "tts_available" in data:
            assert data["tts_available"] is True
        # Each voice should have identifying fields
        for v in voices:
            assert isinstance(v, dict)
            assert ("voice_id" in v) or ("id" in v) or ("name" in v)
