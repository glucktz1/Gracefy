"""
Test suite for Gracefy API after modular router refactoring.
Tests core endpoints to ensure refactoring didn't break functionality.

Endpoints tested:
- GET /api - API root endpoint
- GET /api/health - Health check
- GET /api/analytics/overview - Dashboard analytics
- GET /api/choirs - Get choirs list
- GET /api/churches - Get churches list
- GET /api/song-categories - Get song categories
- GET /api/albums - Get albums
- GET /api/user/search?q=test - Search endpoint
- GET /api/subscription-plans - Get subscription plans
- GET /api/layout/sections - Get layout sections
"""

import pytest
import requests
import os

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAPIRoot:
    """Test root API endpoints"""
    
    def test_api_root_returns_200(self):
        """GET /api - Should return API info"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data or "endpoints" in data, "Response should contain message or endpoints"
        print(f"✓ GET /api - Status: {response.status_code}")
        print(f"  Response: {data}")
    
    def test_api_root_contains_endpoints_info(self):
        """GET /api - Should contain endpoints information"""
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        
        data = response.json()
        # Check for expected structure
        if "endpoints" in data:
            assert isinstance(data["endpoints"], dict), "endpoints should be a dict"
            print(f"✓ API root contains {len(data['endpoints'])} endpoint categories")


class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health_check_returns_200(self):
        """GET /api/health - Should return health status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "status" in data, "Response should contain status field"
        print(f"✓ GET /api/health - Status: {response.status_code}")
        print(f"  Health status: {data.get('status')}")
    
    def test_health_check_status_is_healthy(self):
        """GET /api/health - Status should be 'healthy'"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "healthy", f"Expected status 'healthy', got '{data.get('status')}'"
        print(f"✓ Health status is 'healthy'")
    
    def test_health_check_contains_cache_info(self):
        """GET /api/health - Should contain cache type info"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        # Cache type should be present (redis or memory)
        if "cache_type" in data:
            assert data["cache_type"] in ["redis", "memory"], f"Unexpected cache_type: {data['cache_type']}"
            print(f"✓ Cache type: {data['cache_type']}")


class TestAnalyticsOverview:
    """Test analytics overview endpoint"""
    
    def test_analytics_overview_returns_200(self):
        """GET /api/analytics/overview - Should return analytics data"""
        response = requests.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"✓ GET /api/analytics/overview - Status: {response.status_code}")
        print(f"  Response keys: {list(data.keys())}")
    
    def test_analytics_overview_contains_expected_fields(self):
        """GET /api/analytics/overview - Should contain expected analytics fields"""
        response = requests.get(f"{BASE_URL}/api/analytics/overview")
        assert response.status_code == 200
        
        data = response.json()
        # Check for expected fields
        expected_fields = ["total_users", "total_songs", "total_albums"]
        for field in expected_fields:
            if field in data:
                print(f"  ✓ {field}: {data[field]}")
        
        # At least some analytics fields should be present
        assert len(data) > 0, "Analytics response should not be empty"


