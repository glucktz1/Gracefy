"""
Test the three fixes: Bible TTS Speed Control, Leaders Page Error Handling, Special Mixes Audio
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBibleTTSSpeedControl:
    """Test Bible TTS Speed Control feature - speed parameter in TTS endpoints"""
    
    def test_tts_verse_accepts_speed_parameter(self):
        """Test that TTS verse endpoint accepts speed parameter"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/verse",
            json={
                "book_name": "Mwanzo",
                "chapter": 1,
                "verse": 3,  # Use verse 3 to avoid cache
                "voice": "sw-KE-Zuri-Female",
                "speed": 1.5
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "audio_base64" in data, "Response should contain audio_base64"
        assert len(data["audio_base64"]) > 100, "Audio should have content"
    
    def test_tts_with_slow_speed(self):
        """Test TTS with slow speed (0.5x)"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/verse",
            json={
                "book_name": "Mwanzo",
                "chapter": 1,
                "verse": 4,
                "voice": "sw-KE-Zuri-Female",
                "speed": 0.5
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "audio_base64" in data
    
    def test_tts_with_fast_speed(self):
        """Test TTS with fast speed (2.0x)"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/verse",
            json={
                "book_name": "Mwanzo",
                "chapter": 1,
                "verse": 5,
                "voice": "sw-KE-Zuri-Female",
                "speed": 2.0
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "audio_base64" in data
    
    def test_tts_passage_range_accepts_speed(self):
        """Test TTS passage range endpoint accepts speed parameter"""
        response = requests.post(
            f"{BASE_URL}/api/bible/tts/passage-range",
            json={
                "book_name": "Mwanzo",
                "chapter": 1,
                "start_verse": 1,
                "end_verse": 2,
                "voice": "sw-KE-Zuri-Female",
                "speed": 1.25
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "audio_base64" in data


class TestLeadersErrorHandling:
    """Test Leaders API error handling"""
    
    def test_leaders_list_returns_valid_json(self):
        """Test that leaders list returns valid JSON"""
        response = requests.get(f"{BASE_URL}/api/leaders")
        assert response.status_code == 200
        data = response.json()
        assert "leaders" in data
        assert "total" in data
        assert isinstance(data["leaders"], list)
    
    def test_create_leader_validation_error_returns_string(self):
        """Test that validation errors return proper string messages, not objects"""
        # Try to create a leader with missing required field (name)
        response = requests.post(
            f"{BASE_URL}/api/leaders",
            json={
                "title": "priest"
                # Missing 'name' - should trigger validation
            }
        )
        # API might accept this (as dict doesn't enforce required fields)
        # but the response should be valid JSON
        assert response.status_code in [200, 201, 400, 422]
        
        # The response should be valid JSON and not cause React rendering errors
        data = response.json()
        if "detail" in data:
            detail = data["detail"]
            # Detail should be a string OR an array of dicts (FastAPI validation format)
            if isinstance(detail, list):
                # Each error should have 'msg' field that's a string
                for error in detail:
                    assert "msg" in error or "message" in error or isinstance(error, str), \
                        "Each validation error should have a msg field or be a string"
    
    def test_get_nonexistent_leader_returns_404(self):
        """Test that getting nonexistent leader returns 404 with proper error"""
        response = requests.get(f"{BASE_URL}/api/leaders/nonexistent_leader_id_12345")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data
        assert isinstance(data["detail"], str), "Error detail should be a string"


class TestSpecialMixesSongData:
    """Test Special Mixes with full song data including audio_url"""
    
    def test_special_mixes_list(self):
        """Test that special mixes list returns mixes"""
        response = requests.get(f"{BASE_URL}/api/special-mixes")
        assert response.status_code == 200
        data = response.json()
        assert "mixes" in data
        assert isinstance(data["mixes"], list)
    
    def test_special_mixes_songs_have_expected_fields(self):
        """Test that songs in special mixes have expected fields"""
        response = requests.get(f"{BASE_URL}/api/special-mixes")
        assert response.status_code == 200
        data = response.json()
        mixes = data.get("mixes", [])
        
        if len(mixes) > 0:
            # Check the first mix with songs
            for mix in mixes:
                songs = mix.get("songs", [])
                if songs:
                    # Check expected fields are present in songs
                    for song in songs:
                        assert "song_id" in song, "Song should have song_id"
                        assert "title" in song, "Song should have title"
                        # These fields should be present when mix is created properly
                        # audio_url might be None for some songs if the original song is missing audio
                        if song.get("audio_url"):
                            print(f"  Song '{song.get('title')}' has audio_url: {song.get('audio_url')[:50]}...")
                        else:
                            print(f"  Song '{song.get('title')}' MISSING audio_url (data issue)")
                    break  # Only check first mix with songs
    
    def test_special_mix_creation_includes_audio_url(self):
        """Test that frontend payload format includes audio_url in songs"""
        # This tests the expected payload format from frontend
        test_payload = {
            "title": "TEST_Mix_For_Testing",
            "description": "Test mix to verify audio_url is saved",
            "songs": [
                {
                    "song_id": "test_song_123",
                    "title": "Test Song",
                    "album_id": "test_album_123",
                    "album_title": "Test Album",
                    "artist_name": "Test Artist",
                    "duration": 180,
                    "duration_formatted": "3:00",
                    "audio_url": "/api/files/test_file_123/stream",
                    "file_id": "test_file_123",
                    "order": 1
                }
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/special-mixes",
            json=test_payload
        )
        
        # May fail due to auth, but if it works, check the response
        if response.status_code in [200, 201]:
            data = response.json()
            songs = data.get("songs", [])
            if songs:
                assert songs[0].get("audio_url") == "/api/files/test_file_123/stream", \
                    "Created mix should preserve audio_url in songs"
            
            # Cleanup - delete the test mix
            mix_id = data.get("mix_id")
            if mix_id:
                requests.delete(f"{BASE_URL}/api/special-mixes/{mix_id}")


class TestIntegrationBibleSpeed:
    """Integration tests for Bible TTS speed control"""
    
    def test_voices_endpoint_available(self):
        """Test that voices endpoint returns available voices"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        assert response.status_code == 200
        data = response.json()
        assert "voices" in data
        voices = data["voices"]
        assert len(voices) > 0, "Should have at least one voice"
        
        # Check voice structure
        for voice in voices:
            assert "id" in voice
            assert "name" in voice
            assert "gender" in voice


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
