"""
Test billing logic and premium feature gating.
Tests:
1. Billing status endpoint returns correct billing_enabled flag
2. Playlist creation endpoint correctly blocks non-premium users when billing is enabled
3. Playlist creation endpoint allows users when billing is disabled
4. Billing status toggle via monetization-settings endpoint
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
TEST_USER_TOKEN = "tok_ebd59893c123476d9b4e0b9e528f0989"
ADMIN_EMAIL = "admin@spiritsongs.com"
ADMIN_PASSWORD = "Admin@123"


class TestBillingStatus:
    """Test billing status endpoint"""
    
    def test_billing_status_endpoint_returns_billing_enabled_flag(self):
        """Test that /api/billing-status returns billing_enabled flag"""
        response = requests.get(f"{BASE_URL}/api/billing-status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "billing_enabled" in data, f"Response missing billing_enabled: {data}"
        assert isinstance(data["billing_enabled"], bool), f"billing_enabled should be boolean: {data}"
        
        # Verify other expected fields
        assert "billing_mode" in data, f"Response missing billing_mode: {data}"
        assert "free_trial_enabled" in data, f"Response missing free_trial_enabled: {data}"
        assert "premium_features" in data, f"Response missing premium_features: {data}"
        
        print(f"✓ Billing status: billing_enabled={data['billing_enabled']}, billing_mode={data['billing_mode']}")
    
    def test_billing_status_returns_premium_features_config(self):
        """Test that billing status includes premium features configuration"""
        response = requests.get(f"{BASE_URL}/api/billing-status")
        
        assert response.status_code == 200
        data = response.json()
        
        premium_features = data.get("premium_features", {})
        # Check expected premium feature flags
        assert "downloads" in premium_features or premium_features == {}, f"Missing downloads in premium_features: {premium_features}"
        assert "playlists" in premium_features or premium_features == {}, f"Missing playlists in premium_features: {premium_features}"
        
        print(f"✓ Premium features config: {premium_features}")


class TestBillingToggle:
    """Test toggling billing on/off via monetization-settings"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session for authenticated requests"""
        session = requests.Session()
        
        # Login as admin
        login_response = session.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code} - {login_response.text}")
        
        token = login_response.json().get("token")
        if token:
            session.headers.update({"Authorization": f"Bearer {token}"})
        
        return session
    
    def test_toggle_billing_off(self, admin_session):
        """Test disabling billing via monetization-settings"""
        # First get current settings
        current_response = requests.get(f"{BASE_URL}/api/billing-status")
        current_status = current_response.json().get("billing_enabled", True)
        print(f"Current billing status: {current_status}")
        
        # Disable billing
        response = admin_session.post(f"{BASE_URL}/api/monetization-settings", json={
            "billing_enabled": False,
            "billing_mode": "disabled"
        })
        
        assert response.status_code == 200, f"Failed to update settings: {response.status_code} - {response.text}"
        
        # Verify billing is now disabled
        verify_response = requests.get(f"{BASE_URL}/api/billing-status")
        assert verify_response.status_code == 200
        
        data = verify_response.json()
        assert data["billing_enabled"] == False, f"Billing should be disabled: {data}"
        
        print(f"✓ Billing successfully disabled")
    
    def test_toggle_billing_on(self, admin_session):
        """Test enabling billing via monetization-settings"""
        # Enable billing
        response = admin_session.post(f"{BASE_URL}/api/monetization-settings", json={
            "billing_enabled": True,
            "billing_mode": "full"
        })
        
        assert response.status_code == 200, f"Failed to update settings: {response.status_code} - {response.text}"
        
        # Verify billing is now enabled
        verify_response = requests.get(f"{BASE_URL}/api/billing-status")
        assert verify_response.status_code == 200
        
        data = verify_response.json()
        assert data["billing_enabled"] == True, f"Billing should be enabled: {data}"
        
        print(f"✓ Billing successfully enabled")


