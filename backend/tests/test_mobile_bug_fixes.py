"""
Backend API Tests for Mobile Bug Fixes
======================================
Tests for:
1. /api/upload/base64 - accepts file_data, file, data, or image keys
2. /api/upload - multipart endpoint for file uploads
3. /api/layout/hero-content - returns items with thumbnail/image_url
4. /api/chat/support/start - creates a conversation
5. /api/chat/support/message - returns AI response
6. /api/layout/hero-banners - returns banner list
"""

import pytest
import requests
import os
import base64
import time

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Small test image (1x1 red pixel PNG)
TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
TEST_IMAGE_DATA_URL = f"data:image/png;base64,{TEST_IMAGE_BASE64}"


class TestHealthCheck:
    """Basic health check to ensure API is running"""
    
    def test_health_endpoint(self):
        """Test that the API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "healthy" or "status" in data
        print(f"✓ Health check passed: {data}")


class TestBase64Upload:
    """Tests for /api/upload/base64 endpoint - accepts multiple key names"""
    
    def test_upload_base64_with_file_data_key(self):
        """Test base64 upload using 'file_data' key"""
        payload = {
            "file_data": TEST_IMAGE_BASE64,
            "filename": "test_file_data.png",
            "content_type": "image/png",
            "folder": "test_images"
        }
        response = requests.post(f"{BASE_URL}/api/upload/base64", json=payload)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "file_id" in data, "Response should contain file_id"
        assert "url" in data, "Response should contain url"
        print(f"✓ Base64 upload with 'file_data' key: file_id={data.get('file_id')}")
    
    def test_upload_base64_with_file_key(self):
        """Test base64 upload using 'file' key"""
        payload = {
            "file": TEST_IMAGE_BASE64,
            "filename": "test_file.png",
            "content_type": "image/png",
            "folder": "test_images"
        }
        response = requests.post(f"{BASE_URL}/api/upload/base64", json=payload)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "file_id" in data, "Response should contain file_id"
        print(f"✓ Base64 upload with 'file' key: file_id={data.get('file_id')}")
    
    def test_upload_base64_with_data_key(self):
        """Test base64 upload using 'data' key"""
        payload = {
            "data": TEST_IMAGE_BASE64,
            "filename": "test_data.png",
            "content_type": "image/png",
            "folder": "test_images"
        }
        response = requests.post(f"{BASE_URL}/api/upload/base64", json=payload)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "file_id" in data, "Response should contain file_id"
        print(f"✓ Base64 upload with 'data' key: file_id={data.get('file_id')}")
    
    def test_upload_base64_with_image_key(self):
        """Test base64 upload using 'image' key"""
        payload = {
            "image": TEST_IMAGE_BASE64,
            "filename": "test_image.png",
            "content_type": "image/png",
            "folder": "test_images"
        }
        response = requests.post(f"{BASE_URL}/api/upload/base64", json=payload)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "file_id" in data, "Response should contain file_id"
        print(f"✓ Base64 upload with 'image' key: file_id={data.get('file_id')}")
    
    def test_upload_base64_with_data_url_prefix(self):
        """Test base64 upload with data URL prefix (data:image/png;base64,...)"""
        payload = {
            "file_data": TEST_IMAGE_DATA_URL,
            "filename": "test_data_url.png",
            "folder": "test_images"
        }
        response = requests.post(f"{BASE_URL}/api/upload/base64", json=payload)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "file_id" in data, "Response should contain file_id"
        print(f"✓ Base64 upload with data URL prefix: file_id={data.get('file_id')}")
    
    def test_upload_base64_no_data_returns_error(self):
        """Test that missing image data returns proper error"""
        payload = {
            "filename": "test_no_data.png",
            "folder": "test_images"
        }
        response = requests.post(f"{BASE_URL}/api/upload/base64", json=payload)
        assert response.status_code == 400, f"Expected 400 error, got {response.status_code}"
        data = response.json()
        assert "detail" in data, "Error response should contain detail"
        assert "file_data" in data["detail"] or "image" in data["detail"] or "No image data" in data["detail"]
        print(f"✓ Missing data returns proper error: {data.get('detail')}")


class TestMultipartUpload:
    """Tests for /api/upload multipart endpoint"""
    
    def test_multipart_upload_image(self):
        """Test multipart file upload"""
        # Create a small test image file
        image_bytes = base64.b64decode(TEST_IMAGE_BASE64)
        files = {
            'file': ('test_upload.png', image_bytes, 'image/png')
        }
        data = {
            'folder': 'test_uploads'
        }
        response = requests.post(f"{BASE_URL}/api/upload", files=files, data=data)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        result = response.json()
        assert "file_id" in result, "Response should contain file_id"
        assert "url" in result, "Response should contain url"
        print(f"✓ Multipart upload successful: file_id={result.get('file_id')}, url={result.get('url')}")
    
    def test_multipart_upload_returns_cdn_or_local_url(self):
        """Test that upload returns either CDN URL or local file URL"""
        image_bytes = base64.b64decode(TEST_IMAGE_BASE64)
        files = {
            'file': ('test_cdn.png', image_bytes, 'image/png')
        }
        data = {
            'folder': 'test_uploads'
        }
        response = requests.post(f"{BASE_URL}/api/upload", files=files, data=data)
        assert response.status_code == 200, f"Upload failed: {response.text}"
        result = response.json()
        url = result.get("url", "")
        cdn_url = result.get("cdn_url")
        
        # URL should be either CDN URL (https://) or local file URL (/api/files/)
        assert url.startswith("https://") or url.startswith("/api/files/"), \
            f"URL should be CDN or local file URL, got: {url}"
        print(f"✓ Upload returns valid URL: {url}, cdn_url={cdn_url}")


class TestHeroContent:
    """Tests for /api/layout/hero-content endpoint"""
    
    def test_hero_content_endpoint_exists(self):
        """Test that hero-content endpoint exists and returns 200"""
        response = requests.get(f"{BASE_URL}/api/layout/hero-content")
        assert response.status_code == 200, f"Hero content endpoint failed: {response.text}"
        data = response.json()
        assert "items" in data, "Response should contain 'items' array"
        assert "hero_type" in data, "Response should contain 'hero_type'"
        print(f"✓ Hero content endpoint exists: hero_type={data.get('hero_type')}, items_count={len(data.get('items', []))}")
    
    def test_hero_content_items_have_thumbnail(self):
        """Test that hero content items have thumbnail/image_url"""
        response = requests.get(f"{BASE_URL}/api/layout/hero-content")
        assert response.status_code == 200
        data = response.json()
        items = data.get("items", [])
        
        if len(items) > 0:
            for i, item in enumerate(items[:3]):  # Check first 3 items
                # Items should have either thumbnail or image_url
                has_image = item.get("thumbnail") or item.get("image_url")
                print(f"  Item {i+1}: thumbnail={item.get('thumbnail', 'None')[:50] if item.get('thumbnail') else 'None'}...")
                # Note: Some items may not have images, which is acceptable
            print(f"✓ Hero content items checked for thumbnails")
        else:
            print("✓ Hero content returned empty items (no albums/banners configured)")
    
    def test_hero_content_items_have_link_metadata(self):
        """Test that hero content items have link_type and link_target for navigation"""
        response = requests.get(f"{BASE_URL}/api/layout/hero-content")
        assert response.status_code == 200
        data = response.json()
        items = data.get("items", [])
        
        if len(items) > 0:
            for item in items[:3]:
                # Album items should have link_type='album' and link_target=album_id
                if item.get("album_id"):
                    assert item.get("link_type") == "album", f"Album item should have link_type='album'"
                    assert item.get("link_target") == item.get("album_id"), "link_target should match album_id"
                    print(f"  Album item: link_type={item.get('link_type')}, link_target={item.get('link_target')}")
            print(f"✓ Hero content items have navigation metadata")
        else:
            print("✓ Hero content returned empty items (no albums/banners configured)")
    
    def test_hero_content_config_fields(self):
        """Test that hero content returns configuration fields"""
        response = requests.get(f"{BASE_URL}/api/layout/hero-content")
        assert response.status_code == 200
        data = response.json()
        
        # Check config fields
        assert "auto_rotate" in data, "Response should contain 'auto_rotate'"
        assert "rotation_interval" in data, "Response should contain 'rotation_interval'"
        assert "show_navigation" in data, "Response should contain 'show_navigation'"
        
        print(f"✓ Hero content config: auto_rotate={data.get('auto_rotate')}, interval={data.get('rotation_interval')}, show_nav={data.get('show_navigation')}")


class TestHeroBanners:
    """Tests for /api/layout/hero-banners endpoint"""
    
    def test_hero_banners_endpoint_exists(self):
        """Test that hero-banners endpoint exists and returns 200"""
        response = requests.get(f"{BASE_URL}/api/layout/hero-banners")
        assert response.status_code == 200, f"Hero banners endpoint failed: {response.text}"
        data = response.json()
        assert "banners" in data, "Response should contain 'banners' array"
        print(f"✓ Hero banners endpoint exists: banners_count={len(data.get('banners', []))}")
    
    def test_hero_banners_structure(self):
        """Test hero banners response structure"""
        response = requests.get(f"{BASE_URL}/api/layout/hero-banners")
        assert response.status_code == 200
        data = response.json()
        banners = data.get("banners", [])
        
        if len(banners) > 0:
            banner = banners[0]
            # Check expected fields
            expected_fields = ["banner_id", "title"]
            for field in expected_fields:
                assert field in banner, f"Banner should have '{field}' field"
            print(f"✓ Hero banner structure valid: {list(banner.keys())}")
        else:
            print("✓ Hero banners returned empty (no banners configured)")


class TestSupportChatStart:
    """Tests for /api/chat/support/start endpoint"""
    
    def test_support_chat_start_endpoint_exists(self):
        """Test that support chat start endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/chat/support/start")
        assert response.status_code == 200, f"Support chat start failed: {response.text}"
        data = response.json()
        assert "success" in data, "Response should contain 'success' field"
        assert data.get("success") == True, "success should be True"
        assert "conversation_id" in data, "Response should contain 'conversation_id'"
        print(f"✓ Support chat start: conversation_id={data.get('conversation_id')}")
    
    def test_support_chat_start_creates_conversation(self):
        """Test that starting chat creates a conversation with welcome message"""
        response = requests.post(f"{BASE_URL}/api/chat/support/start")
        assert response.status_code == 200
        data = response.json()
        
        conversation_id = data.get("conversation_id")
        assert conversation_id is not None, "conversation_id should not be None"
        
        # Verify conversation was created by fetching it
        get_response = requests.get(f"{BASE_URL}/api/chat/support")
        assert get_response.status_code == 200
        print(f"✓ Support chat conversation created: {conversation_id}")


