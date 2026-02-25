"""
Test Admin Users Management Endpoints
Tests for /api/admin/users endpoints that manage app_users collection (mobile app customers)

Endpoints tested:
- GET /api/admin/users - List users with pagination and filters
- GET /api/admin/users/stats/summary - User statistics summary
- GET /api/admin/users/{user_id} - User detail
- GET /api/admin/users/{user_id}/listening-history - User listening history
- GET /api/admin/users/{user_id}/transactions - User transactions
- POST /api/admin/users - Create new user
- PUT /api/admin/users/{user_id} - Update user
- DELETE /api/admin/users/{user_id} - Delete user
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get backend URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://catholic-streaming.preview.emergentagent.com"

# Test data prefix for cleanup
TEST_PREFIX = "TEST_admin_user_"


class TestAdminUsersStats:
    """Test user statistics endpoint"""
    
    def test_get_users_stats_summary(self):
        """GET /api/admin/users/stats/summary - Returns user statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/users/stats/summary")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "total" in data, "Missing 'total' field"
        assert "active" in data, "Missing 'active' field"
        assert "suspended" in data, "Missing 'suspended' field"
        assert "premium" in data, "Missing 'premium' field"
        assert "free" in data, "Missing 'free' field"
        assert "trial_active" in data, "Missing 'trial_active' field"
        
        # Verify data types
        assert isinstance(data["total"], int), "total should be integer"
        assert isinstance(data["active"], int), "active should be integer"
        assert isinstance(data["premium"], int), "premium should be integer"
        assert isinstance(data["free"], int), "free should be integer"
        
        # Verify by_registration breakdown
        assert "by_registration" in data, "Missing 'by_registration' field"
        by_reg = data["by_registration"]
        assert "phone" in by_reg, "Missing phone registration count"
        assert "email" in by_reg, "Missing email registration count"
        assert "google" in by_reg, "Missing google registration count"
        
        print(f"✓ Stats summary: total={data['total']}, active={data['active']}, premium={data['premium']}, free={data['free']}")


