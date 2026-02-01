"""
Comprehensive Backend Tests for Teachings (Mafundisho) Feature
Tests all API endpoints for teachings, teaching detail with topics/lessons,
and home API teachings section.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestUserHomeAPI:
    """Test /api/user/home endpoint - teachings section"""

    def test_user_home_returns_200(self):
        """Test that /api/user/home returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        print("✓ GET /api/user/home returns 200")

    def test_user_home_has_sections(self):
        """Test that /api/user/home returns sections array"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        assert "sections" in data
        assert isinstance(data["sections"], list)
        assert len(data["sections"]) > 0
        print(f"✓ Home has {len(data['sections'])} sections")

    def test_user_home_teachings_section_exists(self):
        """Test that teachings section exists in home data"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        
        teachings_sections = [
            s for s in data["sections"]
            if s.get("content_type") == "teachings" or s.get("section_type") == "teachings"
        ]
        
        assert len(teachings_sections) > 0, "No teachings section found"
        section = teachings_sections[0]
        
        # Verify section structure
        assert "items" in section
        assert "section_id" in section
        print(f"✓ Teachings section found: {section.get('title', 'N/A')}")

    def test_user_home_teaching_item_structure(self):
        """Test that each teaching item has required fields"""
        response = requests.get(f"{BASE_URL}/api/user/home")
        assert response.status_code == 200
        data = response.json()
        
        teachings_sections = [
            s for s in data["sections"]
            if s.get("content_type") == "teachings"
        ]
        
        if not teachings_sections or not teachings_sections[0].get("items"):
            pytest.skip("No teachings items available")
        
        teaching = teachings_sections[0]["items"][0]
        
        # Required fields for native app
        required_fields = ["teaching_id", "name", "leader_name", "topic_count", "lesson_count"]
        for field in required_fields:
            assert field in teaching, f"Missing field: {field}"
            print(f"  ✓ {field}: {teaching.get(field)}")
        
        # Verify thumbnail is present (optional but important)
        if "thumbnail" in teaching:
            print(f"  ✓ thumbnail: {teaching.get('thumbnail')}")


class TestTeachingDetailAPI:
    """Test /api/teachings/{teaching_id} endpoint"""
    
    @pytest.fixture
    def teaching_id(self):
        """Get a valid teaching_id from the database"""
        response = requests.get(f"{BASE_URL}/api/teachings")
        if response.status_code != 200 or not response.json().get("teachings"):
            pytest.skip("No teachings available in database")
        return response.json()["teachings"][0]["teaching_id"]

    def test_teaching_detail_returns_200(self, teaching_id):
        """Test that teaching detail endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert response.status_code == 200
        print(f"✓ GET /api/teachings/{teaching_id} returns 200")

    def test_teaching_detail_has_topics(self, teaching_id):
        """Test that teaching detail includes topics array"""
        response = requests.get(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "topics" in data
        assert isinstance(data["topics"], list)
        print(f"✓ Teaching has {len(data['topics'])} topics")

    def test_teaching_detail_has_counts(self, teaching_id):
        """Test that teaching detail includes topic_count and lesson_count"""
        response = requests.get(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "topic_count" in data
        assert "lesson_count" in data
        assert isinstance(data["topic_count"], int)
        assert isinstance(data["lesson_count"], int)
        print(f"✓ topic_count: {data['topic_count']}, lesson_count: {data['lesson_count']}")

    def test_teaching_detail_has_category_name(self, teaching_id):
        """Test that teaching detail includes category_name"""
        response = requests.get(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert response.status_code == 200
        data = response.json()
        
        assert "category_name" in data
        print(f"✓ category_name: {data['category_name']}")

    def test_teaching_topics_have_lessons(self, teaching_id):
        """Test that topics include lessons array with audio_url"""
        response = requests.get(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert response.status_code == 200
        data = response.json()
        
        if not data.get("topics"):
            pytest.skip("No topics in this teaching")
        
        topic = data["topics"][0]
        assert "lessons" in topic
        assert isinstance(topic["lessons"], list)
        print(f"✓ First topic has {len(topic['lessons'])} lessons")
        
        if topic["lessons"]:
            lesson = topic["lessons"][0]
            # Verify lesson has audio_url for playback
            if "audio_url" in lesson:
                print(f"  ✓ First lesson has audio_url: {lesson['audio_url'][:50]}...")
            assert "lesson_id" in lesson
            assert "title" in lesson or "title_sw" in lesson
            print(f"  ✓ Lesson structure verified: {lesson.get('title_sw') or lesson.get('title')}")


class TestLayoutSectionsAPI:
    """Test /api/layout/sections endpoint"""

    def test_layout_sections_returns_200(self):
        """Test that layout sections endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/layout/sections?platform=app")
        assert response.status_code == 200
        print("✓ GET /api/layout/sections returns 200")

    def test_layout_sections_has_sort_order(self):
        """Test that sections have sort_order field"""
        response = requests.get(f"{BASE_URL}/api/layout/sections?platform=app")
        assert response.status_code == 200
        data = response.json()
        
        assert "sections" in data
        assert len(data["sections"]) > 0
        
        # Verify all sections have sort_order
        for section in data["sections"]:
            assert "sort_order" in section
        
        # Verify sections are sorted
        sort_orders = [s["sort_order"] for s in data["sections"]]
        assert sort_orders == sorted(sort_orders), "Sections should be sorted by sort_order"
        print(f"✓ {len(data['sections'])} sections with correct sort_order")


