#!/usr/bin/env python3
"""
Test script for enhanced campaign targeting functionality
"""

import asyncio
import sys
import os
sys.path.append('/app')

from backend.routes.advertising import get_target_users
from core.database import get_db

async def test_enhanced_filtering():
    """Test the enhanced get_target_users function"""
    db = get_db()
    
    print("Testing Enhanced Campaign Targeting...")
    
    # Test 1: Basic filter (all users)
    print("\n1. Testing basic 'all' filter:")
    filter_config = {"type": "all"}
    users = await get_target_users(db, filter_config)
    print(f"   Found {len(users)} total users")
    
    # Test 2: Location filter
    print("\n2. Testing location filter (country='US'):")
    filter_config = {
        "type": "all",
        "country": "US"
    }
    users = await get_target_users(db, filter_config)
    print(f"   Found {len(users)} users in US")
    
    # Test 3: Premium users
    print("\n3. Testing premium users filter:")
    filter_config = {"type": "premium"}
    users = await get_target_users(db, filter_config)
    print(f"   Found {len(users)} premium users")
    
    # Test 4: Free users with email
    print("\n4. Testing free users with email:")
    filter_config = {
        "type": "free",
        "has_email": True
    }
    users = await get_target_users(db, filter_config)
    print(f"   Found {len(users)} free users with email")
    
    # Test 5: Active users with push tokens
    print("\n5. Testing active users with push tokens:")
    filter_config = {
        "type": "active",
        "has_push_token": True
    }
    users = await get_target_users(db, filter_config)
    print(f"   Found {len(users)} active users with push tokens")
    
    # Test 6: Max users limit
    print("\n6. Testing max users limit (max 10):")
    filter_config = {
        "type": "all",
        "max_users": 10
    }
    users = await get_target_users(db, filter_config)
    print(f"   Found {len(users)} users (should be max 10)")
    
    # Test 7: Content listening filter (if we have listening data)
    print("\n7. Testing content listening filter:")
    filter_config = {
        "type": "all",
        "listened_content_ids": ["song123", "album456"]
    }
    users = await get_target_users(db, filter_config)
    print(f"   Found {len(users)} users who listened to specific content")
    
    print("\n✅ Enhanced filtering tests completed!")
    
    # Show sample user data structure
    if users:
        print(f"\nSample user data structure:")
        sample_user = users[0]
        for key, value in sample_user.items():
            print(f"   {key}: {value}")

if __name__ == "__main__":
    asyncio.run(test_enhanced_filtering())