"""
Test Suite for Layout Management System - Phase 3
Tests all layout sections and burners CRUD operations, reordering, toggling, and content assignment
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestLayoutSections:
    """Tests for Layout Sections CRUD operations"""
    
    created_section_id = None
    
    def test_get_all_sections(self):
        """GET /api/layout/sections - fetch all layout sections"""
        response = requests.get(f"{BASE_URL}/api/layout/sections")
        assert response.status_code == 200
        
        data = response.json()
        assert "sections" in data
        assert "total" in data
        assert isinstance(data["sections"], list)
        
        # Default sections should be created if none exist
        if data["total"] > 0:
            section = data["sections"][0]
            assert "section_id" in section
            assert "name" in section
            assert "display_name" in section
            assert "section_type" in section
            assert "platforms" in section
            assert "is_active" in section
            assert "sort_order" in section
        
        print(f"✓ GET /api/layout/sections - Found {data['total']} sections")
    
    def test_get_sections_by_platform(self):
        """GET /api/layout/sections?platform=app - filter by platform"""
        response = requests.get(f"{BASE_URL}/api/layout/sections?platform=app")
        assert response.status_code == 200
        
        data = response.json()
        # All returned sections should include 'app' in platforms
        for section in data["sections"]:
            assert "app" in section.get("platforms", [])
        
        print(f"✓ GET /api/layout/sections?platform=app - Found {data['total']} app sections")
    
    def test_get_active_sections_only(self):
        """GET /api/layout/sections?active_only=true - filter active sections"""
        response = requests.get(f"{BASE_URL}/api/layout/sections?active_only=true")
        assert response.status_code == 200
        
        data = response.json()
        for section in data["sections"]:
            assert section.get("is_active") == True
        
        print(f"✓ GET /api/layout/sections?active_only=true - Found {data['total']} active sections")
    
    def test_create_section(self):
        """POST /api/layout/sections - create a new section"""
        payload = {
            "name": "TEST_christmas_songs",
            "display_name": "TEST Christmas Songs",
            "section_type": "seasonal",
            "description": "Test seasonal section for Christmas music",
            "platforms": ["app", "web"],
            "content_type": "albums",
            "content_count": 8,
            "background_color": "#1e3a5f",
            "background_gradient": "linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%)"
        }
        
        response = requests.post(f"{BASE_URL}/api/layout/sections", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "section_id" in data
        assert data["message"] == "Section created"
        
        TestLayoutSections.created_section_id = data["section_id"]
        print(f"✓ POST /api/layout/sections - Created section: {data['section_id']}")
    
    def test_get_single_section(self):
        """GET /api/layout/sections/{section_id} - get specific section"""
        if not TestLayoutSections.created_section_id:
            pytest.skip("No section created to fetch")
        
        response = requests.get(f"{BASE_URL}/api/layout/sections/{TestLayoutSections.created_section_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["section_id"] == TestLayoutSections.created_section_id
        assert data["name"] == "TEST_christmas_songs"
        assert data["display_name"] == "TEST Christmas Songs"
        assert data["section_type"] == "seasonal"
        
        print(f"✓ GET /api/layout/sections/{TestLayoutSections.created_section_id} - Section retrieved")
    
    def test_update_section(self):
        """PUT /api/layout/sections/{section_id} - update a section"""
        if not TestLayoutSections.created_section_id:
            pytest.skip("No section created to update")
        
        payload = {
            "display_name": "TEST Christmas Songs Updated",
            "description": "Updated description for Christmas section",
            "content_count": 12
        }
        
        response = requests.put(
            f"{BASE_URL}/api/layout/sections/{TestLayoutSections.created_section_id}",
            json=payload
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Section updated"
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/layout/sections/{TestLayoutSections.created_section_id}")
        verify_data = verify_response.json()
        assert verify_data["display_name"] == "TEST Christmas Songs Updated"
        assert verify_data["content_count"] == 12
        
        print(f"✓ PUT /api/layout/sections/{TestLayoutSections.created_section_id} - Section updated")
    
    def test_toggle_section_inactive(self):
        """PUT /api/layout/sections/{section_id}/toggle - deactivate section"""
        if not TestLayoutSections.created_section_id:
            pytest.skip("No section created to toggle")
        
        response = requests.put(
            f"{BASE_URL}/api/layout/sections/{TestLayoutSections.created_section_id}/toggle",
            json={"is_active": False}
        )
        assert response.status_code == 200
        assert "deactivated" in response.json()["message"]
        
        # Verify toggle
        verify_response = requests.get(f"{BASE_URL}/api/layout/sections/{TestLayoutSections.created_section_id}")
        assert verify_response.json()["is_active"] == False
        
        print(f"✓ PUT /api/layout/sections/{TestLayoutSections.created_section_id}/toggle - Section deactivated")
    
    def test_toggle_section_active(self):
        """PUT /api/layout/sections/{section_id}/toggle - activate section"""
        if not TestLayoutSections.created_section_id:
            pytest.skip("No section created to toggle")
        
        response = requests.put(
            f"{BASE_URL}/api/layout/sections/{TestLayoutSections.created_section_id}/toggle",
            json={"is_active": True}
        )
        assert response.status_code == 200
        assert "activated" in response.json()["message"]
        
        print(f"✓ PUT /api/layout/sections/{TestLayoutSections.created_section_id}/toggle - Section activated")
    
    def test_assign_content_to_section(self):
        """POST /api/layout/sections/{section_id}/assign-content - assign content"""
        if not TestLayoutSections.created_section_id:
            pytest.skip("No section created to assign content")
        
        # First get some albums to assign
        albums_response = requests.get(f"{BASE_URL}/api/albums?limit=3")
        albums_data = albums_response.json()
        album_ids = [a["album_id"] for a in albums_data.get("albums", [])[:3]]
        
        payload = {
            "content_type": "albums",
            "content_ids": album_ids
        }
        
        response = requests.post(
            f"{BASE_URL}/api/layout/sections/{TestLayoutSections.created_section_id}/assign-content",
            json=payload
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Content assigned to section"
        
        # Verify assignment
        verify_response = requests.get(f"{BASE_URL}/api/layout/sections/{TestLayoutSections.created_section_id}")
        verify_data = verify_response.json()
        assert verify_data["content_type"] == "albums"
        assert verify_data["content_ids"] == album_ids
        
        print(f"✓ POST /api/layout/sections/{TestLayoutSections.created_section_id}/assign-content - Content assigned")
    
    def test_reorder_sections(self):
        """POST /api/layout/sections/reorder - reorder sections"""
        # Get current sections
        response = requests.get(f"{BASE_URL}/api/layout/sections")
        sections = response.json()["sections"]
        
        if len(sections) < 2:
            pytest.skip("Need at least 2 sections to test reorder")
        
        # Reverse the order
        section_ids = [s["section_id"] for s in sections]
        reversed_order = list(reversed(section_ids))
        
        response = requests.post(
            f"{BASE_URL}/api/layout/sections/reorder",
            json={"section_order": reversed_order}
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Sections reordered"
        
        print(f"✓ POST /api/layout/sections/reorder - Sections reordered")
    
    def test_section_not_found(self):
        """GET /api/layout/sections/{invalid_id} - 404 for non-existent section"""
        response = requests.get(f"{BASE_URL}/api/layout/sections/invalid_section_id_12345")
        assert response.status_code == 404
        
        print("✓ GET /api/layout/sections/invalid_id - Returns 404")
    
    def test_delete_section(self):
        """DELETE /api/layout/sections/{section_id} - delete a section"""
        if not TestLayoutSections.created_section_id:
            pytest.skip("No section created to delete")
        
        response = requests.delete(f"{BASE_URL}/api/layout/sections/{TestLayoutSections.created_section_id}")
        assert response.status_code == 200
        assert response.json()["message"] == "Section deleted"
        
        # Verify deletion
        verify_response = requests.get(f"{BASE_URL}/api/layout/sections/{TestLayoutSections.created_section_id}")
        assert verify_response.status_code == 404
        
        print(f"✓ DELETE /api/layout/sections/{TestLayoutSections.created_section_id} - Section deleted")


class TestLayoutBurners:
    """Tests for Layout Burners (promotional banners) CRUD operations"""
    
    created_burner_id = None
    
    def test_get_all_burners(self):
        """GET /api/layout/burners - fetch all burners"""
        response = requests.get(f"{BASE_URL}/api/layout/burners")
        assert response.status_code == 200
        
        data = response.json()
        assert "burners" in data
        assert "total" in data
        assert isinstance(data["burners"], list)
        
        # Default burners should be created if none exist
        if data["total"] > 0:
            burner = data["burners"][0]
            assert "burner_id" in burner
            assert "name" in burner
            assert "headline" in burner
            assert "cta_text" in burner
            assert "platforms" in burner
            assert "is_active" in burner
        
        print(f"✓ GET /api/layout/burners - Found {data['total']} burners")
    
    def test_get_burners_by_platform(self):
        """GET /api/layout/burners?platform=web - filter by platform"""
        response = requests.get(f"{BASE_URL}/api/layout/burners?platform=web")
        assert response.status_code == 200
        
        data = response.json()
        for burner in data["burners"]:
            assert "web" in burner.get("platforms", [])
        
        print(f"✓ GET /api/layout/burners?platform=web - Found {data['total']} web burners")
    
    def test_create_burner(self):
        """POST /api/layout/burners - create a new burner"""
        payload = {
            "name": "TEST_premium_promo",
            "icon": "crown",
            "icon_color": "#fbbf24",
            "headline": "TEST Upgrade to Premium",
            "subtitle": "Enjoy ad-free music with offline listening",
            "cta_text": "Get Premium",
            "cta_link": "/subscription",
            "cta_link_type": "payment",
            "background_type": "gradient",
            "background_color": "#1e1b4b",
            "background_gradient": "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
            "text_color": "#ffffff",
            "button_color": "#fbbf24",
            "button_text_color": "#000000",
            "platforms": ["app", "web"]
        }
        
        response = requests.post(f"{BASE_URL}/api/layout/burners", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "burner_id" in data
        assert data["message"] == "Burner created"
        
        TestLayoutBurners.created_burner_id = data["burner_id"]
        print(f"✓ POST /api/layout/burners - Created burner: {data['burner_id']}")
    
    def test_get_single_burner(self):
        """GET /api/layout/burners/{burner_id} - get specific burner"""
        if not TestLayoutBurners.created_burner_id:
            pytest.skip("No burner created to fetch")
        
        response = requests.get(f"{BASE_URL}/api/layout/burners/{TestLayoutBurners.created_burner_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["burner_id"] == TestLayoutBurners.created_burner_id
        assert data["name"] == "TEST_premium_promo"
        assert data["headline"] == "TEST Upgrade to Premium"
        assert data["cta_text"] == "Get Premium"
        
        print(f"✓ GET /api/layout/burners/{TestLayoutBurners.created_burner_id} - Burner retrieved")
    
    def test_update_burner(self):
        """PUT /api/layout/burners/{burner_id} - update a burner"""
        if not TestLayoutBurners.created_burner_id:
            pytest.skip("No burner created to update")
        
        payload = {
            "headline": "TEST Premium - Updated",
            "subtitle": "Updated subtitle for premium promo",
            "cta_text": "Upgrade Now",
            "button_color": "#10b981"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/layout/burners/{TestLayoutBurners.created_burner_id}",
            json=payload
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Burner updated"
        
        # Verify update
        verify_response = requests.get(f"{BASE_URL}/api/layout/burners/{TestLayoutBurners.created_burner_id}")
        verify_data = verify_response.json()
        assert verify_data["headline"] == "TEST Premium - Updated"
        assert verify_data["cta_text"] == "Upgrade Now"
        assert verify_data["button_color"] == "#10b981"
        
        print(f"✓ PUT /api/layout/burners/{TestLayoutBurners.created_burner_id} - Burner updated")
    
    def test_toggle_burner_inactive(self):
        """PUT /api/layout/burners/{burner_id}/toggle - deactivate burner"""
        if not TestLayoutBurners.created_burner_id:
            pytest.skip("No burner created to toggle")
        
        response = requests.put(
            f"{BASE_URL}/api/layout/burners/{TestLayoutBurners.created_burner_id}/toggle",
            json={"is_active": False}
        )
        assert response.status_code == 200
        assert "deactivated" in response.json()["message"]
        
        # Verify toggle
        verify_response = requests.get(f"{BASE_URL}/api/layout/burners/{TestLayoutBurners.created_burner_id}")
        assert verify_response.json()["is_active"] == False
        
        print(f"✓ PUT /api/layout/burners/{TestLayoutBurners.created_burner_id}/toggle - Burner deactivated")
    
    def test_toggle_burner_active(self):
        """PUT /api/layout/burners/{burner_id}/toggle - activate burner"""
        if not TestLayoutBurners.created_burner_id:
            pytest.skip("No burner created to toggle")
        
        response = requests.put(
            f"{BASE_URL}/api/layout/burners/{TestLayoutBurners.created_burner_id}/toggle",
            json={"is_active": True}
        )
        assert response.status_code == 200
        assert "activated" in response.json()["message"]
        
        print(f"✓ PUT /api/layout/burners/{TestLayoutBurners.created_burner_id}/toggle - Burner activated")
    
    def test_burner_not_found(self):
        """GET /api/layout/burners/{invalid_id} - 404 for non-existent burner"""
        response = requests.get(f"{BASE_URL}/api/layout/burners/invalid_burner_id_12345")
        assert response.status_code == 404
        
        print("✓ GET /api/layout/burners/invalid_id - Returns 404")
    
    def test_delete_burner(self):
        """DELETE /api/layout/burners/{burner_id} - delete a burner"""
        if not TestLayoutBurners.created_burner_id:
            pytest.skip("No burner created to delete")
        
        response = requests.delete(f"{BASE_URL}/api/layout/burners/{TestLayoutBurners.created_burner_id}")
        assert response.status_code == 200
        assert response.json()["message"] == "Burner deleted"
        
        # Verify deletion
        verify_response = requests.get(f"{BASE_URL}/api/layout/burners/{TestLayoutBurners.created_burner_id}")
        assert verify_response.status_code == 404
        
        print(f"✓ DELETE /api/layout/burners/{TestLayoutBurners.created_burner_id} - Burner deleted")


class TestLayoutConfig:
    """Tests for Layout Configuration endpoints"""
    
    def test_get_layout_config_app(self):
        """GET /api/layout/config/app - get app layout configuration"""
        response = requests.get(f"{BASE_URL}/api/layout/config/app")
        assert response.status_code == 200
        
        data = response.json()
        assert "sections" in data
        assert "burners" in data
        assert "platform" in data
        assert data["platform"] == "app"
        
        print(f"✓ GET /api/layout/config/app - Config retrieved with {len(data['sections'])} sections, {len(data['burners'])} burners")
    
    def test_get_layout_config_web(self):
        """GET /api/layout/config/web - get web layout configuration"""
        response = requests.get(f"{BASE_URL}/api/layout/config/web")
        assert response.status_code == 200
        
        data = response.json()
        assert "sections" in data
        assert "burners" in data
        assert data["platform"] == "web"
        
        print(f"✓ GET /api/layout/config/web - Config retrieved with {len(data['sections'])} sections, {len(data['burners'])} burners")
    
    def test_get_layout_config_invalid_platform(self):
        """GET /api/layout/config/invalid - 400 for invalid platform"""
        response = requests.get(f"{BASE_URL}/api/layout/config/invalid")
        assert response.status_code == 400
        
        print("✓ GET /api/layout/config/invalid - Returns 400 for invalid platform")


class TestLayoutAnalytics:
    """Tests for Layout Analytics tracking endpoints"""
    
    def test_track_section_click(self):
        """POST /api/layout/sections/{section_id}/track-click - track section click"""
        # Get a section first
        sections_response = requests.get(f"{BASE_URL}/api/layout/sections")
        sections = sections_response.json()["sections"]
        
        if not sections:
            pytest.skip("No sections available to track")
        
        section_id = sections[0]["section_id"]
        initial_clicks = sections[0].get("clicks_count", 0)
        
        response = requests.post(f"{BASE_URL}/api/layout/sections/{section_id}/track-click")
        assert response.status_code == 200
        
        # Verify click count increased
        verify_response = requests.get(f"{BASE_URL}/api/layout/sections/{section_id}")
        new_clicks = verify_response.json().get("clicks_count", 0)
        assert new_clicks == initial_clicks + 1
        
        print(f"✓ POST /api/layout/sections/{section_id}/track-click - Click tracked")
    
    def test_track_burner_click(self):
        """POST /api/layout/burners/{burner_id}/track-click - track burner click"""
        # Get a burner first
        burners_response = requests.get(f"{BASE_URL}/api/layout/burners")
        burners = burners_response.json()["burners"]
        
        if not burners:
            pytest.skip("No burners available to track")
        
        burner_id = burners[0]["burner_id"]
        initial_clicks = burners[0].get("clicks_count", 0)
        
        response = requests.post(f"{BASE_URL}/api/layout/burners/{burner_id}/track-click")
        assert response.status_code == 200
        
        # Verify click count increased
        verify_response = requests.get(f"{BASE_URL}/api/layout/burners/{burner_id}")
        new_clicks = verify_response.json().get("clicks_count", 0)
        assert new_clicks == initial_clicks + 1
        
        print(f"✓ POST /api/layout/burners/{burner_id}/track-click - Click tracked")
    
    def test_track_burner_impression(self):
        """POST /api/layout/burners/{burner_id}/track-impression - track burner impression"""
        # Get a burner first
        burners_response = requests.get(f"{BASE_URL}/api/layout/burners")
        burners = burners_response.json()["burners"]
        
        if not burners:
            pytest.skip("No burners available to track")
        
        burner_id = burners[0]["burner_id"]
        initial_impressions = burners[0].get("impressions_count", 0)
        
        response = requests.post(f"{BASE_URL}/api/layout/burners/{burner_id}/track-impression")
        assert response.status_code == 200
        
        # Verify impression count increased
        verify_response = requests.get(f"{BASE_URL}/api/layout/burners/{burner_id}")
        new_impressions = verify_response.json().get("impressions_count", 0)
        assert new_impressions == initial_impressions + 1
        
        print(f"✓ POST /api/layout/burners/{burner_id}/track-impression - Impression tracked")


# Cleanup test data
class TestCleanup:
    """Cleanup any remaining test data"""
    
    def test_cleanup_test_sections(self):
        """Cleanup TEST_ prefixed sections"""
        response = requests.get(f"{BASE_URL}/api/layout/sections")
        sections = response.json()["sections"]
        
        deleted_count = 0
        for section in sections:
            if section.get("name", "").startswith("TEST_"):
                delete_response = requests.delete(f"{BASE_URL}/api/layout/sections/{section['section_id']}")
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleanup - Deleted {deleted_count} test sections")
    
    def test_cleanup_test_burners(self):
        """Cleanup TEST_ prefixed burners"""
        response = requests.get(f"{BASE_URL}/api/layout/burners")
        burners = response.json()["burners"]
        
        deleted_count = 0
        for burner in burners:
            if burner.get("name", "").startswith("TEST_"):
                delete_response = requests.delete(f"{BASE_URL}/api/layout/burners/{burner['burner_id']}")
                if delete_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleanup - Deleted {deleted_count} test burners")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
