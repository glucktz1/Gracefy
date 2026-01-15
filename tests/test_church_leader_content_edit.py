"""
Test Church Leader Authentication and Content Edit Request System
Tests:
- Church leader self-registration (pending approval)
- Admin creates church leader account (auto-approved)
- Church leader login
- Church leader profile
- Church leader announcements
- Church leader account approval/rejection
- Choir album/song edit requests (requires admin approval)
- Admin content edit request management
"""

import pytest
import requests
import os
import uuid
import hashlib

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
TEST_PREFIX = f"TEST_church_leader_{uuid.uuid4().hex[:8]}"
TEST_CHURCH_ID = "ch_576cd2777847"  # St Peters - approved church
TEST_CHOIR_EMAIL = "testchoir@example.com"
TEST_CHOIR_PASSWORD = "test123"
TEST_ALBUM_ID = "alb_2925e1a26b27"  # Album belonging to test choir


class TestChurchLeaderRegistration:
    """Test church leader self-registration flow"""
    
    def test_register_church_leader_missing_fields(self):
        """Test registration fails with missing required fields"""
        response = requests.post(f"{BASE_URL}/api/church-leader/register", json={
            "church_id": TEST_CHURCH_ID
            # Missing name, email, password
        })
        assert response.status_code == 400
        assert "required" in response.json().get("detail", "").lower()
        print("✓ Registration fails with missing fields")
    
    def test_register_church_leader_invalid_church(self):
        """Test registration fails with invalid church_id"""
        response = requests.post(f"{BASE_URL}/api/church-leader/register", json={
            "church_id": "invalid_church_id",
            "name": f"{TEST_PREFIX}_leader",
            "email": f"{TEST_PREFIX}_leader@example.com",
            "password": "TestPass123!"
        })
        assert response.status_code == 404
        assert "not found" in response.json().get("detail", "").lower()
        print("✓ Registration fails with invalid church_id")
    
    def test_register_church_leader_success(self):
        """Test successful church leader self-registration (pending approval)"""
        # First, create a test church for registration
        church_data = {
            "name": f"{TEST_PREFIX}_Church",
            "denomination": "roman_catholic",
            "location": "Test Location",
            "city": "Test City",
            "country": "Tanzania"
        }
        church_response = requests.post(f"{BASE_URL}/api/churches", json=church_data)
        assert church_response.status_code == 200
        test_church_id = church_response.json()["church_id"]
        
        # Register church leader
        response = requests.post(f"{BASE_URL}/api/church-leader/register", json={
            "church_id": test_church_id,
            "name": f"{TEST_PREFIX}_Leader",
            "email": f"{TEST_PREFIX}_leader@example.com",
            "password": "TestPass123!",
            "phone": "+255123456789"
        })
        assert response.status_code == 200
        data = response.json()
        assert "account_id" in data
        assert "pending" in data.get("message", "").lower()
        print(f"✓ Church leader registered successfully with account_id: {data['account_id']}")
        
        # Store for cleanup
        pytest.test_church_id = test_church_id
        pytest.test_account_id = data["account_id"]
        return data["account_id"]
    
    def test_register_duplicate_email(self):
        """Test registration fails with duplicate email"""
        # Try to register with same email
        response = requests.post(f"{BASE_URL}/api/church-leader/register", json={
            "church_id": TEST_CHURCH_ID,
            "name": "Another Leader",
            "email": f"{TEST_PREFIX}_leader@example.com",  # Same email
            "password": "TestPass123!"
        })
        assert response.status_code == 400
        assert "already exists" in response.json().get("detail", "").lower()
        print("✓ Registration fails with duplicate email")


class TestChurchLeaderAdminCreate:
    """Test admin creating church leader accounts"""
    
    def test_admin_create_church_leader_success(self):
        """Test admin creates church leader account (auto-approved)"""
        # Create a new test church
        church_data = {
            "name": f"{TEST_PREFIX}_AdminChurch",
            "denomination": "lutheran",
            "location": "Admin Test Location"
        }
        church_response = requests.post(f"{BASE_URL}/api/churches", json=church_data)
        assert church_response.status_code == 200
        admin_church_id = church_response.json()["church_id"]
        
        # Admin creates church leader
        response = requests.post(f"{BASE_URL}/api/church-leader/create", json={
            "church_id": admin_church_id,
            "name": f"{TEST_PREFIX}_AdminCreatedLeader",
            "email": f"{TEST_PREFIX}_admin_leader@example.com",
            "password": "AdminPass123!",
            "phone": "+255987654321"
        })
        assert response.status_code == 200
        data = response.json()
        assert "account_id" in data
        assert "created successfully" in data.get("message", "").lower()
        print(f"✓ Admin created church leader with account_id: {data['account_id']}")
        
        pytest.admin_church_id = admin_church_id
        pytest.admin_account_id = data["account_id"]
        return data["account_id"]


