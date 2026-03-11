"""
Test Suite for Content Upload and Category Permissions Features
- POST /api/content/upload-thumbnail - Image upload for leader content
- POST /api/content/upload-audio - Audio upload for leader content episodes
- GET /api/admin/category-permissions - Get all user category permissions
- PUT /api/admin/category-permissions/{role_id} - Update permissions for a category
- POST /api/admin/category-permissions/{role_id}/reset - Reset permissions to defaults
"""

import pytest
import requests
import os
import struct
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://music-stream-launch.preview.emergentagent.com').rstrip('/')


class TestContentThumbnailUpload:
    """Tests for POST /api/content/upload-thumbnail"""
    
    def test_upload_thumbnail_success(self):
        """Test successful thumbnail upload"""
        # Create a minimal PNG image (1x1 pixel)
        png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
        
        files = {'file': ('test_image.png', png_data, 'image/png')}
        response = requests.post(f"{BASE_URL}/api/content/upload-thumbnail", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "size" in data
        assert data["size"] == len(png_data)
    
    def test_upload_thumbnail_jpeg(self):
        """Test JPEG thumbnail upload"""
        # Minimal JPEG (1x1 pixel)
        jpeg_data = base64.b64decode("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQCEAwEPwAB//9k=")
        
        files = {'file': ('test_image.jpg', jpeg_data, 'image/jpeg')}
        response = requests.post(f"{BASE_URL}/api/content/upload-thumbnail", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
    
    def test_upload_thumbnail_non_image_rejected(self):
        """Test that non-image files are rejected"""
        text_data = b"This is not an image"
        
        files = {'file': ('test.txt', text_data, 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/content/upload-thumbnail", files=files)
        
        assert response.status_code == 400
        assert "image" in response.json().get("detail", "").lower()
    
    def test_upload_thumbnail_size_limit(self):
        """Test that files over 5MB are rejected"""
        # Create a file larger than 5MB
        large_data = b"x" * (6 * 1024 * 1024)  # 6MB
        
        files = {'file': ('large_image.png', large_data, 'image/png')}
        response = requests.post(f"{BASE_URL}/api/content/upload-thumbnail", files=files)
        
        assert response.status_code == 400
        assert "5MB" in response.json().get("detail", "") or "large" in response.json().get("detail", "").lower()


class TestContentAudioUpload:
    """Tests for POST /api/content/upload-audio"""
    
    @staticmethod
    def create_minimal_wav():
        """Create a minimal valid WAV file"""
        sample_rate = 8000
        num_channels = 1
        bits_per_sample = 8
        num_samples = 100
        data_size = num_samples * num_channels * bits_per_sample // 8
        file_size = 36 + data_size
        
        wav_data = bytearray()
        # RIFF header
        wav_data.extend(b'RIFF')
        wav_data.extend(struct.pack('<I', file_size))
        wav_data.extend(b'WAVE')
        # fmt chunk
        wav_data.extend(b'fmt ')
        wav_data.extend(struct.pack('<I', 16))
        wav_data.extend(struct.pack('<H', 1))
        wav_data.extend(struct.pack('<H', num_channels))
        wav_data.extend(struct.pack('<I', sample_rate))
        wav_data.extend(struct.pack('<I', sample_rate * num_channels * bits_per_sample // 8))
        wav_data.extend(struct.pack('<H', num_channels * bits_per_sample // 8))
        wav_data.extend(struct.pack('<H', bits_per_sample))
        # data chunk
        wav_data.extend(b'data')
        wav_data.extend(struct.pack('<I', data_size))
        wav_data.extend(bytes([128] * data_size))
        
        return bytes(wav_data)
    
    def test_upload_audio_success(self):
        """Test successful audio upload"""
        wav_data = self.create_minimal_wav()
        
        files = {'file': ('test_audio.wav', wav_data, 'audio/wav')}
        response = requests.post(f"{BASE_URL}/api/content/upload-audio", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "size" in data
        assert data["size"] == len(wav_data)
    
    def test_upload_audio_mp3_type(self):
        """Test audio upload with mp3 content type"""
        wav_data = self.create_minimal_wav()
        
        files = {'file': ('test_audio.mp3', wav_data, 'audio/mpeg')}
        response = requests.post(f"{BASE_URL}/api/content/upload-audio", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
    
    def test_upload_audio_non_audio_rejected(self):
        """Test that non-audio files are rejected"""
        text_data = b"This is not audio"
        
        files = {'file': ('test.txt', text_data, 'text/plain')}
        response = requests.post(f"{BASE_URL}/api/content/upload-audio", files=files)
        
        assert response.status_code == 400
        assert "audio" in response.json().get("detail", "").lower()
    
    def test_upload_audio_returns_streaming_url_or_file_id(self):
        """Test that audio upload returns either streaming_url (Supabase) or file_id (MongoDB fallback)"""
        wav_data = self.create_minimal_wav()
        
        files = {'file': ('test_audio.wav', wav_data, 'audio/wav')}
        response = requests.post(f"{BASE_URL}/api/content/upload-audio", files=files)
        
        assert response.status_code == 200
        data = response.json()
        # Should have either streaming_url (Supabase) or file_id (MongoDB fallback)
        assert "streaming_url" in data or "file_id" in data


class TestCategoryPermissionsGet:
    """Tests for GET /api/admin/category-permissions"""
    
    def test_get_all_category_permissions(self):
        """Test getting all category permissions"""
        response = requests.get(f"{BASE_URL}/api/admin/category-permissions")
        
        assert response.status_code == 200
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        
        # Should have 9 user categories
        assert len(categories) == 9
    
    def test_category_permissions_structure(self):
        """Test that each category has required fields"""
        response = requests.get(f"{BASE_URL}/api/admin/category-permissions")
        
        assert response.status_code == 200
        categories = response.json()["categories"]
        
        required_fields = ["role_id", "name", "color", "level", "permissions", "is_customized"]
        
        for cat in categories:
            for field in required_fields:
                assert field in cat, f"Missing field {field} in category {cat.get('role_id')}"
    
    def test_category_permissions_includes_all_roles(self):
        """Test that all expected roles are present"""
        response = requests.get(f"{BASE_URL}/api/admin/category-permissions")
        
        assert response.status_code == 200
        categories = response.json()["categories"]
        
        expected_roles = [
            "super_admin", "admin", "sub_admin", "finance_admin", 
            "moderator", "choir_artist", "religious_leader", 
            "listener_free", "listener_paid"
        ]
        
        actual_roles = [cat["role_id"] for cat in categories]
        
        for role in expected_roles:
            assert role in actual_roles, f"Missing role: {role}"


class TestCategoryPermissionsUpdate:
    """Tests for PUT /api/admin/category-permissions/{role_id}"""
    
    def test_update_category_permissions_success(self):
        """Test successful permission update"""
        new_permissions = ["access_free_content", "view_own_analytics"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/category-permissions/listener_free",
            json={"permissions": new_permissions}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "permissions" in data
        assert set(data["permissions"]) == set(new_permissions)
    
    def test_update_marks_category_as_customized(self):
        """Test that updating permissions marks category as customized"""
        # First update
        requests.put(
            f"{BASE_URL}/api/admin/category-permissions/listener_free",
            json={"permissions": ["access_free_content", "view_own_analytics"]}
        )
        
        # Verify it's marked as customized
        response = requests.get(f"{BASE_URL}/api/admin/category-permissions")
        categories = response.json()["categories"]
        
        listener_free = next(c for c in categories if c["role_id"] == "listener_free")
        assert listener_free["is_customized"] == True
        
        # Clean up - reset to defaults
        requests.post(f"{BASE_URL}/api/admin/category-permissions/listener_free/reset")
    
    def test_update_invalid_role_returns_404(self):
        """Test that updating non-existent role returns 404"""
        response = requests.put(
            f"{BASE_URL}/api/admin/category-permissions/invalid_role",
            json={"permissions": ["access_free_content"]}
        )
        
        assert response.status_code == 404
    
    def test_update_invalid_permission_returns_400(self):
        """Test that invalid permissions are rejected"""
        response = requests.put(
            f"{BASE_URL}/api/admin/category-permissions/listener_free",
            json={"permissions": ["invalid_permission_xyz"]}
        )
        
        assert response.status_code == 400
        assert "invalid" in response.json().get("detail", "").lower()


class TestCategoryPermissionsReset:
    """Tests for POST /api/admin/category-permissions/{role_id}/reset"""
    
    def test_reset_permissions_success(self):
        """Test successful permission reset"""
        # First customize permissions
        requests.put(
            f"{BASE_URL}/api/admin/category-permissions/listener_free",
            json={"permissions": ["access_free_content", "view_own_analytics"]}
        )
        
        # Reset to defaults
        response = requests.post(f"{BASE_URL}/api/admin/category-permissions/listener_free/reset")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "permissions" in data
        # Default for listener_free is just access_free_content
        assert data["permissions"] == ["access_free_content"]
    
    def test_reset_removes_customized_flag(self):
        """Test that reset removes the customized flag"""
        # First customize
        requests.put(
            f"{BASE_URL}/api/admin/category-permissions/listener_free",
            json={"permissions": ["access_free_content", "view_own_analytics"]}
        )
        
        # Reset
        requests.post(f"{BASE_URL}/api/admin/category-permissions/listener_free/reset")
        
        # Verify not customized
        response = requests.get(f"{BASE_URL}/api/admin/category-permissions")
        categories = response.json()["categories"]
        
        listener_free = next(c for c in categories if c["role_id"] == "listener_free")
        assert listener_free["is_customized"] == False
    
    def test_reset_invalid_role_returns_404(self):
        """Test that resetting non-existent role returns 404"""
        response = requests.post(f"{BASE_URL}/api/admin/category-permissions/invalid_role/reset")
        
        assert response.status_code == 404


class TestPermissionValidation:
    """Tests for permission validation"""
    
    def test_all_system_permissions_are_valid(self):
        """Test that all permissions in categories are valid system permissions"""
        response = requests.get(f"{BASE_URL}/api/admin/category-permissions")
        categories = response.json()["categories"]
        
        # Collect all permissions used
        all_used_permissions = set()
        for cat in categories:
            all_used_permissions.update(cat["permissions"])
        
        # All permissions should be valid (no 400 error when setting them)
        for perm in all_used_permissions:
            response = requests.put(
                f"{BASE_URL}/api/admin/category-permissions/listener_free",
                json={"permissions": [perm]}
            )
            # Should not get 400 for invalid permission
            assert response.status_code != 400 or "invalid" not in response.json().get("detail", "").lower(), \
                f"Permission {perm} appears to be invalid"
        
        # Clean up
        requests.post(f"{BASE_URL}/api/admin/category-permissions/listener_free/reset")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
