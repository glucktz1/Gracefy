"""
Neno la Leo (Word of the Day) API Tests
Tests for religious leaders management and daily word content
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@gracefy.life"
ADMIN_PASSWORD = ""
TEST_LEADER_EMAIL = "john.mkali@test.com"
TEST_LEADER_PASSWORD = "0495e408"


class TestNenoLaLeoAdminEndpoints:
    """Admin endpoints for Neno la Leo management"""
    
    def test_get_all_leaders(self):
        """Test GET /api/neno-la-leo/admin/leaders - Get all religious leaders"""
        response = requests.get(f"{API}/neno-la-leo/admin/leaders")
        print(f"GET /api/neno-la-leo/admin/leaders: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "leaders" in data
        assert "total" in data
        assert isinstance(data["leaders"], list)
        print(f"Found {data['total']} leaders")
        
        # Check leader structure if any exist
        if data["leaders"]:
            leader = data["leaders"][0]
            assert "leader_id" in leader
            assert "name" in leader
            assert "title" in leader
            assert "email" in leader
            print(f"First leader: {leader.get('title')} {leader.get('name')}")
    
    def test_get_pending_leaders(self):
        """Test GET /api/neno-la-leo/admin/pending-leaders - Get pending approvals"""
        response = requests.get(f"{API}/neno-la-leo/admin/pending-leaders")
        print(f"GET /api/neno-la-leo/admin/pending-leaders: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "leaders" in data
        assert "total" in data
        print(f"Found {data['total']} pending leaders")
    
    def test_get_all_neno(self):
        """Test GET /api/neno-la-leo/admin/neno - Get all Neno la Leo entries"""
        response = requests.get(f"{API}/neno-la-leo/admin/neno")
        print(f"GET /api/neno-la-leo/admin/neno: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "neno_list" in data
        assert "total" in data
        assert isinstance(data["neno_list"], list)
        print(f"Found {data['total']} Neno la Leo entries")
        
        # Check neno structure if any exist
        if data["neno_list"]:
            neno = data["neno_list"][0]
            assert "neno_id" in neno
            assert "verse_reference" in neno
            assert "leader_id" in neno
            assert "word_date" in neno
            print(f"First neno: {neno.get('verse_reference')} - {neno.get('word_date')}")
    
    def test_get_neno_with_status_filter(self):
        """Test GET /api/neno-la-leo/admin/neno?status=active - Filter by status"""
        response = requests.get(f"{API}/neno-la-leo/admin/neno?status=active")
        print(f"GET /api/neno-la-leo/admin/neno?status=active: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "neno_list" in data
        
        # All returned entries should be active
        for neno in data["neno_list"]:
            assert neno.get("is_active") == True
        print(f"Found {data['total']} active Neno entries")
    
    def test_create_leader(self):
        """Test POST /api/neno-la-leo/admin/leaders - Create a new leader"""
        import uuid
        unique_email = f"test_leader_{uuid.uuid4().hex[:8]}@test.com"
        
        payload = {
            "name": "Test Leader",
            "title": "Pastor",
            "email": unique_email,
            "phone": "+255123456789",
            "bio": "Test bio for automated testing",
            "church_or_organization": "Test Church"
        }
        
        response = requests.post(f"{API}/neno-la-leo/admin/leaders", json=payload)
        print(f"POST /api/neno-la-leo/admin/leaders: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "leader" in data
        assert "temporary_password" in data
        
        leader = data["leader"]
        assert leader["name"] == "Test Leader"
        assert leader["title"] == "Pastor"
        assert leader["email"] == unique_email
        assert leader["is_active"] == True
        assert leader["is_approved"] == True  # Admin-created leaders are auto-approved
        
        print(f"Created leader: {leader['leader_id']}")
        print(f"Temporary password: {data['temporary_password']}")
        
        # Store for cleanup
        return leader["leader_id"]
    
    def test_create_leader_duplicate_email(self):
        """Test POST /api/neno-la-leo/admin/leaders - Duplicate email should fail"""
        payload = {
            "name": "Duplicate Test",
            "title": "Pastor",
            "email": TEST_LEADER_EMAIL,  # Existing email
            "church_or_organization": "Test Church"
        }
        
        response = requests.post(f"{API}/neno-la-leo/admin/leaders", json=payload)
        print(f"POST /api/neno-la-leo/admin/leaders (duplicate): {response.status_code}")
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "already registered" in data["detail"].lower()


class TestNenoLaLeoLeaderPortal:
    """Leader portal authentication and content management"""
    
    def test_leader_login_success(self):
        """Test POST /api/neno-la-leo/leader/login - Successful login"""
        payload = {
            "email": TEST_LEADER_EMAIL,
            "password": TEST_LEADER_PASSWORD
        }
        
        response = requests.post(f"{API}/neno-la-leo/leader/login", json=payload)
        print(f"POST /api/neno-la-leo/leader/login: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "token" in data
        assert "leader" in data
        
        leader = data["leader"]
        assert leader["email"] == TEST_LEADER_EMAIL
        assert "leader_id" in leader
        assert "name" in leader
        assert "title" in leader
        
        print(f"Logged in as: {leader.get('title')} {leader.get('name')}")
        print(f"Token received: {data['token'][:20]}...")
        
        return data["token"]
    
    def test_leader_login_invalid_credentials(self):
        """Test POST /api/neno-la-leo/leader/login - Invalid credentials"""
        payload = {
            "email": TEST_LEADER_EMAIL,
            "password": "wrongpassword"
        }
        
        response = requests.post(f"{API}/neno-la-leo/leader/login", json=payload)
        print(f"POST /api/neno-la-leo/leader/login (invalid): {response.status_code}")
        
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "invalid" in data["detail"].lower()
    
    def test_leader_login_nonexistent_email(self):
        """Test POST /api/neno-la-leo/leader/login - Non-existent email"""
        payload = {
            "email": "nonexistent@test.com",
            "password": "anypassword"
        }
        
        response = requests.post(f"{API}/neno-la-leo/leader/login", json=payload)
        print(f"POST /api/neno-la-leo/leader/login (nonexistent): {response.status_code}")
        
        assert response.status_code == 401
    
    def test_leader_get_profile(self):
        """Test GET /api/neno-la-leo/leader/me - Get leader profile"""
        # First login to get token
        login_response = requests.post(f"{API}/neno-la-leo/leader/login", json={
            "email": TEST_LEADER_EMAIL,
            "password": TEST_LEADER_PASSWORD
        })
        token = login_response.json()["token"]
        
        # Get profile
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API}/neno-la-leo/leader/me", headers=headers)
        print(f"GET /api/neno-la-leo/leader/me: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "leader_id" in data
        assert "name" in data
        assert "email" in data
        assert data["email"] == TEST_LEADER_EMAIL
        print(f"Profile: {data.get('title')} {data.get('name')}")
    
    def test_leader_get_profile_unauthorized(self):
        """Test GET /api/neno-la-leo/leader/me - Without token"""
        response = requests.get(f"{API}/neno-la-leo/leader/me")
        print(f"GET /api/neno-la-leo/leader/me (no auth): {response.status_code}")
        
        assert response.status_code == 401
    
    def test_leader_get_my_neno(self):
        """Test GET /api/neno-la-leo/leader/my-neno - Get leader's Neno entries"""
        # First login to get token
        login_response = requests.post(f"{API}/neno-la-leo/leader/login", json={
            "email": TEST_LEADER_EMAIL,
            "password": TEST_LEADER_PASSWORD
        })
        token = login_response.json()["token"]
        
        # Get my neno
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API}/neno-la-leo/leader/my-neno", headers=headers)
        print(f"GET /api/neno-la-leo/leader/my-neno: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "neno_list" in data
        assert "total" in data
        print(f"Leader has {data['total']} Neno entries")
    
    def test_leader_get_analytics(self):
        """Test GET /api/neno-la-leo/leader/analytics - Get leader analytics"""
        # First login to get token
        login_response = requests.post(f"{API}/neno-la-leo/leader/login", json={
            "email": TEST_LEADER_EMAIL,
            "password": TEST_LEADER_PASSWORD
        })
        token = login_response.json()["token"]
        
        # Get analytics
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API}/neno-la-leo/leader/analytics", headers=headers)
        print(f"GET /api/neno-la-leo/leader/analytics: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "total_neno" in data
        assert "active_neno" in data
        assert "total_reading_plays" in data
        assert "total_reflection_plays" in data
        assert "total_plays" in data
        print(f"Analytics: {data['total_neno']} total, {data['total_plays']} plays")


class TestNenoLaLeoUserEndpoints:
    """User-facing endpoints for Neno la Leo"""
    
    def test_get_active_neno(self):
        """Test GET /api/neno-la-leo/active - Get active Neno for users"""
        response = requests.get(f"{API}/neno-la-leo/active")
        print(f"GET /api/neno-la-leo/active: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "neno_list" in data
        assert "total" in data
        assert isinstance(data["neno_list"], list)
        print(f"Found {data['total']} active Neno entries for users")
        
        # Check neno structure with leader info
        if data["neno_list"]:
            neno = data["neno_list"][0]
            assert "neno_id" in neno
            assert "verse_reference" in neno
            assert "leader" in neno
            assert "display_date" in neno
            assert "leader_display" in neno
            
            leader = neno["leader"]
            if leader:
                assert "name" in leader
                assert "title" in leader
            
            print(f"First active neno: {neno.get('verse_reference')} by {neno.get('leader_display')}")
    
    def test_track_play_count(self):
        """Test POST /api/neno-la-leo/play - Track play count"""
        # First get an active neno
        active_response = requests.get(f"{API}/neno-la-leo/active")
        neno_list = active_response.json().get("neno_list", [])
        
        if not neno_list:
            pytest.skip("No active Neno entries to test play tracking")
        
        neno_id = neno_list[0]["neno_id"]
        
        # Track reading play
        payload = {
            "neno_id": neno_id,
            "audio_type": "reading"
        }
        response = requests.post(f"{API}/neno-la-leo/play", json=payload)
        print(f"POST /api/neno-la-leo/play (reading): {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "tracked" in data["message"].lower()
        
        # Track reflection play
        payload["audio_type"] = "reflection"
        response = requests.post(f"{API}/neno-la-leo/play", json=payload)
        print(f"POST /api/neno-la-leo/play (reflection): {response.status_code}")
        
        assert response.status_code == 200
    
    def test_track_play_count_path_version(self):
        """Test POST /api/neno-la-leo/{neno_id}/play - Track play via path"""
        # First get an active neno
        active_response = requests.get(f"{API}/neno-la-leo/active")
        neno_list = active_response.json().get("neno_list", [])
        
        if not neno_list:
            pytest.skip("No active Neno entries to test play tracking")
        
        neno_id = neno_list[0]["neno_id"]
        
        response = requests.post(f"{API}/neno-la-leo/{neno_id}/play?audio_type=reading")
        print(f"POST /api/neno-la-leo/{neno_id}/play: {response.status_code}")
        
        assert response.status_code == 200
    
    def test_get_single_neno(self):
        """Test GET /api/neno-la-leo/{neno_id} - Get single Neno entry"""
        # First get an active neno
        active_response = requests.get(f"{API}/neno-la-leo/active")
        neno_list = active_response.json().get("neno_list", [])
        
        if not neno_list:
            pytest.skip("No active Neno entries to test")
        
        neno_id = neno_list[0]["neno_id"]
        
        response = requests.get(f"{API}/neno-la-leo/{neno_id}")
        print(f"GET /api/neno-la-leo/{neno_id}: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["neno_id"] == neno_id
        assert "verse_reference" in data
        assert "leader" in data
        print(f"Got neno: {data.get('verse_reference')}")
    
    def test_get_nonexistent_neno(self):
        """Test GET /api/neno-la-leo/{neno_id} - Non-existent ID"""
        response = requests.get(f"{API}/neno-la-leo/neno_nonexistent123")
        print(f"GET /api/neno-la-leo/neno_nonexistent123: {response.status_code}")
        
        assert response.status_code == 404


class TestNenoLaLeoContentCreation:
    """Test content creation flows"""
    
    def test_admin_create_neno_entry(self):
        """Test POST /api/neno-la-leo/admin/neno - Create Neno entry"""
        # First get a leader ID
        leaders_response = requests.get(f"{API}/neno-la-leo/admin/leaders")
        leaders = leaders_response.json().get("leaders", [])
        
        if not leaders:
            pytest.skip("No leaders available to create Neno entry")
        
        leader_id = leaders[0]["leader_id"]
        
        from datetime import datetime, timedelta
        today = datetime.now().strftime("%Y-%m-%d")
        
        payload = {
            "leader_id": leader_id,
            "book": "Mathayo",
            "chapter": 5,
            "verse_start": 1,
            "verse_end": 12,
            "word_date": today,
            "publish_date": today,
            "publish_time": "06:00",
            "reading_audio_url": "",
            "reflection_audio_url": "",
            "notes": "Test entry from automated testing"
        }
        
        response = requests.post(f"{API}/neno-la-leo/admin/neno", json=payload)
        print(f"POST /api/neno-la-leo/admin/neno: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "neno" in data
        
        neno = data["neno"]
        assert neno["book"] == "Mathayo"
        assert neno["chapter"] == 5
        assert neno["verse_reference"] == "Mathayo 5:1-12"
        print(f"Created neno: {neno['neno_id']} - {neno['verse_reference']}")
        
        return neno["neno_id"]
    
    def test_leader_create_neno_entry(self):
        """Test POST /api/neno-la-leo/leader/neno - Leader creates Neno entry"""
        # First login to get token
        login_response = requests.post(f"{API}/neno-la-leo/leader/login", json={
            "email": TEST_LEADER_EMAIL,
            "password": TEST_LEADER_PASSWORD
        })
        token = login_response.json()["token"]
        leader = login_response.json()["leader"]
        
        from datetime import datetime
        today = datetime.now().strftime("%Y-%m-%d")
        
        payload = {
            "leader_id": leader["leader_id"],  # Will be overridden by auth
            "book": "Luka",
            "chapter": 2,
            "verse_start": 15,
            "verse_end": 19,
            "word_date": today,
            "publish_date": today,
            "publish_time": "07:00",
            "reading_audio_url": "",
            "reflection_audio_url": "",
            "notes": "Leader-created test entry"
        }
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.post(f"{API}/neno-la-leo/leader/neno", json=payload, headers=headers)
        print(f"POST /api/neno-la-leo/leader/neno: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert "neno" in data
        
        neno = data["neno"]
        assert neno["verse_reference"] == "Luka 2:15-19"
        assert neno["leader_id"] == leader["leader_id"]
        print(f"Leader created neno: {neno['neno_id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
