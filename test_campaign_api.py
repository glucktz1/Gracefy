#!/usr/bin/env python3
"""
Test the enhanced campaign API endpoints
"""

import requests
import json

def test_campaign_endpoints():
    """Test the enhanced campaign functionality"""
    base_url = "http://localhost:8001/api/advertising"
    
    print("🧪 Testing Enhanced Campaign API Endpoints...")
    
    # Test 1: Basic settings endpoint
    print("\n1. Testing advertising settings:")
    try:
        response = requests.get(f"{base_url}/settings", timeout=5)
        if response.status_code == 200:
            print("   ✅ Settings endpoint working")
        else:
            print(f"   ❌ Settings failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Settings error: {e}")
    
    # Test 2: List campaigns
    print("\n2. Testing campaigns list:")
    try:
        response = requests.get(f"{base_url}/campaigns", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Found {data.get('total', 0)} campaigns")
        else:
            print(f"   ❌ Campaigns list failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Campaigns error: {e}")
    
    # Test 3: Preview count with basic filter
    print("\n3. Testing basic preview count:")
    try:
        params = {
            "target_filter_type": "all",
            "campaign_type": "push"
        }
        response = requests.get(f"{base_url}/preview-target-count", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Basic filter: {data.get('target_count', 0)} users")
        else:
            print(f"   ❌ Preview count failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"   ❌ Preview error: {e}")
    
    # Test 4: Preview count with location filter
    print("\n4. Testing location filter:")
    try:
        params = {
            "target_filter_type": "all",
            "campaign_type": "push",
            "country": "US"
        }
        response = requests.get(f"{base_url}/preview-target-count", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ US users: {data.get('target_count', 0)} users")
        else:
            print(f"   ❌ Location filter failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Location error: {e}")
    
    # Test 5: Preview count with max users limit
    print("\n5. Testing max users limit:")
    try:
        params = {
            "target_filter_type": "all",
            "campaign_type": "push",
            "max_users": 10
        }
        response = requests.get(f"{base_url}/preview-target-count", params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            count = data.get('target_count', 0)
            print(f"   ✅ Limited users: {count} users (should be ≤ 10)")
            if count <= 10:
                print("   ✅ Max users limit working correctly")
            else:
                print("   ⚠️  Max users limit not applied")
        else:
            print(f"   ❌ Max users failed: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Max users error: {e}")
    
    print("\n🎯 Enhanced Campaign API Test Complete!")

if __name__ == "__main__":
    test_campaign_endpoints()