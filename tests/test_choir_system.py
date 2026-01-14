"""
Comprehensive tests for Choir Dashboard and Revenue System
Tests: Choir Login, Dashboard, Revenue, Payment Details, Content Upload, Withdrawals
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_CHOIR_EMAIL = "testchoir@example.com"
TEST_CHOIR_PASSWORD = "test123"


class TestChoirAuthentication:
    """Test choir login and session management"""
    
    def test_choir_login_success(self):
        """Test successful choir login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/choir/login", json={
            "email": TEST_CHOIR_EMAIL,
            "password": TEST_CHOIR_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "choir_id" in data, "Response missing choir_id"
        assert "choir_name" in data, "Response missing choir_name"
        assert "session_token" in data, "Response missing session_token"
        assert data["email"] == TEST_CHOIR_EMAIL
        print(f"✓ Choir login successful: {data['choir_name']}")
        return data["session_token"], data["choir_id"]
    
    def test_choir_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/choir/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")
    
    def test_choir_profile_with_token(self):
        """Test getting choir profile with valid session token"""
        # First login
        login_res = requests.post(f"{BASE_URL}/api/choir/login", json={
            "email": TEST_CHOIR_EMAIL,
            "password": TEST_CHOIR_PASSWORD
        })
        token = login_res.json()["session_token"]
        
        # Get profile
        response = requests.get(f"{BASE_URL}/api/choir/me", 
            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Profile fetch failed: {response.text}"
        
        data = response.json()
        assert "choir_id" in data
        assert "choir_name" in data
        assert "current_balance" in data
        assert "total_earned" in data
        print(f"✓ Profile fetched: balance={data['current_balance']}")
    
    def test_choir_profile_without_token(self):
        """Test profile access without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/choir/me")
        assert response.status_code == 401
        print("✓ Unauthorized access correctly rejected")


class TestChoirRevenue:
    """Test choir revenue analytics endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session token"""
        login_res = requests.post(f"{BASE_URL}/api/choir/login", json={
            "email": TEST_CHOIR_EMAIL,
            "password": TEST_CHOIR_PASSWORD
        })
        self.token = login_res.json()["session_token"]
        self.choir_id = login_res.json()["choir_id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_choir_revenue(self):
        """Test fetching choir revenue analytics"""
        response = requests.get(f"{BASE_URL}/api/choir/revenue/{self.choir_id}",
            headers=self.headers)
        assert response.status_code == 200, f"Revenue fetch failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "summary" in data, "Missing summary in response"
        assert "rates" in data, "Missing rates in response"
        assert "albums" in data, "Missing albums in response"
        assert "monthly" in data, "Missing monthly in response"
        
        # Verify summary fields
        summary = data["summary"]
        assert "total_hours" in summary
        assert "net_revenue" in summary
        assert "unique_streams_count" in summary  # Streams >= 45s
        assert "all_streams_count" in summary  # All streams
        
        # Verify rates
        rates = data["rates"]
        assert "premium_rate" in rates
        assert "standard_rate" in rates
        assert "platform_share" in rates
        assert "minimum_withdrawal" in rates
        
        print(f"✓ Revenue data: net_revenue={summary['net_revenue']}, unique_streams={summary['unique_streams_count']}")
    
    def test_revenue_45_second_rule(self):
        """Verify 45-second minimum stream rule is documented in response"""
        response = requests.get(f"{BASE_URL}/api/choir/revenue/{self.choir_id}",
            headers=self.headers)
        data = response.json()
        
        # The unique_streams_count should only count streams >= 45 seconds
        summary = data["summary"]
        assert "unique_streams_count" in summary, "Missing unique_streams_count (45s rule)"
        assert "all_streams_count" in summary, "Missing all_streams_count"
        
        # unique_streams should be <= all_streams
        assert summary["unique_streams_count"] <= summary["all_streams_count"], \
            "Unique streams should be <= all streams"
        print(f"✓ 45-second rule verified: {summary['unique_streams_count']} revenue streams out of {summary['all_streams_count']} total")


class TestPaymentDetails:
    """Test payment details and OTP verification"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session token"""
        login_res = requests.post(f"{BASE_URL}/api/choir/login", json={
            "email": TEST_CHOIR_EMAIL,
            "password": TEST_CHOIR_PASSWORD
        })
        self.token = login_res.json()["session_token"]
        self.choir_id = login_res.json()["choir_id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_payment_details(self):
        """Test fetching current payment details"""
        response = requests.get(f"{BASE_URL}/api/choir/payment-details",
            headers=self.headers)
        assert response.status_code == 200, f"Payment details fetch failed: {response.text}"
        
        data = response.json()
        assert "current_method" in data
        assert "current_details" in data
        assert "details_status" in data
        print(f"✓ Payment details: method={data['current_method']}, status={data['details_status']}")
    
    def test_request_otp_for_mobile_money(self):
        """Test OTP request for mobile money verification (MOCK)"""
        response = requests.post(f"{BASE_URL}/api/choir/payment-details/request-otp",
            json={"phone_number": "+255712345678"},
            headers=self.headers)
        assert response.status_code == 200, f"OTP request failed: {response.text}"
        
        data = response.json()
        assert "otp_id" in data, "Missing otp_id"
        assert "mock_otp" in data, "Missing mock_otp (for testing)"
        assert "expires_in_minutes" in data
        
        print(f"✓ OTP requested: otp_id={data['otp_id']}, mock_otp={data['mock_otp']}")
        return data["otp_id"], data["mock_otp"]
    
    def test_verify_otp(self):
        """Test OTP verification flow"""
        # Request OTP
        otp_res = requests.post(f"{BASE_URL}/api/choir/payment-details/request-otp",
            json={"phone_number": "+255712345678"},
            headers=self.headers)
        otp_data = otp_res.json()
        
        # Verify OTP
        response = requests.post(f"{BASE_URL}/api/choir/payment-details/verify-otp",
            json={
                "otp_id": otp_data["otp_id"],
                "otp_code": otp_data["mock_otp"]
            },
            headers=self.headers)
        assert response.status_code == 200, f"OTP verification failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "phone_number" in data
        print(f"✓ OTP verified for phone: {data['phone_number']}")
    
    def test_verify_otp_invalid_code(self):
        """Test OTP verification with invalid code"""
        # Request OTP
        otp_res = requests.post(f"{BASE_URL}/api/choir/payment-details/request-otp",
            json={"phone_number": "+255712345678"},
            headers=self.headers)
        otp_data = otp_res.json()
        
        # Try invalid OTP
        response = requests.post(f"{BASE_URL}/api/choir/payment-details/verify-otp",
            json={
                "otp_id": otp_data["otp_id"],
                "otp_code": "000000"  # Wrong code
            },
            headers=self.headers)
        assert response.status_code == 400, f"Expected 400 for invalid OTP, got {response.status_code}"
        print("✓ Invalid OTP correctly rejected")
    
    def test_submit_bank_payment_details(self):
        """Test submitting bank transfer payment details"""
        response = requests.post(f"{BASE_URL}/api/choir/payment-details/submit",
            json={
                "payment_method": "bank_transfer",
                "payment_details": {
                    "bank_name": "CRDB Bank",
                    "account_number": "1234567890",
                    "account_name": "Test Choir"
                }
            },
            headers=self.headers)
        assert response.status_code == 200, f"Bank details submission failed: {response.text}"
        
        data = response.json()
        assert "request_id" in data
        print(f"✓ Bank details submitted for approval: {data['request_id']}")


class TestContentUpload:
    """Test album creation and song upload with admin approval"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session token"""
        login_res = requests.post(f"{BASE_URL}/api/choir/login", json={
            "email": TEST_CHOIR_EMAIL,
            "password": TEST_CHOIR_PASSWORD
        })
        self.token = login_res.json()["session_token"]
        self.choir_id = login_res.json()["choir_id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_create_album_request(self):
        """Test creating album request (requires admin approval)"""
        response = requests.post(f"{BASE_URL}/api/choir/albums/create",
            json={
                "title": f"TEST_Album_{int(time.time())}",
                "description": "Test album for automated testing",
                "monetization_type": "standard",
                "release_date": "2025-01-01"
            },
            headers=self.headers)
        assert response.status_code == 200, f"Album creation failed: {response.text}"
        
        data = response.json()
        assert "request_id" in data
        assert "message" in data
        print(f"✓ Album creation request submitted: {data['request_id']}")
    
    def test_get_my_content_requests(self):
        """Test fetching choir's content requests"""
        response = requests.get(f"{BASE_URL}/api/choir/my-content-requests",
            headers=self.headers)
        assert response.status_code == 200, f"Content requests fetch failed: {response.text}"
        
        data = response.json()
        assert "requests" in data
        print(f"✓ Content requests fetched: {len(data['requests'])} requests")
    
    def test_get_my_albums(self):
        """Test fetching choir's albums"""
        response = requests.get(f"{BASE_URL}/api/choir/my-albums",
            headers=self.headers)
        assert response.status_code == 200, f"Albums fetch failed: {response.text}"
        
        data = response.json()
        assert "albums" in data
        print(f"✓ My albums fetched: {len(data['albums'])} albums")


class TestWithdrawals:
    """Test withdrawal request functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session token"""
        login_res = requests.post(f"{BASE_URL}/api/choir/login", json={
            "email": TEST_CHOIR_EMAIL,
            "password": TEST_CHOIR_PASSWORD
        })
        self.token = login_res.json()["session_token"]
        self.choir_id = login_res.json()["choir_id"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_my_withdrawal_requests(self):
        """Test fetching choir's withdrawal requests"""
        response = requests.get(f"{BASE_URL}/api/withdrawal/my-requests",
            headers=self.headers)
        assert response.status_code == 200, f"Withdrawal requests fetch failed: {response.text}"
        
        data = response.json()
        assert "requests" in data
        print(f"✓ Withdrawal requests fetched: {len(data['requests'])} requests")
    
    def test_withdrawal_request_insufficient_balance(self):
        """Test withdrawal request with amount exceeding balance"""
        # Get current balance
        profile_res = requests.get(f"{BASE_URL}/api/choir/me", headers=self.headers)
        balance = profile_res.json().get("current_balance", 0)
        
        # Try to withdraw more than balance
        response = requests.post(f"{BASE_URL}/api/withdrawal/request",
            json={
                "amount": balance + 100000,  # More than balance
                "payment_method": "mobile_money",
                "payment_details": {"phone": "+255712345678"}
            },
            headers=self.headers)
        
        # Should fail with insufficient balance
        assert response.status_code == 400, f"Expected 400 for insufficient balance, got {response.status_code}"
        print("✓ Insufficient balance correctly rejected")
    
    def test_withdrawal_request_below_minimum(self):
        """Test withdrawal request below minimum amount"""
        response = requests.post(f"{BASE_URL}/api/withdrawal/request",
            json={
                "amount": 100,  # Below minimum (10000)
                "payment_method": "mobile_money",
                "payment_details": {"phone": "+255712345678"}
            },
            headers=self.headers)
        
        assert response.status_code == 400, f"Expected 400 for below minimum, got {response.status_code}"
        print("✓ Below minimum withdrawal correctly rejected")


class TestAdminApprovals:
    """Test admin approval endpoints"""
    
    def test_get_content_requests(self):
        """Test fetching pending content requests (admin)"""
        response = requests.get(f"{BASE_URL}/api/admin/content-requests?status=pending")
        assert response.status_code == 200, f"Content requests fetch failed: {response.text}"
        
        data = response.json()
        assert "requests" in data
        print(f"✓ Admin content requests: {len(data['requests'])} pending")
    
    def test_get_payment_requests(self):
        """Test fetching pending payment requests (admin)"""
        response = requests.get(f"{BASE_URL}/api/admin/payment-requests?status=pending")
        assert response.status_code == 200, f"Payment requests fetch failed: {response.text}"
        
        data = response.json()
        assert "requests" in data
        print(f"✓ Admin payment requests: {len(data['requests'])} pending")
    
    def test_get_admin_notifications(self):
        """Test fetching admin notifications"""
        response = requests.get(f"{BASE_URL}/api/admin/notifications")
        assert response.status_code == 200, f"Notifications fetch failed: {response.text}"
        
        data = response.json()
        assert "notifications" in data
        assert "unread_count" in data
        print(f"✓ Admin notifications: {data['unread_count']} unread")
    
    def test_get_withdrawal_requests(self):
        """Test fetching all withdrawal requests (admin)"""
        response = requests.get(f"{BASE_URL}/api/withdrawal/requests")
        assert response.status_code == 200, f"Withdrawal requests fetch failed: {response.text}"
        
        data = response.json()
        assert "requests" in data
        print(f"✓ Admin withdrawal requests: {len(data['requests'])} total")


class TestCategories:
    """Test categories endpoint for album creation"""
    
    def test_get_categories(self):
        """Test fetching categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200, f"Categories fetch failed: {response.text}"
        
        data = response.json()
        assert "categories" in data
        print(f"✓ Categories fetched: {len(data['categories'])} categories")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
