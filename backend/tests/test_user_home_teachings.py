"""
Test User Home API - Teachings Section
Tests the /api/user/home endpoint to verify teachings section data is correctly returned.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestUserHomeTeachings:
    """Test the teachings section in user home endpoint"""

    def test_user_home_returns_sections(self):
        """Test that /api/user/home returns sections array"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        assert "sections" in data
        assert isinstance(data["sections"], list)
        assert len(data["sections"]) > 0
        print(f"✓ User home returns {len(data['sections'])} sections")

    def test_teachings_section_exists(self):
        """Test that teachings section exists with correct content_type"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        
        # Find teachings section
        teachings_sections = [
            s for s in data["sections"] 
            if s.get("content_type") == "teachings" or s.get("section_type") == "teachings"
        ]
        
        assert len(teachings_sections) > 0, "No teachings section found in user/home response"
        print(f"✓ Found {len(teachings_sections)} teachings section(s)")
        
        # Verify at least one has correct structure
        teachings_section = teachings_sections[0]
        assert teachings_section.get("content_type") == "teachings"
        assert "items" in teachings_section
        print(f"✓ Teachings section title: {teachings_section.get('title')}")

    def test_teachings_items_structure(self):
        """Test that teachings items contain required fields"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        
        # Find teachings section
        teachings_sections = [
            s for s in data["sections"] 
            if s.get("content_type") == "teachings"
        ]
        
        assert len(teachings_sections) > 0, "No teachings section found"
        teachings_section = teachings_sections[0]
        items = teachings_section.get("items", [])
        
        if len(items) == 0:
            pytest.skip("No teachings items found - section may be empty")
        
        # Verify first item structure
        teaching = items[0]
        required_fields = ["teaching_id", "name", "leader_name", "topic_count", "lesson_count"]
        
        for field in required_fields:
            assert field in teaching, f"Missing field: {field}"
            print(f"  ✓ {field}: {teaching.get(field)}")
        
        # Verify data types
        assert isinstance(teaching["teaching_id"], str)
        assert isinstance(teaching["name"], str)
        assert isinstance(teaching["leader_name"], str)
        assert isinstance(teaching["topic_count"], int)
        assert isinstance(teaching["lesson_count"], int)
        
        # Thumbnail can be optional but should be string if present
        if teaching.get("thumbnail"):
            assert isinstance(teaching["thumbnail"], str)
            print(f"  ✓ thumbnail: {teaching.get('thumbnail')}")
        
        print(f"✓ Teaching item has all required fields")

    def test_teachings_item_values(self):
        """Test that teachings items have valid values"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        
        teachings_sections = [
            s for s in data["sections"] 
            if s.get("content_type") == "teachings"
        ]
        
        if not teachings_sections or not teachings_sections[0].get("items"):
            pytest.skip("No teachings items found")
        
        teaching = teachings_sections[0]["items"][0]
        
        # Verify teaching_id format
        assert teaching["teaching_id"].startswith("teach_"), f"Invalid teaching_id format: {teaching['teaching_id']}"
        
        # Verify name is not empty
        assert len(teaching["name"]) > 0, "Teaching name should not be empty"
        
        # Verify counts are non-negative
        assert teaching["topic_count"] >= 0, "Topic count should be non-negative"
        assert teaching["lesson_count"] >= 0, "Lesson count should be non-negative"
        
        print(f"✓ Teaching '{teaching['name']}' has valid values")
        print(f"  - Leader: {teaching['leader_name']}")
        print(f"  - Topics: {teaching['topic_count']}")
        print(f"  - Lessons: {teaching['lesson_count']}")


class TestTeachingsListEndpoint:
    """Test the standalone /api/teachings endpoint"""

    def test_teachings_list_endpoint(self):
        """Test GET /api/teachings returns teachings list"""
        response = requests.get(f"{BASE_URL}/api/teachings")
        assert response.status_code == 200
        data = response.json()
        
        assert "teachings" in data
        assert isinstance(data["teachings"], list)
        assert "total" in data
        print(f"✓ GET /api/teachings returns {data['total']} teachings")

    def test_teachings_list_item_structure(self):
        """Test that teachings list items have required fields"""
        response = requests.get(f"{BASE_URL}/api/teachings")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] == 0:
            pytest.skip("No teachings in database")
        
        teaching = data["teachings"][0]
        required_fields = [
            "teaching_id", "title", "leader_name", "category_id", 
            "status", "created_at"
        ]
        
        for field in required_fields:
            assert field in teaching, f"Missing field: {field}"
        
        print(f"✓ Teaching list item has required fields")
        print(f"  - ID: {teaching['teaching_id']}")
        print(f"  - Title: {teaching['title']}")
        print(f"  - Leader: {teaching['leader_name']}")


class TestMafundishoSectionTitle:
    """Test the Mafundisho na Katekesi section title"""

    def test_section_title_swahili(self):
        """Test that teachings section has Swahili title"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        
        teachings_sections = [
            s for s in data["sections"] 
            if s.get("section_type") == "teachings"
        ]
        
        assert len(teachings_sections) > 0
        section = teachings_sections[0]
        
        # Title should be in Swahili
        title = section.get("title", "")
        assert "Mafundisho" in title or "Katekesi" in title, \
            f"Section title should contain Mafundisho or Katekesi, got: {title}"
        
        print(f"✓ Section title: {title}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
