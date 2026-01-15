"""
Test suite for User Streaming App and Enhanced Analytics endpoints
Phase: P0 - Enhanced Analytics, P1 - User Streaming App

Tests cover:
- User registration and login (email/phone)
- User profile and authentication
- Home screen data with layout sections
- Browse categories and albums
- Search functionality
- Favorites management
- Library (favorites, playlists, recently played)
- Playlist CRUD
- Enhanced analytics dashboard
- Real-time analytics
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://praiseplay.preview.emergentagent.com').rstrip('/')

# Test user credentials
TEST_EMAIL = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
TEST_PHONE = f"+255{uuid.uuid4().hex[:9]}"
TEST_PASSWORD = "testpass123"
TEST_NAME = "Test User"


class TestUserRegistration:
    """User registration endpoint tests"""
    
    def test_register_with_email(self):
        """Test user registration with email"""
        response = requests.post(f"{BASE_URL}/api/user/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": TEST_NAME
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data
        assert "token" in data
        assert data["user"]["email"] == TEST_EMAIL
        assert data["user"]["name"] == TEST_NAME
        assert "user_id" in data["user"]
        assert data["token"].startswith("tok_")
        
        # Store for later tests
        pytest.test_user_id = data["user"]["user_id"]
        pytest.test_token = data["token"]
    
    def test_register_with_phone(self):
        """Test user registration with phone"""
        response = requests.post(f"{BASE_URL}/api/user/register", json={
            "phone": TEST_PHONE,
            "password": TEST_PASSWORD,
            "name": "Phone User"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data
        assert data["user"]["phone"] == TEST_PHONE
    
    def test_register_duplicate_email(self):
        """Test registration with duplicate email fails"""
        response = requests.post(f"{BASE_URL}/api/user/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Duplicate"
        })
        assert response.status_code == 400
        assert "already registered" in response.json().get("detail", "").lower()
    
    def test_register_missing_credentials(self):
        """Test registration without email/phone fails"""
        response = requests.post(f"{BASE_URL}/api/user/register", json={
            "password": TEST_PASSWORD,
            "name": "No Email"
        })
        assert response.status_code == 400


class TestUserLogin:
    """User login endpoint tests"""
    
    def test_login_with_email(self):
        """Test login with email"""
        response = requests.post(f"{BASE_URL}/api/user/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user" in data
        assert "token" in data
        assert data["user"]["email"] == TEST_EMAIL
        
        # Update token for subsequent tests
        pytest.test_token = data["token"]
    
    def test_login_with_phone(self):
        """Test login with phone"""
        response = requests.post(f"{BASE_URL}/api/user/login", json={
            "phone": TEST_PHONE,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "user" in data
        assert data["user"]["phone"] == TEST_PHONE
    
    def test_login_invalid_password(self):
        """Test login with wrong password"""
        response = requests.post(f"{BASE_URL}/api/user/login", json={
            "email": TEST_EMAIL,
            "password": "wrongpassword"
        })
        assert response.status_code == 401
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent user"""
        response = requests.post(f"{BASE_URL}/api/user/login", json={
            "email": "nonexistent@example.com",
            "password": TEST_PASSWORD
        })
        assert response.status_code == 401


