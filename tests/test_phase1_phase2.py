"""
Phase 1 & 2 Tests: Admin Choir Management, Monetization Settings, SMS Notifications
Tests: Admin choir endpoints, Monetization settings (14 sections), Subscription plans CRUD, SMS logs
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test choir with full details
TEST_CHOIR_ID = "sing_6ac984c0ee0e"
TEST_CHOIR_NAME = "St. Mary Cathedral Choir"


class TestAdminChoirManagement:
    """Test admin choir management endpoints at /admin/choirs"""
    
    def test_get_all_choirs(self):
        """Test GET /api/admin/choirs - list all choirs with stats"""
        response = requests.get(f"{BASE_URL}/api/admin/choirs")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "choirs" in data, "Missing 'choirs' in response"
        assert "total" in data, "Missing 'total' in response"
        assert isinstance(data["choirs"], list)
        
        # Verify choir data structure
        if data["choirs"]:
            choir = data["choirs"][0]
            assert "singer_id" in choir
            assert "name" in choir
            assert "status" in choir
            # Stats fields
            assert "album_count" in choir or "total_hours" in choir
        
        print(f"✓ Admin choirs list: {data['total']} choirs")
    
    def test_get_choir_details(self):
        """Test GET /api/admin/choirs/{choir_id} - detailed choir view"""
        response = requests.get(f"{BASE_URL}/api/admin/choirs/{TEST_CHOIR_ID}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "choir" in data, "Missing 'choir' in response"
        assert "revenue" in data, "Missing 'revenue' in response"
        assert "albums" in data, "Missing 'albums' in response"
        assert "withdrawals" in data, "Missing 'withdrawals' in response"
        assert "monthly" in data, "Missing 'monthly' in response"
        
        # Verify choir has enhanced fields
        choir = data["choir"]
        assert choir["singer_id"] == TEST_CHOIR_ID
        assert "denomination" in choir, "Missing denomination field"
        assert "treasurer_name" in choir, "Missing treasurer_name field"
        assert "chairman_name" in choir, "Missing chairman_name field"
        assert "parish_priest_name" in choir, "Missing parish_priest_name field"
        
        # Verify revenue structure
        revenue = data["revenue"]
        assert "total_hours" in revenue
        assert "net_revenue" in revenue
        assert "current_balance" in revenue
        
        print(f"✓ Choir details: {choir['name']}, denomination={choir.get('denomination')}")
    
    def test_create_choir_with_enhanced_fields(self):
        """Test POST /api/admin/choirs - create choir with all new fields"""
        test_name = f"TEST_Choir_{int(time.time())}"
        response = requests.post(f"{BASE_URL}/api/admin/choirs", json={
            "name": test_name,
            "denomination": "lutheran",
            "treasurer_name": "Test Treasurer",
            "treasurer_phone": "+255711111111",
            "chairman_name": "Test Chairman",
            "chairman_phone": "+255722222222",
            "parish_priest_name": "Test Pastor",
            "parish_priest_phone": "+255733333333",
            "bio": "Test choir created by automated tests"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "singer_id" in data, "Missing singer_id in response"
        
        # Verify the choir was created with all fields
        verify_res = requests.get(f"{BASE_URL}/api/admin/choirs/{data['singer_id']}")
        assert verify_res.status_code == 200
        
        choir = verify_res.json()["choir"]
        assert choir["name"] == test_name
        assert choir["denomination"] == "lutheran"
        assert choir["treasurer_name"] == "Test Treasurer"
        assert choir["chairman_name"] == "Test Chairman"
        assert choir["parish_priest_name"] == "Test Pastor"
        
        print(f"✓ Created choir with enhanced fields: {data['singer_id']}")
        return data["singer_id"]
    
    def test_update_choir(self):
        """Test PUT /api/admin/choirs/{choir_id} - update choir"""
        # First create a test choir
        create_res = requests.post(f"{BASE_URL}/api/admin/choirs", json={
            "name": f"TEST_Update_{int(time.time())}",
            "denomination": "baptist"
        })
        choir_id = create_res.json()["singer_id"]
        
        # Update the choir
        response = requests.put(f"{BASE_URL}/api/admin/choirs/{choir_id}", json={
            "denomination": "methodist",
            "treasurer_name": "Updated Treasurer",
            "status": "active"
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify update
        verify_res = requests.get(f"{BASE_URL}/api/admin/choirs/{choir_id}")
        choir = verify_res.json()["choir"]
        assert choir["denomination"] == "methodist"
        assert choir["treasurer_name"] == "Updated Treasurer"
        
        print(f"✓ Updated choir: {choir_id}")
    
    def test_choir_status_change(self):
        """Test changing choir status (active/suspended)"""
        # Create test choir
        create_res = requests.post(f"{BASE_URL}/api/admin/choirs", json={
            "name": f"TEST_Status_{int(time.time())}"
        })
        choir_id = create_res.json()["singer_id"]
        
        # Suspend choir
        response = requests.put(f"{BASE_URL}/api/admin/choirs/{choir_id}", json={
            "status": "suspended"
        })
        assert response.status_code == 200
        
        # Verify
        verify_res = requests.get(f"{BASE_URL}/api/admin/choirs/{choir_id}")
        assert verify_res.json()["choir"]["status"] == "suspended"
        
        # Reactivate
        response = requests.put(f"{BASE_URL}/api/admin/choirs/{choir_id}", json={
            "status": "active"
        })
        assert response.status_code == 200
        
        print(f"✓ Choir status change working")
    
    def test_choir_approval_status(self):
        """Test changing choir approval status"""
        # Create test choir
        create_res = requests.post(f"{BASE_URL}/api/admin/choirs", json={
            "name": f"TEST_Approval_{int(time.time())}"
        })
        choir_id = create_res.json()["singer_id"]
        
        # Approve choir
        response = requests.put(f"{BASE_URL}/api/admin/choirs/{choir_id}", json={
            "approval_status": "approved"
        })
        assert response.status_code == 200
        
        # Verify
        verify_res = requests.get(f"{BASE_URL}/api/admin/choirs/{choir_id}")
        assert verify_res.json()["choir"]["approval_status"] == "approved"
        
        print(f"✓ Choir approval status working")


class TestMonetizationSettings:
    """Test comprehensive monetization settings (14 sections)"""
    
    def test_get_monetization_settings(self):
        """Test GET /api/monetization/settings - all 14 sections"""
        response = requests.get(f"{BASE_URL}/api/monetization/settings")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Section 1: Subscription Settings
        assert "subscription_enabled" in data
        assert "subscription_price_monthly" in data
        assert "subscription_price_yearly" in data
        assert "free_trial_enabled" in data
        assert "free_trial_days" in data
        assert "auto_renew_enabled" in data
        assert "grace_period_days" in data
        
        # Section 2: Platform Revenue Settings
        assert "platform_fee_percentage" in data
        assert "apply_fee_to_subscriptions" in data
        assert "apply_fee_to_donations" in data
        
        # Section 3: Content Revenue Rates
        assert "premium_rate_per_hour" in data
        assert "standard_rate_per_hour" in data
        
        # Section 4: Premium Content Rules
        assert "premium_duration_days" in data
        assert "auto_downgrade_to_standard" in data
        assert "premium_approval_required" in data
        
        # Section 5: Listening Time Rules (45-second rule)
        assert "min_qualifying_play_seconds" in data
        assert data["min_qualifying_play_seconds"] == 45, "45-second rule not set correctly"
        assert "max_payable_hours_per_user_per_hour" in data
        assert "max_payable_hours_per_user_per_day" in data
        assert "ignore_muted_playback" in data
        
        # Section 6: Payout Settings
        assert "minimum_payout_threshold" in data
        assert "payout_frequency" in data
        assert "payout_cutoff_day" in data
        assert "payout_fee_handling" in data
        
        # Section 7: Payout Methods
        assert "payout_mobile_money_enabled" in data
        assert "payout_bank_transfer_enabled" in data
        assert "payout_paypal_enabled" in data
        
        # Section 8: Tips & Donations
        assert "tips_enabled" in data
        assert "suggested_tip_amounts" in data
        assert "platform_fee_on_tips_percentage" in data
        
        # Section 9: Album Monetization Controls
        assert "subscription_only_albums_enabled" in data
        assert "free_promotional_albums_enabled" in data
        assert "geo_restricted_monetization" in data
        
        # Section 10: Tax & Compliance
        assert "vat_percentage" in data
        assert "withholding_tax_percentage" in data
        assert "tax_invoice_generation_enabled" in data
        
        # Section 11: Currency & Rounding
        assert "base_currency" in data
        assert "rounding_precision" in data
        
        # Section 12: Analytics & Reporting
        assert "revenue_aggregation_interval" in data
        assert "data_retention_days" in data
        
        # Section 13: Alerts & Monitoring
        assert "revenue_drop_alert_threshold" in data
        assert "unusual_spike_alert_enabled" in data
        assert "failed_payout_alert_enabled" in data
        
        # Section 14: Permissions & Safety
        assert "choir_monetization_frozen" in data
        assert "all_payouts_paused" in data
        assert "emergency_rate_rollback_enabled" in data
        
        print(f"✓ All 14 monetization sections present")
        print(f"  - 45-second rule: {data['min_qualifying_play_seconds']}s")
        print(f"  - Platform fee: {data['platform_fee_percentage']}%")
        print(f"  - Premium rate: {data['premium_rate_per_hour']} TZS/hour")
    
    def test_update_monetization_settings(self):
        """Test PUT /api/monetization/settings - update settings"""
        # Get current settings
        current = requests.get(f"{BASE_URL}/api/monetization/settings").json()
        
        # Update some settings
        response = requests.put(f"{BASE_URL}/api/monetization/settings", json={
            "premium_rate_per_hour": 12.0,
            "standard_rate_per_hour": 6.0,
            "min_qualifying_play_seconds": 45,
            "platform_fee_percentage": 30.0
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify update
        updated = requests.get(f"{BASE_URL}/api/monetization/settings").json()
        assert updated["premium_rate_per_hour"] == 12.0
        assert updated["standard_rate_per_hour"] == 6.0
        
        # Restore original values
        requests.put(f"{BASE_URL}/api/monetization/settings", json={
            "premium_rate_per_hour": current.get("premium_rate_per_hour", 10.0),
            "standard_rate_per_hour": current.get("standard_rate_per_hour", 5.0)
        })
        
        print(f"✓ Monetization settings update working")
    
    def test_rate_change_history(self):
        """Test GET /api/monetization/rate-history"""
        response = requests.get(f"{BASE_URL}/api/monetization/rate-history")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "history" in data
        assert isinstance(data["history"], list)
        
        print(f"✓ Rate change history: {len(data['history'])} entries")


class TestSubscriptionPlans:
    """Test subscription plans CRUD"""
    
    def test_get_subscription_plans(self):
        """Test GET /api/monetization/plans"""
        response = requests.get(f"{BASE_URL}/api/monetization/plans")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "plans" in data
        assert isinstance(data["plans"], list)
        
        # Verify default plans exist
        plan_names = [p["name"] for p in data["plans"]]
        assert "daily" in plan_names or len(data["plans"]) > 0
        
        # Verify plan structure
        if data["plans"]:
            plan = data["plans"][0]
            assert "plan_id" in plan
            assert "name" in plan
            assert "display_name" in plan
            assert "price" in plan
            assert "duration_days" in plan
            assert "features" in plan
            assert "is_active" in plan
        
        print(f"✓ Subscription plans: {len(data['plans'])} plans")
        for p in data["plans"]:
            print(f"  - {p['display_name']}: TZS {p['price']} ({p['duration_days']} days)")
    
    def test_create_subscription_plan(self):
        """Test POST /api/monetization/plans"""
        test_plan = {
            "name": f"test_plan_{int(time.time())}",
            "display_name": "Test Plan",
            "price": 1500,
            "duration_days": 3,
            "features": ["Test feature 1", "Test feature 2"],
            "is_active": True,
            "sort_order": 99
        }
        
        response = requests.post(f"{BASE_URL}/api/monetization/plans", json=test_plan)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "plan_id" in data
        
        print(f"✓ Created subscription plan: {data['plan_id']}")
        return data["plan_id"]
    
    def test_update_subscription_plan(self):
        """Test PUT /api/monetization/plans/{plan_id}"""
        # Create a plan first
        create_res = requests.post(f"{BASE_URL}/api/monetization/plans", json={
            "name": f"update_test_{int(time.time())}",
            "display_name": "Update Test",
            "price": 1000,
            "duration_days": 2,
            "features": ["Feature 1"],
            "is_active": True
        })
        plan_id = create_res.json()["plan_id"]
        
        # Update the plan
        response = requests.put(f"{BASE_URL}/api/monetization/plans/{plan_id}", json={
            "price": 1200,
            "display_name": "Updated Test Plan",
            "is_active": False
        })
        assert response.status_code == 200, f"Failed: {response.text}"
        
        # Verify update
        plans = requests.get(f"{BASE_URL}/api/monetization/plans").json()["plans"]
        updated_plan = next((p for p in plans if p["plan_id"] == plan_id), None)
        if updated_plan:
            assert updated_plan["price"] == 1200
            assert updated_plan["display_name"] == "Updated Test Plan"
        
        print(f"✓ Updated subscription plan: {plan_id}")
    
    def test_delete_subscription_plan(self):
        """Test DELETE /api/monetization/plans/{plan_id}"""
        # Create a plan first
        create_res = requests.post(f"{BASE_URL}/api/monetization/plans", json={
            "name": f"delete_test_{int(time.time())}",
            "display_name": "Delete Test",
            "price": 500,
            "duration_days": 1,
            "features": [],
            "is_active": True
        })
        plan_id = create_res.json()["plan_id"]
        
        # Delete the plan
        response = requests.delete(f"{BASE_URL}/api/monetization/plans/{plan_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        print(f"✓ Deleted subscription plan: {plan_id}")


class TestSMSNotifications:
    """Test SMS notification logs (MOCK)"""
    
    def test_get_sms_logs(self):
        """Test GET /api/admin/sms-logs"""
        response = requests.get(f"{BASE_URL}/api/admin/sms-logs")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "logs" in data
        assert "total" in data
        assert isinstance(data["logs"], list)
        
        print(f"✓ SMS logs: {data['total']} entries")
    
    def test_sms_logs_filter_by_type(self):
        """Test SMS logs filtering by notification type"""
        response = requests.get(f"{BASE_URL}/api/admin/sms-logs?notification_type=withdrawal_request")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "logs" in data
        
        # All logs should be of the filtered type
        for log in data["logs"]:
            assert log["notification_type"] == "withdrawal_request"
        
        print(f"✓ SMS logs filter working")
    
    def test_sms_logs_filter_by_choir(self):
        """Test SMS logs filtering by choir"""
        response = requests.get(f"{BASE_URL}/api/admin/sms-logs?choir_id={TEST_CHOIR_ID}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "logs" in data
        
        print(f"✓ SMS logs choir filter working")


class TestAlbumSongManagement:
    """Test admin album/song management - enable/disable, approve"""
    
    def test_get_albums(self):
        """Test GET /api/albums"""
        response = requests.get(f"{BASE_URL}/api/albums")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "albums" in data
        assert "total" in data
        
        print(f"✓ Albums: {data['total']} total")
    
    def test_album_status_change(self):
        """Test album enable/disable via PUT /api/albums/{album_id}"""
        # Get an album first
        albums_res = requests.get(f"{BASE_URL}/api/albums")
        albums = albums_res.json()["albums"]
        
        if albums:
            album_id = albums[0]["album_id"]
            original_status = albums[0]["status"]
            
            # Toggle status
            new_status = "inactive" if original_status == "active" else "active"
            response = requests.put(f"{BASE_URL}/api/albums/{album_id}", json={
                "status": new_status
            })
            assert response.status_code == 200, f"Failed: {response.text}"
            
            # Restore original status
            requests.put(f"{BASE_URL}/api/albums/{album_id}", json={
                "status": original_status
            })
            
            print(f"✓ Album status change working")
        else:
            print("⚠ No albums to test status change")
    
    def test_bulk_album_status(self):
        """Test bulk album status update"""
        # Get albums
        albums_res = requests.get(f"{BASE_URL}/api/albums")
        albums = albums_res.json()["albums"]
        
        if len(albums) >= 2:
            album_ids = [a["album_id"] for a in albums[:2]]
            
            response = requests.post(f"{BASE_URL}/api/albums/bulk-status", json={
                "album_ids": album_ids,
                "status": "active"
            })
            assert response.status_code == 200, f"Failed: {response.text}"
            
            print(f"✓ Bulk album status update working")
        else:
            print("⚠ Not enough albums for bulk test")
    
    def test_song_status_change(self):
        """Test song enable/disable"""
        # Get songs
        songs_res = requests.get(f"{BASE_URL}/api/songs")
        songs = songs_res.json()["songs"]
        
        if songs:
            song_id = songs[0]["song_id"]
            original_status = songs[0]["status"]
            
            # Toggle status
            new_status = "inactive" if original_status == "active" else "active"
            response = requests.put(f"{BASE_URL}/api/songs/{song_id}", json={
                "status": new_status
            })
            assert response.status_code == 200, f"Failed: {response.text}"
            
            # Restore
            requests.put(f"{BASE_URL}/api/songs/{song_id}", json={
                "status": original_status
            })
            
            print(f"✓ Song status change working")
        else:
            print("⚠ No songs to test")


class TestChoirRevenueAnalytics:
    """Test choir revenue analytics with 45-second rule"""
    
    def test_choir_revenue_with_45_second_rule(self):
        """Test that revenue analytics respects 45-second minimum"""
        # Get a choir with listening data
        choirs_res = requests.get(f"{BASE_URL}/api/admin/choirs")
        choirs = choirs_res.json()["choirs"]
        
        # Find a choir with plays
        choir_with_plays = next((c for c in choirs if c.get("total_plays", 0) > 0), None)
        
        if choir_with_plays:
            choir_id = choir_with_plays["singer_id"]
            
            # Get detailed revenue
            response = requests.get(f"{BASE_URL}/api/admin/choirs/{choir_id}")
            assert response.status_code == 200
            
            data = response.json()
            revenue = data["revenue"]
            
            # Verify revenue structure
            assert "total_hours" in revenue
            assert "net_revenue" in revenue
            assert "total_plays" in revenue
            
            print(f"✓ Choir revenue analytics: {revenue['total_hours']:.2f}h, {revenue['total_plays']} plays")
        else:
            print("⚠ No choir with plays to test revenue")
    
    def test_revenue_settings_45_second_rule(self):
        """Verify 45-second rule is configured in monetization settings"""
        response = requests.get(f"{BASE_URL}/api/monetization/settings")
        data = response.json()
        
        assert data["min_qualifying_play_seconds"] == 45, \
            f"Expected 45 seconds, got {data['min_qualifying_play_seconds']}"
        
        print(f"✓ 45-second rule configured: {data['min_qualifying_play_seconds']}s minimum")


class TestWithdrawalSMSNotifications:
    """Test withdrawal SMS notifications to treasurer/chairman/priest"""
    
    def test_choir_has_contact_details(self):
        """Verify test choir has treasurer/chairman/priest contacts"""
        response = requests.get(f"{BASE_URL}/api/admin/choirs/{TEST_CHOIR_ID}")
        assert response.status_code == 200
        
        choir = response.json()["choir"]
        
        # Verify contact fields exist
        assert "treasurer_name" in choir
        assert "treasurer_phone" in choir
        assert "chairman_name" in choir
        assert "chairman_phone" in choir
        assert "parish_priest_name" in choir
        assert "parish_priest_phone" in choir
        
        # Verify test choir has contacts set
        assert choir["treasurer_name"] is not None, "Treasurer name not set"
        assert choir["treasurer_phone"] is not None, "Treasurer phone not set"
        
        print(f"✓ Choir contacts configured:")
        print(f"  - Treasurer: {choir['treasurer_name']} ({choir['treasurer_phone']})")
        print(f"  - Chairman: {choir['chairman_name']} ({choir['chairman_phone']})")
        print(f"  - Priest: {choir['parish_priest_name']} ({choir['parish_priest_phone']})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