class TestAdminUsersList:
    """Test users list endpoint with filters"""
    
    def test_get_users_list_basic(self):
        """GET /api/admin/users - Returns paginated users list"""
        response = requests.get(f"{BASE_URL}/api/admin/users")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify pagination fields
        assert "users" in data, "Missing 'users' field"
        assert "total" in data, "Missing 'total' field"
        assert "page" in data, "Missing 'page' field"
        assert "limit" in data, "Missing 'limit' field"
        
        assert isinstance(data["users"], list), "users should be a list"
        assert isinstance(data["total"], int), "total should be integer"
        
        print(f"✓ Users list: {len(data['users'])} users returned, total={data['total']}")
    
    def test_get_users_with_pagination(self):
        """GET /api/admin/users with page and limit params"""
        response = requests.get(f"{BASE_URL}/api/admin/users", params={"page": 1, "limit": 5})
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == 5
        assert len(data["users"]) <= 5, "Should return at most 5 users"
        
        print(f"✓ Pagination: page={data['page']}, limit={data['limit']}, returned={len(data['users'])}")
    
    def test_get_users_with_search_filter(self):
        """GET /api/admin/users with search filter"""
        # First create a test user to search for
        test_email = f"{TEST_PREFIX}search_{uuid.uuid4().hex[:8]}@test.com"
        create_response = requests.post(f"{BASE_URL}/api/admin/users", json={
            "email": test_email,
            "name": f"{TEST_PREFIX}SearchUser",
            "membership_type": "free",
            "status": "active"
        })
        
        if create_response.status_code == 201:
            user_id = create_response.json().get("user_id")
            
            # Search for the user
            response = requests.get(f"{BASE_URL}/api/admin/users", params={"search": TEST_PREFIX})
            
            assert response.status_code == 200
            data = response.json()
            
            # Should find at least our test user
            assert data["total"] >= 1, "Search should find at least one user"
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/admin/users/{user_id}")
            
            print(f"✓ Search filter: found {data['total']} users matching '{TEST_PREFIX}'")
        else:
            print(f"⚠ Could not create test user for search test: {create_response.text}")
    
    def test_get_users_with_membership_type_filter_free(self):
        """GET /api/admin/users with membership_type=free filter"""
        response = requests.get(f"{BASE_URL}/api/admin/users", params={"membership_type": "free"})
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify all returned users are free tier
        for user in data["users"]:
            membership = user.get("membership_type") or user.get("subscription_tier")
            assert membership in ["free", None], f"Expected free membership, got {membership}"
        
        print(f"✓ Membership filter (free): {data['total']} free users")
    
    def test_get_users_with_membership_type_filter_premium(self):
        """GET /api/admin/users with membership_type=premium filter"""
        response = requests.get(f"{BASE_URL}/api/admin/users", params={"membership_type": "premium"})
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify all returned users are premium tier
        for user in data["users"]:
            membership = user.get("membership_type") or user.get("subscription_tier")
            assert membership == "premium", f"Expected premium membership, got {membership}"
        
        print(f"✓ Membership filter (premium): {data['total']} premium users")
    
    def test_get_users_with_membership_type_filter_vip(self):
        """GET /api/admin/users with membership_type=vip filter"""
        response = requests.get(f"{BASE_URL}/api/admin/users", params={"membership_type": "vip"})
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify all returned users are VIP tier
        for user in data["users"]:
            membership = user.get("membership_type") or user.get("subscription_tier")
            assert membership == "vip", f"Expected vip membership, got {membership}"
        
        print(f"✓ Membership filter (vip): {data['total']} VIP users")
    
    def test_get_users_with_status_filter_active(self):
        """GET /api/admin/users with status=active filter"""
        response = requests.get(f"{BASE_URL}/api/admin/users", params={"status": "active"})
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify all returned users are active
        for user in data["users"]:
            assert user.get("status") == "active", f"Expected active status, got {user.get('status')}"
        
        print(f"✓ Status filter (active): {data['total']} active users")
    
    def test_get_users_with_status_filter_suspended(self):
        """GET /api/admin/users with status=suspended filter"""
        response = requests.get(f"{BASE_URL}/api/admin/users", params={"status": "suspended"})
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify all returned users are suspended
        for user in data["users"]:
            assert user.get("status") == "suspended", f"Expected suspended status, got {user.get('status')}"
        
        print(f"✓ Status filter (suspended): {data['total']} suspended users")