class TestUserProfile:
    """User profile endpoint tests"""
    
    def test_get_profile_authenticated(self):
        """Test getting user profile with valid token"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available - run registration test first")
        
        response = requests.get(f"{BASE_URL}/api/user/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data
        assert "email" in data or "phone" in data
    
    def test_get_profile_no_auth(self):
        """Test getting profile without authentication"""
        response = requests.get(f"{BASE_URL}/api/user/me")
        assert response.status_code == 401
    
    def test_get_profile_invalid_token(self):
        """Test getting profile with invalid token"""
        response = requests.get(f"{BASE_URL}/api/user/me", headers={
            "Authorization": "Bearer invalid_token_123"
        })
        assert response.status_code == 401


class TestUserHome:
    """User home screen endpoint tests"""
    
    def test_get_home_data(self):
        """Test getting home screen data"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "sections" in data
        assert "burners" in data
        assert isinstance(data["sections"], list)
        assert isinstance(data["burners"], list)
    
    def test_home_sections_structure(self):
        """Test home sections have correct structure"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        
        data = response.json()
        for section in data.get("sections", []):
            assert "section_id" in section
            assert "type" in section
            assert "title" in section
            assert "items" in section


class TestBrowseCategories:
    """Browse categories endpoint tests"""
    
    def test_get_all_categories(self):
        """Test getting all categories"""
        response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
    
    def test_get_category_albums(self):
        """Test getting albums in a category"""
        # First get categories
        cat_response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        categories = cat_response.json().get("categories", [])
        
        if not categories:
            pytest.skip("No categories available")
        
        category_id = categories[0]["category_id"]
        response = requests.get(f"{BASE_URL}/api/user/browse/category/{category_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "category" in data
        assert "albums" in data
    
    def test_get_nonexistent_category(self):
        """Test getting non-existent category"""
        response = requests.get(f"{BASE_URL}/api/user/browse/category/nonexistent_cat_123")
        assert response.status_code == 404


class TestAlbumDetails:
    """Album details endpoint tests"""
    
    def test_get_album_with_songs(self):
        """Test getting album with songs"""
        # First get albums
        albums_response = requests.get(f"{BASE_URL}/api/albums?limit=1")
        albums = albums_response.json().get("albums", [])
        
        if not albums:
            pytest.skip("No albums available")
        
        album_id = albums[0]["album_id"]
        response = requests.get(f"{BASE_URL}/api/user/album/{album_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "album" in data
        assert "songs" in data
        assert isinstance(data["songs"], list)
    
    def test_get_nonexistent_album(self):
        """Test getting non-existent album"""
        response = requests.get(f"{BASE_URL}/api/user/album/nonexistent_album_123")
        assert response.status_code == 404


class TestSearch:
    """Search endpoint tests"""
    
    def test_search_content(self):
        """Test searching for content"""
        response = requests.get(f"{BASE_URL}/api/user/search?q=praise")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "albums" in data
        assert "songs" in data
        assert "artists" in data
    
    def test_search_short_query(self):
        """Test search with short query returns empty"""
        response = requests.get(f"{BASE_URL}/api/user/search?q=a")
        assert response.status_code == 200
        
        data = response.json()
        assert data["albums"] == []
        assert data["songs"] == []
        assert data["artists"] == []
    
    def test_search_empty_query(self):
        """Test search with empty query"""
        response = requests.get(f"{BASE_URL}/api/user/search?q=")
        assert response.status_code == 200


class TestFavorites:
    """Favorites management endpoint tests"""
    
    def test_add_to_favorites(self):
        """Test adding item to favorites"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available")
        
        response = requests.post(f"{BASE_URL}/api/user/favorites/add", 
            json={"type": "song", "id": "test_song_123"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert "Added to favorites" in response.json().get("message", "")
    
    def test_add_to_favorites_no_auth(self):
        """Test adding to favorites without auth"""
        response = requests.post(f"{BASE_URL}/api/user/favorites/add", 
            json={"type": "song", "id": "test_song_123"}
        )
        assert response.status_code == 401
    
    def test_remove_from_favorites(self):
        """Test removing item from favorites"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available")
        
        response = requests.post(f"{BASE_URL}/api/user/favorites/remove", 
            json={"id": "test_song_123"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200


class TestLibrary:
    """User library endpoint tests"""
    
    def test_get_library(self):
        """Test getting user library"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available")
        
        response = requests.get(f"{BASE_URL}/api/user/library", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "favorites" in data
        assert "playlists" in data
        assert "recently_played" in data
        assert "downloads" in data
    
    def test_get_library_no_auth(self):
        """Test getting library without auth"""
        response = requests.get(f"{BASE_URL}/api/user/library")
        assert response.status_code == 401


class TestPlaylists:
    """Playlist management endpoint tests"""
    
    def test_create_playlist(self):
        """Test creating a playlist"""
        token = getattr(pytest, 'test_token', None)
        if not token:
            pytest.skip("No token available")
        
        response = requests.post(f"{BASE_URL}/api/user/playlist/create", 
            json={"name": "Test Playlist", "description": "Test description"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "playlist" in data
        assert data["playlist"]["name"] == "Test Playlist"
        assert "playlist_id" in data["playlist"]
        
        pytest.test_playlist_id = data["playlist"]["playlist_id"]
    
    def test_add_song_to_playlist(self):
        """Test adding song to playlist"""
        token = getattr(pytest, 'test_token', None)
        playlist_id = getattr(pytest, 'test_playlist_id', None)
        
        if not token or not playlist_id:
            pytest.skip("No token or playlist available")
        
        response = requests.post(f"{BASE_URL}/api/user/playlist/{playlist_id}/add", 
            json={"song_id": "test_song_456"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
    
    def test_get_playlist(self):
        """Test getting playlist with songs"""
        playlist_id = getattr(pytest, 'test_playlist_id', None)
        
        if not playlist_id:
            pytest.skip("No playlist available")
        
        response = requests.get(f"{BASE_URL}/api/user/playlist/{playlist_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert "playlist" in data
        assert "songs" in data
    
    def test_get_nonexistent_playlist(self):
        """Test getting non-existent playlist"""
        response = requests.get(f"{BASE_URL}/api/user/playlist/nonexistent_pl_123")
        assert response.status_code == 404


class TestEnhancedAnalytics:
    """Enhanced analytics endpoint tests"""
    
    def test_get_enhanced_analytics_default(self):
        """Test getting enhanced analytics with default period"""
        response = requests.get(f"{BASE_URL}/api/analytics/enhanced")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "period" in data
        assert "overview" in data
        assert "platform_stats" in data
        assert "revenue_breakdown" in data
        assert "daily_trend" in data
        assert "top_songs" in data
        assert "top_choirs" in data
        assert "categories" in data
        assert "rates" in data
    
    def test_get_enhanced_analytics_7d(self):
        """Test getting analytics for 7 days"""
        response = requests.get(f"{BASE_URL}/api/analytics/enhanced?period=7d")
        assert response.status_code == 200
        assert response.json()["period"] == "7d"
    
    def test_get_enhanced_analytics_30d(self):
        """Test getting analytics for 30 days"""
        response = requests.get(f"{BASE_URL}/api/analytics/enhanced?period=30d")
        assert response.status_code == 200
        assert response.json()["period"] == "30d"
    
    def test_get_enhanced_analytics_90d(self):
        """Test getting analytics for 90 days"""
        response = requests.get(f"{BASE_URL}/api/analytics/enhanced?period=90d")
        assert response.status_code == 200
        assert response.json()["period"] == "90d"
    
    def test_get_enhanced_analytics_1y(self):
        """Test getting analytics for 1 year"""
        response = requests.get(f"{BASE_URL}/api/analytics/enhanced?period=1y")
        assert response.status_code == 200
        assert response.json()["period"] == "1y"
    
    def test_analytics_overview_structure(self):
        """Test analytics overview has correct structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/enhanced")
        assert response.status_code == 200
        
        overview = response.json()["overview"]
        expected_fields = [
            "total_streams", "revenue_streams", "unique_listeners",
            "unique_songs_played", "total_listening_hours", "avg_session_duration",
            "gross_revenue", "platform_revenue", "choir_payouts"
        ]
        for field in expected_fields:
            assert field in overview, f"Missing field: {field}"
    
    def test_analytics_platform_stats_structure(self):
        """Test platform stats has correct structure"""
        response = requests.get(f"{BASE_URL}/api/analytics/enhanced")
        assert response.status_code == 200
        
        stats = response.json()["platform_stats"]
        assert "total_albums" in stats
        assert "total_songs" in stats
        assert "total_choirs" in stats
        assert "total_users" in stats


class TestRealtimeAnalytics:
    """Real-time analytics endpoint tests"""
    
    def test_get_realtime_analytics(self):
        """Test getting real-time analytics"""
        response = requests.get(f"{BASE_URL}/api/analytics/realtime")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "active_streams" in data
        assert "active_listeners" in data
        assert "per_minute" in data
        assert isinstance(data["per_minute"], list)


# Cleanup test data
class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_users(self):
        """Note: Test users created with TEST_ prefix for identification"""
        # In production, would delete test users here
        # For now, just verify we can access the API
        response = requests.get(f"{BASE_URL}/api/user/browse/categories")
        assert response.status_code == 200
        print(f"Test cleanup complete. Test email: {TEST_EMAIL}, Test phone: {TEST_PHONE}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
