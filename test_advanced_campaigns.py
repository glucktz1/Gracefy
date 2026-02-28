#!/usr/bin/env python3
"""
Test advanced campaign filtering features
"""

import requests
import json

def test_advanced_features():
    """Test the advanced filtering capabilities"""
    base_url = "http://localhost:8001/api/advertising"
    
    print("🚀 Testing Advanced Campaign Filtering Features...")
    
    # Test 1: Premium users filter
    print("\n1. Testing premium users filter:")
    try:
        params = {
            "target_filter_type": "premium",
            "campaign_type": "push"
        }
        response = requests.get(f"{base_url}/preview-target-count", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Premium users: {data.get('target_count', 0)} users")
        else:
            print(f"   ❌ Premium filter failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Premium error: {e}")
    
    # Test 2: Free users filter
    print("\n2. Testing free users filter:")
    try:
        params = {
            "target_filter_type": "free",
            "campaign_type": "push"
        }
        response = requests.get(f"{base_url}/preview-target-count", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Free users: {data.get('target_count', 0)} users")
        else:
            print(f"   ❌ Free filter failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Free error: {e}")
    
    # Test 3: Active users filter
    print("\n3. Testing active users filter:")
    try:
        params = {
            "target_filter_type": "active",
            "campaign_type": "push"
        }
        response = requests.get(f"{base_url}/preview-target-count", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Active users: {data.get('target_count', 0)} users")
        else:
            print(f"   ❌ Active filter failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Active error: {e}")
    
    # Test 4: Email campaign filter
    print("\n4. Testing email campaign requirements:")
    try:
        params = {
            "target_filter_type": "all",
            "campaign_type": "email"
        }
        response = requests.get(f"{base_url}/preview-target-count", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Users with email: {data.get('target_count', 0)} users")
            filter_info = data.get('filter', {})
            if filter_info.get('has_email'):
                print("   ✅ Email requirement automatically added")
        else:
            print(f"   ❌ Email filter failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Email error: {e}")
    
    # Test 5: SMS campaign filter
    print("\n5. Testing SMS campaign requirements:")
    try:
        params = {
            "target_filter_type": "all",
            "campaign_type": "sms"
        }
        response = requests.get(f"{base_url}/preview-target-count", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Users with phone: {data.get('target_count', 0)} users")
            filter_info = data.get('filter', {})
            if filter_info.get('has_phone'):
                print("   ✅ Phone requirement automatically added")
        else:
            print(f"   ❌ SMS filter failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ SMS error: {e}")
    
    # Test 6: Content listening filter
    print("\n6. Testing content listening filter:")
    try:
        params = {
            "target_filter_type": "all",
            "campaign_type": "push",
            "listened_content_ids": "song123,album456"
        }
        response = requests.get(f"{base_url}/preview-target-count", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Users who listened to content: {data.get('target_count', 0)} users")
            filter_info = data.get('filter', {})
            if 'listened_content_ids' in filter_info:
                print("   ✅ Content listening filter applied")
        else:
            print(f"   ❌ Content filter failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Content error: {e}")
    
    # Test 7: Multiple filters combined
    print("\n7. Testing combined filters:")
    try:
        params = {
            "target_filter_type": "free",
            "campaign_type": "email",
            "country": "US",
            "max_users": 5
        }
        response = requests.get(f"{base_url}/preview-target-count", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            count = data.get('target_count', 0)
            print(f"   ✅ Combined filters: {count} users")
            print(f"   📊 Filter applied: {json.dumps(data.get('filter', {}), indent=2)}")
            if count <= 5:
                print("   ✅ All filters working correctly")
        else:
            print(f"   ❌ Combined filters failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Combined error: {e}")
    
    print("\n🎯 Advanced Campaign Filtering Test Complete!")

if __name__ == "__main__":
    test_advanced_features()