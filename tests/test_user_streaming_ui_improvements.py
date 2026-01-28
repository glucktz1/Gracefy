"""
Test suite for User Streaming App UI Improvements
Tests: Hero section, Quick access grid, Category filters, Show all buttons, Different card layouts
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://faith-audio-3.preview.emergentagent.com').rstrip('/')

class TestBrowseCategories:
    """Tests for GET /api/user/browse/categories endpoint"""
    
    def test_browse_categories_returns_categories(self):
        """Test that browse categories returns a list of categories"""
        response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        print(f"✓ Browse categories returned {len(data['categories'])} categories")
    
    def test_browse_categories_structure(self):
        """Test that categories have required fields"""
        response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        assert response.status_code == 200
        data = response.json()
        
        if data["categories"]:
            cat = data["categories"][0]
            assert "category_id" in cat
            assert "name" in cat
            assert "status" in cat
            print(f"✓ Category structure validated: {cat['name']}")
    
    def test_browse_categories_default_creation(self):
        """Test that default categories are created if none exist"""
        response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        assert response.status_code == 200
        data = response.json()
        # Should have categories (either existing or default)
        assert len(data["categories"]) > 0
        print(f"✓ Categories available: {len(data['categories'])}")


class TestUserHome:
    """Tests for GET /api/user/home endpoint"""
    
    def test_user_home_returns_sections(self):
        """Test that user home returns sections"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        assert "sections" in data
        assert isinstance(data["sections"], list)
        print(f"✓ User home returned {len(data['sections'])} sections")
    
    def test_user_home_returns_burners(self):
        """Test that user home returns burners (promotional banners)"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        assert "burners" in data
        assert isinstance(data["burners"], list)
        print(f"✓ User home returned {len(data['burners'])} burners")
    
    def test_user_home_section_structure(self):
        """Test that sections have required fields"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        
        if data["sections"]:
            section = data["sections"][0]
            assert "section_id" in section
            assert "type" in section
            assert "title" in section
            print(f"✓ Section structure validated: {section['title']} (type: {section['type']})")
    
    def test_user_home_section_types(self):
        """Test that sections have valid types"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        
        valid_types = ["hero", "quick_access", "featured_albums", "trending", "seasonal", "cta", "custom"]
        for section in data["sections"]:
            assert section["type"] in valid_types, f"Invalid section type: {section['type']}"
        print(f"✓ All section types are valid")
    
    def test_user_home_sections_have_items(self):
        """Test that sections have items array"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        
        for section in data["sections"]:
            assert "items" in section
            assert isinstance(section["items"], list)
        print(f"✓ All sections have items array")


class TestCategoryAlbums:
    """Tests for GET /api/user/browse/category/{id} endpoint"""
    
    def test_category_albums_valid_category(self):
        """Test getting albums for a valid category"""
        # First get categories
        cat_response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        categories = cat_response.json()["categories"]
        
        if categories:
            cat_id = categories[0]["category_id"]
            response = requests.get(f"{BASE_URL}/api/user/browse/category/{cat_id}")
            assert response.status_code == 200
            data = response.json()
            assert "category" in data
            assert "albums" in data
            assert isinstance(data["albums"], list)
            print(f"✓ Category albums returned for {data['category']['name']}: {len(data['albums'])} albums")
        else:
            pytest.skip("No categories available")
    
    def test_category_albums_invalid_category(self):
        """Test getting albums for an invalid category returns 404"""
        response = requests.get(f"{BASE_URL}/api/user/browse/category/invalid_cat_id")
        assert response.status_code == 404
        print("✓ Invalid category returns 404")
    
    def test_category_albums_structure(self):
        """Test that category albums response has correct structure"""
        cat_response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        categories = cat_response.json()["categories"]
        
        if categories:
            cat_id = categories[0]["category_id"]
            response = requests.get(f"{BASE_URL}/api/user/browse/category/{cat_id}")
            assert response.status_code == 200
            data = response.json()
            
            # Validate category structure
            assert "category_id" in data["category"]
            assert "name" in data["category"]
            
            # Validate albums structure if any
            if data["albums"]:
                album = data["albums"][0]
                assert "album_id" in album
                assert "title" in album
                print(f"✓ Category albums structure validated")
        else:
            pytest.skip("No categories available")


