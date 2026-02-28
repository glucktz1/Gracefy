"""
Test Azam Pay Payment Feature and Push Notification Setup
Tests:
1. Azam Pay checkout endpoint creates pending transaction
2. Azam Pay test-confirm endpoint activates subscription and creates admin notification
3. Push token registration endpoint saves token to user
4. Push token stats endpoint returns correct data
5. Admin notifications endpoint returns recent notifications
6. Admin notification settings returns sound_enabled flag
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from main agent
TEST_USER_ID = "user_da3ee79a1d71"
TEST_USER_TOKEN = "tok_ebd59893c123476d9b4e0b9e528f0989"

# Plan IDs
PLAN_IDS = ["plan_daily", "plan_weekly", "plan_monthly"]


class TestAzamPayCheckout:
    """Test Azam Pay checkout endpoint creates pending transaction"""
    
    def test_checkout_creates_pending_transaction(self):
        """POST /api/payment/azampay/checkout - creates pending transaction"""
        # Use a unique phone number for this test
        test_phone = f"+2557{random.randint(1000000, 9999999)}"
        
        response = requests.post(
            f"{BASE_URL}/api/payment/azampay/checkout",
            json={
                "user_id": TEST_USER_ID,
                "plan_id": "plan_daily",
                "phone_number": test_phone
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True, "Expected success=True"
        assert "transaction_id" in data, "Missing transaction_id"
        assert "external_id" in data, "Missing external_id"
        assert data.get("status") == "pending", f"Expected status=pending, got {data.get('status')}"
        assert data.get("test_mode") == True, "Expected test_mode=True"
        assert data.get("amount") == 500, f"Expected amount=500 for daily plan, got {data.get('amount')}"
        assert data.get("currency") == "TZS", f"Expected currency=TZS, got {data.get('currency')}"
        
        # Store transaction_id for later tests
        self.__class__.transaction_id = data.get("transaction_id")
        self.__class__.external_id = data.get("external_id")
        
        print(f"✓ Checkout created pending transaction: {data.get('transaction_id')}")
        return data
    
    def test_checkout_validates_required_fields(self):
        """POST /api/payment/azampay/checkout - validates required fields"""
        # Missing user_id
        response = requests.post(
            f"{BASE_URL}/api/payment/azampay/checkout",
            json={
                "plan_id": "plan_daily",
                "phone_number": "+255712345678"
            }
        )
        assert response.status_code == 400, f"Expected 400 for missing user_id, got {response.status_code}"
        
        # Missing plan_id
        response = requests.post(
            f"{BASE_URL}/api/payment/azampay/checkout",
            json={
                "user_id": TEST_USER_ID,
                "phone_number": "+255712345678"
            }
        )
        assert response.status_code == 400, f"Expected 400 for missing plan_id, got {response.status_code}"
        
        # Missing phone_number
        response = requests.post(
            f"{BASE_URL}/api/payment/azampay/checkout",
            json={
                "user_id": TEST_USER_ID,
                "plan_id": "plan_daily"
            }
        )
        assert response.status_code == 400, f"Expected 400 for missing phone_number, got {response.status_code}"
        
        print("✓ Checkout validates required fields correctly")
    
    def test_checkout_validates_phone_format(self):
        """POST /api/payment/azampay/checkout - validates Tanzanian phone format"""
        # Invalid phone format
        response = requests.post(
            f"{BASE_URL}/api/payment/azampay/checkout",
            json={
                "user_id": TEST_USER_ID,
                "plan_id": "plan_daily",
                "phone_number": "12345"  # Invalid format
            }
        )
        assert response.status_code == 400, f"Expected 400 for invalid phone, got {response.status_code}"
        
        print("✓ Checkout validates phone format correctly")
    
    def test_checkout_validates_plan_id(self):
        """POST /api/payment/azampay/checkout - validates plan_id"""
        response = requests.post(
            f"{BASE_URL}/api/payment/azampay/checkout",
            json={
                "user_id": TEST_USER_ID,
                "plan_id": "invalid_plan",
                "phone_number": "+255712345678"
            }
        )
        assert response.status_code == 400, f"Expected 400 for invalid plan, got {response.status_code}"
        
        print("✓ Checkout validates plan_id correctly")
    
    def test_checkout_detects_mno_correctly(self):
        """POST /api/payment/azampay/checkout - detects MNO from phone prefix"""
        # Vodacom prefix (74, 75, 76)
        response = requests.post(
            f"{BASE_URL}/api/payment/azampay/checkout",
            json={
                "user_id": TEST_USER_ID,
                "plan_id": "plan_daily",
                "phone_number": "+255741234567"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("mno") == "Vodacom", f"Expected MNO=Vodacom for 74 prefix, got {data.get('mno')}"
        
        # Tigo prefix (65, 67, 71)
        response = requests.post(
            f"{BASE_URL}/api/payment/azampay/checkout",
            json={
                "user_id": TEST_USER_ID,
                "plan_id": "plan_daily",
                "phone_number": "+255651234567"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("mno") == "Tigo", f"Expected MNO=Tigo for 65 prefix, got {data.get('mno')}"
        
        print("✓ Checkout detects MNO correctly from phone prefix")


class TestAzamPayTestConfirm:
    """Test Azam Pay test-confirm endpoint activates subscription and creates admin notification"""
    
    def test_confirm_activates_subscription(self):
        """POST /api/payment/azampay/test-confirm/{transaction_id} - activates subscription"""
        # First create a checkout
        test_phone = f"+2557{random.randint(1000000, 9999999)}"
        checkout_response = requests.post(
            f"{BASE_URL}/api/payment/azampay/checkout",
            json={
                "user_id": TEST_USER_ID,
                "plan_id": "plan_weekly",
                "phone_number": test_phone
            }
        )
        assert checkout_response.status_code == 200
        checkout_data = checkout_response.json()
        transaction_id = checkout_data.get("transaction_id")
        
        # Now confirm the payment
        confirm_response = requests.post(
            f"{BASE_URL}/api/payment/azampay/test-confirm/{transaction_id}",
            json={"action": "confirm"}
        )
        
        assert confirm_response.status_code == 200, f"Expected 200, got {confirm_response.status_code}: {confirm_response.text}"
        
        confirm_data = confirm_response.json()
        assert confirm_data.get("success") == True, "Expected success=True"
        assert confirm_data.get("status") == "completed", f"Expected status=completed, got {confirm_data.get('status')}"
        assert "expires_at" in confirm_data, "Missing expires_at in response"
        
        # Verify transaction status changed
        status_response = requests.get(f"{BASE_URL}/api/payment/azampay/status/{transaction_id}")
        assert status_response.status_code == 200
        status_data = status_response.json()
        assert status_data.get("status") == "completed", f"Transaction status should be completed, got {status_data.get('status')}"
        
        print(f"✓ Test-confirm activated subscription, expires_at: {confirm_data.get('expires_at')}")
        
        # Store for notification test
        self.__class__.confirmed_transaction_id = transaction_id
    
    def test_confirm_creates_admin_notification(self):
        """POST /api/payment/azampay/test-confirm - creates admin notification"""
        # Get admin notifications
        response = requests.get(f"{BASE_URL}/api/admin/notifications?limit=10")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        notifications = data.get("notifications", [])
        
        # Check if there's a payment_success notification
        payment_notifications = [n for n in notifications if n.get("type") == "payment_success"]
        
        assert len(payment_notifications) > 0, "Expected at least one payment_success notification"
        
        latest_notification = payment_notifications[0]
        assert latest_notification.get("title") == "New Payment Received!", f"Unexpected title: {latest_notification.get('title')}"
        assert "subscribed to" in latest_notification.get("message", ""), f"Message should contain 'subscribed to': {latest_notification.get('message')}"
        assert latest_notification.get("is_read") == False, "New notification should be unread"
        
        print(f"✓ Admin notification created: {latest_notification.get('message')}")
    
    def test_confirm_rejects_non_test_mode_transaction(self):
        """POST /api/payment/azampay/test-confirm - rejects non-test-mode transactions"""
        # This test would require a production transaction which we can't create in test mode
        # So we just verify the endpoint exists and returns proper error for invalid transaction
        response = requests.post(
            f"{BASE_URL}/api/payment/azampay/test-confirm/invalid_txn_id",
            json={"action": "confirm"}
        )
        assert response.status_code == 404, f"Expected 404 for invalid transaction, got {response.status_code}"
        
        print("✓ Test-confirm rejects invalid transaction IDs")
    
    def test_confirm_rejects_already_processed_transaction(self):
        """POST /api/payment/azampay/test-confirm - rejects already processed transactions"""
        # Create and confirm a transaction
        test_phone = f"+2557{random.randint(1000000, 9999999)}"
        checkout_response = requests.post(
            f"{BASE_URL}/api/payment/azampay/checkout",
            json={
                "user_id": TEST_USER_ID,
                "plan_id": "plan_daily",
                "phone_number": test_phone
            }
        )
        transaction_id = checkout_response.json().get("transaction_id")
        
        # Confirm first time
        requests.post(
            f"{BASE_URL}/api/payment/azampay/test-confirm/{transaction_id}",
            json={"action": "confirm"}
        )
        
        # Try to confirm again
        response = requests.post(
            f"{BASE_URL}/api/payment/azampay/test-confirm/{transaction_id}",
            json={"action": "confirm"}
        )
        
        assert response.status_code == 400, f"Expected 400 for already processed transaction, got {response.status_code}"
        
        print("✓ Test-confirm rejects already processed transactions")


class TestPushTokenRegistration:
    """Test push token registration endpoint saves token to user"""
    
    def test_save_push_token(self):
        """POST /api/user/push-token - saves push token to user"""
        test_push_token = f"ExponentPushToken[test_{uuid.uuid4().hex[:12]}]"
        
        response = requests.post(
            f"{BASE_URL}/api/user/push-token",
            json={
                "user_id": TEST_USER_ID,
                "push_token": test_push_token,
                "platform": "android",
                "device_name": "Test Device"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert data.get("message") == "Push token saved", f"Unexpected message: {data.get('message')}"
        
        print(f"✓ Push token saved successfully: {test_push_token[:30]}...")
    
    def test_save_push_token_validates_required_fields(self):
        """POST /api/user/push-token - validates required fields"""
        # Missing user_id
        response = requests.post(
            f"{BASE_URL}/api/user/push-token",
            json={
                "push_token": "ExponentPushToken[test123]"
            }
        )
        assert response.status_code == 400, f"Expected 400 for missing user_id, got {response.status_code}"
        
        # Missing push_token
        response = requests.post(
            f"{BASE_URL}/api/user/push-token",
            json={
                "user_id": TEST_USER_ID
            }
        )
        assert response.status_code == 400, f"Expected 400 for missing push_token, got {response.status_code}"
        
        print("✓ Push token endpoint validates required fields")
    
    def test_save_push_token_validates_user_exists(self):
        """POST /api/user/push-token - validates user exists"""
        response = requests.post(
            f"{BASE_URL}/api/user/push-token",
            json={
                "user_id": "nonexistent_user_id",
                "push_token": "ExponentPushToken[test123]"
            }
        )
        assert response.status_code == 404, f"Expected 404 for nonexistent user, got {response.status_code}"
        
        print("✓ Push token endpoint validates user exists")


class TestPushTokenStats:
    """Test push token stats endpoint returns correct data"""
    
    def test_get_push_token_stats(self):
        """GET /api/admin/push-tokens/stats - returns push token statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/push-tokens/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "total_users" in data, "Missing total_users"
        assert "users_with_push_tokens" in data, "Missing users_with_push_tokens"
        assert "coverage_percentage" in data, "Missing coverage_percentage"
        assert "platform_breakdown" in data, "Missing platform_breakdown"
        
        # Verify platform breakdown structure
        platform_breakdown = data.get("platform_breakdown", {})
        assert "android" in platform_breakdown, "Missing android in platform_breakdown"
        assert "ios" in platform_breakdown, "Missing ios in platform_breakdown"
        
        # Verify data types
        assert isinstance(data.get("total_users"), int), "total_users should be int"
        assert isinstance(data.get("users_with_push_tokens"), int), "users_with_push_tokens should be int"
        assert isinstance(data.get("coverage_percentage"), (int, float)), "coverage_percentage should be numeric"
        
        print(f"✓ Push token stats: {data.get('users_with_push_tokens')}/{data.get('total_users')} users ({data.get('coverage_percentage')}%)")


