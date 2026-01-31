"""
Comprehensive Tests for Teachings and Reflections (Mafundisho na Tafakari) API
Tests CRUD operations for Teachings, Topics, and Lessons with cascading deletes.
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestTeachingsStaticEndpoints:
    """Test static data endpoints - categories, monetization types, stats"""
    
    def test_get_stats(self, api_client):
        """GET /api/teachings/stats - returns correct structure"""
        response = api_client.get(f"{BASE_URL}/api/teachings/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_teachings" in data
        assert "total_topics" in data
        assert "total_lessons" in data
        assert "published" in data
        assert "draft" in data
        assert "by_category" in data
        
        # Verify types
        assert isinstance(data["total_teachings"], int)
        assert isinstance(data["total_topics"], int)
        assert isinstance(data["total_lessons"], int)
    
    def test_get_categories(self, api_client):
        """GET /api/teachings/categories - returns list of categories"""
        response = api_client.get(f"{BASE_URL}/api/teachings/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        assert isinstance(data["categories"], list)
        assert len(data["categories"]) > 0
        
        # Verify category structure
        cat = data["categories"][0]
        assert "id" in cat
        assert "name" in cat
        assert "name_en" in cat
    
    def test_get_monetization_types(self, api_client):
        """GET /api/teachings/monetization-types - returns monetization types"""
        response = api_client.get(f"{BASE_URL}/api/teachings/monetization-types")
        assert response.status_code == 200
        
        data = response.json()
        assert "types" in data
        assert isinstance(data["types"], list)
        assert len(data["types"]) > 0
        
        # Verify type structure
        mon_type = data["types"][0]
        assert "id" in mon_type
        assert "name" in mon_type
    
    def test_get_leaders(self, api_client):
        """GET /api/leaders - returns leaders for dropdown"""
        response = api_client.get(f"{BASE_URL}/api/leaders")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaders" in data
        assert isinstance(data["leaders"], list)


class TestTeachingsCRUD:
    """Test Teachings Create, Read, Update, Delete operations"""
    
    @pytest.fixture(autouse=True)
    def setup_and_teardown(self, api_client):
        """Setup and teardown - cleanup test teachings"""
        yield
        # Cleanup: Delete any test teachings created during tests
        response = api_client.get(f"{BASE_URL}/api/teachings")
        if response.status_code == 200:
            teachings = response.json().get("teachings", [])
            for t in teachings:
                if t.get("title", "").startswith("TEST_"):
                    api_client.delete(f"{BASE_URL}/api/teachings/{t['teaching_id']}")
    
    def test_create_teaching(self, api_client):
        """POST /api/teachings - creates a new teaching"""
        payload = {
            "title": "TEST_Teaching_Creation",
            "title_sw": "TEST_Mafundisho ya Majaribio",
            "description": "Test teaching description",
            "description_sw": "Maelezo ya mafundisho ya majaribio",
            "category_id": "ndoa",
            "category_name": "Mafundisho ya Ndoa",
            "monetization_type": "free",
            "status": "draft"
        }
        
        response = api_client.post(f"{BASE_URL}/api/teachings", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "teaching_id" in data
        assert data["title"] == payload["title"]
        assert data["title_sw"] == payload["title_sw"]
        assert data["category_id"] == payload["category_id"]
        assert data["status"] == "draft"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/teachings/{data['teaching_id']}")
    
    def test_get_teachings_list(self, api_client):
        """GET /api/teachings - returns list of teachings"""
        response = api_client.get(f"{BASE_URL}/api/teachings")
        assert response.status_code == 200
        
        data = response.json()
        assert "teachings" in data
        assert "total" in data
        assert isinstance(data["teachings"], list)
    
    def test_create_and_get_teaching_by_id(self, api_client):
        """Create teaching → GET by ID to verify persistence"""
        # Create
        payload = {
            "title": "TEST_Teaching_GetById",
            "title_sw": "TEST_Mafundisho GetById",
            "category_id": "katekesi",
            "monetization_type": "premium",
            "status": "draft"
        }
        
        create_response = api_client.post(f"{BASE_URL}/api/teachings", json=payload)
        assert create_response.status_code == 200
        teaching_id = create_response.json()["teaching_id"]
        
        # Get by ID
        get_response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert get_response.status_code == 200
        
        teaching = get_response.json()
        assert teaching["teaching_id"] == teaching_id
        assert teaching["title"] == payload["title"]
        assert teaching["category_id"] == payload["category_id"]
        assert "topics" in teaching  # Should include topics array
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")
    
    def test_update_teaching(self, api_client):
        """PUT /api/teachings/{id} - updates teaching"""
        # Create first
        create_payload = {
            "title": "TEST_Teaching_BeforeUpdate",
            "title_sw": "TEST_Original Title",
            "status": "draft"
        }
        create_response = api_client.post(f"{BASE_URL}/api/teachings", json=create_payload)
        assert create_response.status_code == 200
        teaching_id = create_response.json()["teaching_id"]
        
        # Update
        update_payload = {
            "title": "TEST_Teaching_AfterUpdate",
            "status": "published"
        }
        update_response = api_client.put(f"{BASE_URL}/api/teachings/{teaching_id}", json=update_payload)
        assert update_response.status_code == 200
        
        # Verify update persisted
        get_response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert get_response.status_code == 200
        
        teaching = get_response.json()
        assert teaching["title"] == "TEST_Teaching_AfterUpdate"
        assert teaching["status"] == "published"
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")
    
    def test_delete_teaching(self, api_client):
        """DELETE /api/teachings/{id} - deletes teaching"""
        # Create first
        payload = {"title": "TEST_Teaching_ToDelete", "status": "draft"}
        create_response = api_client.post(f"{BASE_URL}/api/teachings", json=payload)
        assert create_response.status_code == 200
        teaching_id = create_response.json()["teaching_id"]
        
        # Delete
        delete_response = api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert delete_response.status_code == 200
        assert "deleted" in delete_response.json().get("message", "").lower()
        
        # Verify deletion - should return 404
        get_response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert get_response.status_code == 404
    
    def test_get_nonexistent_teaching(self, api_client):
        """GET /api/teachings/{id} - returns 404 for non-existent teaching"""
        response = api_client.get(f"{BASE_URL}/api/teachings/nonexistent_id_xyz")
        assert response.status_code == 404


class TestTopicsCRUD:
    """Test Topics (Mada) CRUD operations under a teaching"""
    
    def test_create_topic_under_teaching(self, api_client):
        """POST /api/teachings/{id}/topics - creates topic"""
        # Create teaching first
        teaching_payload = {"title": "TEST_Teaching_ForTopics", "status": "draft"}
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json=teaching_payload)
        assert teaching_response.status_code == 200
        teaching_id = teaching_response.json()["teaching_id"]
        
        try:
            # Create topic
            topic_payload = {
                "title": "TEST_Topic_1",
                "title_sw": "TEST_Mada ya 1",
                "description": "Test topic description"
            }
            topic_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json=topic_payload)
            assert topic_response.status_code == 200
            
            topic = topic_response.json()
            assert "topic_id" in topic
            assert topic["teaching_id"] == teaching_id
            assert topic["title"] == topic_payload["title"]
            assert topic["order"] == 1  # First topic should be order 1
        finally:
            # Cleanup
            api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")
    
    def test_get_topics_for_teaching(self, api_client):
        """GET /api/teachings/{id}/topics - returns topics list"""
        # Create teaching and topic
        teaching_payload = {"title": "TEST_Teaching_GetTopics", "status": "draft"}
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json=teaching_payload)
        teaching_id = teaching_response.json()["teaching_id"]
        
        try:
            # Create 2 topics
            api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Topic_A", "title_sw": "Mada A"})
            api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Topic_B", "title_sw": "Mada B"})
            
            # Get topics
            response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}/topics")
            assert response.status_code == 200
            
            data = response.json()
            assert "topics" in data
            assert len(data["topics"]) == 2
        finally:
            api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")
    
    def test_update_topic(self, api_client):
        """PUT /api/teachings/{id}/topics/{topic_id} - updates topic"""
        # Create teaching and topic
        teaching_payload = {"title": "TEST_Teaching_UpdateTopic", "status": "draft"}
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json=teaching_payload)
        teaching_id = teaching_response.json()["teaching_id"]
        
        topic_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Original_Topic"})
        topic_id = topic_response.json()["topic_id"]
        
        try:
            # Update topic
            update_payload = {"title": "TEST_Updated_Topic", "status": "published"}
            update_response = api_client.put(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}", json=update_payload)
            assert update_response.status_code == 200
            
            # Verify update via get teaching (which includes topics)
            get_response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}")
            teaching = get_response.json()
            updated_topic = next((t for t in teaching["topics"] if t["topic_id"] == topic_id), None)
            assert updated_topic is not None
            assert updated_topic["title"] == "TEST_Updated_Topic"
        finally:
            api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")
    
    def test_delete_topic(self, api_client):
        """DELETE /api/teachings/{id}/topics/{topic_id} - deletes topic"""
        # Create teaching and topic
        teaching_payload = {"title": "TEST_Teaching_DeleteTopic", "status": "draft"}
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json=teaching_payload)
        teaching_id = teaching_response.json()["teaching_id"]
        
        topic_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Topic_ToDelete"})
        topic_id = topic_response.json()["topic_id"]
        
        try:
            # Delete topic
            delete_response = api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}")
            assert delete_response.status_code == 200
            
            # Verify deletion
            get_response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}/topics")
            topics = get_response.json()["topics"]
            assert len(topics) == 0
        finally:
            api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")


class TestLessonsCRUD:
    """Test Lessons (Sehemu) CRUD operations under a topic"""
    
    def test_create_lesson_under_topic(self, api_client):
        """POST /api/teachings/{id}/topics/{topic_id}/lessons - creates lesson"""
        # Create teaching and topic
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Teaching_ForLessons"})
        teaching_id = teaching_response.json()["teaching_id"]
        
        topic_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Topic_ForLessons"})
        topic_id = topic_response.json()["topic_id"]
        
        try:
            # Create lesson
            lesson_payload = {
                "title": "TEST_Lesson_1",
                "title_sw": "TEST_Sehemu ya 1",
                "description": "Test lesson description",
                "duration": 300,
                "duration_formatted": "5:00"
            }
            lesson_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons", json=lesson_payload)
            assert lesson_response.status_code == 200
            
            lesson = lesson_response.json()
            assert "lesson_id" in lesson
            assert lesson["topic_id"] == topic_id
            assert lesson["teaching_id"] == teaching_id
            assert lesson["title"] == lesson_payload["title"]
            assert lesson["order"] == 1
        finally:
            api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")
    
    def test_get_lessons_for_topic(self, api_client):
        """GET /api/teachings/{id}/topics/{topic_id}/lessons - returns lessons"""
        # Create teaching, topic, and lessons
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Teaching_GetLessons"})
        teaching_id = teaching_response.json()["teaching_id"]
        
        topic_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Topic_GetLessons"})
        topic_id = topic_response.json()["topic_id"]
        
        try:
            # Create 2 lessons
            api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons", json={"title": "TEST_Lesson_A"})
            api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons", json={"title": "TEST_Lesson_B"})
            
            # Get lessons
            response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons")
            assert response.status_code == 200
            
            data = response.json()
            assert "lessons" in data
            assert len(data["lessons"]) == 2
        finally:
            api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")
    
    def test_update_lesson(self, api_client):
        """PUT /api/teachings/{id}/topics/{topic_id}/lessons/{lesson_id} - updates lesson"""
        # Create teaching, topic, lesson
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Teaching_UpdateLesson"})
        teaching_id = teaching_response.json()["teaching_id"]
        
        topic_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Topic_UpdateLesson"})
        topic_id = topic_response.json()["topic_id"]
        
        lesson_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons", json={"title": "TEST_Original_Lesson"})
        lesson_id = lesson_response.json()["lesson_id"]
        
        try:
            # Update lesson
            update_payload = {"title": "TEST_Updated_Lesson", "status": "published"}
            update_response = api_client.put(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons/{lesson_id}", json=update_payload)
            assert update_response.status_code == 200
            
            # Verify via get teaching
            get_response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}")
            teaching = get_response.json()
            topic = teaching["topics"][0]
            updated_lesson = next((l for l in topic["lessons"] if l["lesson_id"] == lesson_id), None)
            assert updated_lesson is not None
            assert updated_lesson["title"] == "TEST_Updated_Lesson"
        finally:
            api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")
    
    def test_delete_lesson(self, api_client):
        """DELETE /api/teachings/{id}/topics/{topic_id}/lessons/{lesson_id} - deletes lesson"""
        # Create teaching, topic, lesson
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Teaching_DeleteLesson"})
        teaching_id = teaching_response.json()["teaching_id"]
        
        topic_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Topic_DeleteLesson"})
        topic_id = topic_response.json()["topic_id"]
        
        lesson_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons", json={"title": "TEST_Lesson_ToDelete"})
        lesson_id = lesson_response.json()["lesson_id"]
        
        try:
            # Delete lesson
            delete_response = api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons/{lesson_id}")
            assert delete_response.status_code == 200
            
            # Verify deletion
            get_response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons")
            lessons = get_response.json()["lessons"]
            assert len(lessons) == 0
        finally:
            api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")


class TestCascadingDeletes:
    """Test that deleting a teaching cascades to topics and lessons"""
    
    def test_delete_teaching_cascades_to_topics_and_lessons(self, api_client):
        """Deleting a teaching should delete all its topics and lessons"""
        # Create teaching
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Teaching_Cascade"})
        teaching_id = teaching_response.json()["teaching_id"]
        
        # Create topics
        topic1_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Topic_Cascade_1"})
        topic1_id = topic1_response.json()["topic_id"]
        
        topic2_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Topic_Cascade_2"})
        topic2_id = topic2_response.json()["topic_id"]
        
        # Create lessons under first topic
        api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic1_id}/lessons", json={"title": "TEST_Lesson_Cascade_1"})
        api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic1_id}/lessons", json={"title": "TEST_Lesson_Cascade_2"})
        
        # Create lesson under second topic
        api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic2_id}/lessons", json={"title": "TEST_Lesson_Cascade_3"})
        
        # Verify we have data
        get_response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert get_response.status_code == 200
        teaching = get_response.json()
        assert len(teaching["topics"]) == 2
        assert len(teaching["topics"][0]["lessons"]) + len(teaching["topics"][1]["lessons"]) == 3
        
        # Delete teaching - should cascade
        delete_response = api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert delete_response.status_code == 200
        
        # Verify teaching is gone
        verify_response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}")
        assert verify_response.status_code == 404
    
    def test_delete_topic_cascades_to_lessons(self, api_client):
        """Deleting a topic should delete all its lessons"""
        # Create teaching and topic with lessons
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Teaching_TopicCascade"})
        teaching_id = teaching_response.json()["teaching_id"]
        
        try:
            topic_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Topic_ToCascade"})
            topic_id = topic_response.json()["topic_id"]
            
            # Create multiple lessons
            api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons", json={"title": "TEST_Lesson_TC_1"})
            api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons", json={"title": "TEST_Lesson_TC_2"})
            
            # Verify lessons exist
            lessons_response = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons")
            assert len(lessons_response.json()["lessons"]) == 2
            
            # Delete topic - should cascade delete lessons
            delete_response = api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}")
            assert delete_response.status_code == 200
            
            # Verify topic is gone (via teaching details)
            teaching_details = api_client.get(f"{BASE_URL}/api/teachings/{teaching_id}").json()
            assert len(teaching_details["topics"]) == 0
        finally:
            api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")


class TestBulkLessonCreation:
    """Test bulk lesson creation endpoint"""
    
    def test_create_lessons_bulk(self, api_client):
        """POST /api/teachings/{id}/topics/{topic_id}/lessons/bulk - creates multiple lessons"""
        # Create teaching and topic
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Teaching_BulkLessons"})
        teaching_id = teaching_response.json()["teaching_id"]
        
        topic_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics", json={"title": "TEST_Topic_BulkLessons"})
        topic_id = topic_response.json()["topic_id"]
        
        try:
            # Bulk create lessons
            bulk_payload = {
                "lessons": [
                    {"title": "TEST_Bulk_Lesson_1", "title_sw": "Sehemu 1"},
                    {"title": "TEST_Bulk_Lesson_2", "title_sw": "Sehemu 2"},
                    {"title": "TEST_Bulk_Lesson_3", "title_sw": "Sehemu 3"}
                ]
            }
            bulk_response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/{topic_id}/lessons/bulk", json=bulk_payload)
            assert bulk_response.status_code == 200
            
            data = bulk_response.json()
            assert "lessons" in data
            assert "count" in data
            assert data["count"] == 3
            assert len(data["lessons"]) == 3
            
            # Verify order
            assert data["lessons"][0]["order"] == 1
            assert data["lessons"][1]["order"] == 2
            assert data["lessons"][2]["order"] == 3
        finally:
            api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")


class TestTeachingsFilters:
    """Test filtering teachings list"""
    
    def test_filter_teachings_by_category(self, api_client):
        """GET /api/teachings?category=ndoa - filters by category"""
        # Create teachings with different categories
        api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Filter_Ndoa", "category_id": "ndoa"})
        api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Filter_Katekesi", "category_id": "katekesi"})
        
        try:
            # Filter by ndoa category
            response = api_client.get(f"{BASE_URL}/api/teachings?category=ndoa")
            assert response.status_code == 200
            
            teachings = response.json()["teachings"]
            # All returned teachings should have category_id=ndoa
            for t in teachings:
                if t["title"].startswith("TEST_Filter_"):
                    assert t["category_id"] == "ndoa"
        finally:
            # Cleanup
            all_teachings = api_client.get(f"{BASE_URL}/api/teachings").json()["teachings"]
            for t in all_teachings:
                if t.get("title", "").startswith("TEST_Filter_"):
                    api_client.delete(f"{BASE_URL}/api/teachings/{t['teaching_id']}")
    
    def test_filter_teachings_by_status(self, api_client):
        """GET /api/teachings?status=published - filters by status"""
        # Create teachings with different statuses
        api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Status_Draft", "status": "draft"})
        api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Status_Published", "status": "published"})
        
        try:
            # Filter by published status
            response = api_client.get(f"{BASE_URL}/api/teachings?status=published")
            assert response.status_code == 200
            
            teachings = response.json()["teachings"]
            for t in teachings:
                assert t["status"] == "published"
        finally:
            # Cleanup
            all_teachings = api_client.get(f"{BASE_URL}/api/teachings").json()["teachings"]
            for t in all_teachings:
                if t.get("title", "").startswith("TEST_Status_"):
                    api_client.delete(f"{BASE_URL}/api/teachings/{t['teaching_id']}")


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_create_topic_nonexistent_teaching(self, api_client):
        """POST topic on non-existent teaching returns 404"""
        response = api_client.post(f"{BASE_URL}/api/teachings/nonexistent_123/topics", json={"title": "TEST_Topic"})
        assert response.status_code == 404
    
    def test_create_lesson_nonexistent_topic(self, api_client):
        """POST lesson on non-existent topic returns 404"""
        # Create teaching first
        teaching_response = api_client.post(f"{BASE_URL}/api/teachings", json={"title": "TEST_Teaching_Edge"})
        teaching_id = teaching_response.json()["teaching_id"]
        
        try:
            response = api_client.post(f"{BASE_URL}/api/teachings/{teaching_id}/topics/nonexistent_topic/lessons", json={"title": "TEST_Lesson"})
            assert response.status_code == 404
        finally:
            api_client.delete(f"{BASE_URL}/api/teachings/{teaching_id}")
    
    def test_update_nonexistent_teaching(self, api_client):
        """PUT on non-existent teaching returns 404"""
        response = api_client.put(f"{BASE_URL}/api/teachings/nonexistent_xyz", json={"title": "Updated"})
        assert response.status_code == 404
    
    def test_delete_nonexistent_teaching(self, api_client):
        """DELETE on non-existent teaching returns 404"""
        response = api_client.delete(f"{BASE_URL}/api/teachings/nonexistent_abc")
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