class TestLayoutSections:
    """Tests for layout sections endpoint"""
    
    def test_layout_sections_returns_sections(self):
        """Test that layout sections endpoint returns sections"""
        response = requests.get(f"{BASE_URL}/api/layout/sections")
        assert response.status_code == 200
        data = response.json()
        assert "sections" in data
        assert "total" in data
        print(f"✓ Layout sections returned {data['total']} sections")
    
    def test_layout_sections_default_creation(self):
        """Test that default sections are created if none exist"""
        response = requests.get(f"{BASE_URL}/api/layout/sections")
        assert response.status_code == 200
        data = response.json()
        # Should have sections (either existing or default)
        assert data["total"] > 0
        print(f"✓ Layout sections available: {data['total']}")
    
    def test_layout_sections_structure(self):
        """Test that layout sections have required fields"""
        response = requests.get(f"{BASE_URL}/api/layout/sections")
        assert response.status_code == 200
        data = response.json()
        
        if data["sections"]:
            section = data["sections"][0]
            assert "section_id" in section
            assert "name" in section
            assert "display_name" in section
            assert "section_type" in section
            assert "is_active" in section
            print(f"✓ Layout section structure validated: {section['display_name']}")


class TestLayoutBurners:
    """Tests for layout burners endpoint"""
    
    def test_layout_burners_returns_burners(self):
        """Test that layout burners endpoint returns burners"""
        response = requests.get(f"{BASE_URL}/api/layout/burners")
        assert response.status_code == 200
        data = response.json()
        assert "burners" in data
        assert "total" in data
        print(f"✓ Layout burners returned {data['total']} burners")
    
    def test_layout_burners_structure(self):
        """Test that layout burners have required fields"""
        response = requests.get(f"{BASE_URL}/api/layout/burners")
        assert response.status_code == 200
        data = response.json()
        
        if data["burners"]:
            burner = data["burners"][0]
            assert "burner_id" in burner
            assert "headline" in burner
            assert "cta_text" in burner
            print(f"✓ Layout burner structure validated: {burner['headline']}")


class TestAlbumDetails:
    """Tests for album details endpoint"""
    
    def test_album_details_valid_album(self):
        """Test getting details for a valid album"""
        # First get albums from home
        home_response = requests.get(f"{BASE_URL}/api/user/home")
        sections = home_response.json()["sections"]
        
        album_id = None
        for section in sections:
            if section.get("items"):
                for item in section["items"]:
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
            print(f"✓ Album details returned for {data['album']['title']}: {len(data['songs'])} songs")
        else:
            pytest.skip("No albums available")
    
    def test_album_details_invalid_album(self):
        """Test getting details for an invalid album returns 404"""
        response = requests.get(f"{BASE_URL}/api/user/album/invalid_album_id")
        assert response.status_code == 404
        print("✓ Invalid album returns 404")


class TestSearch:
    """Tests for search endpoint"""
    
    def test_search_returns_results(self):
        """Test that search returns results"""
        response = requests.get(f"{BASE_URL}/api/user/search?q=test")
        assert response.status_code == 200
        data = response.json()
        assert "albums" in data
        assert "songs" in data
        assert "artists" in data
        print(f"✓ Search returned results: {len(data['albums'])} albums, {len(data['songs'])} songs, {len(data['artists'])} artists")
    
    def test_search_short_query(self):
        """Test that short query returns empty results"""
        response = requests.get(f"{BASE_URL}/api/user/search?q=a")
        assert response.status_code == 200
        data = response.json()
        # Short queries should return empty results
        assert data["albums"] == []
        assert data["songs"] == []
        assert data["artists"] == []
        print("✓ Short query returns empty results")


class TestUserRegistrationAndLogin:
    """Tests for user registration and login"""
    
    def test_user_registration(self):
        """Test user registration"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(f"{BASE_URL}/api/user/register", json={
            "email": f"TEST_ui_user_{unique_id}@example.com",
            "password": "testpass123",
            "name": "Test UI User"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ User registered successfully: {data['user']['email']}")
    
    def test_user_login(self):
        """Test user login"""
        # First register
        unique_id = uuid.uuid4().hex[:8]
        email = f"TEST_login_user_{unique_id}@example.com"
        requests.post(f"{BASE_URL}/api/user/register", json={
            "email": email,
            "password": "testpass123",
            "name": "Test Login User"
        })
        
        # Then login
        response = requests.post(f"{BASE_URL}/api/user/login", json={
            "email": email,
            "password": "testpass123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"✓ User logged in successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