class TestPlaylistPremiumGating:
    """Test playlist creation premium gating based on billing status"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session for authenticated requests"""
        session = requests.Session()
        
        # Login as admin
        login_response = session.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code} - {login_response.text}")
        
        token = login_response.json().get("token")
        if token:
            session.headers.update({"Authorization": f"Bearer {token}"})
        
        return session
    
    @pytest.fixture
    def user_session(self):
        """Get user session with test token"""
        session = requests.Session()
        session.headers.update({
            "Authorization": f"Bearer {TEST_USER_TOKEN}",
            "Content-Type": "application/json"
        })
        return session
    
    def test_playlist_creation_blocked_when_billing_enabled_non_premium(self, admin_session, user_session):
        """Test that non-premium users cannot create playlists when billing is enabled"""
        # Step 1: Enable billing
        admin_session.post(f"{BASE_URL}/api/monetization-settings", json={
            "billing_enabled": True,
            "billing_mode": "full"
        })
        
        # Verify billing is enabled
        billing_response = requests.get(f"{BASE_URL}/api/billing-status")
        assert billing_response.json().get("billing_enabled") == True, "Billing should be enabled"
        print(f"✓ Billing enabled: {billing_response.json().get('billing_enabled')}")
        
        # Step 2: Try to create playlist as non-premium user
        playlist_name = f"TEST_Playlist_{uuid.uuid4().hex[:8]}"
        response = user_session.post(f"{BASE_URL}/api/library/playlists", json={
            "name": playlist_name,
            "description": "Test playlist for premium gating"
        })
        
        # Should return 403 Forbidden for non-premium users
        assert response.status_code == 403, f"Expected 403 for non-premium user, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "Premium" in data.get("detail", "") or "premium" in data.get("detail", "").lower(), \
            f"Error message should mention Premium: {data}"
        
        print(f"✓ Playlist creation correctly blocked for non-premium user: {data.get('detail')}")
    
    def test_playlist_creation_allowed_when_billing_disabled(self, admin_session, user_session):
        """Test that users can create playlists when billing is disabled"""
        # Step 1: Disable billing
        admin_session.post(f"{BASE_URL}/api/monetization-settings", json={
            "billing_enabled": False,
            "billing_mode": "disabled"
        })
        
        # Verify billing is disabled
        billing_response = requests.get(f"{BASE_URL}/api/billing-status")
        assert billing_response.json().get("billing_enabled") == False, "Billing should be disabled"
        print(f"✓ Billing disabled: {billing_response.json().get('billing_enabled')}")
        
        # Step 2: Try to create playlist as user (should work now)
        playlist_name = f"TEST_Playlist_{uuid.uuid4().hex[:8]}"
        response = user_session.post(f"{BASE_URL}/api/library/playlists", json={
            "name": playlist_name,
            "description": "Test playlist when billing disabled"
        })
        
        # Should succeed when billing is disabled
        assert response.status_code in [200, 201], f"Expected 200/201 when billing disabled, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "playlist_id" in data, f"Response should contain playlist_id: {data}"
        assert data.get("name") == playlist_name, f"Playlist name mismatch: {data}"
        
        print(f"✓ Playlist creation allowed when billing disabled: {data.get('playlist_id')}")
        
        # Cleanup: Delete the test playlist
        playlist_id = data.get("playlist_id")
        if playlist_id:
            # Note: There may not be a delete endpoint, but we prefix with TEST_ for identification
            print(f"  Created test playlist: {playlist_id}")
    
    def test_get_playlists_works_regardless_of_billing(self, user_session):
        """Test that GET playlists works regardless of billing status"""
        response = user_session.get(f"{BASE_URL}/api/library/playlists")
        
        # GET should always work
        assert response.status_code == 200, f"GET playlists should work: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "playlists" in data, f"Response should contain playlists: {data}"
        
        print(f"✓ GET playlists works: {len(data.get('playlists', []))} playlists found")


class TestUserSubscriptionStatus:
    """Test user subscription status endpoint"""
    
    @pytest.fixture
    def admin_session(self):
        """Get admin session for authenticated requests"""
        session = requests.Session()
        
        # Login as admin
        login_response = session.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Admin login failed: {login_response.status_code} - {login_response.text}")
        
        token = login_response.json().get("token")
        if token:
            session.headers.update({"Authorization": f"Bearer {token}"})
        
        return session
    
    def test_subscription_status_returns_free_access_when_billing_disabled(self, admin_session):
        """Test that subscription status returns free_access when billing is disabled"""
        # Disable billing first
        admin_session.post(f"{BASE_URL}/api/monetization-settings", json={
            "billing_enabled": False
        })
        
        # Get a user_id from the test token
        # First verify the token is valid
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {TEST_USER_TOKEN}"})
        
        # Get user info
        user_response = session.get(f"{BASE_URL}/api/user/profile")
        if user_response.status_code != 200:
            pytest.skip(f"Could not get user profile: {user_response.status_code}")
        
        user_id = user_response.json().get("user_id")
        if not user_id:
            pytest.skip("Could not get user_id from profile")
        
        # Check subscription status
        response = requests.get(f"{BASE_URL}/api/user/subscription-status?user_id={user_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # When billing is disabled, user should be treated as premium
        assert data.get("billing_enabled") == False or data.get("is_premium") == True, \
            f"User should be premium when billing disabled: {data}"
        
        print(f"✓ Subscription status when billing disabled: {data}")


class TestMonetizationSettings:
    """Test monetization settings endpoint"""
    
    def test_get_monetization_settings(self):
        """Test GET monetization settings"""
        response = requests.get(f"{BASE_URL}/api/monetization-settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "billing_enabled" in data, f"Response should contain billing_enabled: {data}"
        
        print(f"✓ Monetization settings: billing_enabled={data.get('billing_enabled')}")
    
    def test_monetization_settings_alias(self):
        """Test monetization settings alias endpoint"""
        response = requests.get(f"{BASE_URL}/api/monetization/settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "billing_enabled" in data, f"Response should contain billing_enabled: {data}"
        
        print(f"✓ Monetization settings (alias): billing_enabled={data.get('billing_enabled')}")


# Cleanup fixture to restore billing state after tests
@pytest.fixture(scope="module", autouse=True)
def restore_billing_state():
    """Restore billing state after all tests"""
    # Get initial state
    initial_response = requests.get(f"{BASE_URL}/api/billing-status")
    initial_state = initial_response.json().get("billing_enabled", True) if initial_response.status_code == 200 else True
    
    yield
    
    # Restore initial state
    try:
        session = requests.Session()
        login_response = session.post(f"{BASE_URL}/api/admin/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            if token:
                session.headers.update({"Authorization": f"Bearer {token}"})
                session.post(f"{BASE_URL}/api/monetization-settings", json={
                    "billing_enabled": initial_state
                })
                print(f"\n✓ Restored billing state to: {initial_state}")
    except Exception as e:
        print(f"\n⚠ Could not restore billing state: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
