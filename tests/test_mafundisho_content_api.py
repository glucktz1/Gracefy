"""
Test suite for Mafundisho (Leader Content) API endpoints
Tests: Content containers, series, episodes, file uploads, and mobile API endpoints
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data prefix for cleanup
TEST_PREFIX = "TEST_MAFUNDISHO_"


class TestMafundishoAPI:
    """Test /api/mafundisho endpoints for mobile app"""
    
    def test_get_mafundisho_list(self):
        """GET /api/mafundisho - Returns list of content containers with series_count, episode_count, total_classes"""
        response = requests.get(f"{BASE_URL}/api/mafundisho")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "mafundisho" in data, "Response should contain 'mafundisho' key"
        assert "total" in data, "Response should contain 'total' key"
        assert isinstance(data["mafundisho"], list), "mafundisho should be a list"
        
        # If there are items, verify structure
        if len(data["mafundisho"]) > 0:
            item = data["mafundisho"][0]
            # Verify required fields for mobile app cards
            assert "container_id" in item, "Item should have container_id"
            assert "title" in item, "Item should have title"
            assert "series_count" in item, "Item should have series_count"
            assert "episode_count" in item, "Item should have episode_count"
            assert "total_classes" in item, "Item should have total_classes"
            print(f"✓ Mafundisho list returned {data['total']} items with proper structure")
        else:
            print("✓ Mafundisho list endpoint working (no items yet)")
    
    def test_get_mafundisho_detail_existing(self):
        """GET /api/mafundisho/{container_id} - Returns container with series array containing episodes"""
        # First get list to find an existing container
        list_response = requests.get(f"{BASE_URL}/api/mafundisho")
        assert list_response.status_code == 200
        
        data = list_response.json()
        if len(data["mafundisho"]) > 0:
            container_id = data["mafundisho"][0]["container_id"]
            
            # Get detail
            detail_response = requests.get(f"{BASE_URL}/api/mafundisho/{container_id}")
            assert detail_response.status_code == 200, f"Expected 200, got {detail_response.status_code}"
            
            detail = detail_response.json()
            assert "container" in detail, "Response should have 'container' key"
            assert "series" in detail, "Response should have 'series' key"
            assert "total_series" in detail, "Response should have 'total_series' key"
            assert "total_episodes" in detail, "Response should have 'total_episodes' key"
            
            # Verify container structure
            container = detail["container"]
            assert "container_id" in container, "Container should have container_id"
            assert "title" in container, "Container should have title"
            
            print(f"✓ Mafundisho detail for {container_id}: {detail['total_series']} series, {detail['total_episodes']} episodes")
        else:
            print("⚠ No existing containers to test detail endpoint")
    
    def test_get_mafundisho_detail_not_found(self):
        """GET /api/mafundisho/{container_id} - Returns 404 for non-existent container"""
        response = requests.get(f"{BASE_URL}/api/mafundisho/nonexistent_container_12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Mafundisho detail returns 404 for non-existent container")
    
    def test_get_mafundisho_detail_test_container(self):
        """GET /api/mafundisho/container_47a02fd9ee1f - Test specific container from request"""
        container_id = "container_47a02fd9ee1f"
        response = requests.get(f"{BASE_URL}/api/mafundisho/{container_id}")
        
        if response.status_code == 200:
            detail = response.json()
            print(f"✓ Test container found: {detail['container'].get('title', 'N/A')}")
            print(f"  - Series: {detail['total_series']}, Episodes: {detail['total_episodes']}")
            
            # Verify series structure if present
            if detail["series"]:
                series = detail["series"][0]
                assert "series_id" in series, "Series should have series_id"
                assert "title" in series, "Series should have title"
                assert "episodes" in series, "Series should have episodes array"
                print(f"  - First series: {series.get('title', 'N/A')} with {len(series.get('episodes', []))} episodes")
        elif response.status_code == 404:
            print(f"⚠ Test container {container_id} not found (may need to be created)")
        else:
            print(f"⚠ Unexpected status {response.status_code} for test container")


class TestContentContainersAPI:
    """Test /api/content-containers endpoints"""
    
    def test_get_content_containers(self):
        """GET /api/content-containers - Returns list of containers"""
        response = requests.get(f"{BASE_URL}/api/content-containers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "containers" in data, "Response should have 'containers' key"
        print(f"✓ Content containers: {len(data['containers'])} items")
    
    def test_create_content_container(self):
        """POST /api/content-containers - Create new container"""
        test_id = uuid.uuid4().hex[:8]
        payload = {
            "title": f"{TEST_PREFIX}Parenting in Modern Days {test_id}",
            "description": "A comprehensive course on modern parenting",
            "content_type": "teaching",
            "leader_name": "Fr. John Muga",
            "leader_title": "Parish Priest",
            "monetization_type": "standard",
            "status": "active"
        }
        
        response = requests.post(f"{BASE_URL}/api/content-containers", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "container_id" in data, "Response should have container_id"
        
        # Store for cleanup
        self.__class__.created_container_id = data["container_id"]
        print(f"✓ Created container: {data['container_id']}")
        
        # Verify by GET
        get_response = requests.get(f"{BASE_URL}/api/content-containers/{data['container_id']}")
        assert get_response.status_code == 200
        container = get_response.json()
        assert container.get("title") == payload["title"], "Title should match"
        assert container.get("leader_name") == payload["leader_name"], "Leader name should match"
        print(f"✓ Verified container creation with leader_name: {container.get('leader_name')}")
    
    def test_update_content_container(self):
        """PUT /api/content-containers/{id} - Update container"""
        container_id = getattr(self.__class__, 'created_container_id', None)
        if not container_id:
            pytest.skip("No container created to update")
        
        updates = {
            "description": "Updated description for testing",
            "thumbnail_url": "https://example.com/thumbnail.jpg"
        }
        
        response = requests.put(f"{BASE_URL}/api/content-containers/{container_id}", json=updates)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✓ Updated container {container_id}")


class TestContentSeriesAPI:
    """Test /api/content-series endpoints"""
    
    def test_get_content_series(self):
        """GET /api/content-series - Returns list of series"""
        response = requests.get(f"{BASE_URL}/api/content-series")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "series" in data, "Response should have 'series' key"
        print(f"✓ Content series: {len(data['series'])} items")
    
    def test_create_content_series_with_thumbnail(self):
        """POST /api/content-series - Create series with thumbnail_url"""
        # First ensure we have a container
        container_id = getattr(TestContentContainersAPI, 'created_container_id', None)
        if not container_id:
            # Create a container first
            test_id = uuid.uuid4().hex[:8]
            container_payload = {
                "title": f"{TEST_PREFIX}Series Test Container {test_id}",
                "content_type": "teaching",
                "leader_name": "Fr. Test Leader",
                "status": "active"
            }
            container_response = requests.post(f"{BASE_URL}/api/content-containers", json=container_payload)
            if container_response.status_code == 200:
                container_id = container_response.json()["container_id"]
            else:
                pytest.skip("Could not create container for series test")
        
        test_id = uuid.uuid4().hex[:8]
        payload = {
            "container_id": container_id,
            "title": f"{TEST_PREFIX}Lesson 1: Introduction {test_id}",
            "description": "Introduction to the topic",
            "thumbnail_url": "https://gracefy-cdn.b-cdn.net/thumbnails/test-series.jpg",
            "series_number": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/content-series", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "series_id" in data, "Response should have series_id"
        
        self.__class__.created_series_id = data["series_id"]
        print(f"✓ Created series: {data['series_id']} with thumbnail_url")
        
        # Verify thumbnail_url is stored
        get_response = requests.get(f"{BASE_URL}/api/content-series?container_id={container_id}")
        assert get_response.status_code == 200
        series_list = get_response.json()["series"]
        created_series = next((s for s in series_list if s["series_id"] == data["series_id"]), None)
        if created_series:
            assert created_series.get("thumbnail_url") == payload["thumbnail_url"], "thumbnail_url should be stored"
            print(f"✓ Verified series thumbnail_url: {created_series.get('thumbnail_url')}")


class TestContentEpisodesAPI:
    """Test /api/content-episodes endpoints"""
    
    def test_get_content_episodes(self):
        """GET /api/content-episodes - Returns list of episodes"""
        response = requests.get(f"{BASE_URL}/api/content-episodes")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "episodes" in data, "Response should have 'episodes' key"
        print(f"✓ Content episodes: {len(data['episodes'])} items")
    
    def test_create_content_episode_with_audio(self):
        """POST /api/content-episodes - Create episode with audio_url"""
        series_id = getattr(TestContentSeriesAPI, 'created_series_id', None)
        container_id = getattr(TestContentContainersAPI, 'created_container_id', None)
        
        if not series_id:
            pytest.skip("No series created for episode test")
        
        test_id = uuid.uuid4().hex[:8]
        payload = {
            "series_id": series_id,
            "container_id": container_id,
            "title": f"{TEST_PREFIX}Topic 1: Understanding Basics {test_id}",
            "description": "First topic in the series",
            "audio_url": "https://gracefy-cdn.b-cdn.net/audio/test-episode.mp3",
            "duration_seconds": 1800,  # 30 minutes
            "episode_number": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/content-episodes", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "episode_id" in data, "Response should have episode_id"
        
        self.__class__.created_episode_id = data["episode_id"]
        print(f"✓ Created episode: {data['episode_id']} with audio_url")
        
        # Verify audio_url is stored
        get_response = requests.get(f"{BASE_URL}/api/content-episodes?series_id={series_id}")
        assert get_response.status_code == 200
        episodes = get_response.json()["episodes"]
        created_episode = next((e for e in episodes if e["episode_id"] == data["episode_id"]), None)
        if created_episode:
            assert created_episode.get("audio_url") == payload["audio_url"], "audio_url should be stored"
            print(f"✓ Verified episode audio_url: {created_episode.get('audio_url')}")


class TestFileUploadAPI:
    """Test file upload endpoints for Bunny CDN"""
    
    def test_upload_thumbnail_image(self):
        """POST /api/content/upload-thumbnail - Upload thumbnail to Bunny CDN"""
        # Create a small test image (1x1 pixel PNG)
        import base64
        # Minimal valid PNG (1x1 transparent pixel)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        
        files = {
            'file': ('test_thumbnail.png', png_data, 'image/png')
        }
        
        response = requests.post(f"{BASE_URL}/api/content/upload-thumbnail", files=files)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "url" in data, "Response should have 'url' key"
        assert "size" in data, "Response should have 'size' key"
        assert "storage_type" in data, "Response should have 'storage_type' key"
        
        # Check if CDN or MongoDB fallback
        if data["storage_type"] == "cdn":
            assert data["url"].startswith("https://"), "CDN URL should be HTTPS"
            print(f"✓ Thumbnail uploaded to CDN: {data['url']}")
        else:
            print(f"✓ Thumbnail uploaded to MongoDB fallback (CDN may not be configured)")
        
        print(f"  - Size: {data['size']} bytes, Storage: {data['storage_type']}")
    
    def test_upload_thumbnail_invalid_type(self):
        """POST /api/content/upload-thumbnail - Rejects non-image files"""
        files = {
            'file': ('test.txt', b'This is not an image', 'text/plain')
        }
        
        response = requests.post(f"{BASE_URL}/api/content/upload-thumbnail", files=files)
        assert response.status_code == 400, f"Expected 400 for non-image, got {response.status_code}"
        print("✓ Thumbnail upload correctly rejects non-image files")
    
    def test_upload_audio_file(self):
        """POST /api/content/upload-audio - Upload audio to Bunny CDN"""
        # Create minimal MP3 header (not a valid audio but enough for content-type check)
        # Real MP3 files would be larger, this tests the endpoint accepts audio
        mp3_header = bytes([0xFF, 0xFB, 0x90, 0x00])  # MP3 frame header
        
        files = {
            'file': ('test_audio.mp3', mp3_header, 'audio/mpeg')
        }
        
        response = requests.post(f"{BASE_URL}/api/content/upload-audio", files=files)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "url" in data, "Response should have 'url' key"
        assert "size" in data, "Response should have 'size' key"
        assert "storage_type" in data, "Response should have 'storage_type' key"
        
        if data["storage_type"] == "cdn":
            print(f"✓ Audio uploaded to CDN: {data['url']}")
        else:
            print(f"✓ Audio uploaded to MongoDB fallback")
        
        print(f"  - Size: {data['size']} bytes, Storage: {data['storage_type']}")
    
    def test_upload_audio_invalid_type(self):
        """POST /api/content/upload-audio - Rejects non-audio files"""
        files = {
            'file': ('test.txt', b'This is not audio', 'text/plain')
        }
        
        response = requests.post(f"{BASE_URL}/api/content/upload-audio", files=files)
        assert response.status_code == 400, f"Expected 400 for non-audio, got {response.status_code}"
        print("✓ Audio upload correctly rejects non-audio files")


class TestMobileAPIStructure:
    """Test that API responses have correct structure for mobile app consumption"""
    
    def test_mafundisho_card_fields(self):
        """Verify /api/mafundisho returns fields needed for mobile cards"""
        response = requests.get(f"{BASE_URL}/api/mafundisho")
        assert response.status_code == 200
        
        data = response.json()
        if len(data["mafundisho"]) > 0:
            item = data["mafundisho"][0]
            
            # Required fields for mobile card display
            required_fields = [
                "container_id",
                "title",
                "thumbnail",  # or thumbnail_url
                "leader_name",
                "series_count",
                "episode_count",
                "total_classes"
            ]
            
            missing_fields = []
            for field in required_fields:
                if field not in item:
                    # Check alternative field names
                    if field == "thumbnail" and "thumbnail_url" not in item:
                        missing_fields.append(field)
                    elif field != "thumbnail":
                        missing_fields.append(field)
            
            if missing_fields:
                print(f"⚠ Missing fields for mobile cards: {missing_fields}")
            else:
                print("✓ All required fields present for mobile card display")
                print(f"  - Title: {item.get('title')}")
                print(f"  - Leader: {item.get('leader_name')}")
                print(f"  - Classes: {item.get('total_classes')}")
        else:
            print("⚠ No items to verify mobile card structure")
    
    def test_mafundisho_detail_series_structure(self):
        """Verify /api/mafundisho/{id} returns series with episodes for mobile detail screen"""
        # Get first container
        list_response = requests.get(f"{BASE_URL}/api/mafundisho")
        assert list_response.status_code == 200
        
        data = list_response.json()
        if len(data["mafundisho"]) > 0:
            container_id = data["mafundisho"][0]["container_id"]
            
            detail_response = requests.get(f"{BASE_URL}/api/mafundisho/{container_id}")
            assert detail_response.status_code == 200
            
            detail = detail_response.json()
            
            # Verify container has required fields
            container = detail["container"]
            assert "thumbnail" in container or "thumbnail_url" in container, "Container should have thumbnail"
            
            # Verify series structure
            if detail["series"]:
                series = detail["series"][0]
                assert "series_id" in series, "Series should have series_id"
                assert "title" in series, "Series should have title"
                assert "thumbnail" in series or "thumbnail_url" in series, "Series should have thumbnail"
                assert "episodes" in series, "Series should have episodes array"
                
                # Verify episode structure
                if series["episodes"]:
                    episode = series["episodes"][0]
                    assert "episode_id" in episode, "Episode should have episode_id"
                    assert "title" in episode, "Episode should have title"
                    # audio_url may be optional for some episodes
                    print(f"✓ Series structure verified: {series.get('title')} with {len(series['episodes'])} episodes")
                else:
                    print(f"✓ Series structure verified (no episodes yet)")
            else:
                print("✓ Detail structure verified (no series yet)")
        else:
            print("⚠ No containers to verify detail structure")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self):
        """Delete test-created data with TEST_MAFUNDISHO_ prefix"""
        # This runs last to clean up
        deleted_count = 0
        
        # Get all containers and delete test ones
        response = requests.get(f"{BASE_URL}/api/content-containers")
        if response.status_code == 200:
            containers = response.json().get("containers", [])
            for container in containers:
                if container.get("title", "").startswith(TEST_PREFIX):
                    del_response = requests.delete(f"{BASE_URL}/api/content-containers/{container['container_id']}")
                    if del_response.status_code == 200:
                        deleted_count += 1
        
        print(f"✓ Cleanup: Deleted {deleted_count} test containers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
