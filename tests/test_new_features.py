"""
Test new features for Spirit Songs app:
1. Phone OTP Login flow (MOCKED)
2. Admin Settings page - Device limits, billing toggle, login methods toggle, playback rules
3. Layout Manager Hero Banners - Add/edit/delete banners with image upload
4. Repeat feature UI in PWA player
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://worship-mobile.preview.emergentagent.com')

class TestPhoneOTPLogin:
    """Test Phone OTP login flow (MOCKED)"""
    
    def test_send_otp_success(self):
        """Test sending OTP to a phone number"""
        test_phone = "+255123456789"
        response = requests.post(f"{BASE_URL}/api/auth/send-otp", json={
            "phone": test_phone
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "OTP sent successfully"
        assert "phone" in data
        assert data["phone"] == test_phone
        # MOCKED - OTP is returned in dev mode
        assert "otp_dev" in data
        assert len(data["otp_dev"]) == 6
        print(f"✓ OTP sent successfully. Dev OTP: {data['otp_dev']}")
    
    def test_send_otp_missing_phone(self):
        """Test sending OTP without phone number"""
        response = requests.post(f"{BASE_URL}/api/auth/send-otp", json={})
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✓ Correctly rejected missing phone: {data['detail']}")
    
    def test_verify_otp_success(self):
        """Test verifying OTP and logging in"""
        test_phone = f"+255{uuid.uuid4().hex[:9]}"
        
        # First send OTP
        send_response = requests.post(f"{BASE_URL}/api/auth/send-otp", json={
            "phone": test_phone
        })
        assert send_response.status_code == 200
        otp = send_response.json()["otp_dev"]
        
        # Now verify OTP
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": test_phone,
            "otp": otp
        })
        
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["phone"] == test_phone
        assert "user_id" in data["user"]
        print(f"✓ OTP verified successfully. User ID: {data['user']['user_id']}")
    
    def test_verify_otp_invalid(self):
        """Test verifying with invalid OTP"""
        test_phone = f"+255{uuid.uuid4().hex[:9]}"
        
        # First send OTP
        send_response = requests.post(f"{BASE_URL}/api/auth/send-otp", json={
            "phone": test_phone
        })
        assert send_response.status_code == 200
        
        # Try to verify with wrong OTP
        verify_response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": test_phone,
            "otp": "000000"
        })
        
        assert verify_response.status_code == 400
        data = verify_response.json()
        assert "detail" in data
        print(f"✓ Correctly rejected invalid OTP: {data['detail']}")
    
    def test_verify_otp_missing_fields(self):
        """Test verifying OTP with missing fields"""
        response = requests.post(f"{BASE_URL}/api/auth/verify-otp", json={
            "phone": "+255123456789"
        })
        
        assert response.status_code == 400
        print("✓ Correctly rejected missing OTP field")


class TestAdminSettings:
    """Test Admin Settings API - Device limits, billing, login methods, playback rules"""
    
    def test_get_admin_settings(self):
        """Test getting admin settings"""
        response = requests.get(f"{BASE_URL}/api/admin/settings")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check all expected fields exist
        assert "billing_enabled" in data
        assert "free_user_daily_song_limit" in data
        assert "free_user_max_devices" in data
        assert "premium_user_max_devices" in data
        assert "login_methods" in data
        assert "play_count_replay_limit" in data
        assert "min_play_duration_seconds" in data
        
        # Check login_methods structure
        login_methods = data["login_methods"]
        assert "email_password" in login_methods
        assert "phone_otp" in login_methods
        assert "google" in login_methods
        
        print(f"✓ Admin settings retrieved successfully")
        print(f"  - Billing enabled: {data['billing_enabled']}")
        print(f"  - Free user max devices: {data['free_user_max_devices']}")
        print(f"  - Premium user max devices: {data['premium_user_max_devices']}")
        print(f"  - Login methods: {login_methods}")
    
    def test_update_device_limits(self):
        """Test updating device limits"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/settings")
        original_settings = get_response.json()
        
        # Update device limits
        new_free_limit = 2
        new_premium_limit = 5
        
        update_response = requests.put(f"{BASE_URL}/api/admin/settings", json={
            "free_user_max_devices": new_free_limit,
            "premium_user_max_devices": new_premium_limit
        })
        
        assert update_response.status_code == 200
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/admin/settings")
        updated_settings = verify_response.json()
        
        assert updated_settings["free_user_max_devices"] == new_free_limit
        assert updated_settings["premium_user_max_devices"] == new_premium_limit
        
        print(f"✓ Device limits updated successfully")
        print(f"  - Free user max devices: {updated_settings['free_user_max_devices']}")
        print(f"  - Premium user max devices: {updated_settings['premium_user_max_devices']}")
        
        # Restore original settings
        requests.put(f"{BASE_URL}/api/admin/settings", json={
            "free_user_max_devices": original_settings.get("free_user_max_devices", 1),
            "premium_user_max_devices": original_settings.get("premium_user_max_devices", 3)
        })
    
    def test_update_billing_toggle(self):
        """Test toggling billing enabled/disabled"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/settings")
        original_billing = get_response.json().get("billing_enabled", True)
        
        # Toggle billing
        new_billing = not original_billing
        update_response = requests.put(f"{BASE_URL}/api/admin/settings", json={
            "billing_enabled": new_billing
        })
        
        assert update_response.status_code == 200
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/admin/settings")
        assert verify_response.json()["billing_enabled"] == new_billing
        
        print(f"✓ Billing toggle updated: {original_billing} -> {new_billing}")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/admin/settings", json={
            "billing_enabled": original_billing
        })
    
    def test_update_login_methods(self):
        """Test updating login methods toggles"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/settings")
        original_methods = get_response.json().get("login_methods", {})
        
        # Update login methods
        new_methods = {
            "email_password": True,
            "phone_otp": False,  # Disable phone OTP
            "google": True
        }
        
        update_response = requests.put(f"{BASE_URL}/api/admin/settings", json={
            "login_methods": new_methods
        })
        
        assert update_response.status_code == 200
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/admin/settings")
        updated_methods = verify_response.json()["login_methods"]
        
        assert updated_methods["phone_otp"] == False
        print(f"✓ Login methods updated successfully")
        print(f"  - Phone OTP disabled: {not updated_methods['phone_otp']}")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/admin/settings", json={
            "login_methods": original_methods if original_methods else {
                "email_password": True,
                "phone_otp": True,
                "google": True
            }
        })
    
    def test_update_playback_rules(self):
        """Test updating playback rules (replay limit, min duration)"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/settings")
        original_settings = get_response.json()
        
        # Update playback rules
        new_replay_limit = 3
        new_min_duration = 45
        
        update_response = requests.put(f"{BASE_URL}/api/admin/settings", json={
            "play_count_replay_limit": new_replay_limit,
            "min_play_duration_seconds": new_min_duration
        })
        
        assert update_response.status_code == 200
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/admin/settings")
        updated_settings = verify_response.json()
        
        assert updated_settings["play_count_replay_limit"] == new_replay_limit
        assert updated_settings["min_play_duration_seconds"] == new_min_duration
        
        print(f"✓ Playback rules updated successfully")
        print(f"  - Replay limit: {updated_settings['play_count_replay_limit']}")
        print(f"  - Min duration: {updated_settings['min_play_duration_seconds']}s")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/admin/settings", json={
            "play_count_replay_limit": original_settings.get("play_count_replay_limit", 2),
            "min_play_duration_seconds": original_settings.get("min_play_duration_seconds", 30)
        })


class TestHeroBanners:
    """Test Hero Banners CRUD operations"""
    
    @pytest.fixture
    def test_banner_data(self):
        return {
            "title": f"TEST_Banner_{uuid.uuid4().hex[:6]}",
            "subtitle": "Test subtitle for banner",
            "image_url": "https://example.com/test-banner.jpg",
            "link_type": "album",
            "link_id": "test_album_123",
            "is_active": True,
            "order": 1
        }
    
    def test_create_hero_banner(self, test_banner_data):
        """Test creating a hero banner"""
        response = requests.post(f"{BASE_URL}/api/layout/hero-banner", json=test_banner_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "banner_id" in data
        assert data["message"] == "Banner created"
        
        print(f"✓ Hero banner created: {data['banner_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout/hero-banner/{data['banner_id']}")
        return data["banner_id"]
    
    def test_get_hero_banners(self):
        """Test getting all hero banners"""
        response = requests.get(f"{BASE_URL}/api/layout/hero-banners")
        
        assert response.status_code == 200
        data = response.json()
        assert "banners" in data
        assert isinstance(data["banners"], list)
        
        print(f"✓ Retrieved {len(data['banners'])} hero banners")
    
    def test_get_active_hero_banners(self):
        """Test getting only active hero banners"""
        response = requests.get(f"{BASE_URL}/api/layout/hero-banners?active_only=true")
        
        assert response.status_code == 200
        data = response.json()
        assert "banners" in data
        
        # All returned banners should be active
        for banner in data["banners"]:
            assert banner.get("is_active", True) == True
        
        print(f"✓ Retrieved {len(data['banners'])} active hero banners")
    
    def test_update_hero_banner(self, test_banner_data):
        """Test updating a hero banner"""
        # Create banner first
        create_response = requests.post(f"{BASE_URL}/api/layout/hero-banner", json=test_banner_data)
        banner_id = create_response.json()["banner_id"]
        
        # Update banner
        update_data = {
            "title": "Updated Banner Title",
            "subtitle": "Updated subtitle",
            "is_active": False
        }
        
        update_response = requests.put(f"{BASE_URL}/api/layout/hero-banner/{banner_id}", json=update_data)
        
        assert update_response.status_code == 200
        assert update_response.json()["message"] == "Banner updated"
        
        print(f"✓ Hero banner updated: {banner_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout/hero-banner/{banner_id}")
    
    def test_delete_hero_banner(self, test_banner_data):
        """Test deleting a hero banner"""
        # Create banner first
        create_response = requests.post(f"{BASE_URL}/api/layout/hero-banner", json=test_banner_data)
        banner_id = create_response.json()["banner_id"]
        
        # Delete banner
        delete_response = requests.delete(f"{BASE_URL}/api/layout/hero-banner/{banner_id}")
        
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Banner deleted"
        
        print(f"✓ Hero banner deleted: {banner_id}")
    
    def test_delete_nonexistent_banner(self):
        """Test deleting a banner that doesn't exist"""
        response = requests.delete(f"{BASE_URL}/api/layout/hero-banner/nonexistent_banner_123")
        
        assert response.status_code == 404
        print("✓ Correctly returned 404 for nonexistent banner")
    
    def test_banner_with_external_url(self):
        """Test creating a banner with external URL link"""
        banner_data = {
            "title": f"TEST_External_Banner_{uuid.uuid4().hex[:6]}",
            "subtitle": "Click to visit external site",
            "image_url": "https://example.com/external-banner.jpg",
            "link_type": "external",
            "external_url": "https://example.com/promo",
            "is_active": True,
            "order": 2
        }
        
        response = requests.post(f"{BASE_URL}/api/layout/hero-banner", json=banner_data)
        
        assert response.status_code == 200
        banner_id = response.json()["banner_id"]
        
        print(f"✓ External link banner created: {banner_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout/hero-banner/{banner_id}")


