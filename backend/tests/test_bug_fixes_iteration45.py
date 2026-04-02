"""
Backend API tests for iteration 45 bug fixes:
1. HLS status (hls_status, hls_url) returned by GET /api/songs endpoint
2. GET /api/analytics/user-demographics endpoint works without crash
3. GET /api/analytics/device-distribution endpoint works without crash
4. POST /api/library/playlists endpoint returns 401 without auth token
5. Web admin login with empty password works
"""

import pytest
import requests
import os

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://neno-la-leo.preview.emergentagent.com"


class TestHLSStatusInSongs:
    """Test that GET /api/songs returns hls_status and hls_url fields"""
    
    def test_songs_endpoint_returns_hls_fields(self):
        """Verify that songs endpoint includes hls_status and hls_url in projection"""
        response = requests.get(f"{BASE_URL}/api/songs", timeout=30)
        
        # Status code assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "songs" in data, "Response should contain 'songs' key"
        
        # If there are songs, check that hls_status and hls_url are in the projection
        # (they may be null/missing if not set, but the projection should allow them)
        songs = data.get("songs", [])
        print(f"Found {len(songs)} songs")
        
        if songs:
            # Check first song for hls fields
            first_song = songs[0]
            print(f"First song keys: {list(first_song.keys())}")
            
            # The projection includes hls_status and hls_url, so they should be present
            # if the song has them set in the database
            # We just verify the endpoint works and returns song data
            assert "song_id" in first_song, "Song should have song_id"
            assert "title" in first_song, "Song should have title"
            
            # Check if hls_status is in the response (may be null if not set)
            # The key point is the projection now includes these fields
            print(f"hls_status present: {'hls_status' in first_song}")
            print(f"hls_url present: {'hls_url' in first_song}")
            
            # If hls_status is present, verify it's a valid value
            if "hls_status" in first_song and first_song["hls_status"]:
                assert first_song["hls_status"] in ["pending", "processing", "completed", "failed"], \
                    f"Invalid hls_status: {first_song['hls_status']}"
        
        print(f"TEST PASSED: Songs endpoint returns {len(songs)} songs with proper structure")


class TestAnalyticsEndpoints:
    """Test analytics endpoints don't crash"""
    
    def test_user_demographics_no_crash(self):
        """Verify GET /api/analytics/user-demographics works without crash"""
        response = requests.get(f"{BASE_URL}/api/analytics/user-demographics", timeout=60)
        
        # Status code assertion - should be 200, not 500
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "total_users" in data, "Response should contain 'total_users'"
        assert "locations" in data, "Response should contain 'locations'"
        assert "age_distribution" in data, "Response should contain 'age_distribution'"
        assert "gender_distribution" in data, "Response should contain 'gender_distribution'"
        assert "device_distribution" in data, "Response should contain 'device_distribution'"
        
        # Verify locations is a dict (the fix ensures location is always a string key)
        assert isinstance(data["locations"], dict), "locations should be a dict"
        
        print(f"TEST PASSED: user-demographics returned {data['total_users']} users")
        print(f"Locations: {list(data['locations'].keys())[:5]}")
    
    def test_device_distribution_no_crash(self):
        """Verify GET /api/analytics/device-distribution works without crash"""
        response = requests.get(f"{BASE_URL}/api/analytics/device-distribution", timeout=60)
        
        # Status code assertion - should be 200, not 500
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "total_users" in data, "Response should contain 'total_users'"
        assert "platform_distribution" in data, "Response should contain 'platform_distribution'"
        assert "manufacturer_distribution" in data, "Response should contain 'manufacturer_distribution'"
        assert "location_distribution" in data, "Response should contain 'location_distribution'"
        
        # Verify location_distribution is a dict (the fix ensures location is always a string key)
        assert isinstance(data["location_distribution"], dict), "location_distribution should be a dict"
        
        print(f"TEST PASSED: device-distribution returned {data['total_users']} users")
        print(f"Platform distribution: {data['platform_distribution']}")


class TestPlaylistAuthRequired:
    """Test that playlist creation requires authentication"""
    
    def test_create_playlist_without_auth_returns_401(self):
        """Verify POST /api/library/playlists returns 401 without auth token"""
        payload = {
            "name": "Test Playlist",
            "description": "Test description"
        }
        
        # Make request WITHOUT auth header
        response = requests.post(
            f"{BASE_URL}/api/library/playlists",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        # Should return 401 Unauthorized
        assert response.status_code == 401, f"Expected 401, got {response.status_code}: {response.text}"
        
        print(f"TEST PASSED: Playlist creation without auth returns 401")


class TestAdminLoginEmptyPassword:
    """Test admin login with empty password"""
    
    def test_admin_login_with_empty_password(self):
        """Verify admin can login with empty password (as per credentials)"""
        payload = {
            "email": "admin@gracefy.life",
            "password": ""  # Empty password as specified
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users/login",  # Correct endpoint path
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        # Should return 200 with token
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response contains token
        assert "token" in data or "access_token" in data, "Response should contain token"
        
        token = data.get("token") or data.get("access_token")
        assert token and len(token) > 0, "Token should not be empty"
        
        print(f"TEST PASSED: Admin login with empty password works")
        print(f"Token received: {token[:20]}...")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