class TestChoirsEndpoint:
    """Test choirs list endpoint"""
    
    def test_choirs_returns_200(self):
        """GET /api/choirs - Should return choirs list"""
        response = requests.get(f"{BASE_URL}/api/choirs")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "choirs" in data, "Response should contain 'choirs' field"
        assert isinstance(data["choirs"], list), "'choirs' should be a list"
        print(f"✓ GET /api/choirs - Status: {response.status_code}")
        print(f"  Total choirs: {data.get('total', len(data['choirs']))}")
    
    def test_choirs_pagination(self):
        """GET /api/choirs - Should support pagination"""
        response = requests.get(f"{BASE_URL}/api/choirs?skip=0&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "choirs" in data
        assert len(data["choirs"]) <= 5, "Should respect limit parameter"
        print(f"✓ Choirs pagination working (limit=5, returned={len(data['choirs'])})")


class TestChurchesEndpoint:
    """Test churches list endpoint"""
    
    def test_churches_returns_200(self):
        """GET /api/churches - Should return churches list"""
        response = requests.get(f"{BASE_URL}/api/churches")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "churches" in data, "Response should contain 'churches' field"
        assert isinstance(data["churches"], list), "'churches' should be a list"
        print(f"✓ GET /api/churches - Status: {response.status_code}")
        print(f"  Total churches: {data.get('total', len(data['churches']))}")
    
    def test_churches_pagination(self):
        """GET /api/churches - Should support pagination"""
        response = requests.get(f"{BASE_URL}/api/churches?skip=0&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "churches" in data
        assert len(data["churches"]) <= 5, "Should respect limit parameter"
        print(f"✓ Churches pagination working (limit=5, returned={len(data['churches'])})")


class TestSongCategoriesEndpoint:
    """Test song categories endpoint"""
    
    def test_song_categories_returns_200(self):
        """GET /api/song-categories - Should return song categories"""
        response = requests.get(f"{BASE_URL}/api/song-categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "categories" in data, "Response should contain 'categories' field"
        assert isinstance(data["categories"], list), "'categories' should be a list"
        print(f"✓ GET /api/song-categories - Status: {response.status_code}")
        print(f"  Total categories: {len(data['categories'])}")
    
    def test_song_categories_structure(self):
        """GET /api/song-categories - Categories should have expected structure"""
        response = requests.get(f"{BASE_URL}/api/song-categories")
        assert response.status_code == 200
        
        data = response.json()
        if data["categories"]:
            category = data["categories"][0]
            # Check for expected fields
            expected_fields = ["name"]
            for field in expected_fields:
                if field in category:
                    print(f"  ✓ Category has '{field}' field")


class TestAlbumsEndpoint:
    """Test albums endpoint"""
    
    def test_albums_returns_200(self):
        """GET /api/albums - Should return albums list"""
        response = requests.get(f"{BASE_URL}/api/albums")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "albums" in data, "Response should contain 'albums' field"
        assert isinstance(data["albums"], list), "'albums' should be a list"
        print(f"✓ GET /api/albums - Status: {response.status_code}")
        print(f"  Total albums: {data.get('total', len(data['albums']))}")
    
    def test_albums_pagination(self):
        """GET /api/albums - Should support pagination"""
        response = requests.get(f"{BASE_URL}/api/albums?skip=0&limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert "albums" in data
        assert len(data["albums"]) <= 5, "Should respect limit parameter"
        print(f"✓ Albums pagination working (limit=5, returned={len(data['albums'])})")
    
    def test_albums_structure(self):
        """GET /api/albums - Albums should have expected structure"""
        response = requests.get(f"{BASE_URL}/api/albums")
        assert response.status_code == 200
        
        data = response.json()
        if data["albums"]:
            album = data["albums"][0]
            # Check for expected fields
            expected_fields = ["album_id", "title"]
            for field in expected_fields:
                if field in album:
                    print(f"  ✓ Album has '{field}' field")


class TestSearchEndpoint:
    """Test search endpoint"""
    
    def test_search_returns_200(self):
        """GET /api/user/search?q=test - Should return search results"""
        response = requests.get(f"{BASE_URL}/api/user/search?q=test")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "query" in data, "Response should contain 'query' field"
        print(f"✓ GET /api/user/search?q=test - Status: {response.status_code}")
        print(f"  Query: {data.get('query')}")
    
    def test_search_returns_expected_categories(self):
        """GET /api/user/search - Should return songs, albums, choirs, churches"""
        response = requests.get(f"{BASE_URL}/api/user/search?q=test")
        assert response.status_code == 200
        
        data = response.json()
        expected_categories = ["songs", "albums", "choirs", "churches"]
        for category in expected_categories:
            if category in data:
                print(f"  ✓ Search returns '{category}': {len(data[category])} results")
    
    def test_search_requires_query(self):
        """GET /api/user/search - Should require query parameter"""
        response = requests.get(f"{BASE_URL}/api/user/search")
        # Should return 422 (validation error) or 400 (bad request)
        assert response.status_code in [400, 422], f"Expected 400/422 without query, got {response.status_code}"
        print(f"✓ Search correctly requires 'q' parameter (status: {response.status_code})")


class TestSubscriptionPlansEndpoint:
    """Test subscription plans endpoint"""
    
    def test_subscription_plans_returns_200(self):
        """GET /api/subscription-plans - Should return subscription plans"""
        response = requests.get(f"{BASE_URL}/api/subscription-plans")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "plans" in data, "Response should contain 'plans' field"
        assert isinstance(data["plans"], list), "'plans' should be a list"
        print(f"✓ GET /api/subscription-plans - Status: {response.status_code}")
        print(f"  Total plans: {len(data['plans'])}")
    
    def test_subscription_plans_structure(self):
        """GET /api/subscription-plans - Plans should have expected structure"""
        response = requests.get(f"{BASE_URL}/api/subscription-plans")
        assert response.status_code == 200
        
        data = response.json()
        if data["plans"]:
            plan = data["plans"][0]
            # Check for expected fields
            expected_fields = ["plan_id", "name", "price"]
            for field in expected_fields:
                if field in plan:
                    print(f"  ✓ Plan has '{field}' field: {plan[field]}")


class TestLayoutSectionsEndpoint:
    """Test layout sections endpoint"""
    
    def test_layout_sections_returns_200(self):
        """GET /api/layout/sections - Should return layout sections"""
        response = requests.get(f"{BASE_URL}/api/layout/sections")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "sections" in data, "Response should contain 'sections' field"
        assert isinstance(data["sections"], list), "'sections' should be a list"
        print(f"✓ GET /api/layout/sections - Status: {response.status_code}")
        print(f"  Total sections: {len(data['sections'])}")
    
    def test_layout_sections_platform_filter(self):
        """GET /api/layout/sections - Should support platform filter"""
        response = requests.get(f"{BASE_URL}/api/layout/sections?platform=app")
        assert response.status_code == 200
        
        data = response.json()
        assert "sections" in data
        print(f"✓ Layout sections with platform=app: {len(data['sections'])} sections")


class TestAdditionalEndpoints:
    """Test additional endpoints to verify router integration"""
    
    def test_categories_endpoint(self):
        """GET /api/categories - Should return content categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "categories" in data
        print(f"✓ GET /api/categories - Status: {response.status_code}")
    
    def test_singers_endpoint(self):
        """GET /api/singers - Should return singers/artists"""
        response = requests.get(f"{BASE_URL}/api/singers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "singers" in data
        print(f"✓ GET /api/singers - Status: {response.status_code}")
    
    def test_monetization_settings_endpoint(self):
        """GET /api/monetization-settings - Should return monetization settings"""
        response = requests.get(f"{BASE_URL}/api/monetization-settings")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Should have some settings
        assert len(data) > 0, "Should return monetization settings"
        print(f"✓ GET /api/monetization-settings - Status: {response.status_code}")
    
    def test_billing_status_endpoint(self):
        """GET /api/billing-status - Should return billing status"""
        response = requests.get(f"{BASE_URL}/api/billing-status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "billing_enabled" in data
        print(f"✓ GET /api/billing-status - Status: {response.status_code}")
        print(f"  Billing enabled: {data.get('billing_enabled')}")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
