"""
Test Suite for Spirit Songs New Features:
1. Choir Self-Registration with Admin Approval
2. Forgot Password Flow with Email/Phone Reset

All OTPs are MOCKED - returned in API response (otp_dev field)
"""

import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://spiritsongs-app.preview.emergentagent.com').rstrip('/')

# Test data
TEST_CHOIR_EMAIL = f"testchoir_{uuid.uuid4().hex[:8]}@example.com"
TEST_CHOIR_NAME = f"Test Choir {uuid.uuid4().hex[:6]}"
TEST_CHOIR_PHONE = "+255123456789"
TEST_PASSWORD = "testpass123"

class TestChoirSelfRegistration:
    """Test Choir Self-Registration API"""
    
    created_choir_id = None
    
    def test_01_register_choir_success(self):
        """Test successful choir registration"""
        response = requests.post(f"{BASE_URL}/api/choir/register", json={
            "name": TEST_CHOIR_NAME,
            "email": TEST_CHOIR_EMAIL,
            "phone": TEST_CHOIR_PHONE,
            "password": TEST_PASSWORD,
            "type": "choir",
            "description": "A test choir for automated testing"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "choir_id" in data, "Response should contain choir_id"
        assert data["status"] == "pending", "Status should be pending"
        assert "message" in data, "Response should contain message"
        
        TestChoirSelfRegistration.created_choir_id = data["choir_id"]
        print(f"✓ Choir registered successfully: {data['choir_id']}")
    
    def test_02_register_duplicate_email_fails(self):
        """Test that duplicate email registration fails"""
        response = requests.post(f"{BASE_URL}/api/choir/register", json={
            "name": "Another Choir",
            "email": TEST_CHOIR_EMAIL,  # Same email
            "password": TEST_PASSWORD,
            "type": "choir"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "already registered" in data.get("detail", "").lower(), "Should indicate email already registered"
        print("✓ Duplicate email registration correctly rejected")
    
    def test_03_register_missing_fields_fails(self):
        """Test that registration without required fields fails"""
        # Missing name
        response = requests.post(f"{BASE_URL}/api/choir/register", json={
            "email": "test@example.com",
            "password": TEST_PASSWORD
        })
        assert response.status_code == 400, "Should fail without name"
        
        # Missing email
        response = requests.post(f"{BASE_URL}/api/choir/register", json={
            "name": "Test Choir",
            "password": TEST_PASSWORD
        })
        assert response.status_code == 400, "Should fail without email"
        print("✓ Missing required fields correctly rejected")
    
    def test_04_get_pending_registrations(self):
        """Test getting pending choir registrations (admin endpoint)"""
        response = requests.get(f"{BASE_URL}/api/admin/choir-registrations")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "registrations" in data, "Response should contain registrations"
        assert isinstance(data["registrations"], list), "Registrations should be a list"
        
        # Check if our test choir is in the list
        choir_ids = [r["choir_id"] for r in data["registrations"]]
        assert TestChoirSelfRegistration.created_choir_id in choir_ids, "Created choir should be in pending list"
        print(f"✓ Found {len(data['registrations'])} pending registrations")
    
    def test_05_approve_choir_registration(self):
        """Test approving a choir registration"""
        choir_id = TestChoirSelfRegistration.created_choir_id
        assert choir_id, "Choir ID should be set from previous test"
        
        response = requests.post(f"{BASE_URL}/api/admin/choir/{choir_id}/approve", json={
            "approved_by": "test_admin"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should contain message"
        assert "approved" in data["message"].lower(), "Message should indicate approval"
        print(f"✓ Choir {choir_id} approved successfully")
    
    def test_06_approve_nonexistent_choir_fails(self):
        """Test that approving non-existent choir fails"""
        response = requests.post(f"{BASE_URL}/api/admin/choir/nonexistent_id/approve", json={})
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent choir approval correctly rejected")
    
    def test_07_reject_choir_registration(self):
        """Test rejecting a choir registration"""
        # First create a new choir to reject
        reject_email = f"reject_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(f"{BASE_URL}/api/choir/register", json={
            "name": "Choir To Reject",
            "email": reject_email,
            "password": TEST_PASSWORD,
            "type": "artist"
        })
        
        assert response.status_code == 200
        choir_id = response.json()["choir_id"]
        
        # Now reject it
        response = requests.post(f"{BASE_URL}/api/admin/choir/{choir_id}/reject", json={
            "reason": "Test rejection reason"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "rejected" in data["message"].lower(), "Message should indicate rejection"
        print(f"✓ Choir {choir_id} rejected successfully")


class TestForgotPasswordFlow:
    """Test Forgot Password Flow APIs"""
    
    test_user_email = None
    test_user_phone = None
    reset_token = None
    
    @classmethod
    def setup_class(cls):
        """Create a test user for password reset tests"""
        cls.test_user_email = f"pwreset_{uuid.uuid4().hex[:8]}@example.com"
        cls.test_user_phone = f"+255{uuid.uuid4().hex[:9]}"
        
        # Register a test user in app_users
        response = requests.post(f"{BASE_URL}/api/user/register", json={
            "email": cls.test_user_email,
            "phone": cls.test_user_phone,
            "password": TEST_PASSWORD,
            "name": "Password Reset Test User"
        })
        
        if response.status_code == 200:
            print(f"✓ Test user created: {cls.test_user_email}")
        else:
            print(f"Note: Could not create test user: {response.text}")
    
    def test_01_send_reset_otp_via_email(self):
        """Test sending password reset OTP via email"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/send", json={
            "email": TestForgotPasswordFlow.test_user_email
        })
        
        # May return 404 if user doesn't exist, which is expected behavior
        if response.status_code == 404:
            print("⚠ Test user not found - skipping email reset test")
            pytest.skip("Test user not found")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should contain message"
        assert "otp_dev" in data, "Response should contain otp_dev (MOCKED)"
        assert len(data["otp_dev"]) == 6, "OTP should be 6 digits"
        assert data["identifier_type"] == "email", "Identifier type should be email"
        
        print(f"✓ Reset OTP sent via email: {data['otp_dev']} (MOCKED)")
    
    def test_02_send_reset_otp_via_phone(self):
        """Test sending password reset OTP via phone"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/send", json={
            "phone": TestForgotPasswordFlow.test_user_phone
        })
        
        if response.status_code == 404:
            print("⚠ Test user not found - skipping phone reset test")
            pytest.skip("Test user not found")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "otp_dev" in data, "Response should contain otp_dev (MOCKED)"
        assert data["identifier_type"] == "phone", "Identifier type should be phone"
        
        print(f"✓ Reset OTP sent via phone: {data['otp_dev']} (MOCKED)")
    
    def test_03_send_reset_nonexistent_user_fails(self):
        """Test that sending reset to non-existent user fails"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/send", json={
            "email": "nonexistent_user_12345@example.com"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent user reset correctly rejected")
    
    def test_04_send_reset_missing_identifier_fails(self):
        """Test that sending reset without email/phone fails"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/send", json={})
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Missing identifier correctly rejected")
    
    def test_05_verify_reset_otp(self):
        """Test verifying password reset OTP"""
        # First send OTP
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/send", json={
            "email": TestForgotPasswordFlow.test_user_email
        })
        
        if response.status_code == 404:
            pytest.skip("Test user not found")
        
        otp = response.json()["otp_dev"]
        identifier = response.json()["identifier"]
        
        # Verify OTP
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/verify", json={
            "identifier": identifier,
            "otp": otp
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "reset_token" in data, "Response should contain reset_token"
        assert len(data["reset_token"]) > 0, "Reset token should not be empty"
        
        TestForgotPasswordFlow.reset_token = data["reset_token"]
        print(f"✓ OTP verified, reset token received")
    
    def test_06_verify_invalid_otp_fails(self):
        """Test that invalid OTP verification fails"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/verify", json={
            "identifier": TestForgotPasswordFlow.test_user_email,
            "otp": "000000"  # Invalid OTP
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid OTP correctly rejected")
    
    def test_07_reset_password_success(self):
        """Test resetting password with valid token"""
        if not TestForgotPasswordFlow.reset_token:
            pytest.skip("No reset token available")
        
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/reset", json={
            "reset_token": TestForgotPasswordFlow.reset_token,
            "new_password": "newpassword123"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "message" in data, "Response should contain message"
        print("✓ Password reset successfully")
    
    def test_08_reset_password_short_password_fails(self):
        """Test that short password is rejected"""
        # Get a fresh reset token
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/send", json={
            "email": TestForgotPasswordFlow.test_user_email
        })
        
        if response.status_code == 404:
            pytest.skip("Test user not found")
        
        otp = response.json()["otp_dev"]
        identifier = response.json()["identifier"]
        
        # Verify OTP
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/verify", json={
            "identifier": identifier,
            "otp": otp
        })
        
        if response.status_code != 200:
            pytest.skip("Could not get reset token")
        
        reset_token = response.json()["reset_token"]
        
        # Try to reset with short password
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/reset", json={
            "reset_token": reset_token,
            "new_password": "123"  # Too short
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Short password correctly rejected")
    
    def test_09_reset_password_invalid_token_fails(self):
        """Test that invalid reset token is rejected"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password/reset", json={
            "reset_token": "invalid_token_12345",
            "new_password": "newpassword123"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid reset token correctly rejected")


class TestChoirRegistrationTypes:
    """Test different choir/artist types registration"""
    
    def test_register_as_artist(self):
        """Test registration as solo artist"""
        response = requests.post(f"{BASE_URL}/api/choir/register", json={
            "name": f"Solo Artist {uuid.uuid4().hex[:6]}",
            "email": f"artist_{uuid.uuid4().hex[:8]}@example.com",
            "password": TEST_PASSWORD,
            "type": "artist",
            "description": "A solo gospel artist"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        print("✓ Artist registration successful")
    
    def test_register_as_band(self):
        """Test registration as band/group"""
        response = requests.post(f"{BASE_URL}/api/choir/register", json={
            "name": f"Gospel Band {uuid.uuid4().hex[:6]}",
            "email": f"band_{uuid.uuid4().hex[:8]}@example.com",
            "password": TEST_PASSWORD,
            "type": "band",
            "description": "A gospel music band"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"
        print("✓ Band registration successful")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
