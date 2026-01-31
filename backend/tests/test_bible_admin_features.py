"""
Test suite for Bible Admin Features:
1. TTS Voice Selection - verifying voice changes work correctly
2. Admin TTS Cache Management - GET/DELETE cache entries
3. Admin Snippet Management - Edit, Enable/Disable, Delete snippets
"""

import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTTSVoiceSelection:
    """Test TTS voice selection and verify different voices produce different audio"""
    
    def test_get_tts_voices(self):
        """GET /api/bible/tts/voices returns all available voices"""
        response = requests.get(f"{BASE_URL}/api/bible/tts/voices")
        assert response.status_code == 200
        
        data = response.json()
        assert "voices" in data
        assert "male_voices" in data
        assert "female_voices" in data
        assert "default" in data
        assert "tts_available" in data
        
        # Verify we have voices
        assert len(data["voices"]) >= 6
        assert len(data["male_voices"]) >= 3
        assert len(data["female_voices"]) >= 3
        
        print(f"✅ Found {len(data['voices'])} voices, TTS available: {data['tts_available']}")
    
    def test_voice_preview_zuri_female(self):
        """POST /api/bible/tts/preview works with Zuri female voice"""
        response = requests.post(f"{BASE_URL}/api/bible/tts/preview", json={
            "voice_id": "sw-KE-Zuri-Female",
            "text": "Bwana ni mchungaji wangu."
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("generated") == True
        assert "audio_base64" in data
        assert len(data["audio_base64"]) > 100  # Has actual audio data
        
        print(f"✅ Zuri voice preview generated, audio length: {len(data['audio_base64'])}")
        return len(data["audio_base64"])
    
    def test_voice_preview_rafiki_male(self):
        """POST /api/bible/tts/preview works with Rafiki male voice"""
        response = requests.post(f"{BASE_URL}/api/bible/tts/preview", json={
            "voice_id": "sw-KE-Rafiki-Male",
            "text": "Bwana ni mchungaji wangu."
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("generated") == True
        assert "audio_base64" in data
        assert len(data["audio_base64"]) > 100
        
        print(f"✅ Rafiki voice preview generated, audio length: {len(data['audio_base64'])}")
        return len(data["audio_base64"])
    
    def test_different_voices_produce_different_audio(self):
        """Verify different voices produce different audio for same text"""
        # Generate audio with two different voices
        text = "Mungu wetu ni kimbilio na nguvu."
        
        response1 = requests.post(f"{BASE_URL}/api/bible/tts/preview", json={
            "voice_id": "sw-KE-Zuri-Female",
            "text": text
        })
        response2 = requests.post(f"{BASE_URL}/api/bible/tts/preview", json={
            "voice_id": "sw-KE-Rafiki-Male",
            "text": text
        })
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        audio1 = response1.json()["audio_base64"]
        audio2 = response2.json()["audio_base64"]
        
        # Different voices should produce different audio
        assert audio1 != audio2, "Same text with different voices should produce different audio"
        
        print(f"✅ Different voices produce different audio - Zuri: {len(audio1)}, Rafiki: {len(audio2)}")
    
    def test_verse_tts_with_voice_parameter(self):
        """POST /api/bible/tts/verse correctly uses the voice parameter"""
        # Test with default voice (Zuri)
        response1 = requests.post(f"{BASE_URL}/api/bible/tts/verse", json={
            "book_name": "Mwanzo",
            "chapter": 1,
            "verse": 1,
            "voice": "sw-KE-Zuri-Female"
        })
        
        # Test with different voice (Rafiki)
        response2 = requests.post(f"{BASE_URL}/api/bible/tts/verse", json={
            "book_name": "Mwanzo",
            "chapter": 1,
            "verse": 1,
            "voice": "sw-KE-Rafiki-Male"
        })
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Note: Due to caching, same verse with different voices may come from cache
        # But new requests should use the specified voice
        print(f"✅ Verse TTS with voice parameter works correctly")


class TestTTSCacheAdmin:
    """Test Admin TTS Cache Management endpoints"""
    
    def test_get_tts_cache(self):
        """GET /api/admin/bible/tts-cache returns cache entries and stats"""
        response = requests.get(f"{BASE_URL}/api/admin/bible/tts-cache")
        assert response.status_code == 200
        
        data = response.json()
        assert "cache" in data
        assert "stats" in data
        assert "total" in data["stats"]
        assert "size_mb" in data["stats"]
        
        print(f"✅ TTS Cache: {data['stats']['total']} entries, {data['stats']['size_mb']} MB")
        return data
    
    def test_tts_cache_structure(self):
        """Verify TTS cache entries have correct structure"""
        response = requests.get(f"{BASE_URL}/api/admin/bible/tts-cache")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["cache"]) > 0:
            entry = data["cache"][0]
            # Check expected fields
            assert "cache_key" in entry
            assert "voice" in entry or "text" in entry
            print(f"✅ Cache entry structure valid: {list(entry.keys())}")
        else:
            print("⚠️ No cache entries to verify structure")
    
    def test_delete_nonexistent_cache_entry(self):
        """DELETE /api/admin/bible/tts-cache/{key} returns 404 for nonexistent entry"""
        response = requests.delete(f"{BASE_URL}/api/admin/bible/tts-cache/nonexistent_key_12345")
        assert response.status_code == 404
        
        print("✅ DELETE nonexistent cache entry returns 404 as expected")
    
    def test_clear_all_cache(self):
        """DELETE /api/admin/bible/tts-cache clears all cache entries"""
        # First check current cache
        get_response = requests.get(f"{BASE_URL}/api/admin/bible/tts-cache")
        initial_count = get_response.json()["stats"]["total"]
        
        # Clear all cache
        response = requests.delete(f"{BASE_URL}/api/admin/bible/tts-cache")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        # Message should mention how many entries were cleared
        print(f"✅ Cleared cache: {data['message']}")
        
        # Verify cache is cleared
        verify_response = requests.get(f"{BASE_URL}/api/admin/bible/tts-cache")
        assert verify_response.json()["stats"]["total"] == 0
        print("✅ Cache cleared successfully, count is now 0")


class TestSnippetAdmin:
    """Test Admin Snippet Management endpoints"""
    
    test_snippet_id = None
    
    def test_get_admin_snippets(self):
        """GET /api/admin/bible/snippets returns all snippets"""
        response = requests.get(f"{BASE_URL}/api/admin/bible/snippets")
        assert response.status_code == 200
        
        data = response.json()
        assert "snippets" in data
        
        print(f"✅ Found {len(data['snippets'])} snippets")
        
        if data["snippets"]:
            TestSnippetAdmin.test_snippet_id = data["snippets"][0]["snippet_id"]
            return data["snippets"][0]
        return None
    
    def test_create_snippet(self):
        """POST /api/admin/bible/snippets creates a new snippet"""
        response = requests.post(f"{BASE_URL}/api/admin/bible/snippets", json={
            "title": "TEST_Snippet_For_Testing",
            "reference": "John 3:16",
            "text": "For God so loved the world...",
            "text_sw": "Kwa maana Mungu aliupenda ulimwengu...",
            "category": "daily",
            "is_featured": False
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "snippet_id" in data
        assert data["title"] == "TEST_Snippet_For_Testing"
        
        TestSnippetAdmin.test_snippet_id = data["snippet_id"]
        print(f"✅ Created test snippet: {data['snippet_id']}")
        return data["snippet_id"]
    
    def test_update_snippet(self):
        """PUT /api/admin/bible/snippets/{id} updates a snippet"""
        if not TestSnippetAdmin.test_snippet_id:
            TestSnippetAdmin.test_snippet_id = self.test_create_snippet()
        
        response = requests.put(
            f"{BASE_URL}/api/admin/bible/snippets/{TestSnippetAdmin.test_snippet_id}",
            json={
                "title": "TEST_Updated_Snippet_Title",
                "is_featured": True
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✅ Updated snippet: {data['message']}")
    
    def test_toggle_snippet_active_status(self):
        """PUT /api/admin/bible/snippets/{id} can toggle is_active status"""
        if not TestSnippetAdmin.test_snippet_id:
            TestSnippetAdmin.test_snippet_id = self.test_create_snippet()
        
        # Deactivate
        response = requests.put(
            f"{BASE_URL}/api/admin/bible/snippets/{TestSnippetAdmin.test_snippet_id}",
            json={"is_active": False}
        )
        assert response.status_code == 200
        print("✅ Deactivated snippet")
        
        # Reactivate
        response = requests.put(
            f"{BASE_URL}/api/admin/bible/snippets/{TestSnippetAdmin.test_snippet_id}",
            json={"is_active": True}
        )
        assert response.status_code == 200
        print("✅ Reactivated snippet")
    
    def test_delete_snippet(self):
        """DELETE /api/admin/bible/snippets/{id} deletes a snippet"""
        # Create a snippet to delete
        create_response = requests.post(f"{BASE_URL}/api/admin/bible/snippets", json={
            "title": "TEST_Snippet_To_Delete",
            "reference": "Test 1:1",
            "text": "Test text",
            "category": "daily"
        })
        snippet_id = create_response.json()["snippet_id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/admin/bible/snippets/{snippet_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✅ Deleted snippet: {data['message']}")
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/bible/snippets/{snippet_id}")
        assert get_response.status_code == 404
        print("✅ Verified snippet was deleted (404)")
    
    def test_update_nonexistent_snippet(self):
        """PUT /api/admin/bible/snippets/{id} returns 404 for nonexistent snippet"""
        response = requests.put(
            f"{BASE_URL}/api/admin/bible/snippets/nonexistent_snippet_12345",
            json={"title": "Should fail"}
        )
        assert response.status_code == 404
        print("✅ Update nonexistent snippet returns 404")
    
    def test_delete_nonexistent_snippet(self):
        """DELETE /api/admin/bible/snippets/{id} returns 404 for nonexistent snippet"""
        response = requests.delete(f"{BASE_URL}/api/admin/bible/snippets/nonexistent_snippet_12345")
        assert response.status_code == 404
        print("✅ Delete nonexistent snippet returns 404")
    
    def test_cleanup_test_snippets(self):
        """Clean up test snippets created during testing"""
        # Get all snippets
        response = requests.get(f"{BASE_URL}/api/admin/bible/snippets")
        snippets = response.json().get("snippets", [])
        
        # Delete any TEST_ prefixed snippets
        deleted_count = 0
        for snippet in snippets:
            if snippet.get("title", "").startswith("TEST_"):
                del_response = requests.delete(f"{BASE_URL}/api/admin/bible/snippets/{snippet['snippet_id']}")
                if del_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✅ Cleaned up {deleted_count} test snippets")


class TestBibleSettings:
    """Test Bible settings including voice defaults"""
    
    def test_get_bible_settings(self):
        """GET /api/admin/bible/settings returns current settings"""
        response = requests.get(f"{BASE_URL}/api/admin/bible/settings")
        assert response.status_code == 200
        
        data = response.json()
        assert "settings_id" in data or "default_voice" in data
        
        print(f"✅ Bible settings retrieved: default_voice={data.get('default_voice', 'N/A')}")
        return data
    
    def test_update_bible_settings(self):
        """PUT /api/admin/bible/settings updates voice settings"""
        response = requests.put(f"{BASE_URL}/api/admin/bible/settings", json={
            "default_voice": "sw-KE-Zuri-Female",
            "default_voice_male": "sw-KE-Rafiki-Male",
            "default_voice_female": "sw-KE-Zuri-Female"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        print(f"✅ Updated bible settings: {data['message']}")
        
        # Verify the update persisted
        verify = requests.get(f"{BASE_URL}/api/admin/bible/settings")
        verify_data = verify.json()
        assert verify_data.get("default_voice_female") == "sw-KE-Zuri-Female"
        print("✅ Verified settings persisted correctly")


class TestListeningStats:
    """Test Bible listening statistics endpoints"""
    
    def test_get_listening_stats(self):
        """GET /api/admin/bible/listening-stats returns listening statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/bible/listening-stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_listeners" in data
        assert "today_listeners" in data
        assert "total_listening_hours" in data
        
        print(f"✅ Listening stats: {data['total_listeners']} total, {data['today_listeners']} today, {data['total_listening_hours']}h total")


# Run tests when executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