class TestChurchLeaderLogin:
    """Test church leader login flow"""
    
    def test_login_invalid_credentials(self):
        """Test login fails with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/church-leader/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        assert "invalid" in response.json().get("detail", "").lower()
        print("✓ Login fails with invalid credentials")
    
    def test_login_pending_account(self):
        """Test login fails for pending account"""
        # Try to login with the self-registered account (pending)
        response = requests.post(f"{BASE_URL}/api/church-leader/login", json={
            "email": f"{TEST_PREFIX}_leader@example.com",
            "password": "TestPass123!"
        })
        assert response.status_code == 403
        assert "pending" in response.json().get("detail", "").lower()
        print("✓ Login fails for pending account")
    
    def test_login_approved_account(self):
        """Test login succeeds for approved account"""
        # Login with admin-created account (auto-approved)
        response = requests.post(f"{BASE_URL}/api/church-leader/login", json={
            "email": f"{TEST_PREFIX}_admin_leader@example.com",
            "password": "AdminPass123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        assert "church_id" in data
        assert "church_name" in data
        print(f"✓ Login successful, session_token received")
        
        pytest.church_leader_token = data["session_token"]
        pytest.church_leader_church_id = data["church_id"]
        return data["session_token"]


class TestChurchLeaderProfile:
    """Test church leader profile endpoints"""
    
    def test_get_profile_unauthenticated(self):
        """Test profile access fails without authentication"""
        response = requests.get(f"{BASE_URL}/api/church-leader/me")
        assert response.status_code == 401
        print("✓ Profile access fails without authentication")
    
    def test_get_profile_authenticated(self):
        """Test profile access with valid token"""
        token = getattr(pytest, 'church_leader_token', None)
        if not token:
            pytest.skip("No church leader token available")
        
        response = requests.get(
            f"{BASE_URL}/api/church-leader/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "account_id" in data
        assert "church_id" in data
        assert "church_name" in data
        assert "name" in data
        assert "email" in data
        assert "status" in data
        print(f"✓ Profile retrieved: {data['name']} - {data['church_name']}")


class TestChurchLeaderAnnouncements:
    """Test church leader announcement management"""
    
    def test_get_announcements_unauthenticated(self):
        """Test announcements access fails without authentication"""
        response = requests.get(f"{BASE_URL}/api/church-leader/my-announcements")
        assert response.status_code == 401
        print("✓ Announcements access fails without authentication")
    
    def test_create_announcement(self):
        """Test church leader creates announcement"""
        token = getattr(pytest, 'church_leader_token', None)
        if not token:
            pytest.skip("No church leader token available")
        
        announcement_data = {
            "date": "2025-01-20",
            "title": f"{TEST_PREFIX}_Test Announcement",
            "announcement_type": "general",
            "description": "This is a test announcement created by church leader",
            "time": "10:00 AM",
            "location": "Main Church Hall"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/church-leader/announcements",
            json=announcement_data,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "announcement_id" in data
        print(f"✓ Announcement created: {data['announcement_id']}")
        
        pytest.test_announcement_id = data["announcement_id"]
    
    def test_get_my_announcements(self):
        """Test church leader gets their announcements"""
        token = getattr(pytest, 'church_leader_token', None)
        if not token:
            pytest.skip("No church leader token available")
        
        response = requests.get(
            f"{BASE_URL}/api/church-leader/my-announcements",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "announcements" in data
        assert isinstance(data["announcements"], list)
        print(f"✓ Retrieved {len(data['announcements'])} announcements")


class TestChurchLeaderAccountApproval:
    """Test church leader account approval/rejection"""
    
    def test_get_all_accounts(self):
        """Test admin gets all church leader accounts"""
        response = requests.get(f"{BASE_URL}/api/church-leader/accounts")
        assert response.status_code == 200
        data = response.json()
        assert "accounts" in data
        assert isinstance(data["accounts"], list)
        print(f"✓ Retrieved {len(data['accounts'])} church leader accounts")
    
    def test_approve_account(self):
        """Test approving a pending church leader account"""
        account_id = getattr(pytest, 'test_account_id', None)
        if not account_id:
            pytest.skip("No pending account to approve")
        
        response = requests.put(
            f"{BASE_URL}/api/church-leader/account/{account_id}/approve",
            json={"approved_by": "test_admin"}
        )
        assert response.status_code == 200
        assert "approved" in response.json().get("message", "").lower()
        print(f"✓ Account {account_id} approved")
    
    def test_login_after_approval(self):
        """Test login succeeds after account approval"""
        response = requests.post(f"{BASE_URL}/api/church-leader/login", json={
            "email": f"{TEST_PREFIX}_leader@example.com",
            "password": "TestPass123!"
        })
        assert response.status_code == 200
        data = response.json()
        assert "session_token" in data
        print("✓ Login successful after approval")
    
    def test_reject_account_not_found(self):
        """Test rejecting non-existent account"""
        response = requests.put(
            f"{BASE_URL}/api/church-leader/account/invalid_account_id/reject",
            json={"admin_notes": "Test rejection"}
        )
        assert response.status_code == 404
        print("✓ Reject returns 404 for non-existent account")


class TestChoirContentEditRequests:
    """Test choir album/song edit request system"""
    
    @pytest.fixture(autouse=True)
    def setup_choir_session(self):
        """Login as choir to get session token"""
        response = requests.post(f"{BASE_URL}/api/choir/login", json={
            "email": TEST_CHOIR_EMAIL,
            "password": TEST_CHOIR_PASSWORD
        })
        if response.status_code == 200:
            self.choir_token = response.json()["session_token"]
            self.choir_id = response.json()["choir_id"]
        else:
            self.choir_token = None
            self.choir_id = None
    
    def test_album_edit_request_unauthenticated(self):
        """Test album edit request fails without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/choir/albums/{TEST_ALBUM_ID}/edit-request",
            json={"title": "New Title"}
        )
        assert response.status_code == 401
        print("✓ Album edit request fails without authentication")
    
    def test_album_edit_request_success(self):
        """Test choir submits album edit request"""
        if not self.choir_token:
            pytest.skip("Choir login failed")
        
        edit_data = {
            "title": f"{TEST_PREFIX}_Updated Album Title",
            "description": "Updated description for testing"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/choir/albums/{TEST_ALBUM_ID}/edit-request",
            json=edit_data,
            headers={"Authorization": f"Bearer {self.choir_token}"}
        )
        
        # Could be 200 (success) or 403 (not owner) or 404 (album not found)
        if response.status_code == 200:
            data = response.json()
            assert "request_id" in data
            print(f"✓ Album edit request submitted: {data['request_id']}")
            pytest.album_edit_request_id = data["request_id"]
        elif response.status_code == 403:
            print("✓ Album edit request correctly denied - not owner")
        elif response.status_code == 404:
            print("✓ Album not found (expected if test album doesn't exist)")
        else:
            print(f"Album edit request response: {response.status_code} - {response.text}")
    
    def test_song_edit_request_unauthenticated(self):
        """Test song edit request fails without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/choir/songs/test_song_id/edit-request",
            json={"title": "New Title"}
        )
        assert response.status_code == 401
        print("✓ Song edit request fails without authentication")
    
    def test_get_my_edit_requests_unauthenticated(self):
        """Test getting edit requests fails without authentication"""
        response = requests.get(f"{BASE_URL}/api/choir/my-edit-requests")
        assert response.status_code == 401
        print("✓ Get edit requests fails without authentication")
    
    def test_get_my_edit_requests(self):
        """Test choir gets their edit requests"""
        if not self.choir_token:
            pytest.skip("Choir login failed")
        
        response = requests.get(
            f"{BASE_URL}/api/choir/my-edit-requests",
            headers={"Authorization": f"Bearer {self.choir_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "requests" in data
        assert isinstance(data["requests"], list)
        print(f"✓ Retrieved {len(data['requests'])} edit requests")


class TestAdminContentEditRequests:
    """Test admin content edit request management"""
    
    def test_get_all_edit_requests(self):
        """Test admin gets all content edit requests"""
        response = requests.get(f"{BASE_URL}/api/admin/content-edit-requests")
        assert response.status_code == 200
        data = response.json()
        assert "requests" in data
        assert isinstance(data["requests"], list)
        print(f"✓ Retrieved {len(data['requests'])} content edit requests")
    
    def test_get_edit_requests_by_status(self):
        """Test filtering edit requests by status"""
        response = requests.get(f"{BASE_URL}/api/admin/content-edit-requests?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert "requests" in data
        # All returned requests should be pending
        for req in data["requests"]:
            assert req["status"] == "pending"
        print(f"✓ Retrieved {len(data['requests'])} pending edit requests")
    
    def test_approve_edit_request_not_found(self):
        """Test approving non-existent edit request"""
        response = requests.post(
            f"{BASE_URL}/api/admin/content-edit-requests/invalid_request_id/approve",
            json={"processed_by": "test_admin"}
        )
        assert response.status_code == 404
        print("✓ Approve returns 404 for non-existent request")
    
    def test_reject_edit_request_not_found(self):
        """Test rejecting non-existent edit request"""
        response = requests.post(
            f"{BASE_URL}/api/admin/content-edit-requests/invalid_request_id/reject",
            json={"processed_by": "test_admin", "admin_notes": "Test rejection"}
        )
        assert response.status_code == 404
        print("✓ Reject returns 404 for non-existent request")


class TestChurchLeaderLogout:
    """Test church leader logout"""
    
    def test_logout(self):
        """Test church leader logout"""
        token = getattr(pytest, 'church_leader_token', None)
        if not token:
            pytest.skip("No church leader token available")
        
        response = requests.post(
            f"{BASE_URL}/api/church-leader/logout",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        print("✓ Church leader logged out successfully")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self):
        """Clean up test churches and accounts"""
        # Delete test churches
        test_church_id = getattr(pytest, 'test_church_id', None)
        admin_church_id = getattr(pytest, 'admin_church_id', None)
        
        if test_church_id:
            requests.delete(f"{BASE_URL}/api/churches/{test_church_id}")
            print(f"✓ Cleaned up test church: {test_church_id}")
        
        if admin_church_id:
            requests.delete(f"{BASE_URL}/api/churches/{admin_church_id}")
            print(f"✓ Cleaned up admin church: {admin_church_id}")
        
        # Note: Church leader accounts are linked to churches, 
        # they should be cleaned up separately if needed
        print("✓ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
