"""
Test suite for Auth Settings, See All functionality, and Hero Section
Tests:
1. Auth settings toggle (email, phone, Google)
2. See All section endpoint with pagination and search
3. Hero section content linkage from Layout Manager
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test Section ID and Hero Config Content IDs from requirements
TEST_SECTION_ID = "section_922b32cfdfbf"  # Lent songs
HERO_CONTENT_IDS = ["alb_bf5a2e1d4c03", "alb_6147d5b6c651", "alb_8c2c04972d01"]


class TestAuthSettings:
    """Test authentication settings toggle functionality"""
    
    def test_get_available_methods(self):
        """GET /api/auth/available-methods - returns enabled auth methods"""
        response = requests.get(f"{BASE_URL}/api/auth/available-methods")
        assert response.status_code == 200
        
        data = response.json()
        assert "email_password" in data
        assert "google" in data
        assert "phone" in data
        assert isinstance(data["email_password"], bool)
        assert isinstance(data["google"], bool)
        assert isinstance(data["phone"], bool)
        print(f"✓ Available methods: email={data['email_password']}, google={data['google']}, phone={data['phone']}")
    
    def test_get_admin_auth_settings(self):
        """GET /api/admin/auth-settings - returns full auth settings"""
        response = requests.get(f"{BASE_URL}/api/admin/auth-settings")
        assert response.status_code == 200
        
        data = response.json()
        assert "email_password_enabled" in data
        assert "google_enabled" in data
        assert "phone_enabled" in data
        assert "registration_enabled" in data
        print(f"✓ Auth settings retrieved: email_password_enabled={data['email_password_enabled']}")
    
    def test_update_auth_settings_disable_email(self):
        """PUT /api/admin/auth-settings - toggle email_password_enabled"""
        # Disable email/password
        response = requests.put(
            f"{BASE_URL}/api/admin/auth-settings",
            json={"email_password_enabled": False}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["settings"]["email_password_enabled"] == False
        print("✓ Email/password auth disabled successfully")
        
        # Verify available methods reflects the change
        methods_response = requests.get(f"{BASE_URL}/api/auth/available-methods")
        methods = methods_response.json()
        assert methods["email_password"] == False
        print("✓ Available methods correctly shows email_password=false")
    
    def test_login_fails_when_email_disabled(self):
        """POST /api/user/login - should fail with 403 when email_password_enabled is false"""
        # First ensure email is disabled
        requests.put(
            f"{BASE_URL}/api/admin/auth-settings",
            json={"email_password_enabled": False}
        )
        
        # Try to login with email
        response = requests.post(
            f"{BASE_URL}/api/user/login",
            json={"email": "test@example.com", "password": "test123"}
        )
        
        assert response.status_code == 403
        data = response.json()
        assert "disabled" in data.get("detail", "").lower()
        print("✓ Login correctly returns 403 when email/password is disabled")
    
    def test_update_auth_settings_enable_email(self):
        """PUT /api/admin/auth-settings - re-enable email_password"""
        response = requests.put(
            f"{BASE_URL}/api/admin/auth-settings",
            json={"email_password_enabled": True}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["settings"]["email_password_enabled"] == True
        print("✓ Email/password auth re-enabled successfully")
    
    def test_toggle_phone_auth(self):
        """PUT /api/admin/auth-settings - toggle phone_enabled"""
        # Disable phone
        response = requests.put(
            f"{BASE_URL}/api/admin/auth-settings",
            json={"phone_enabled": False}
        )
        assert response.status_code == 200
        assert response.json()["settings"]["phone_enabled"] == False
        
        # Verify in available methods
        methods = requests.get(f"{BASE_URL}/api/auth/available-methods").json()
        assert methods["phone"] == False
        print("✓ Phone auth disabled and reflected in available methods")
        
        # Re-enable phone
        response = requests.put(
            f"{BASE_URL}/api/admin/auth-settings",
            json={"phone_enabled": True}
        )
        assert response.status_code == 200
        assert response.json()["settings"]["phone_enabled"] == True
        print("✓ Phone auth re-enabled successfully")
    
    def test_toggle_google_auth(self):
        """PUT /api/admin/auth-settings - toggle google_enabled"""
        # Disable Google
        response = requests.put(
            f"{BASE_URL}/api/admin/auth-settings",
            json={"google_enabled": False}
        )
        assert response.status_code == 200
        assert response.json()["settings"]["google_enabled"] == False
        
        # Verify in available methods
        methods = requests.get(f"{BASE_URL}/api/auth/available-methods").json()
        assert methods["google"] == False
        print("✓ Google auth disabled and reflected in available methods")
        
        # Re-enable Google
        response = requests.put(
            f"{BASE_URL}/api/admin/auth-settings",
            json={"google_enabled": True}
        )
        assert response.status_code == 200
        assert response.json()["settings"]["google_enabled"] == True
        print("✓ Google auth re-enabled successfully")


class TestSeeAllSection:
    """Test See All section endpoint with pagination and search"""
    
    def test_get_section_content(self):
        """GET /api/user/section/{section_id} - returns paginated content"""
        response = requests.get(f"{BASE_URL}/api/user/section/{TEST_SECTION_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "section" in data
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "limit" in data
        assert "has_more" in data
        
        # Verify section info
        section = data["section"]
        assert section["section_id"] == TEST_SECTION_ID
        assert "content_type" in section
        
        print(f"✓ Section content retrieved: {len(data['items'])} items, total={data['total']}")
    
    def test_section_pagination(self):
        """GET /api/user/section/{section_id}?page=1&limit=2 - pagination works"""
        response = requests.get(
            f"{BASE_URL}/api/user/section/{TEST_SECTION_ID}",
            params={"page": 1, "limit": 2}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["items"]) <= 2
        assert data["page"] == 1
        assert data["limit"] == 2
        print(f"✓ Pagination works: returned {len(data['items'])} items with limit=2")
    
    def test_section_search(self):
        """GET /api/user/section/{section_id}?search=query - filters results"""
        # Search for something that exists
        response = requests.get(
            f"{BASE_URL}/api/user/section/{TEST_SECTION_ID}",
            params={"search": "Msalaba"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Should return filtered results
        print(f"✓ Search for 'Msalaba' returned {len(data['items'])} items")
        
        # Search for something that doesn't exist
        response = requests.get(
            f"{BASE_URL}/api/user/section/{TEST_SECTION_ID}",
            params={"search": "xyznonexistent123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert len(data["items"]) == 0
        print("✓ Search for non-existent term returns empty results")
    
    def test_section_items_have_required_fields(self):
        """Verify section items have required fields for display"""
        response = requests.get(f"{BASE_URL}/api/user/section/{TEST_SECTION_ID}")
        assert response.status_code == 200
        
        data = response.json()
        if data["items"]:
            item = data["items"][0]
            # Albums should have these fields
            assert "album_id" in item or "entity_type" in item
            assert "title" in item or "name" in item
            assert "thumbnail" in item
            print(f"✓ Section items have required fields: {list(item.keys())[:5]}...")


class TestHeroSection:
    """Test Hero section content linkage from Layout Manager"""
    
    def test_get_hero_config(self):
        """GET /api/layout/hero-config - returns hero configuration"""
        response = requests.get(f"{BASE_URL}/api/layout/hero-config")
        assert response.status_code == 200
        
        data = response.json()
        assert "content_ids" in data
        assert "hero_type" in data
        assert isinstance(data["content_ids"], list)
        
        # Verify expected content IDs are present
        for content_id in HERO_CONTENT_IDS:
            assert content_id in data["content_ids"], f"Expected {content_id} in hero config"
        
        print(f"✓ Hero config has {len(data['content_ids'])} content IDs: {data['content_ids']}")
    
    def test_home_hero_content_matches_config(self):
        """GET /api/user/home?platform=web - hero content matches hero_config"""
        # Get hero config
        config_response = requests.get(f"{BASE_URL}/api/layout/hero-config")
        config = config_response.json()
        expected_ids = set(config["content_ids"])
        
        # Get home page data
        home_response = requests.get(f"{BASE_URL}/api/user/home", params={"platform": "web"})
        assert home_response.status_code == 200
        
        home_data = home_response.json()
        assert "hero" in home_data
        
        hero = home_data["hero"]
        assert "items" in hero
        
        # Verify hero items match config
        hero_album_ids = {item.get("album_id") for item in hero["items"]}
        
        # All hero items should be from the config
        for album_id in hero_album_ids:
            assert album_id in expected_ids, f"Hero item {album_id} not in config"
        
        print(f"✓ Hero section has {len(hero['items'])} items matching config")
        for item in hero["items"]:
            print(f"  - {item.get('album_id')}: {item.get('title')}")
    
    def test_hero_items_have_display_fields(self):
        """Verify hero items have required fields for display"""
        response = requests.get(f"{BASE_URL}/api/user/home", params={"platform": "web"})
        assert response.status_code == 200
        
        hero = response.json().get("hero", {})
        items = hero.get("items", [])
        
        if items:
            item = items[0]
            assert "album_id" in item
            assert "title" in item
            assert "thumbnail" in item
            assert "artist_name" in item
            print(f"✓ Hero items have required display fields")
    
    def test_hero_rotation_settings(self):
        """Verify hero has rotation settings from config"""
        response = requests.get(f"{BASE_URL}/api/user/home", params={"platform": "web"})
        assert response.status_code == 200
        
        hero = response.json().get("hero", {})
        
        # Check rotation settings
        assert "auto_rotate" in hero
        assert "rotation_interval" in hero
        assert "show_navigation" in hero
        
        print(f"✓ Hero rotation settings: auto_rotate={hero['auto_rotate']}, interval={hero['rotation_interval']}ms")


class TestLayoutSections:
    """Test that Layout Manager sections are respected by web"""
    
    def test_home_returns_sections(self):
        """GET /api/user/home?platform=web - returns sections array"""
        response = requests.get(f"{BASE_URL}/api/user/home", params={"platform": "web"})
        assert response.status_code == 200
        
        data = response.json()
        assert "sections" in data
        assert isinstance(data["sections"], list)
        assert len(data["sections"]) > 0
        
        print(f"✓ Home page has {len(data['sections'])} sections")
    
    def test_sections_have_required_fields(self):
        """Verify sections have required fields"""
        response = requests.get(f"{BASE_URL}/api/user/home", params={"platform": "web"})
        data = response.json()
        
        for section in data["sections"]:
            assert "section_id" in section
            assert "name" in section or "title" in section
            assert "items" in section
            assert "content_type" in section or "section_type" in section
        
        print("✓ All sections have required fields")
    
    def test_lent_songs_section_present(self):
        """Verify Lent songs section (section_922b32cfdfbf) is in home"""
        response = requests.get(f"{BASE_URL}/api/user/home", params={"platform": "web"})
        data = response.json()
        
        section_ids = [s["section_id"] for s in data["sections"]]
        assert TEST_SECTION_ID in section_ids, f"Lent songs section not found in home"
        
        # Find the section and verify it has items
        lent_section = next(s for s in data["sections"] if s["section_id"] == TEST_SECTION_ID)
        assert len(lent_section["items"]) > 0
        
        print(f"✓ Lent songs section found with {len(lent_section['items'])} items")


# Cleanup fixture to ensure auth settings are restored
@pytest.fixture(autouse=True, scope="module")
def restore_auth_settings():
    """Restore auth settings after all tests"""
    yield
    # Restore all auth methods to enabled
    requests.put(
        f"{BASE_URL}/api/admin/auth-settings",
        json={
            "email_password_enabled": True,
            "google_enabled": True,
            "phone_enabled": True
        }
    )
    print("\n✓ Auth settings restored to defaults")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
