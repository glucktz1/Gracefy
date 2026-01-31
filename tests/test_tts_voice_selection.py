"""
Test TTS Voice Selection & Preview Feature
Tests for GET /api/bible/tts/voices, POST /api/bible/tts/preview, and voice settings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Expected voice IDs
MALE_VOICE_IDS = ["sw-KE-Rafiki-Male", "sw-TZ-Daudi-Male", "en-US-Journey-Male"]
FEMALE_VOICE_IDS = ["sw-KE-Zuri-Female", "sw-TZ-Amani-Female", "en-US-Aria-Female"]
ALL_VOICE_IDS = MALE_VOICE_IDS + FEMALE_VOICE_IDS


class TestTTSVoices:
    """Test GET /api/bible/tts/voices endpoint"""
    
    def test_get_voices_returns_all_voices(self):
        """Should return array of 6 voice objects"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        assert response.status_code == 200
        
        data = response.json()
        assert "voices" in data
        assert len(data["voices"]) == 6
    
    def test_get_voices_returns_male_voices(self):
        """Should return array of 3 male voices"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        assert response.status_code == 200
        
        data = response.json()
        assert "male_voices" in data
        assert len(data["male_voices"]) == 3
        
        for voice in data["male_voices"]:
            assert voice["gender"] == "male"
            assert voice["id"] in MALE_VOICE_IDS
    
    def test_get_voices_returns_female_voices(self):
        """Should return array of 3 female voices"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        assert response.status_code == 200
        
        data = response.json()
        assert "female_voices" in data
        assert len(data["female_voices"]) == 3
        
        for voice in data["female_voices"]:
            assert voice["gender"] == "female"
            assert voice["id"] in FEMALE_VOICE_IDS
    
    def test_voice_structure_has_required_fields(self):
        """Each voice should have id, name, description, language, gender, sample_text"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        assert response.status_code == 200
        
        data = response.json()
        required_fields = ["id", "name", "description", "language", "gender", "sample_text"]
        
        for voice in data["voices"]:
            for field in required_fields:
                assert field in voice, f"Missing field '{field}' in voice {voice.get('id', 'unknown')}"
                assert voice[field] is not None, f"Field '{field}' is None in voice {voice.get('id', 'unknown')}"
    
    def test_voice_languages_are_valid(self):
        """Voice languages should be sw-KE, sw-TZ, or en-US"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        assert response.status_code == 200
        
        data = response.json()
        valid_languages = ["sw-KE", "sw-TZ", "en-US"]
        
        for voice in data["voices"]:
            assert voice["language"] in valid_languages


class TestTTSPreview:
    """Test POST /api/bible/tts/preview endpoint"""
    
    @pytest.mark.parametrize("voice_id", ALL_VOICE_IDS)
    def test_preview_all_voices(self, voice_id):
        """Should return preview response for all valid voice IDs"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={"voice_id": voice_id}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["voice_id"] == voice_id
        assert "voice_name" in data
        assert "text" in data
        assert "generated" in data
        assert isinstance(data["generated"], bool)
    
    def test_preview_female_voice_returns_correct_name(self):
        """Preview with sw-KE-Zuri-Female should return voice_name Zuri"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={"voice_id": "sw-KE-Zuri-Female"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["voice_name"] == "Zuri"
        assert data["voice_id"] == "sw-KE-Zuri-Female"
    
    def test_preview_male_voice_returns_correct_name(self):
        """Preview with sw-KE-Rafiki-Male should return voice_name Rafiki"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={"voice_id": "sw-KE-Rafiki-Male"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["voice_name"] == "Rafiki"
        assert data["voice_id"] == "sw-KE-Rafiki-Male"
    
    def test_preview_returns_sample_text(self):
        """Preview should return sample text from voice config"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={"voice_id": "sw-KE-Zuri-Female"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "text" in data
        assert len(data["text"]) > 0
    
    def test_preview_invalid_voice_returns_404(self):
        """Preview with invalid voice ID should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={"voice_id": "invalid-voice-id"}
        )
        assert response.status_code == 404
    
    def test_preview_tts_not_configured_message(self):
        """When TTS not configured, should return informative message"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={"voice_id": "sw-KE-Zuri-Female"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # TTS may not be configured in test environment
        if data["generated"] is False:
            assert data["audio_base64"] is None
            assert "message" in data


class TestVoiceSettings:
    """Test voice preferences in admin settings"""
    
    def test_save_voice_settings(self):
        """Should save male and female voice preferences"""
        response = requests.put(
            f"{BASE_URL}/api/admin/bible/settings",
            json={
                "default_voice_male": "sw-KE-Rafiki-Male",
                "default_voice_female": "sw-KE-Zuri-Female"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data or data.get("message") == "Settings updated"
    
    def test_get_saved_voice_settings(self):
        """Should retrieve saved voice preferences"""
        # First save settings
        requests.put(
            f"{BASE_URL}/api/admin/bible/settings",
            json={
                "default_voice_male": "sw-TZ-Daudi-Male",
                "default_voice_female": "sw-TZ-Amani-Female"
            }
        )
        
        # Then get settings
        response = requests.get(f"{BASE_URL}/api/admin/bible/settings")
        assert response.status_code == 200
        
        data = response.json()
        assert data["default_voice_male"] == "sw-TZ-Daudi-Male"
        assert data["default_voice_female"] == "sw-TZ-Amani-Female"
    
    def test_update_voice_settings_preserves_other_settings(self):
        """Updating voice settings should not erase other settings"""
        # Get current settings first
        initial_response = requests.get(f"{BASE_URL}/api/admin/bible/settings")
        initial_data = initial_response.json()
        
        # Update voice settings
        requests.put(
            f"{BASE_URL}/api/admin/bible/settings",
            json={
                "default_voice_male": "en-US-Journey-Male",
                "default_voice_female": "en-US-Aria-Female"
            }
        )
        
        # Verify other settings preserved
        response = requests.get(f"{BASE_URL}/api/admin/bible/settings")
        data = response.json()
        
        # Core settings should still exist
        assert "is_active" in data
        assert "free_user_minutes_before_prompt" in data
        # Voice settings should be updated
        assert data["default_voice_male"] == "en-US-Journey-Male"
        assert data["default_voice_female"] == "en-US-Aria-Female"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