class TestAdminNotifications:
    """Test admin notifications endpoint returns recent notifications"""
    
    def test_get_admin_notifications(self):
        """GET /api/admin/notifications - returns recent notifications"""
        response = requests.get(f"{BASE_URL}/api/admin/notifications")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify response structure
        assert "notifications" in data, "Missing notifications array"
        assert "unread_count" in data, "Missing unread_count"
        
        notifications = data.get("notifications", [])
        assert isinstance(notifications, list), "notifications should be a list"
        
        # If there are notifications, verify structure
        if notifications:
            notification = notifications[0]
            assert "notification_id" in notification, "Missing notification_id"
            assert "type" in notification, "Missing type"
            assert "title" in notification, "Missing title"
            assert "message" in notification, "Missing message"
            assert "is_read" in notification, "Missing is_read"
            assert "created_at" in notification, "Missing created_at"
        
        print(f"✓ Admin notifications returned: {len(notifications)} notifications, {data.get('unread_count')} unread")
    
    def test_get_admin_notifications_with_limit(self):
        """GET /api/admin/notifications?limit=5 - respects limit parameter"""
        response = requests.get(f"{BASE_URL}/api/admin/notifications?limit=5")
        
        assert response.status_code == 200
        
        data = response.json()
        notifications = data.get("notifications", [])
        
        assert len(notifications) <= 5, f"Expected max 5 notifications, got {len(notifications)}"
        
        print(f"✓ Admin notifications respects limit parameter")
    
    def test_get_admin_notifications_unread_only(self):
        """GET /api/admin/notifications?unread_only=true - filters unread only"""
        response = requests.get(f"{BASE_URL}/api/admin/notifications?unread_only=true")
        
        assert response.status_code == 200
        
        data = response.json()
        notifications = data.get("notifications", [])
        
        # All returned notifications should be unread
        for notification in notifications:
            assert notification.get("is_read") == False, f"Expected unread notification, got is_read={notification.get('is_read')}"
        
        print(f"✓ Admin notifications filters unread correctly")
    
    def test_mark_notification_read(self):
        """POST /api/admin/notifications/{id}/read - marks notification as read"""
        # First get notifications
        response = requests.get(f"{BASE_URL}/api/admin/notifications?unread_only=true&limit=1")
        data = response.json()
        notifications = data.get("notifications", [])
        
        if not notifications:
            pytest.skip("No unread notifications to test with")
        
        notification_id = notifications[0].get("notification_id")
        
        # Mark as read
        mark_response = requests.post(f"{BASE_URL}/api/admin/notifications/{notification_id}/read")
        
        assert mark_response.status_code == 200, f"Expected 200, got {mark_response.status_code}"
        
        mark_data = mark_response.json()
        assert mark_data.get("success") == True, "Expected success=True"
        
        print(f"✓ Notification marked as read: {notification_id}")


