"""
Backend API Tests for Three Bug Fixes:
1. Bible Section Bug - Bible stats endpoint field names
2. Special Mixes Bug - Creation with title and songs array
3. Leaders Page Bug - CRUD operations and file upload support
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBibleStats:
    """Test Bible stats endpoint - Bug Fix #1: Verify field names are correct"""
    
    def test_bible_stats_returns_required_fields(self):
        """Bible stats should return book_count, verse_count, AND has_data fields"""
        response = requests.get(f"{BASE_URL}/api/bible/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify all required fields exist
        assert 'book_count' in data, "Missing book_count field"
        assert 'verse_count' in data, "Missing verse_count field"
        assert 'has_data' in data, "Missing has_data field"
        
        # Also check backward-compatible fields
        assert 'books_count' in data, "Missing books_count field (backward compat)"
        assert 'verses_count' in data, "Missing verses_count field (backward compat)"
        
        # Verify values are consistent
        assert data['book_count'] == data['books_count'], "book_count and books_count should match"
        assert data['verse_count'] == data['verses_count'], "verse_count and verses_count should match"
        
        # Verify data types
        assert isinstance(data['book_count'], int), "book_count should be int"
        assert isinstance(data['verse_count'], int), "verse_count should be int"
        assert isinstance(data['has_data'], bool), "has_data should be bool"
        
        print(f"Bible stats: {data['book_count']} books, {data['verse_count']} verses, has_data={data['has_data']}")

    def test_bible_stats_with_language_param(self):
        """Bible stats should accept language parameter"""
        response = requests.get(f"{BASE_URL}/api/bible/stats?language=sw")
        assert response.status_code == 200
        
        data = response.json()
        assert 'book_count' in data
        assert 'verse_count' in data
        assert 'has_data' in data


class TestSpecialMixes:
    """Test Special Mixes CRUD - Bug Fix #2: Verify title and songs array handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Store created mix IDs for cleanup"""
        self.created_mix_ids = []
        yield
        # Cleanup created mixes
        for mix_id in self.created_mix_ids:
            try:
                requests.delete(f"{BASE_URL}/api/special-mixes/{mix_id}")
            except:
                pass
    
    def test_create_special_mix_with_title_and_songs(self):
        """Creating a mix should properly handle title and songs array"""
        payload = {
            "title": "TEST_Bug_Fix_Mix",
            "songs": [
                {"song_id": "test_song_1", "title": "Test Song 1"},
                {"song_id": "test_song_2", "title": "Test Song 2"}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/special-mixes", json=payload)
        assert response.status_code == 200 or response.status_code == 201, f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify title is returned
        assert 'title' in data, "Missing title in response"
        assert data['title'] == "TEST_Bug_Fix_Mix", f"Title mismatch: expected 'TEST_Bug_Fix_Mix', got '{data['title']}'"
        
        # Verify songs array is populated
        assert 'songs' in data, "Missing songs in response"
        assert isinstance(data['songs'], list), "songs should be a list"
        assert len(data['songs']) == 2, f"Expected 2 songs, got {len(data['songs'])}"
        
        # Verify songs_count
        assert 'songs_count' in data, "Missing songs_count in response"
        assert data['songs_count'] == 2, f"Expected songs_count=2, got {data['songs_count']}"
        
        # Store for cleanup
        if 'mix_id' in data:
            self.created_mix_ids.append(data['mix_id'])
        
        print(f"Created mix: {data['mix_id']} with {data['songs_count']} songs")
    
    def test_get_special_mixes_list(self):
        """Get special mixes list"""
        response = requests.get(f"{BASE_URL}/api/special-mixes")
        assert response.status_code == 200
        
        data = response.json()
        assert 'mixes' in data, "Response should have 'mixes' field"
        assert isinstance(data['mixes'], list), "mixes should be a list"
        
        print(f"Found {len(data['mixes'])} special mixes")


class TestLeaders:
    """Test Leaders CRUD - Bug Fix #3: Verify leaders API and file upload support"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Store created leader IDs for cleanup"""
        self.created_leader_ids = []
        yield
        # Cleanup created leaders
        for leader_id in self.created_leader_ids:
            try:
                requests.delete(f"{BASE_URL}/api/leaders/{leader_id}")
            except:
                pass
    
    def test_get_leaders_list(self):
        """Get leaders list"""
        response = requests.get(f"{BASE_URL}/api/leaders")
        assert response.status_code == 200
        
        data = response.json()
        assert 'leaders' in data, "Response should have 'leaders' field"
        assert isinstance(data['leaders'], list), "leaders should be a list"
        
        print(f"Found {len(data['leaders'])} leaders")
    
    def test_create_leader(self):
        """Create a new leader"""
        payload = {
            "name": "TEST_Bug_Fix_Leader",
            "title": "priest",
            "bio": "Test leader bio",
            "status": "pending"
        }
        
        response = requests.post(f"{BASE_URL}/api/leaders", json=payload)
        assert response.status_code == 200 or response.status_code == 201, f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify leader was created
        assert 'leader_id' in data, "Response should have leader_id"
        assert data['name'] == "TEST_Bug_Fix_Leader"
        
        # Store for cleanup
        self.created_leader_ids.append(data['leader_id'])
        
        print(f"Created leader: {data['leader_id']}")
    
    def test_update_leader(self):
        """Update a leader"""
        # First create a leader
        create_payload = {
            "name": "TEST_Update_Leader",
            "title": "pastor",
            "status": "pending"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/leaders", json=create_payload)
        assert create_response.status_code in [200, 201]
        
        leader_id = create_response.json()['leader_id']
        self.created_leader_ids.append(leader_id)
        
        # Now update
        update_payload = {
            "name": "TEST_Update_Leader_Modified",
            "title": "bishop",
            "bio": "Updated bio"
        }
        
        update_response = requests.put(f"{BASE_URL}/api/leaders/{leader_id}", json=update_payload)
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        data = update_response.json()
        # The API might return updated data or just success
        print(f"Updated leader: {leader_id}")
    
    def test_upload_endpoint_exists(self):
        """Verify upload endpoint exists for file uploads"""
        # We can't fully test file upload without a file, but we can verify endpoint exists
        # Send empty form data to check endpoint responds (will likely fail validation but endpoint exists)
        response = requests.post(f"{BASE_URL}/api/upload")
        # 400/422 means endpoint exists but validation failed (expected without file)
        # 404 would mean endpoint doesn't exist
        assert response.status_code != 404, "Upload endpoint should exist"
        print(f"Upload endpoint exists, returned status: {response.status_code}")


class TestHealthCheck:
    """Health check tests"""
    
    def test_health_endpoint(self):
        """Health endpoint should return healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get('status') == 'healthy', f"Expected healthy, got {data.get('status')}"
        print("Health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