class TestAdminUserCRUD:
    """Test CRUD operations for admin users"""
    
    def test_create_user_success(self):
        """POST /api/admin/users - Create new user with email"""
        test_email = f"{TEST_PREFIX}create_{uuid.uuid4().hex[:8]}@test.com"
        
        response = requests.post(f"{BASE_URL}/api/admin/users", json={
            "email": test_email,
            "name": f"{TEST_PREFIX}CreateUser",
            "membership_type": "free",
            "status": "active",
            "country": "Tanzania"
        })
        
        # API returns 200 for successful creation
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Missing user_id in response"
        assert "message" in data, "Missing message in response"
        
        user_id = data["user_id"]
        
        # Verify user was created by fetching it
        get_response = requests.get(f"{BASE_URL}/api/admin/users/{user_id}")
        assert get_response.status_code == 200, "Created user should be retrievable"
        
        user_data = get_response.json()
        assert user_data["email"] == test_email
        assert user_data["name"] == f"{TEST_PREFIX}CreateUser"
        assert user_data["country"] == "Tanzania"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}")
        
        print(f"✓ Create user: user_id={user_id}")
    
    def test_create_user_with_phone(self):
        """POST /api/admin/users - Create new user with phone"""
        test_phone = f"+255{uuid.uuid4().hex[:9]}"
        
        response = requests.post(f"{BASE_URL}/api/admin/users", json={
            "phone": test_phone,
            "name": f"{TEST_PREFIX}PhoneUser",
            "membership_type": "premium",
            "status": "active"
        })
        
        # API returns 200 for successful creation
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        data = response.json()
        user_id = data["user_id"]
        
        # Verify user was created
        get_response = requests.get(f"{BASE_URL}/api/admin/users/{user_id}")
        assert get_response.status_code == 200
        
        user_data = get_response.json()
        assert user_data["phone"] == test_phone
        assert user_data["membership_type"] == "premium"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}")
        
        print(f"✓ Create user with phone: user_id={user_id}")
    
    def test_create_user_missing_email_and_phone(self):
        """POST /api/admin/users - Returns 400 when both email and phone missing"""
        response = requests.post(f"{BASE_URL}/api/admin/users", json={
            "name": f"{TEST_PREFIX}NoContact",
            "membership_type": "free"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        print("✓ Create user without email/phone returns 400")
    
    def test_create_user_duplicate_email(self):
        """POST /api/admin/users - Returns 400 for duplicate email"""
        test_email = f"{TEST_PREFIX}dup_{uuid.uuid4().hex[:8]}@test.com"
        
        # Create first user
        response1 = requests.post(f"{BASE_URL}/api/admin/users", json={
            "email": test_email,
            "name": f"{TEST_PREFIX}DupUser1"
        })
        
        if response1.status_code in [200, 201]:
            user_id = response1.json()["user_id"]
            
            # Try to create duplicate
            response2 = requests.post(f"{BASE_URL}/api/admin/users", json={
                "email": test_email,
                "name": f"{TEST_PREFIX}DupUser2"
            })
            
            assert response2.status_code == 400, f"Expected 400 for duplicate, got {response2.status_code}"
            
            # Cleanup
            requests.delete(f"{BASE_URL}/api/admin/users/{user_id}")
            
            print("✓ Duplicate email returns 400")
    
    def test_get_user_detail(self):
        """GET /api/admin/users/{user_id} - Returns user detail"""
        # Create a test user first
        test_email = f"{TEST_PREFIX}detail_{uuid.uuid4().hex[:8]}@test.com"
        
        create_response = requests.post(f"{BASE_URL}/api/admin/users", json={
            "email": test_email,
            "name": f"{TEST_PREFIX}DetailUser",
            "membership_type": "premium",
            "status": "active",
            "country": "Kenya"
        })
        
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        user_id = create_response.json()["user_id"]
        
        # Get user detail
        response = requests.get(f"{BASE_URL}/api/admin/users/{user_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify all expected fields
        assert data["user_id"] == user_id
        assert data["email"] == test_email
        assert data["name"] == f"{TEST_PREFIX}DetailUser"
        assert data["membership_type"] == "premium"
        assert data["status"] == "active"
        assert data["country"] == "Kenya"
        
        # Verify additional fields exist
        assert "created_at" in data
        assert "devices" in data
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}")
        
        print(f"✓ Get user detail: user_id={user_id}")
    
    def test_get_user_detail_not_found(self):
        """GET /api/admin/users/{user_id} - Returns 404 for non-existent user"""
        response = requests.get(f"{BASE_URL}/api/admin/users/nonexistent_user_12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ Get non-existent user returns 404")
    
    def test_update_user(self):
        """PUT /api/admin/users/{user_id} - Update user details"""
        # Create a test user first
        test_email = f"{TEST_PREFIX}update_{uuid.uuid4().hex[:8]}@test.com"
        
        create_response = requests.post(f"{BASE_URL}/api/admin/users", json={
            "email": test_email,
            "name": f"{TEST_PREFIX}UpdateUser",
            "membership_type": "free",
            "status": "active"
        })
        
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        user_id = create_response.json()["user_id"]
        
        # Update user
        update_response = requests.put(f"{BASE_URL}/api/admin/users/{user_id}", json={
            "name": f"{TEST_PREFIX}UpdatedName",
            "membership_type": "premium",
            "status": "suspended",
            "country": "Uganda"
        })
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        # Verify update by fetching user
        get_response = requests.get(f"{BASE_URL}/api/admin/users/{user_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert data["name"] == f"{TEST_PREFIX}UpdatedName"
        assert data["membership_type"] == "premium"
        assert data["status"] == "suspended"
        assert data["country"] == "Uganda"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}")
        
        print(f"✓ Update user: user_id={user_id}")
    
    def test_update_user_not_found(self):
        """PUT /api/admin/users/{user_id} - Returns 404 for non-existent user"""
        response = requests.put(f"{BASE_URL}/api/admin/users/nonexistent_user_12345", json={
            "name": "Test"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ Update non-existent user returns 404")
    
    def test_delete_user(self):
        """DELETE /api/admin/users/{user_id} - Delete user"""
        # Create a test user first
        test_email = f"{TEST_PREFIX}delete_{uuid.uuid4().hex[:8]}@test.com"
        
        create_response = requests.post(f"{BASE_URL}/api/admin/users", json={
            "email": test_email,
            "name": f"{TEST_PREFIX}DeleteUser"
        })
        
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        user_id = create_response.json()["user_id"]
        
        # Delete user
        delete_response = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify user is deleted
        get_response = requests.get(f"{BASE_URL}/api/admin/users/{user_id}")
        assert get_response.status_code == 404, "Deleted user should return 404"
        
        print(f"✓ Delete user: user_id={user_id}")
    
    def test_delete_user_not_found(self):
        """DELETE /api/admin/users/{user_id} - Returns 404 for non-existent user"""
        response = requests.delete(f"{BASE_URL}/api/admin/users/nonexistent_user_12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ Delete non-existent user returns 404")


class TestAdminUserHistory:
    """Test user listening history and transactions endpoints"""
    
    def test_get_user_listening_history(self):
        """GET /api/admin/users/{user_id}/listening-history - Returns listening history"""
        # Create a test user
        test_email = f"{TEST_PREFIX}history_{uuid.uuid4().hex[:8]}@test.com"
        
        create_response = requests.post(f"{BASE_URL}/api/admin/users", json={
            "email": test_email,
            "name": f"{TEST_PREFIX}HistoryUser"
        })
        
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        user_id = create_response.json()["user_id"]
        
        # Get listening history
        response = requests.get(f"{BASE_URL}/api/admin/users/{user_id}/listening-history")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "history" in data, "Missing 'history' field"
        assert "total" in data, "Missing 'total' field"
        assert isinstance(data["history"], list), "history should be a list"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}")
        
        print(f"✓ Get listening history: {data['total']} records")
    
    def test_get_user_transactions(self):
        """GET /api/admin/users/{user_id}/transactions - Returns transactions"""
        # Create a test user
        test_email = f"{TEST_PREFIX}trans_{uuid.uuid4().hex[:8]}@test.com"
        
        create_response = requests.post(f"{BASE_URL}/api/admin/users", json={
            "email": test_email,
            "name": f"{TEST_PREFIX}TransUser"
        })
        
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        user_id = create_response.json()["user_id"]
        
        # Get transactions
        response = requests.get(f"{BASE_URL}/api/admin/users/{user_id}/transactions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "transactions" in data, "Missing 'transactions' field"
        assert "total" in data, "Missing 'total' field"
        assert isinstance(data["transactions"], list), "transactions should be a list"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{user_id}")
        
        print(f"✓ Get transactions: {data['total']} records")


class TestExistingUserData:
    """Test with existing user data mentioned in the request"""
    
    def test_get_existing_user_by_id_pattern(self):
        """Test fetching user with user_id pattern like user_3b129582f1f4"""
        # Get users list to find an existing user
        response = requests.get(f"{BASE_URL}/api/admin/users", params={"limit": 1})
        
        assert response.status_code == 200
        
        data = response.json()
        
        if data["total"] > 0 and len(data["users"]) > 0:
            existing_user = data["users"][0]
            user_id = existing_user.get("user_id")
            
            if user_id:
                # Fetch this user's detail
                detail_response = requests.get(f"{BASE_URL}/api/admin/users/{user_id}")
                assert detail_response.status_code == 200
                
                detail_data = detail_response.json()
                assert detail_data["user_id"] == user_id
                
                print(f"✓ Fetched existing user: {user_id}")
            else:
                print("⚠ No user_id found in existing user data")
        else:
            print("⚠ No existing users in database to test")


@pytest.fixture(scope="module", autouse=True)
def cleanup_test_users():
    """Cleanup test users after all tests complete"""
    yield
    
    # Cleanup: Delete all test-created users
    try:
        response = requests.get(f"{BASE_URL}/api/admin/users", params={"search": TEST_PREFIX, "limit": 100})
        if response.status_code == 200:
            users = response.json().get("users", [])
            for user in users:
                user_id = user.get("user_id")
                if user_id:
                    requests.delete(f"{BASE_URL}/api/admin/users/{user_id}")
            print(f"Cleaned up {len(users)} test users")
    except Exception as e:
        print(f"Cleanup error: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
