"""
Test suite for Bible TTS (Text-to-Speech) Full System using OpenAI TTS
Tests all TTS-related endpoints for the Bible reading feature.
"""
import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTTSVoicesEndpoint:
    """Tests for GET /api/bible/tts/voices - List available TTS voices"""
    
    def test_get_voices_returns_200(self):
        """Verify endpoint returns 200 status"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/bible/tts/voices returns 200")
    
    def test_get_voices_returns_6_total(self):
        """Verify 6 voices are returned"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        data = response.json()
        assert len(data.get("voices", [])) == 6, f"Expected 6 voices, got {len(data.get('voices', []))}"
        print(f"✓ Returns {len(data.get('voices', []))} voices total")
    
    def test_get_voices_returns_3_male_voices(self):
        """Verify 3 male voices are returned"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        data = response.json()
        male_voices = data.get("male_voices", [])
        assert len(male_voices) == 3, f"Expected 3 male voices, got {len(male_voices)}"
        
        # Verify voice IDs
        male_ids = [v["id"] for v in male_voices]
        expected_ids = ["sw-KE-Rafiki-Male", "sw-TZ-Daudi-Male", "en-US-Journey-Male"]
        for vid in expected_ids:
            assert vid in male_ids, f"Expected {vid} in male voices"
        print(f"✓ Returns 3 male voices: {male_ids}")
    
    def test_get_voices_returns_3_female_voices(self):
        """Verify 3 female voices are returned"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        data = response.json()
        female_voices = data.get("female_voices", [])
        assert len(female_voices) == 3, f"Expected 3 female voices, got {len(female_voices)}"
        
        # Verify voice IDs
        female_ids = [v["id"] for v in female_voices]
        expected_ids = ["sw-KE-Zuri-Female", "sw-TZ-Amani-Female", "en-US-Aria-Female"]
        for vid in expected_ids:
            assert vid in female_ids, f"Expected {vid} in female voices"
        print(f"✓ Returns 3 female voices: {female_ids}")
    
    def test_get_voices_has_required_fields(self):
        """Verify each voice has required fields"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        data = response.json()
        
        required_fields = ["id", "name", "description", "language", "gender", "openai_voice"]
        for voice in data.get("voices", []):
            for field in required_fields:
                assert field in voice, f"Voice {voice.get('id', 'unknown')} missing field: {field}"
        print(f"✓ All voices have required fields: {required_fields}")
    
    def test_tts_available_flag(self):
        """Verify tts_available flag is True when API key is set"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        data = response.json()
        assert data.get("tts_available") == True, "TTS should be available when EMERGENT_LLM_KEY is set"
        print("✓ tts_available flag is True")


