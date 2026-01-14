"""
Test suite for User Streaming App Audio Player Improvements
Tests: Hero section, Quick access grid, Category filters, Featured albums carousel,
       Different section layouts, Album detail, Audio player with controls
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestUserHomeEndpoint:
    """Tests for GET /api/user/home endpoint"""
    
    def test_user_home_returns_sections(self):
        """Test that /api/user/home returns sections array"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        assert "sections" in data
        assert isinstance(data["sections"], list)
        print("✓ GET /api/user/home returns sections array")
    
    def test_user_home_returns_burners(self):
        """Test that /api/user/home returns burners array for hero section"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        assert "burners" in data
        assert isinstance(data["burners"], list)
        print("✓ GET /api/user/home returns burners array")
    
    def test_user_home_sections_have_items(self):
        """Test that sections have items array"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        for section in data["sections"]:
            assert "items" in section
            assert isinstance(section["items"], list)
        print("✓ All sections have items array")
    
    def test_user_home_sections_have_required_fields(self):
        """Test that sections have required fields"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        for section in data["sections"]:
            assert "section_id" in section
            assert "type" in section
            assert "title" in section
        print("✓ Sections have required fields (section_id, type, title)")


class TestLayoutSectionsEndpoint:
    """Tests for GET /api/layout/sections endpoint"""
    
    def test_layout_sections_returns_sections(self):
        """Test that /api/layout/sections returns sections"""
        response = requests.get(f"{BASE_URL}/api/layout/sections")
        assert response.status_code == 200
        data = response.json()
        assert "sections" in data
        assert isinstance(data["sections"], list)
        print("✓ GET /api/layout/sections returns sections")
    
    def test_layout_sections_active_only(self):
        """Test that active_only filter works"""
        response = requests.get(f"{BASE_URL}/api/layout/sections?active_only=true")
        assert response.status_code == 200
        data = response.json()
        for section in data["sections"]:
            assert section.get("is_active") == True
        print("✓ GET /api/layout/sections?active_only=true returns only active sections")
    
    def test_layout_sections_have_content_ids(self):
        """Test that sections have content_ids for admin configuration"""
        response = requests.get(f"{BASE_URL}/api/layout/sections")
        assert response.status_code == 200
        data = response.json()
        # Check that featured_albums section exists and has content_ids field
        featured = [s for s in data["sections"] if s.get("section_type") == "featured_albums"]
        if featured:
            assert "content_ids" in featured[0] or "content_count" in featured[0]
            print("✓ Featured albums section has content configuration")
        else:
            print("✓ Layout sections returned (no featured_albums section found)")


class TestCategoriesEndpoint:
    """Tests for GET /api/user/browse/categories endpoint"""
    
    def test_browse_categories_returns_list(self):
        """Test that /api/user/browse/categories returns categories"""
        response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        print("✓ GET /api/user/browse/categories returns categories list")
    
    def test_categories_have_required_fields(self):
        """Test that categories have required fields"""
        response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        assert response.status_code == 200
        data = response.json()
        if data["categories"]:
            cat = data["categories"][0]
            assert "category_id" in cat
            assert "name" in cat
            print("✓ Categories have required fields (category_id, name)")
        else:
            print("✓ Categories endpoint works (empty list)")


class TestCategoryBrowseEndpoint:
    """Tests for GET /api/user/browse/category/{id} endpoint"""
    
    def test_browse_category_returns_albums(self):
        """Test that browsing a category returns albums"""
        # First get categories
        cat_response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        categories = cat_response.json().get("categories", [])
        
        if categories:
            cat_id = categories[0]["category_id"]
            response = requests.get(f"{BASE_URL}/api/user/browse/category/{cat_id}")
            assert response.status_code == 200
            data = response.json()
            assert "albums" in data
            print(f"✓ GET /api/user/browse/category/{cat_id} returns albums")
        else:
            pytest.skip("No categories available for testing")
    
    def test_browse_invalid_category_returns_404(self):
        """Test that invalid category returns 404"""
        response = requests.get(f"{BASE_URL}/api/user/browse/category/invalid_cat_id")
        assert response.status_code == 404
        print("✓ GET /api/user/browse/category/invalid returns 404")


class TestAlbumEndpoint:
    """Tests for GET /api/user/album/{id} endpoint"""
    
    def test_album_returns_songs(self):
        """Test that album endpoint returns album with songs"""
        # First get albums from home
        home_response = requests.get(f"{BASE_URL}/api/user/home")
        sections = home_response.json().get("sections", [])
        
        album_id = None
        for section in sections:
            items = section.get("items", [])
            for item in items:
                if "album_id" in item:
                    album_id = item["album_id"]
                    break
            if album_id:
                break
        
        if album_id:
            response = requests.get(f"{BASE_URL}/api/user/album/{album_id}")
            assert response.status_code == 200
            data = response.json()
            assert "album" in data
            assert "songs" in data
            print(f"✓ GET /api/user/album/{album_id} returns album with songs")
        else:
            pytest.skip("No albums available for testing")
    
    def test_invalid_album_returns_404(self):
        """Test that invalid album returns 404"""
        response = requests.get(f"{BASE_URL}/api/user/album/invalid_album_id")
        assert response.status_code == 404
        print("✓ GET /api/user/album/invalid returns 404")


class TestListeningSessionEndpoints:
    """Tests for listening session endpoints (audio player backend)"""
    
    def test_start_listening_session(self):
        """Test starting a listening session"""
        payload = {
            "song_id": "test_song_123",
            "user_id": "test_user_123"
        }
        response = requests.post(f"{BASE_URL}/api/listening/start", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        print("✓ POST /api/listening/start creates session")
        return data["session_id"]
    
    def test_end_listening_session(self):
        """Test ending a listening session"""
        # First start a session
        start_payload = {
            "song_id": "test_song_456",
            "user_id": "test_user_456"
        }
        start_response = requests.post(f"{BASE_URL}/api/listening/start", json=start_payload)
        session_id = start_response.json().get("session_id")
        
        if session_id:
            end_payload = {"session_id": session_id}
            response = requests.post(f"{BASE_URL}/api/listening/end", json=end_payload)
            assert response.status_code == 200
            print("✓ POST /api/listening/end ends session")
        else:
            pytest.skip("Could not create session to end")


class TestSearchEndpoint:
    """Tests for GET /api/user/search endpoint"""
    
    def test_search_returns_results(self):
        """Test that search returns albums, songs, artists"""
        response = requests.get(f"{BASE_URL}/api/user/search?q=test")
        assert response.status_code == 200
        data = response.json()
        # Should have at least one of these keys
        assert "albums" in data or "songs" in data or "artists" in data
        print("✓ GET /api/user/search?q=test returns results structure")
    
    def test_search_short_query(self):
        """Test that short query returns empty or error"""
        response = requests.get(f"{BASE_URL}/api/user/search?q=a")
        assert response.status_code == 200
        data = response.json()
        # Short queries should return empty results
        total_results = len(data.get("albums", [])) + len(data.get("songs", [])) + len(data.get("artists", []))
        assert total_results == 0
        print("✓ GET /api/user/search?q=a returns empty for short query")


class TestUserAuthEndpoints:
    """Tests for user registration and login"""
    
    def test_user_registration(self):
        """Test user registration"""
        unique_id = uuid.uuid4().hex[:8]
        payload = {
            "email": f"TEST_audio_user_{unique_id}@example.com",
            "password": "testpass123",
            "name": f"Test User {unique_id}"
        }
        response = requests.post(f"{BASE_URL}/api/user/register", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print("✓ POST /api/user/register creates user")
        return data
    
    def test_user_login(self):
        """Test user login"""
        # First register a user
        unique_id = uuid.uuid4().hex[:8]
        reg_payload = {
            "email": f"TEST_login_user_{unique_id}@example.com",
            "password": "testpass123",
            "name": f"Test Login User {unique_id}"
        }
        requests.post(f"{BASE_URL}/api/user/register", json=reg_payload)
        
        # Then login
        login_payload = {
            "email": reg_payload["email"],
            "password": "testpass123"
        }
        response = requests.post(f"{BASE_URL}/api/user/login", json=login_payload)
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print("✓ POST /api/user/login authenticates user")


class TestLayoutBurnersEndpoint:
    """Tests for GET /api/layout/burners endpoint"""
    
    def test_layout_burners_returns_list(self):
        """Test that /api/layout/burners returns burners"""
        response = requests.get(f"{BASE_URL}/api/layout/burners")
        assert response.status_code == 200
        data = response.json()
        assert "burners" in data
        assert isinstance(data["burners"], list)
        print("✓ GET /api/layout/burners returns burners list")
    
    def test_burners_have_required_fields(self):
        """Test that burners have required fields for hero section"""
        response = requests.get(f"{BASE_URL}/api/layout/burners")
        assert response.status_code == 200
        data = response.json()
        if data["burners"]:
            burner = data["burners"][0]
            # Check for hero section fields
            assert "headline" in burner or "cta_text" in burner
            print("✓ Burners have hero section fields")
        else:
            print("✓ Burners endpoint works (empty list)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