class TestAdminNotificationSettings:
    """Test admin notification settings returns sound_enabled flag"""
    
    def test_get_notification_settings(self):
        """GET /api/admin/notifications/settings - returns notification settings with sound_enabled"""
        response = requests.get(f"{BASE_URL}/api/admin/notifications/settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify sound_enabled flag exists
        assert "sound_enabled" in data, "Missing sound_enabled flag"
        assert isinstance(data.get("sound_enabled"), bool), "sound_enabled should be boolean"
        
        # Verify other expected settings
        assert "payment_notifications" in data, "Missing payment_notifications"
        assert "browser_notifications" in data, "Missing browser_notifications"
        
        print(f"✓ Notification settings returned: sound_enabled={data.get('sound_enabled')}")
    
    def test_update_notification_settings(self):
        """PUT /api/admin/notifications/settings - updates notification settings"""
        # Get current settings
        get_response = requests.get(f"{BASE_URL}/api/admin/notifications/settings")
        current_settings = get_response.json()
        
        # Toggle sound_enabled
        new_sound_enabled = not current_settings.get("sound_enabled", True)
        
        update_response = requests.put(
            f"{BASE_URL}/api/admin/notifications/settings",
            json={
                "sound_enabled": new_sound_enabled,
                "payment_notifications": True,
                "browser_notifications": True
            }
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        update_data = update_response.json()
        assert update_data.get("success") == True, "Expected success=True"
        
        # Verify the change
        verify_response = requests.get(f"{BASE_URL}/api/admin/notifications/settings")
        verify_data = verify_response.json()
        assert verify_data.get("sound_enabled") == new_sound_enabled, f"sound_enabled not updated correctly"
        
        # Restore original setting
        requests.put(
            f"{BASE_URL}/api/admin/notifications/settings",
            json={"sound_enabled": current_settings.get("sound_enabled", True)}
        )
        
        print(f"✓ Notification settings updated successfully")


class TestTransactionStatus:
    """Test transaction status endpoint"""
    
    def test_get_transaction_status(self):
        """GET /api/payment/azampay/status/{transaction_id} - returns transaction status"""
        # First create a transaction
        test_phone = f"+2557{random.randint(1000000, 9999999)}"
        checkout_response = requests.post(
            f"{BASE_URL}/api/payment/azampay/checkout",
            json={
                "user_id": TEST_USER_ID,
                "plan_id": "plan_daily",
                "phone_number": test_phone
            }
        )
        transaction_id = checkout_response.json().get("transaction_id")
        
        # Get status
        response = requests.get(f"{BASE_URL}/api/payment/azampay/status/{transaction_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify response structure
        assert data.get("transaction_id") == transaction_id
        assert data.get("status") == "pending"
        assert data.get("amount") == 500
        assert data.get("currency") == "TZS"
        assert data.get("test_mode") == True
        
        print(f"✓ Transaction status returned correctly: {data.get('status')}")
    
    def test_get_transaction_status_not_found(self):
        """GET /api/payment/azampay/status/{transaction_id} - returns 404 for invalid ID"""
        response = requests.get(f"{BASE_URL}/api/payment/azampay/status/invalid_transaction_id")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ Transaction status returns 404 for invalid ID")


# Import random for phone number generation
import random


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
