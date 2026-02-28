"""
Test suite for Campaign Targeting Features
Tests: Content search, location filters, user preview, and campaign creation with new filters
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCampaignTargeting:
    """Campaign targeting endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(
            f"{self.base_url}/api/admin/users/login",
            json={"email": "admin@spiritsongs.com", "password": "Admin@123"}
        )
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Admin login failed")
    
    # Content Search Tests
    def test_content_search_returns_results(self):
        """GET /api/advertising/content/search - returns search results"""
        response = self.session.get(f"{self.base_url}/api/advertising/content/search?q=test&content_type=all")
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "total" in data
        assert isinstance(data["results"], list)
    
    def test_content_search_filters_by_type(self):
        """GET /api/advertising/content/search - filters by content type"""
        # Test songs only
        response = self.session.get(f"{self.base_url}/api/advertising/content/search?q=test&content_type=songs")
        assert response.status_code == 200
        data = response.json()
        for item in data["results"]:
            assert item["type"] == "song"
        
        # Test albums only
        response = self.session.get(f"{self.base_url}/api/advertising/content/search?q=test&content_type=albums")
        assert response.status_code == 200
        data = response.json()
        for item in data["results"]:
            assert item["type"] == "album"
    
    def test_content_search_result_structure(self):
        """GET /api/advertising/content/search - returns correct structure"""
        response = self.session.get(f"{self.base_url}/api/advertising/content/search?q=test&content_type=all")
        assert response.status_code == 200
        data = response.json()
        if data["results"]:
            item = data["results"][0]
            assert "id" in item
            assert "type" in item
            assert "title" in item
            assert "subtitle" in item
    
    # Location Filter Tests
    def test_get_countries_returns_list(self):
        """GET /api/advertising/locations/countries - returns country list"""
        response = self.session.get(f"{self.base_url}/api/advertising/locations/countries")
        assert response.status_code == 200
        data = response.json()
        assert "countries" in data
        assert isinstance(data["countries"], list)
    
    def test_get_countries_includes_expected(self):
        """GET /api/advertising/locations/countries - includes expected countries"""
        response = self.session.get(f"{self.base_url}/api/advertising/locations/countries")
        assert response.status_code == 200
        data = response.json()
        # Based on context: Burundi, Kenya, Rwanda, Tanzania, Uganda
        expected_countries = ["Burundi", "Kenya", "Rwanda", "Tanzania", "Uganda"]
        for country in expected_countries:
            assert country in data["countries"], f"Expected {country} in countries list"
    
    def test_get_regions_for_country(self):
        """GET /api/advertising/locations/regions - returns regions for country"""
        response = self.session.get(f"{self.base_url}/api/advertising/locations/regions?country=Kenya")
        assert response.status_code == 200
        data = response.json()
        assert "regions" in data
        assert isinstance(data["regions"], list)
    
    def test_get_regions_requires_country(self):
        """GET /api/advertising/locations/regions - requires country parameter"""
        response = self.session.get(f"{self.base_url}/api/advertising/locations/regions")
        assert response.status_code == 422  # Validation error
    
    # Preview Target Count Tests
    def test_preview_target_count_basic(self):
        """GET /api/advertising/preview-target-count - returns target count"""
        response = self.session.get(
            f"{self.base_url}/api/advertising/preview-target-count?target_filter_type=all&campaign_type=push"
        )
        assert response.status_code == 200
        data = response.json()
        assert "target_count" in data
        assert "filter" in data
        assert isinstance(data["target_count"], int)
    
    def test_preview_target_count_with_country(self):
        """GET /api/advertising/preview-target-count - filters by country"""
        response = self.session.get(
            f"{self.base_url}/api/advertising/preview-target-count?target_filter_type=all&campaign_type=push&country=Kenya"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filter"]["country"] == "Kenya"
    
    def test_preview_target_count_with_max_users(self):
        """GET /api/advertising/preview-target-count - respects max_users"""
        response = self.session.get(
            f"{self.base_url}/api/advertising/preview-target-count?target_filter_type=all&campaign_type=push&max_users=5"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["target_count"] <= 5
    
    def test_preview_target_count_sample_users(self):
        """GET /api/advertising/preview-target-count - returns sample users"""
        response = self.session.get(
            f"{self.base_url}/api/advertising/preview-target-count?target_filter_type=all&campaign_type=push"
        )
        assert response.status_code == 200
        data = response.json()
        assert "sample_users" in data
        assert isinstance(data["sample_users"], list)
    
    # Preview Users Tests
    def test_preview_users_basic(self):
        """POST /api/advertising/campaigns/preview-users - returns user list"""
        response = self.session.post(
            f"{self.base_url}/api/advertising/campaigns/preview-users",
            json={"filter_type": "all", "campaign_type": "push"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "total" in data
        assert "filter_applied" in data
    
    def test_preview_users_structure(self):
        """POST /api/advertising/campaigns/preview-users - returns correct user structure"""
        response = self.session.post(
            f"{self.base_url}/api/advertising/campaigns/preview-users",
            json={"filter_type": "all", "campaign_type": "push"}
        )
        assert response.status_code == 200
        data = response.json()
        if data["users"]:
            user = data["users"][0]
            assert "user_id" in user
            assert "name" in user
            assert "email" in user
            assert "country" in user
            assert "is_premium" in user
            assert "has_push_token" in user
    
    def test_preview_users_with_country_filter(self):
        """POST /api/advertising/campaigns/preview-users - filters by country"""
        response = self.session.post(
            f"{self.base_url}/api/advertising/campaigns/preview-users",
            json={"filter_type": "all", "campaign_type": "push", "country": "Tanzania"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filter_applied"]["country"] == "Tanzania"
    
    def test_preview_users_with_content_filter(self):
        """POST /api/advertising/campaigns/preview-users - filters by content"""
        response = self.session.post(
            f"{self.base_url}/api/advertising/campaigns/preview-users",
            json={
                "filter_type": "all", 
                "campaign_type": "push",
                "listened_content_ids": ["song_test123"],
                "not_listened_content_ids": ["album_test456"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filter_applied"]["listened_content_ids"] == ["song_test123"]
        assert data["filter_applied"]["not_listened_content_ids"] == ["album_test456"]
    
    def test_preview_users_with_max_users(self):
        """POST /api/advertising/campaigns/preview-users - respects max_users"""
        response = self.session.post(
            f"{self.base_url}/api/advertising/campaigns/preview-users",
            json={"filter_type": "all", "campaign_type": "push", "max_users": 3}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["users"]) <= 3
    
    # Campaign Creation Tests
    def test_create_campaign_with_country_filter(self):
        """POST /api/advertising/campaigns - creates campaign with country filter"""
        # Remove JSON content-type for form data
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(
            f"{self.base_url}/api/advertising/campaigns",
            headers=headers,
            data={
                "name": "TEST_Country_Filter_Campaign",
                "type": "push",
                "message_body": "Test message",
                "target_filter_type": "all",
                "country": "Tanzania"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["campaign"]["target_filter"]["country"] == "Tanzania"
        
        # Cleanup
        campaign_id = data["campaign"]["campaign_id"]
        requests.delete(f"{self.base_url}/api/advertising/campaigns/{campaign_id}", headers=headers)
    
    def test_create_campaign_with_content_filters(self):
        """POST /api/advertising/campaigns - creates campaign with content filters"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(
            f"{self.base_url}/api/advertising/campaigns",
            headers=headers,
            data={
                "name": "TEST_Content_Filter_Campaign",
                "type": "push",
                "message_body": "Test message",
                "target_filter_type": "all",
                "listened_content_ids": "song_123,song_456",
                "not_listened_content_ids": "album_789"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "listened_content_ids" in data["campaign"]["target_filter"]
        assert "not_listened_content_ids" in data["campaign"]["target_filter"]
        assert data["campaign"]["target_filter"]["listened_content_ids"] == ["song_123", "song_456"]
        assert data["campaign"]["target_filter"]["not_listened_content_ids"] == ["album_789"]
        
        # Cleanup
        campaign_id = data["campaign"]["campaign_id"]
        requests.delete(f"{self.base_url}/api/advertising/campaigns/{campaign_id}", headers=headers)
    
    def test_create_campaign_with_max_users(self):
        """POST /api/advertising/campaigns - creates campaign with max_users limit"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(
            f"{self.base_url}/api/advertising/campaigns",
            headers=headers,
            data={
                "name": "TEST_Max_Users_Campaign",
                "type": "push",
                "message_body": "Test message",
                "target_filter_type": "all",
                "max_users": 100
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["campaign"]["target_filter"]["max_users"] == 100
        
        # Cleanup
        campaign_id = data["campaign"]["campaign_id"]
        requests.delete(f"{self.base_url}/api/advertising/campaigns/{campaign_id}", headers=headers)
    
    def test_create_campaign_with_excluded_users(self):
        """POST /api/advertising/campaigns - creates campaign with excluded users"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(
            f"{self.base_url}/api/advertising/campaigns",
            headers=headers,
            data={
                "name": "TEST_Excluded_Users_Campaign",
                "type": "push",
                "message_body": "Test message",
                "target_filter_type": "all",
                "excluded_user_ids": "user_123,user_456"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "excluded_user_ids" in data["campaign"]["target_filter"]
        assert data["campaign"]["target_filter"]["excluded_user_ids"] == ["user_123", "user_456"]
        
        # Cleanup
        campaign_id = data["campaign"]["campaign_id"]
        requests.delete(f"{self.base_url}/api/advertising/campaigns/{campaign_id}", headers=headers)
    
    def test_create_campaign_with_all_filters(self):
        """POST /api/advertising/campaigns - creates campaign with all new filters"""
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(
            f"{self.base_url}/api/advertising/campaigns",
            headers=headers,
            data={
                "name": "TEST_All_Filters_Campaign",
                "type": "push",
                "message_title": "Test Title",
                "message_body": "Test message",
                "target_filter_type": "active",
                "country": "Kenya",
                "region": "Nairobi",
                "listened_content_ids": "song_123",
                "not_listened_content_ids": "album_456",
                "max_users": 50,
                "excluded_user_ids": "user_789"
            }
        )
        assert response.status_code == 200
        data = response.json()
        target_filter = data["campaign"]["target_filter"]
        
        assert target_filter["type"] == "active"
        assert target_filter["country"] == "Kenya"
        assert target_filter["region"] == "Nairobi"
        assert target_filter["listened_content_ids"] == ["song_123"]
        assert target_filter["not_listened_content_ids"] == ["album_456"]
        assert target_filter["max_users"] == 50
        assert target_filter["excluded_user_ids"] == ["user_789"]
        
        # Cleanup
        campaign_id = data["campaign"]["campaign_id"]
        requests.delete(f"{self.base_url}/api/advertising/campaigns/{campaign_id}", headers=headers)


class TestCampaignTargetingEdgeCases:
    """Edge case tests for campaign targeting"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.base_url = BASE_URL
        self.session = requests.Session()
        
        # Login as admin
        login_response = self.session.post(
            f"{self.base_url}/api/admin/users/login",
            json={"email": "admin@spiritsongs.com", "password": "Admin@123"}
        )
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Admin login failed")
    
    def test_content_search_empty_query(self):
        """GET /api/advertising/content/search - handles empty query"""
        response = self.session.get(f"{self.base_url}/api/advertising/content/search?q=&content_type=all")
        # Should return empty results or validation error
        assert response.status_code in [200, 422]
    
    def test_content_search_no_results(self):
        """GET /api/advertising/content/search - handles no results"""
        response = self.session.get(f"{self.base_url}/api/advertising/content/search?q=xyznonexistent123&content_type=all")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["results"] == []
    
    def test_regions_for_nonexistent_country(self):
        """GET /api/advertising/locations/regions - handles nonexistent country"""
        response = self.session.get(f"{self.base_url}/api/advertising/locations/regions?country=NonexistentCountry")
        assert response.status_code == 200
        data = response.json()
        assert data["regions"] == []
    
    def test_preview_users_empty_filters(self):
        """POST /api/advertising/campaigns/preview-users - handles empty filters"""
        response = self.session.post(
            f"{self.base_url}/api/advertising/campaigns/preview-users",
            json={}
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