class TestTTSPreviewEndpoint:
    """Tests for POST /api/bible/tts/preview - Preview voice audio"""
    
    def test_preview_female_voice_zuri(self):
        """Test preview for sw-KE-Zuri-Female voice"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={"voice_id": "sw-KE-Zuri-Female"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("generated") == True, "Expected generated=True"
        assert data.get("voice_name") == "Zuri", f"Expected voice_name=Zuri, got {data.get('voice_name')}"
        assert data.get("audio_base64"), "Expected non-empty audio_base64"
        assert len(data.get("audio_base64", "")) > 100, "Audio base64 should be substantial"
        print(f"✓ Preview sw-KE-Zuri-Female: generated={data.get('generated')}, audio_size={len(data.get('audio_base64', ''))}")
    
    def test_preview_male_voice_rafiki(self):
        """Test preview for sw-KE-Rafiki-Male voice"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={"voice_id": "sw-KE-Rafiki-Male"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("generated") == True, "Expected generated=True"
        assert data.get("voice_name") == "Rafiki", f"Expected voice_name=Rafiki, got {data.get('voice_name')}"
        assert data.get("audio_base64"), "Expected non-empty audio_base64"
        print(f"✓ Preview sw-KE-Rafiki-Male: generated={data.get('generated')}, voice_name={data.get('voice_name')}")
    
    def test_preview_invalid_voice_returns_404(self):
        """Test preview with invalid voice ID returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={"voice_id": "invalid-voice-id"}
        )
        assert response.status_code == 404, f"Expected 404 for invalid voice, got {response.status_code}"
        print("✓ Invalid voice ID returns 404")
    
    def test_preview_missing_voice_id_returns_400(self):
        """Test preview without voice_id returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={}
        )
        assert response.status_code == 400, f"Expected 400 for missing voice_id, got {response.status_code}"
        print("✓ Missing voice_id returns 400")
    
    def test_preview_audio_is_valid_base64(self):
        """Verify audio_base64 is valid base64"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={"voice_id": "sw-TZ-Amani-Female"}
        )
        data = response.json()
        audio_b64 = data.get("audio_base64", "")
        
        # Try to decode - should not raise
        try:
            decoded = base64.b64decode(audio_b64)
            assert len(decoded) > 0, "Decoded audio should not be empty"
            print(f"✓ Audio is valid base64, decoded size: {len(decoded)} bytes")
        except Exception as e:
            pytest.fail(f"Failed to decode audio_base64: {e}")


class TestTTSVerseEndpoint:
    """Tests for POST /api/bible/tts/verse - Generate audio for single verse"""
    
    def test_generate_verse_audio_mwanzo_1_1(self):
        """Test generating audio for Mwanzo 1:1"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/verse",
            json={
                "book_name": "Mwanzo",
                "chapter": 1,
                "verse": 1,
                "voice": "sw-KE-Rafiki-Male"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("audio_base64"), "Expected non-empty audio_base64"
        assert "verse" in data, "Expected verse object in response"
        assert data["verse"].get("text"), "Expected verse text in response"
        print(f"✓ Verse TTS for Mwanzo 1:1: audio_size={len(data.get('audio_base64', ''))}, text={data['verse'].get('text', '')[:50]}...")
    
    def test_generate_verse_audio_different_voice(self):
        """Test generating audio with different voice"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/verse",
            json={
                "book_name": "Mwanzo",
                "chapter": 1,
                "verse": 2,
                "voice": "sw-TZ-Amani-Female"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("audio_base64"), "Expected non-empty audio_base64"
        print(f"✓ Verse TTS with sw-TZ-Amani-Female voice works")
    
    def test_verse_not_found_returns_404(self):
        """Test requesting non-existent verse returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/verse",
            json={
                "book_name": "Mwanzo",
                "chapter": 1,
                "verse": 9999  # Non-existent verse
            }
        )
        assert response.status_code == 404, f"Expected 404 for non-existent verse, got {response.status_code}"
        print("✓ Non-existent verse returns 404")
    
    def test_missing_required_fields_returns_400(self):
        """Test missing required fields returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/verse",
            json={"book_name": "Mwanzo"}  # Missing chapter and verse
        )
        assert response.status_code == 400, f"Expected 400 for missing fields, got {response.status_code}"
        print("✓ Missing required fields returns 400")


class TestTTSPassageEndpoint:
    """Tests for POST /api/bible/tts/passage - Generate audio for multiple verses"""
    
    def test_generate_passage_audio(self):
        """Test generating audio for passage Mwanzo 1:1-3"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/passage",
            json={
                "book_name": "Mwanzo",
                "chapter": 1,
                "start_verse": 1,
                "end_verse": 3,
                "voice": "sw-TZ-Amani-Female"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("audio_base64"), "Expected non-empty audio_base64"
        assert "verses" in data, "Expected verses array in response"
        assert len(data.get("verses", [])) == 3, f"Expected 3 verses, got {len(data.get('verses', []))}"
        print(f"✓ Passage TTS for Mwanzo 1:1-3: audio_size={len(data.get('audio_base64', ''))}, verses_count={len(data.get('verses', []))}")
    
    def test_passage_with_male_voice(self):
        """Test passage with male voice"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/passage",
            json={
                "book_name": "Mwanzo",
                "chapter": 1,
                "start_verse": 1,
                "end_verse": 2,
                "voice": "sw-KE-Rafiki-Male"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("audio_base64"), "Expected non-empty audio_base64"
        print("✓ Passage TTS with male voice works")
    
    def test_passage_not_found_returns_404(self):
        """Test requesting non-existent passage returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/passage",
            json={
                "book_name": "NonExistentBook",
                "chapter": 1,
                "start_verse": 1,
                "end_verse": 3
            }
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent passage returns 404")


class TestAdminBibleSettings:
    """Tests for Bible settings endpoints"""
    
    def test_save_voice_settings(self):
        """Test saving default voice settings"""
        response = requests.put(
            f"{BASE_URL}/api/admin/bible/settings",
            json={
                "default_voice_male": "sw-KE-Rafiki-Male",
                "default_voice_female": "sw-KE-Zuri-Female"
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("message") == "Settings updated", f"Expected success message, got {data}"
        print("✓ PUT /api/admin/bible/settings saves voice preferences")
    
    def test_get_saved_settings(self):
        """Test retrieving saved settings"""
        # First save settings
        requests.put(
            f"{BASE_URL}/api/admin/bible/settings",
            json={
                "default_voice_male": "sw-TZ-Daudi-Male",
                "default_voice_female": "sw-TZ-Amani-Female"
            }
        )
        
        # Then retrieve
        response = requests.get(f"{BASE_URL}/api/admin/bible/settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert data.get("default_voice_male") == "sw-TZ-Daudi-Male", f"Expected sw-TZ-Daudi-Male, got {data.get('default_voice_male')}"
        assert data.get("default_voice_female") == "sw-TZ-Amani-Female", f"Expected sw-TZ-Amani-Female, got {data.get('default_voice_female')}"
        print(f"✓ GET /api/admin/bible/settings returns saved preferences: male={data.get('default_voice_male')}, female={data.get('default_voice_female')}")


class TestAllVoicesPreview:
    """Test preview for all 6 voices"""
    
    @pytest.mark.parametrize("voice_id,expected_name", [
        ("sw-KE-Zuri-Female", "Zuri"),
        ("sw-TZ-Amani-Female", "Amani"),
        ("en-US-Aria-Female", "Aria"),
        ("sw-KE-Rafiki-Male", "Rafiki"),
        ("sw-TZ-Daudi-Male", "Daudi"),
        ("en-US-Journey-Male", "Journey"),
    ])
    def test_preview_all_voices(self, voice_id, expected_name):
        """Test preview for each voice"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/preview",
            json={"voice_id": voice_id}
        )
        assert response.status_code == 200, f"Expected 200 for {voice_id}, got {response.status_code}"
        data = response.json()
        
        assert data.get("generated") == True, f"Expected generated=True for {voice_id}"
        assert data.get("voice_name") == expected_name, f"Expected {expected_name}, got {data.get('voice_name')}"
        assert data.get("audio_base64"), f"Expected audio for {voice_id}"
        print(f"✓ Voice {voice_id} ({expected_name}): generated={data.get('generated')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
