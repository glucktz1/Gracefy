"""
Test Leaders Page API and Home Page Data
Tests for iteration 26 - verifying Leaders rebuild and Home data
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLeadersAPI:
    """Test Leaders CRUD API endpoints"""
    
    created_leader_id = None
    
    def test_get_leaders(self):
        """GET /api/leaders - should return leaders list"""
        response = requests.get(f"{BASE_URL}/api/leaders")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaders" in data
        assert isinstance(data["leaders"], list)
        print(f"✓ Found {len(data['leaders'])} leaders")
    
    def test_create_leader(self):
        """POST /api/leaders - create new leader"""
        payload = {
            "name": "TEST_Leader_Iter26",
            "title": "pastor",
            "bio": "Test leader for iteration 26"
        }
        response = requests.post(f"{BASE_URL}/api/leaders", json=payload)
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert "leader_id" in data
        assert data["name"] == payload["name"]
        assert data["title"] == payload["title"]
        # Verify NO thumbnail/photo field is required
        print(f"✓ Created leader: {data['leader_id']}")
        TestLeadersAPI.created_leader_id = data["leader_id"]
    
    def test_create_leader_no_thumbnail_required(self):
        """POST /api/leaders - verify NO thumbnail field needed"""
        # Create leader without any thumbnail/photo field
        payload = {
            "name": "TEST_NoPhoto_Leader",
            "title": "priest",
            "church_id": "",
            "bio": "Leader without photo"
        }
        response = requests.post(f"{BASE_URL}/api/leaders", json=payload)
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert "leader_id" in data
        # Photo should be null or empty
        assert data.get("photo") is None or data.get("photo") == ""
        print(f"✓ Leader created without thumbnail requirement")
        
        # Cleanup
        if data.get("leader_id"):
            requests.delete(f"{BASE_URL}/api/leaders/{data['leader_id']}")
    
    def test_get_single_leader(self):
        """GET /api/leaders/{id} - get specific leader"""
        if not TestLeadersAPI.created_leader_id:
            pytest.skip("No leader created")
        
        response = requests.get(f"{BASE_URL}/api/leaders/{TestLeadersAPI.created_leader_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("leader_id") == TestLeadersAPI.created_leader_id
        print(f"✓ Retrieved leader: {data['name']}")
    
    def test_update_leader(self):
        """PUT /api/leaders/{id} - update leader"""
        if not TestLeadersAPI.created_leader_id:
            pytest.skip("No leader created")
        
        payload = {
            "name": "TEST_Leader_Updated",
            "is_verified": True
        }
        response = requests.put(
            f"{BASE_URL}/api/leaders/{TestLeadersAPI.created_leader_id}", 
            json=payload
        )
        assert response.status_code == 200
        print(f"✓ Leader updated successfully")
    
    def test_update_leader_verify_persistence(self):
        """GET after update - verify changes persisted"""
        if not TestLeadersAPI.created_leader_id:
            pytest.skip("No leader created")
        
        response = requests.get(f"{BASE_URL}/api/leaders/{TestLeadersAPI.created_leader_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("name") == "TEST_Leader_Updated"
        assert data.get("is_verified") == True
        print(f"✓ Update persisted correctly")
    
    def test_delete_leader(self):
        """DELETE /api/leaders/{id} - delete leader"""
        if not TestLeadersAPI.created_leader_id:
            pytest.skip("No leader created")
        
        response = requests.delete(f"{BASE_URL}/api/leaders/{TestLeadersAPI.created_leader_id}")
        assert response.status_code == 200
        print(f"✓ Leader deleted successfully")
    
    def test_delete_leader_verify_removed(self):
        """GET after delete - verify leader is removed"""
        if not TestLeadersAPI.created_leader_id:
            pytest.skip("No leader created")
        
        response = requests.get(f"{BASE_URL}/api/leaders/{TestLeadersAPI.created_leader_id}")
        assert response.status_code == 404
        print(f"✓ Leader correctly removed from DB")


class TestHomePageData:
    """Test Home Page data API"""
    
    def test_user_home_endpoint(self):
        """GET /api/user/home - should return sections with items"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        
        data = response.json()
        assert "sections" in data
        assert isinstance(data["sections"], list)
        assert len(data["sections"]) > 0, "Home page should have at least one section"
        print(f"✓ Found {len(data['sections'])} sections on home page")
    
    def test_home_sections_have_items(self):
        """Verify sections have items"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        
        data = response.json()
        sections_with_items = [s for s in data["sections"] if s.get("items")]
        print(f"✓ {len(sections_with_items)} sections have items")
        
        # List sections and their item counts
        for section in data["sections"]:
            item_count = len(section.get("items", []))
            print(f"  - {section.get('title', 'Untitled')}: {item_count} items")
    
    def test_hero_section_exists(self):
        """Verify hero section is present"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        
        data = response.json()
        assert "hero" in data, "Home page should have hero section"
        hero = data["hero"]
        assert "items" in hero
        print(f"✓ Hero section has {len(hero['items'])} items")


class TestAlbumsWithSongs:
    """Test Albums API with songs data"""
    
    def test_albums_all_songs(self):
        """GET /api/albums/all-songs - should return albums with songs"""
        response = requests.get(f"{BASE_URL}/api/albums/all-songs?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "albums" in data
        assert isinstance(data["albums"], list)
        print(f"✓ Found {len(data['albums'])} albums")
        
        # Check if albums have songs
        for album in data["albums"]:
            songs = album.get("songs", [])
            print(f"  - {album.get('title', 'Untitled')}: {len(songs)} songs")


class TestBrowseCategories:
    """Test Browse Categories API"""
    
    def test_browse_categories(self):
        """GET /api/user/browse/categories - should return categories"""
        response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        print(f"✓ Found {len(data['categories'])} categories")


class TestChurchesAPI:
    """Test Churches API - needed for Leaders page church dropdown"""
    
    def test_get_churches(self):
        """GET /api/churches - should return churches list"""
        response = requests.get(f"{BASE_URL}/api/churches")
        assert response.status_code == 200
        
        data = response.json()
        assert "churches" in data
        assert isinstance(data["churches"], list)
        print(f"✓ Found {len(data['churches'])} churches")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