class TestPhoneOTPWithDisabledSetting:
    """Test Phone OTP when disabled in admin settings"""
    
    def test_send_otp_when_disabled(self):
        """Test that OTP sending fails when phone_otp is disabled"""
        # First disable phone OTP in settings
        requests.put(f"{BASE_URL}/api/admin/settings", json={
            "login_methods": {
                "email_password": True,
                "phone_otp": False,
                "google": True
            }
        })
        
        # Try to send OTP
        response = requests.post(f"{BASE_URL}/api/auth/send-otp", json={
            "phone": "+255123456789"
        })
        
        # Should be forbidden
        assert response.status_code == 403
        data = response.json()
        assert "disabled" in data["detail"].lower()
        
        print(f"✓ OTP correctly blocked when disabled: {data['detail']}")
        
        # Re-enable phone OTP
        requests.put(f"{BASE_URL}/api/admin/settings", json={
            "login_methods": {
                "email_password": True,
                "phone_otp": True,
                "google": True
            }
        })


# Cleanup function to remove test data
def cleanup_test_banners():
    """Remove all TEST_ prefixed banners"""
    response = requests.get(f"{BASE_URL}/api/layout/hero-banners")
    if response.status_code == 200:
        banners = response.json().get("banners", [])
        for banner in banners:
            if banner.get("title", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/layout/hero-banner/{banner['banner_id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