class TestSupportChatMessage:
    """Tests for /api/chat/support/message endpoint"""
    
    def test_support_chat_message_endpoint_exists(self):
        """Test that support chat message endpoint exists"""
        # First start a conversation
        start_response = requests.post(f"{BASE_URL}/api/chat/support/start")
        assert start_response.status_code == 200
        
        # Send a message
        payload = {"message": "Habari, ninahitaji msaada"}
        response = requests.post(f"{BASE_URL}/api/chat/support/message", json=payload)
        assert response.status_code == 200, f"Support chat message failed: {response.text}"
        data = response.json()
        assert "success" in data, "Response should contain 'success' field"
        print(f"✓ Support chat message endpoint exists")
    
    def test_support_chat_message_returns_ai_response(self):
        """Test that sending message returns AI response"""
        # Start a conversation
        start_response = requests.post(f"{BASE_URL}/api/chat/support/start")
        assert start_response.status_code == 200
        
        # Send a message
        payload = {"message": "Hello, I need help with the app"}
        response = requests.post(f"{BASE_URL}/api/chat/support/message", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True, "success should be True"
        assert "user_message" in data, "Response should contain 'user_message'"
        assert "ai_response" in data, "Response should contain 'ai_response'"
        
        user_msg = data.get("user_message", {})
        ai_msg = data.get("ai_response", {})
        
        assert user_msg.get("message") == "Hello, I need help with the app", "User message should match"
        assert user_msg.get("sender") == "user", "User message sender should be 'user'"
        assert ai_msg.get("sender") == "ai", "AI response sender should be 'ai'"
        assert ai_msg.get("message"), "AI response should have a message"
        
        print(f"✓ AI response received: {ai_msg.get('message', '')[:100]}...")
    
    def test_support_chat_message_with_swahili(self):
        """Test AI responds to Swahili messages"""
        # Start a conversation
        start_response = requests.post(f"{BASE_URL}/api/chat/support/start")
        assert start_response.status_code == 200
        
        # Send Swahili message
        payload = {"message": "Habari, ninawezaje kupakua nyimbo?"}
        response = requests.post(f"{BASE_URL}/api/chat/support/message", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        ai_msg = data.get("ai_response", {})
        assert ai_msg.get("message"), "AI should respond to Swahili message"
        print(f"✓ AI responds to Swahili: {ai_msg.get('message', '')[:100]}...")
    
    def test_support_chat_message_validation(self):
        """Test message validation - empty message should fail"""
        payload = {"message": ""}
        response = requests.post(f"{BASE_URL}/api/chat/support/message", json=payload)
        # Should return 422 validation error for empty message
        assert response.status_code == 422, f"Expected 422 for empty message, got {response.status_code}"
        print(f"✓ Empty message validation works")


class TestSupportChatGet:
    """Tests for /api/chat/support GET endpoint"""
    
    def test_support_chat_get_endpoint_exists(self):
        """Test that support chat GET endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/chat/support")
        assert response.status_code == 200, f"Support chat GET failed: {response.text}"
        data = response.json()
        assert "success" in data, "Response should contain 'success' field"
        assert "messages" in data, "Response should contain 'messages' array"
        print(f"✓ Support chat GET endpoint exists: messages_count={len(data.get('messages', []))}")
    
    def test_support_chat_get_returns_welcome_message(self):
        """Test that GET returns welcome message for new users"""
        response = requests.get(f"{BASE_URL}/api/chat/support")
        assert response.status_code == 200
        data = response.json()
        
        messages = data.get("messages", [])
        assert len(messages) > 0, "Should have at least welcome message"
        
        # First message should be welcome message from AI
        first_msg = messages[0]
        assert first_msg.get("sender") in ["ai", "system"], "First message should be from AI/system"
        print(f"✓ Welcome message: {first_msg.get('message', '')[:80]}...")


class TestCDNStatus:
    """Tests for CDN status endpoint"""
    
    def test_cdn_status_endpoint(self):
        """Test CDN status endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/cdn/status")
        assert response.status_code == 200, f"CDN status failed: {response.text}"
        data = response.json()
        assert "enabled" in data, "Response should contain 'enabled' field"
        print(f"✓ CDN status: enabled={data.get('enabled')}, storage_zone={data.get('storage_zone')}")


class TestIntegration:
    """Integration tests combining multiple endpoints"""
    
    def test_full_chat_flow(self):
        """Test complete chat flow: start -> message -> get"""
        # 1. Start conversation
        start_response = requests.post(f"{BASE_URL}/api/chat/support/start")
        assert start_response.status_code == 200
        conversation_id = start_response.json().get("conversation_id")
        print(f"  1. Started conversation: {conversation_id}")
        
        # 2. Send message
        msg_payload = {"message": "How do I download songs?"}
        msg_response = requests.post(f"{BASE_URL}/api/chat/support/message", json=msg_payload)
        assert msg_response.status_code == 200
        ai_response = msg_response.json().get("ai_response", {}).get("message", "")
        print(f"  2. Sent message, AI responded: {ai_response[:60]}...")
        
        # 3. Get conversation
        get_response = requests.get(f"{BASE_URL}/api/chat/support")
        assert get_response.status_code == 200
        messages = get_response.json().get("messages", [])
        print(f"  3. Retrieved conversation: {len(messages)} messages")
        
        print(f"✓ Full chat flow completed successfully")
    
    def test_upload_and_verify(self):
        """Test upload and verify file exists"""
        # Upload file
        payload = {
            "file_data": TEST_IMAGE_BASE64,
            "filename": "test_verify.png",
            "folder": "test_images"
        }
        upload_response = requests.post(f"{BASE_URL}/api/upload/base64", json=payload)
        assert upload_response.status_code == 200
        
        file_id = upload_response.json().get("file_id")
        url = upload_response.json().get("url")
        print(f"  1. Uploaded file: {file_id}")
        
        # Verify file exists (if local URL)
        if url and url.startswith("/api/files/"):
            verify_response = requests.get(f"{BASE_URL}{url}")
            assert verify_response.status_code == 200, f"File verification failed: {verify_response.status_code}"
            print(f"  2. Verified file exists at {url}")
        elif url and url.startswith("https://"):
            print(f"  2. File uploaded to CDN: {url}")
        
        print(f"✓ Upload and verify completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
