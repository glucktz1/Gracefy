"""
Test Church CRUD, Announcements, Follow System, and Layout Sections
Tests for:
- Church CRUD operations (create, read, update, delete)
- Church approval/rejection workflow
- Church announcements CRUD
- User follow/unfollow system (requires auth)
- Singers/Choirs with followers_count
- Layout sections with 'choirs' and 'churches' types
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = f"TEST_church_{uuid.uuid4().hex[:6]}"


class TestChurchCRUD:
    """Church CRUD endpoint tests"""
    
    church_id = None
    
    def test_01_list_churches_empty_or_existing(self):
        """GET /api/churches - List all churches"""
        response = requests.get(f"{BASE_URL}/api/churches")
        assert response.status_code == 200
        data = response.json()
        assert "churches" in data
        assert "total" in data
        assert isinstance(data["churches"], list)
        print(f"✓ GET /api/churches - Found {data['total']} churches")
    
    def test_02_list_churches_with_status_filter(self):
        """GET /api/churches?status=pending - Filter by status"""
        response = requests.get(f"{BASE_URL}/api/churches?status=pending")
        assert response.status_code == 200
        data = response.json()
        assert "churches" in data
        # All returned churches should have pending status
        for church in data["churches"]:
            assert church.get("status") == "pending"
        print(f"✓ GET /api/churches?status=pending - Found {data['total']} pending churches")
    
    def test_03_create_church(self):
        """POST /api/churches - Create new church with all fields"""
        church_data = {
            "name": f"{TEST_PREFIX}_St. Mary's Cathedral",
            "denomination": "roman_catholic",
            "location": "Dar es Salaam, Tanzania",
            "address": "123 Main Street",
            "city": "Dar es Salaam",
            "country": "Tanzania",
            "direction": "Near the central market",
            "latitude": -6.8235,
            "longitude": 39.2695,
            "google_maps_url": "https://maps.google.com/?q=-6.8235,39.2695",
            "bio": "A historic cathedral serving the community since 1950",
            "leader_name": "Father John Doe",
            "leader_title": "Parish Priest",
            "leader_phone": "+255123456789",
            "leader_email": "father.john@stmarys.tz",
            "thumbnail": "https://example.com/church-thumb.jpg",
            "cover_image": "https://example.com/church-cover.jpg",
            "gallery_images": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"],
            "prayer_schedule": [
                {"day": "Sunday", "time": "08:00", "service_type": "Mass", "description": "Morning Mass"},
                {"day": "Sunday", "time": "10:30", "service_type": "Mass", "description": "High Mass"},
                {"day": "Wednesday", "time": "18:00", "service_type": "Adoration", "description": "Evening Adoration"}
            ],
            "phone": "+255987654321",
            "email": "info@stmarys.tz",
            "website": "https://stmarys.tz",
            "submitted_by": "test_user",
            "submitted_by_email": "test@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/churches", json=church_data)
        assert response.status_code == 200
        data = response.json()
        assert "church_id" in data
        assert data["message"] == "Church created successfully"
        
        TestChurchCRUD.church_id = data["church_id"]
        print(f"✓ POST /api/churches - Created church: {data['church_id']}")
    
    def test_04_get_church_by_id(self):
        """GET /api/churches/{church_id} - Get single church"""
        assert TestChurchCRUD.church_id is not None
        
        response = requests.get(f"{BASE_URL}/api/churches/{TestChurchCRUD.church_id}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify all fields
        assert data["church_id"] == TestChurchCRUD.church_id
        assert TEST_PREFIX in data["name"]
        assert data["denomination"] == "roman_catholic"
        assert data["status"] == "pending"  # Default status
        assert data["followers_count"] == 0  # Default
        assert "prayer_schedule" in data
        assert len(data["prayer_schedule"]) == 3
        print(f"✓ GET /api/churches/{TestChurchCRUD.church_id} - Retrieved church details")
    
    def test_05_get_church_not_found(self):
        """GET /api/churches/invalid_id - Returns 404"""
        response = requests.get(f"{BASE_URL}/api/churches/invalid_church_id_12345")
        assert response.status_code == 404
        print("✓ GET /api/churches/invalid_id - Returns 404 as expected")
    
    def test_06_update_church(self):
        """PUT /api/churches/{church_id} - Update church details"""
        assert TestChurchCRUD.church_id is not None
        
        updates = {
            "bio": "Updated bio - A historic cathedral serving the community since 1950, now with modern facilities",
            "phone": "+255111222333",
            "website": "https://stmarys-updated.tz"
        }
        
        response = requests.put(f"{BASE_URL}/api/churches/{TestChurchCRUD.church_id}", json=updates)
        assert response.status_code == 200
        assert response.json()["message"] == "Church updated successfully"
        
        # Verify update persisted
        get_response = requests.get(f"{BASE_URL}/api/churches/{TestChurchCRUD.church_id}")
        assert get_response.status_code == 200
        data = get_response.json()
        assert "Updated bio" in data["bio"]
        assert data["phone"] == "+255111222333"
        print(f"✓ PUT /api/churches/{TestChurchCRUD.church_id} - Updated and verified")
    
    def test_07_update_church_not_found(self):
        """PUT /api/churches/invalid_id - Returns 404"""
        response = requests.put(f"{BASE_URL}/api/churches/invalid_id", json={"bio": "test"})
        assert response.status_code == 404
        print("✓ PUT /api/churches/invalid_id - Returns 404 as expected")


class TestChurchApproval:
    """Church approval/rejection workflow tests"""
    
    church_id = None
    
    def test_01_create_church_for_approval(self):
        """Create a church to test approval workflow"""
        church_data = {
            "name": f"{TEST_PREFIX}_Approval Test Church",
            "denomination": "lutheran",
            "location": "Arusha, Tanzania"
        }
        
        response = requests.post(f"{BASE_URL}/api/churches", json=church_data)
        assert response.status_code == 200
        TestChurchApproval.church_id = response.json()["church_id"]
        
        # Verify initial status is pending
        get_response = requests.get(f"{BASE_URL}/api/churches/{TestChurchApproval.church_id}")
        assert get_response.json()["status"] == "pending"
        print(f"✓ Created church for approval test: {TestChurchApproval.church_id}")
    
    def test_02_approve_church(self):
        """POST /api/churches/{church_id}/approve - Admin approve church"""
        assert TestChurchApproval.church_id is not None
        
        approval_data = {
            "approved_by": "admin_user",
            "admin_notes": "Verified church details"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/churches/{TestChurchApproval.church_id}/approve",
            json=approval_data
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Church approved successfully"
        
        # Verify status changed
        get_response = requests.get(f"{BASE_URL}/api/churches/{TestChurchApproval.church_id}")
        data = get_response.json()
        assert data["status"] == "approved"
        assert data["approved_by"] == "admin_user"
        assert data["admin_notes"] == "Verified church details"
        print(f"✓ POST /api/churches/{TestChurchApproval.church_id}/approve - Church approved")
    
    def test_03_create_church_for_rejection(self):
        """Create another church to test rejection"""
        church_data = {
            "name": f"{TEST_PREFIX}_Rejection Test Church",
            "denomination": "pentecostal",
            "location": "Mwanza, Tanzania"
        }
        
        response = requests.post(f"{BASE_URL}/api/churches", json=church_data)
        assert response.status_code == 200
        TestChurchApproval.church_id = response.json()["church_id"]
        print(f"✓ Created church for rejection test: {TestChurchApproval.church_id}")
    
    def test_04_reject_church(self):
        """POST /api/churches/{church_id}/reject - Admin reject church"""
        assert TestChurchApproval.church_id is not None
        
        rejection_data = {
            "admin_notes": "Incomplete information provided"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/churches/{TestChurchApproval.church_id}/reject",
            json=rejection_data
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Church rejected"
        
        # Verify status changed
        get_response = requests.get(f"{BASE_URL}/api/churches/{TestChurchApproval.church_id}")
        data = get_response.json()
        assert data["status"] == "rejected"
        assert data["admin_notes"] == "Incomplete information provided"
        print(f"✓ POST /api/churches/{TestChurchApproval.church_id}/reject - Church rejected")
    
    def test_05_approve_nonexistent_church(self):
        """POST /api/churches/invalid_id/approve - Returns 404"""
        response = requests.post(f"{BASE_URL}/api/churches/invalid_id/approve", json={})
        assert response.status_code == 404
        print("✓ POST /api/churches/invalid_id/approve - Returns 404 as expected")


class TestChurchAnnouncements:
    """Church announcements CRUD tests"""
    
    church_id = None
    announcement_id = None
    
    def test_01_create_church_for_announcements(self):
        """Create an approved church for announcement tests"""
        church_data = {
            "name": f"{TEST_PREFIX}_Announcement Test Church",
            "denomination": "anglican",
            "location": "Dodoma, Tanzania"
        }
        
        response = requests.post(f"{BASE_URL}/api/churches", json=church_data)
        assert response.status_code == 200
        TestChurchAnnouncements.church_id = response.json()["church_id"]
        
        # Approve the church
        requests.post(
            f"{BASE_URL}/api/churches/{TestChurchAnnouncements.church_id}/approve",
            json={"approved_by": "admin"}
        )
        print(f"✓ Created and approved church for announcements: {TestChurchAnnouncements.church_id}")
    
    def test_02_create_announcement(self):
        """POST /api/churches/{church_id}/announcements - Create announcement"""
        assert TestChurchAnnouncements.church_id is not None
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        announcement_data = {
            "date": tomorrow,
            "title": f"{TEST_PREFIX} Sunday Mass Schedule Change",
            "announcement_type": "general",
            "description": "Due to renovations, Sunday Mass will be held at 9:00 AM instead of 8:00 AM",
            "time": "09:00",
            "contact_person": "Father John",
            "contact_phone": "+255123456789",
            "is_recurring": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/churches/{TestChurchAnnouncements.church_id}/announcements",
            json=announcement_data
        )
        assert response.status_code == 200
        data = response.json()
        assert "announcement_id" in data
        assert "Announcement created" in data["message"]
        
        TestChurchAnnouncements.announcement_id = data["announcement_id"]
        print(f"✓ POST /api/churches/.../announcements - Created: {data['announcement_id']}")
    
    def test_03_list_announcements(self):
        """GET /api/churches/{church_id}/announcements - List announcements"""
        assert TestChurchAnnouncements.church_id is not None
        
        response = requests.get(
            f"{BASE_URL}/api/churches/{TestChurchAnnouncements.church_id}/announcements"
        )
        assert response.status_code == 200
        data = response.json()
        assert "announcements" in data
        assert len(data["announcements"]) >= 1
        
        # Verify our announcement is in the list
        announcement_ids = [a["announcement_id"] for a in data["announcements"]]
        assert TestChurchAnnouncements.announcement_id in announcement_ids
        print(f"✓ GET /api/churches/.../announcements - Found {len(data['announcements'])} announcements")
    
    def test_04_update_announcement(self):
        """PUT /api/churches/{church_id}/announcements/{announcement_id} - Update"""
        assert TestChurchAnnouncements.church_id is not None
        assert TestChurchAnnouncements.announcement_id is not None
        
        updates = {
            "title": f"{TEST_PREFIX} Updated: Sunday Mass Schedule Change",
            "description": "Updated description - Mass at 9:30 AM"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/churches/{TestChurchAnnouncements.church_id}/announcements/{TestChurchAnnouncements.announcement_id}",
            json=updates
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Announcement updated"
        print(f"✓ PUT /api/churches/.../announcements/{TestChurchAnnouncements.announcement_id} - Updated")
    
    def test_05_get_church_full_details(self):
        """GET /api/churches/{church_id}/full - Get church with announcements"""
        assert TestChurchAnnouncements.church_id is not None
        
        response = requests.get(
            f"{BASE_URL}/api/churches/{TestChurchAnnouncements.church_id}/full"
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify church data
        assert data["church_id"] == TestChurchAnnouncements.church_id
        assert "announcements" in data or "announcements_list" in data
        print(f"✓ GET /api/churches/{TestChurchAnnouncements.church_id}/full - Got full details with announcements")
    
    def test_06_delete_announcement(self):
        """DELETE /api/churches/{church_id}/announcements/{announcement_id} - Delete"""
        assert TestChurchAnnouncements.church_id is not None
        assert TestChurchAnnouncements.announcement_id is not None
        
        response = requests.delete(
            f"{BASE_URL}/api/churches/{TestChurchAnnouncements.church_id}/announcements/{TestChurchAnnouncements.announcement_id}"
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Announcement deleted"
        print(f"✓ DELETE /api/churches/.../announcements/{TestChurchAnnouncements.announcement_id} - Deleted")
    
    def test_07_create_announcement_for_nonexistent_church(self):
        """POST /api/churches/invalid_id/announcements - Returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/churches/invalid_church_id/announcements",
            json={"date": "2025-01-01", "title": "Test"}
        )
        assert response.status_code == 404
        print("✓ POST /api/churches/invalid_id/announcements - Returns 404 as expected")