class TestMobileContentAPIs:
    """Test content APIs used by native mobile app"""

    def test_albums_api(self):
        """Test GET /api/albums returns albums list"""
        response = requests.get(f"{BASE_URL}/api/albums")
        assert response.status_code == 200
        data = response.json()
        assert "albums" in data or "total" in data
        print(f"✓ Albums API works - total: {data.get('total', len(data.get('albums', [])))}")

    def test_songs_api(self):
        """Test GET /api/songs returns songs list"""
        response = requests.get(f"{BASE_URL}/api/songs")
        assert response.status_code == 200
        data = response.json()
        assert "songs" in data or "total" in data
        print(f"✓ Songs API works - total: {data.get('total', len(data.get('songs', [])))}")

    def test_categories_api(self):
        """Test GET /api/categories returns categories list"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        # Categories endpoint may return just array or object with categories key
        if isinstance(data, list):
            print(f"✓ Categories API works - count: {len(data)}")
        else:
            print(f"✓ Categories API works - count: {data.get('total', len(data.get('categories', [])))}")

    def test_special_mixes_api(self):
        """Test GET /api/special-mixes returns mixes list"""
        response = requests.get(f"{BASE_URL}/api/special-mixes")
        assert response.status_code == 200
        data = response.json()
        # May return mixes array directly or with total
        print(f"✓ Special mixes API works")

    def test_churches_api(self):
        """Test GET /api/churches returns churches list"""
        response = requests.get(f"{BASE_URL}/api/churches")
        assert response.status_code == 200
        data = response.json()
        assert "churches" in data or "total" in data
        print(f"✓ Churches API works - total: {data.get('total', len(data.get('churches', [])))}")

    def test_leaders_api(self):
        """Test GET /api/leaders returns leaders list"""
        response = requests.get(f"{BASE_URL}/api/leaders")
        assert response.status_code == 200
        data = response.json()
        assert "leaders" in data or "total" in data
        print(f"✓ Leaders API works - total: {data.get('total', len(data.get('leaders', [])))}")


class TestTeachingsListAPI:
    """Test /api/teachings endpoint"""

    def test_teachings_list_returns_200(self):
        """Test GET /api/teachings returns 200"""
        response = requests.get(f"{BASE_URL}/api/teachings")
        assert response.status_code == 200
        print("✓ GET /api/teachings returns 200")

    def test_teachings_list_structure(self):
        """Test that teachings list has correct structure"""
        response = requests.get(f"{BASE_URL}/api/teachings")
        assert response.status_code == 200
        data = response.json()
        
        assert "teachings" in data
        assert "total" in data
        assert isinstance(data["teachings"], list)
        print(f"✓ Teachings list has {data['total']} total items")

    def test_teachings_with_category_filter(self):
        """Test teachings endpoint with category filter"""
        response = requests.get(f"{BASE_URL}/api/teachings?category=katekesi")
        assert response.status_code == 200
        data = response.json()
        
        # All returned teachings should be in katekesi category
        for teaching in data.get("teachings", []):
            assert teaching.get("category_id") == "katekesi" or teaching.get("category_name") == "Katekesi"
        print(f"✓ Category filter works - found {len(data.get('teachings', []))} katekesi teachings")


class TestTeaching404:
    """Test 404 handling for non-existent teaching"""

    def test_invalid_teaching_id(self):
        """Test that invalid teaching_id returns 404"""
        response = requests.get(f"{BASE_URL}/api/teachings/invalid_id_12345")
        assert response.status_code == 404
        print("✓ Invalid teaching_id returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
