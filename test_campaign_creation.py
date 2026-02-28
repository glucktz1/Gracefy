#!/usr/bin/env python3
"""
Test creating campaigns with enhanced filtering
"""

import requests
import json

def test_campaign_creation():
    """Test creating campaigns with advanced filters"""
    base_url = "http://localhost:8001/api/advertising"
    
    print("📝 Testing Enhanced Campaign Creation...")
    
    # First, let's try to create a campaign (this will likely fail due to auth, but we can see the API structure)
    print("\n1. Testing campaign creation with advanced filters:")
    
    campaign_data = {
        "name": "Test Enhanced Campaign",
        "description": "Testing advanced filtering capabilities",
        "type": "push",
        "message_title": "Welcome!",
        "message_body": "This is a test message with advanced targeting",
        "target_filter_type": "free",
        "country": "US",
        "max_users": 100,
        "excluded_user_ids": "user123,user456"
    }
    
    try:
        response = requests.post(f"{base_url}/campaigns", data=campaign_data, timeout=5)
        print(f"   Response status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Campaign created: {data.get('campaign', {}).get('name')}")
            print(f"   🎯 Target count: {data.get('target_count', 0)}")
        elif response.status_code == 403:
            print("   ⚠️  Authentication required (expected)")
        else:
            print(f"   📄 Response: {response.text[:200]}...")
    except Exception as e:
        print(f"   ❌ Creation error: {e}")
    
    # Test the API documentation
    print("\n2. Checking API documentation:")
    try:
        response = requests.get(f"{base_url.replace('/api/advertising', '')}/docs", timeout=5)
        if response.status_code == 200:
            print("   ✅ API docs accessible")
            # Check if our new endpoint is documented
            if "preview-target-count" in response.text:
                print("   ✅ New preview endpoint documented")
            else:
                print("   ⚠️  New endpoint may not be in docs yet")
        else:
            print(f"   ❌ Docs failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Docs error: {e}")
    
    print("\n📊 Testing all filter combinations:")
    
    # Test various filter combinations
    test_cases = [
        {
            "name": "Basic Push Campaign",
            "params": {"target_filter_type": "all", "campaign_type": "push"}
        },
        {
            "name": "Premium Email Campaign", 
            "params": {"target_filter_type": "premium", "campaign_type": "email"}
        },
        {
            "name": "Location-based SMS",
            "params": {"target_filter_type": "all", "campaign_type": "sms", "country": "US", "region": "California"}
        },
        {
            "name": "Content-based Push",
            "params": {"target_filter_type": "all", "campaign_type": "push", "listened_content_ids": "song123"}
        },
        {
            "name": "Exclusion Filter",
            "params": {"target_filter_type": "all", "campaign_type": "push", "excluded_user_ids": "user1,user2"}
        },
        {
            "name": "Limited Campaign",
            "params": {"target_filter_type": "free", "campaign_type": "email", "max_users": 50}
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n   {i}. {test_case['name']}:")
        try:
            response = requests.get(f"{base_url}/preview-target-count", params=test_case['params'], timeout=5)
            if response.status_code == 200:
                data = response.json()
                count = data.get('target_count', 0)
                print(f"      ✅ Target users: {count}")
                
                # Show applied filters
                filters = data.get('filter', {})
                active_filters = [k for k, v in filters.items() if v and k != 'type']
                if active_filters:
                    print(f"      🎯 Active filters: {', '.join(active_filters)}")
            else:
                print(f"      ❌ Failed: {response.status_code}")
        except Exception as e:
            print(f"      ❌ Error: {e}")
    
    print("\n🎯 Enhanced Campaign Creation Test Complete!")

if __name__ == "__main__":
    test_campaign_creation()