class TestUserFollowSystem:
    """User follow/unfollow system tests (requires authentication)"""
    
    user_token = None
    user_id = None
    church_id = None
    singer_id = None
    
    def test_01_register_test_user(self):
        """POST /api/user/register - Create test user for follow tests"""
        user_data = {
            "email": f"{TEST_PREFIX}_follow_user@example.com",
            "password": "TestPass123!",
            "name": f"{TEST_PREFIX} Follow Test User"
        }
        
        response = requests.post(f"{BASE_URL}/api/user/register", json=user_data)
        
        # User might already exist, try login
        if response.status_code == 400 and "already registered" in response.text:
            login_response = requests.post(f"{BASE_URL}/api/user/login", json={
                "email": user_data["email"],
                "password": user_data["password"]
            })
            assert login_response.status_code == 200
            data = login_response.json()
        else:
            assert response.status_code == 200
            data = response.json()
        
        assert "token" in data
        assert "user" in data
        
        TestUserFollowSystem.user_token = data["token"]
        TestUserFollowSystem.user_id = data["user"]["user_id"]
        print(f"✓ User registered/logged in: {TestUserFollowSystem.user_id}")
    
    def test_02_create_church_to_follow(self):
        """Create a church to follow"""
        church_data = {
            "name": f"{TEST_PREFIX}_Church to Follow",
            "denomination": "roman_catholic",
            "location": "Zanzibar, Tanzania"
        }
        
        response = requests.post(f"{BASE_URL}/api/churches", json=church_data)
        assert response.status_code == 200
        TestUserFollowSystem.church_id = response.json()["church_id"]
        
        # Approve it
        requests.post(
            f"{BASE_URL}/api/churches/{TestUserFollowSystem.church_id}/approve",
            json={"approved_by": "admin"}
        )
        print(f"✓ Created church to follow: {TestUserFollowSystem.church_id}")
    
    def test_03_create_singer_to_follow(self):
        """Create a singer/choir to follow"""
        singer_data = {
            "name": f"{TEST_PREFIX}_Choir to Follow",
            "type": "choir",
            "denomination": "lutheran",
            "location": "Moshi, Tanzania"
        }
        
        response = requests.post(f"{BASE_URL}/api/singers", json=singer_data)
        assert response.status_code == 200
        TestUserFollowSystem.singer_id = response.json()["singer_id"]
        print(f"✓ Created singer/choir to follow: {TestUserFollowSystem.singer_id}")
    
    def test_04_follow_church(self):
        """POST /api/user/follow - Follow a church (requires auth)"""
        assert TestUserFollowSystem.user_token is not None
        assert TestUserFollowSystem.church_id is not None
        
        headers = {"Authorization": f"Bearer {TestUserFollowSystem.user_token}"}
        follow_data = {
            "entity_type": "church",
            "entity_id": TestUserFollowSystem.church_id
        }
        
        response = requests.post(
            f"{BASE_URL}/api/user/follow",
            json=follow_data,
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "follow_id" in data
        assert "Now following" in data["message"]
        print(f"✓ POST /api/user/follow - Followed church: {data['follow_id']}")
    
    def test_05_follow_choir(self):
        """POST /api/user/follow - Follow a choir (requires auth)"""
        assert TestUserFollowSystem.user_token is not None
        assert TestUserFollowSystem.singer_id is not None
        
        headers = {"Authorization": f"Bearer {TestUserFollowSystem.user_token}"}
        follow_data = {
            "entity_type": "choir",
            "entity_id": TestUserFollowSystem.singer_id
        }
        
        response = requests.post(
            f"{BASE_URL}/api/user/follow",
            json=follow_data,
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "follow_id" in data
        print(f"✓ POST /api/user/follow - Followed choir: {data['follow_id']}")
    
    def test_06_follow_already_following(self):
        """POST /api/user/follow - Already following returns 400"""
        assert TestUserFollowSystem.user_token is not None
        assert TestUserFollowSystem.church_id is not None
        
        headers = {"Authorization": f"Bearer {TestUserFollowSystem.user_token}"}
        follow_data = {
            "entity_type": "church",
            "entity_id": TestUserFollowSystem.church_id
        }
        
        response = requests.post(
            f"{BASE_URL}/api/user/follow",
            json=follow_data,
            headers=headers
        )
        assert response.status_code == 400
        assert "Already following" in response.json()["detail"]
        print("✓ POST /api/user/follow - Already following returns 400 as expected")
    
    def test_07_check_is_following_church(self):
        """GET /api/user/is-following/{entity_type}/{entity_id} - Check if following"""
        assert TestUserFollowSystem.user_token is not None
        assert TestUserFollowSystem.church_id is not None
        
        headers = {"Authorization": f"Bearer {TestUserFollowSystem.user_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/user/is-following/church/{TestUserFollowSystem.church_id}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_following"] == True
        print(f"✓ GET /api/user/is-following/church/{TestUserFollowSystem.church_id} - is_following=True")
    
    def test_08_check_is_following_not_following(self):
        """GET /api/user/is-following - Check entity not following"""
        assert TestUserFollowSystem.user_token is not None
        
        headers = {"Authorization": f"Bearer {TestUserFollowSystem.user_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/user/is-following/church/nonexistent_church_id",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_following"] == False
        print("✓ GET /api/user/is-following - Not following returns is_following=False")
    
    def test_09_get_user_following(self):
        """GET /api/user/following - Get user's followed entities"""
        assert TestUserFollowSystem.user_token is not None
        
        headers = {"Authorization": f"Bearer {TestUserFollowSystem.user_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/user/following",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "churches" in data
        assert "choirs" in data
        assert "total" in data
        assert data["total"] >= 2  # We followed 1 church and 1 choir
        assert len(data["churches"]) >= 1
        assert len(data["choirs"]) >= 1
        print(f"✓ GET /api/user/following - Following {data['total']} entities")
    
    def test_10_verify_followers_count_incremented(self):
        """Verify followers_count was incremented on church and singer"""
        assert TestUserFollowSystem.church_id is not None
        assert TestUserFollowSystem.singer_id is not None
        
        # Check church followers_count
        church_response = requests.get(f"{BASE_URL}/api/churches/{TestUserFollowSystem.church_id}")
        assert church_response.status_code == 200
        church_data = church_response.json()
        assert church_data["followers_count"] >= 1
        print(f"✓ Church followers_count: {church_data['followers_count']}")
        
        # Check singer followers_count
        singers_response = requests.get(f"{BASE_URL}/api/singers")
        assert singers_response.status_code == 200
        singers_data = singers_response.json()
        
        # Find our singer
        our_singer = next(
            (s for s in singers_data["singers"] if s["singer_id"] == TestUserFollowSystem.singer_id),
            None
        )
        if our_singer:
            assert our_singer["followers_count"] >= 1
            print(f"✓ Singer followers_count: {our_singer['followers_count']}")
    
    def test_11_unfollow_church(self):
        """DELETE /api/user/unfollow - Unfollow entity (requires auth)"""
        assert TestUserFollowSystem.user_token is not None
        assert TestUserFollowSystem.church_id is not None
        
        headers = {"Authorization": f"Bearer {TestUserFollowSystem.user_token}"}
        unfollow_data = {
            "entity_type": "church",
            "entity_id": TestUserFollowSystem.church_id
        }
        
        response = requests.delete(
            f"{BASE_URL}/api/user/unfollow",
            json=unfollow_data,
            headers=headers
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Unfollowed successfully"
        print(f"✓ DELETE /api/user/unfollow - Unfollowed church")
    
    def test_12_verify_is_following_after_unfollow(self):
        """Verify is_following returns False after unfollow"""
        assert TestUserFollowSystem.user_token is not None
        assert TestUserFollowSystem.church_id is not None
        
        headers = {"Authorization": f"Bearer {TestUserFollowSystem.user_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/user/is-following/church/{TestUserFollowSystem.church_id}",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_following"] == False
        print("✓ After unfollow, is_following=False")
    
    def test_13_follow_without_auth(self):
        """POST /api/user/follow - Without auth returns 401"""
        follow_data = {
            "entity_type": "church",
            "entity_id": "some_church_id"
        }
        
        response = requests.post(f"{BASE_URL}/api/user/follow", json=follow_data)
        assert response.status_code == 401
        print("✓ POST /api/user/follow without auth - Returns 401 as expected")
    
    def test_14_following_without_auth(self):
        """GET /api/user/following - Without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/user/following")
        assert response.status_code == 401
        print("✓ GET /api/user/following without auth - Returns 401 as expected")


class TestSingersWithFollowers:
    """Test singers/choirs endpoint includes followers_count"""
    
    def test_01_get_singers_list(self):
        """GET /api/singers - List singers/choirs with followers_count"""
        response = requests.get(f"{BASE_URL}/api/singers")
        assert response.status_code == 200
        data = response.json()
        
        assert "singers" in data
        assert "total" in data
        
        # Verify singers have followers_count field (may be 0 or missing for old records)
        # The Singer model defines followers_count with default 0
        for singer in data["singers"]:
            # followers_count should exist, but old records might not have it
            # The model default is 0, so we check if it's an int when present
            if "followers_count" in singer:
                assert isinstance(singer["followers_count"], int)
        
        print(f"✓ GET /api/singers - Found {data['total']} singers")
    
    def test_02_get_singers_with_type_filter(self):
        """GET /api/singers?type=choir - Filter by type"""
        response = requests.get(f"{BASE_URL}/api/singers?type=choir")
        assert response.status_code == 200
        data = response.json()
        
        # All returned should be choirs
        for singer in data["singers"]:
            assert singer.get("type") == "choir"
        
        print(f"✓ GET /api/singers?type=choir - Found {data['total']} choirs")


class TestLayoutSections:
    """Test layout sections include 'choirs' and 'churches' types"""
    
    def test_01_get_layout_sections(self):
        """GET /api/layout/sections - Verify section types"""
        response = requests.get(f"{BASE_URL}/api/layout/sections")
        assert response.status_code == 200
        data = response.json()
        
        assert "sections" in data
        print(f"✓ GET /api/layout/sections - Found {len(data['sections'])} sections")
    
    def test_02_create_choirs_section(self):
        """POST /api/layout/sections - Create section with type 'choirs'"""
        section_data = {
            "name": f"{TEST_PREFIX}_choirs_section",
            "display_name": "Featured Choirs",
            "section_type": "choirs",
            "content_type": "choirs",
            "description": "Test section for choirs",
            "platforms": ["app", "web"],
            "is_active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/layout/sections", json=section_data)
        assert response.status_code == 200
        data = response.json()
        assert "section_id" in data
        
        # Verify section was created with correct type
        get_response = requests.get(f"{BASE_URL}/api/layout/sections/{data['section_id']}")
        assert get_response.status_code == 200
        section = get_response.json()
        assert section["section_type"] == "choirs"
        assert section["content_type"] == "choirs"
        
        print(f"✓ POST /api/layout/sections - Created choirs section: {data['section_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout/sections/{data['section_id']}")
    
    def test_03_create_churches_section(self):
        """POST /api/layout/sections - Create section with type 'churches'"""
        section_data = {
            "name": f"{TEST_PREFIX}_churches_section",
            "display_name": "Featured Churches",
            "section_type": "churches",
            "content_type": "churches",
            "description": "Test section for churches",
            "platforms": ["app", "web"],
            "is_active": True
        }
        
        response = requests.post(f"{BASE_URL}/api/layout/sections", json=section_data)
        assert response.status_code == 200
        data = response.json()
        assert "section_id" in data
        
        # Verify section was created with correct type
        get_response = requests.get(f"{BASE_URL}/api/layout/sections/{data['section_id']}")
        assert get_response.status_code == 200
        section = get_response.json()
        assert section["section_type"] == "churches"
        assert section["content_type"] == "churches"
        
        print(f"✓ POST /api/layout/sections - Created churches section: {data['section_id']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/layout/sections/{data['section_id']}")


class TestChurchDelete:
    """Test church deletion (cleanup)"""
    
    def test_01_delete_church(self):
        """DELETE /api/churches/{church_id} - Delete church"""
        # Create a church to delete
        church_data = {
            "name": f"{TEST_PREFIX}_Delete Test Church",
            "denomination": "pentecostal",
            "location": "Test Location"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/churches", json=church_data)
        assert create_response.status_code == 200
        church_id = create_response.json()["church_id"]
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/churches/{church_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Church deleted successfully"
        
        # Verify it's gone
        get_response = requests.get(f"{BASE_URL}/api/churches/{church_id}")
        assert get_response.status_code == 404
        
        print(f"✓ DELETE /api/churches/{church_id} - Deleted and verified")
    
    def test_02_delete_nonexistent_church(self):
        """DELETE /api/churches/invalid_id - Returns 404"""
        response = requests.delete(f"{BASE_URL}/api/churches/invalid_church_id")
        assert response.status_code == 404
        print("✓ DELETE /api/churches/invalid_id - Returns 404 as expected")


# Cleanup function to remove test data
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests complete"""
    yield
    
    # Cleanup churches with TEST_PREFIX
    try:
        churches_response = requests.get(f"{BASE_URL}/api/churches")
        if churches_response.status_code == 200:
            for church in churches_response.json().get("churches", []):
                if TEST_PREFIX in church.get("name", ""):
                    requests.delete(f"{BASE_URL}/api/churches/{church['church_id']}")
        
        # Cleanup singers with TEST_PREFIX
        singers_response = requests.get(f"{BASE_URL}/api/singers")
        if singers_response.status_code == 200:
            for singer in singers_response.json().get("singers", []):
                if TEST_PREFIX in singer.get("name", ""):
                    requests.delete(f"{BASE_URL}/api/singers/{singer['singer_id']}")
        
        print(f"\n✓ Cleanup completed for test data with prefix: {TEST_PREFIX}")
    except Exception as e:
        print(f"\n⚠ Cleanup error: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
