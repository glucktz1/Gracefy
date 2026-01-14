"""
Test file upload functionality for Spirit Songs Admin API
Tests:
- POST /api/upload - Single file upload (image returns data URL, audio returns streaming URL)
- POST /api/upload/multiple - Multiple file upload with song_name extraction from filename
- GET /api/files/{file_id}/stream - Audio streaming with Range header support
- GET /api/files/{file_id} - File metadata retrieval
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test audio content (small WAV header + minimal data)
def create_test_audio_content():
    """Create minimal valid WAV file content for testing"""
    # WAV header for a minimal file
    wav_header = bytes([
        0x52, 0x49, 0x46, 0x46,  # "RIFF"
        0x24, 0x00, 0x00, 0x00,  # File size - 8
        0x57, 0x41, 0x56, 0x45,  # "WAVE"
        0x66, 0x6D, 0x74, 0x20,  # "fmt "
        0x10, 0x00, 0x00, 0x00,  # Subchunk1Size (16 for PCM)
        0x01, 0x00,              # AudioFormat (1 = PCM)
        0x01, 0x00,              # NumChannels (1 = mono)
        0x44, 0xAC, 0x00, 0x00,  # SampleRate (44100)
        0x88, 0x58, 0x01, 0x00,  # ByteRate
        0x02, 0x00,              # BlockAlign
        0x10, 0x00,              # BitsPerSample (16)
        0x64, 0x61, 0x74, 0x61,  # "data"
        0x00, 0x00, 0x00, 0x00   # Subchunk2Size (0 for minimal)
    ])
    return wav_header

# Test image content (minimal PNG)
def create_test_image_content():
    """Create minimal valid PNG file content for testing"""
    # Minimal 1x1 transparent PNG
    png_data = bytes([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,  # 8-bit RGBA
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,  # IDAT chunk
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,  # Compressed data
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,  # 
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,  # IEND chunk
        0x42, 0x60, 0x82
    ])
    return png_data


class TestSingleFileUpload:
    """Tests for POST /api/upload endpoint"""
    
    def test_upload_image_returns_data_url(self):
        """Upload image file should return data URL"""
        image_content = create_test_image_content()
        files = {'file': ('test_thumbnail.png', io.BytesIO(image_content), 'image/png')}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "file_id" in data, "Response should contain file_id"
        assert "url" in data, "Response should contain url"
        assert "filename" in data, "Response should contain filename"
        assert "content_type" in data, "Response should contain content_type"
        assert "size" in data, "Response should contain size"
        
        # Image should return data URL
        assert data["url"].startswith("data:image/png;base64,"), f"Image URL should be data URL, got: {data['url'][:50]}"
        assert data["filename"] == "test_thumbnail.png"
        assert data["content_type"] == "image/png"
        print(f"✓ Image upload successful: file_id={data['file_id']}, url starts with data:image/png")
    
    def test_upload_audio_returns_streaming_url(self):
        """Upload audio file should return streaming URL"""
        audio_content = create_test_audio_content()
        files = {'file': ('test_song.wav', io.BytesIO(audio_content), 'audio/wav')}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "file_id" in data
        assert "url" in data
        
        # Audio should return streaming URL
        assert data["url"].startswith("/api/files/"), f"Audio URL should be streaming URL, got: {data['url']}"
        assert "/stream" in data["url"], "Audio URL should contain /stream"
        assert data["content_type"] == "audio/wav"
        print(f"✓ Audio upload successful: file_id={data['file_id']}, streaming_url={data['url']}")
        
        # Store for later tests
        return data["file_id"]
    
    def test_upload_mp3_returns_streaming_url(self):
        """Upload MP3 file should return streaming URL"""
        # Minimal MP3 frame (not a valid MP3 but has correct content type)
        mp3_content = b'\xff\xfb\x90\x00' + b'\x00' * 100
        files = {'file': ('Amazing Grace.mp3', io.BytesIO(mp3_content), 'audio/mpeg')}
        
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["url"].startswith("/api/files/")
        assert "/stream" in data["url"]
        assert data["content_type"] == "audio/mpeg"
        print(f"✓ MP3 upload successful: streaming_url={data['url']}")


class TestMultipleFileUpload:
    """Tests for POST /api/upload/multiple endpoint"""
    
    def test_upload_multiple_audio_files(self):
        """Upload multiple audio files should return streaming URLs with song names"""
        audio_content = create_test_audio_content()
        
        # Create multiple files with different names
        files = [
            ('files', ('Praise The Lord.wav', io.BytesIO(audio_content), 'audio/wav')),
            ('files', ('Holy Spirit.wav', io.BytesIO(audio_content), 'audio/wav')),
            ('files', ('Amazing Grace - Live Version.wav', io.BytesIO(audio_content), 'audio/wav'))
        ]
        
        response = requests.post(f"{BASE_URL}/api/upload/multiple", files=files)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "files" in data, "Response should contain files array"
        assert "total" in data, "Response should contain total count"
        assert data["total"] == 3, f"Expected 3 files, got {data['total']}"
        
        # Verify each file
        expected_song_names = ["Praise The Lord", "Holy Spirit", "Amazing Grace - Live Version"]
        for i, file_result in enumerate(data["files"]):
            assert "file_id" in file_result
            assert "url" in file_result
            assert "song_name" in file_result, "Response should contain song_name extracted from filename"
            assert file_result["url"].startswith("/api/files/"), "Audio should have streaming URL"
            assert "/stream" in file_result["url"]
            assert file_result["song_name"] == expected_song_names[i], f"Expected song_name '{expected_song_names[i]}', got '{file_result['song_name']}'"
            print(f"✓ File {i+1}: song_name='{file_result['song_name']}', streaming_url={file_result['url']}")
        
        print(f"✓ Multiple file upload successful: {data['total']} files uploaded")
    
    def test_upload_mixed_files(self):
        """Upload mix of audio and image files"""
        audio_content = create_test_audio_content()
        image_content = create_test_image_content()
        
        files = [
            ('files', ('song1.wav', io.BytesIO(audio_content), 'audio/wav')),
            ('files', ('album_cover.png', io.BytesIO(image_content), 'image/png'))
        ]
        
        response = requests.post(f"{BASE_URL}/api/upload/multiple", files=files)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 2
        
        # First file (audio) should have streaming URL
        assert data["files"][0]["url"].startswith("/api/files/")
        assert data["files"][0]["song_name"] == "song1"
        
        # Second file (image) should have data URL
        assert data["files"][1]["url"].startswith("data:image/png")
        print(f"✓ Mixed file upload: audio has streaming URL, image has data URL")


class TestFileStreaming:
    """Tests for GET /api/files/{file_id}/stream endpoint"""
    
    @pytest.fixture
    def uploaded_audio_file(self):
        """Upload an audio file and return its file_id"""
        audio_content = create_test_audio_content()
        files = {'file': ('test_stream.wav', io.BytesIO(audio_content), 'audio/wav')}
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        assert response.status_code == 200
        return response.json()
    
    def test_stream_full_file(self, uploaded_audio_file):
        """Stream full audio file without Range header"""
        file_id = uploaded_audio_file["file_id"]
        
        response = requests.get(f"{BASE_URL}/api/files/{file_id}/stream")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "Accept-Ranges" in response.headers, "Response should support range requests"
        assert response.headers["Accept-Ranges"] == "bytes"
        assert "Content-Length" in response.headers
        assert response.headers["Content-Type"] == "audio/wav"
        print(f"✓ Full file stream: Content-Length={response.headers['Content-Length']}, Content-Type={response.headers['Content-Type']}")
    
    def test_stream_with_range_header(self, uploaded_audio_file):
        """Stream audio file with Range header for seeking"""
        file_id = uploaded_audio_file["file_id"]
        
        # Request first 10 bytes
        headers = {"Range": "bytes=0-9"}
        response = requests.get(f"{BASE_URL}/api/files/{file_id}/stream", headers=headers)
        
        assert response.status_code == 206, f"Expected 206 Partial Content, got {response.status_code}"
        assert "Content-Range" in response.headers, "Response should have Content-Range header"
        assert response.headers["Content-Range"].startswith("bytes 0-9/")
        assert len(response.content) == 10, f"Expected 10 bytes, got {len(response.content)}"
        print(f"✓ Range request: Content-Range={response.headers['Content-Range']}")
    
    def test_stream_middle_range(self, uploaded_audio_file):
        """Stream middle portion of audio file"""
        file_id = uploaded_audio_file["file_id"]
        
        # Request bytes 10-19
        headers = {"Range": "bytes=10-19"}
        response = requests.get(f"{BASE_URL}/api/files/{file_id}/stream", headers=headers)
        
        assert response.status_code == 206
        assert "bytes 10-19/" in response.headers["Content-Range"]
        assert len(response.content) == 10
        print(f"✓ Middle range request: Content-Range={response.headers['Content-Range']}")
    
    def test_stream_nonexistent_file(self):
        """Stream non-existent file should return 404"""
        response = requests.get(f"{BASE_URL}/api/files/nonexistent_file_id/stream")
        
        assert response.status_code == 404
        print("✓ Non-existent file returns 404")


class TestFileMetadata:
    """Tests for GET /api/files/{file_id} endpoint"""
    
    @pytest.fixture
    def uploaded_file(self):
        """Upload a file and return its data"""
        audio_content = create_test_audio_content()
        files = {'file': ('metadata_test.wav', io.BytesIO(audio_content), 'audio/wav')}
        response = requests.post(f"{BASE_URL}/api/upload", files=files)
        assert response.status_code == 200
        return response.json()
    
    def test_get_file_metadata(self, uploaded_file):
        """Get file metadata should return file info without data"""
        file_id = uploaded_file["file_id"]
        
        response = requests.get(f"{BASE_URL}/api/files/{file_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify metadata fields
        assert "file_id" in data
        assert "filename" in data
        assert "content_type" in data
        assert "size" in data
        assert "created_at" in data
        
        # Data should NOT be included (excluded in query)
        assert "data" not in data, "File data should not be included in metadata response"
        
        assert data["filename"] == "metadata_test.wav"
        assert data["content_type"] == "audio/wav"
        print(f"✓ File metadata: filename={data['filename']}, size={data['size']}, content_type={data['content_type']}")
    
    def test_get_nonexistent_file_metadata(self):
        """Get metadata for non-existent file should return 404"""
        response = requests.get(f"{BASE_URL}/api/files/nonexistent_file_id")
        
        assert response.status_code == 404
        print("✓ Non-existent file metadata returns 404")


class TestIntegrationWithAlbums:
    """Integration tests for file upload with album/song creation"""
    
    def test_upload_thumbnail_and_create_album(self):
        """Upload thumbnail and use URL in album creation"""
        # Upload thumbnail
        image_content = create_test_image_content()
        files = {'file': ('album_thumbnail.png', io.BytesIO(image_content), 'image/png')}
        upload_response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert upload_response.status_code == 200
        thumbnail_url = upload_response.json()["url"]
        
        # Create album with thumbnail
        album_data = {
            "title": "TEST_Upload_Album",
            "description": "Test album with uploaded thumbnail",
            "thumbnail": thumbnail_url,
            "monetization_type": "free",
            "status": "active"
        }
        
        album_response = requests.post(f"{BASE_URL}/api/albums", json=album_data)
        
        assert album_response.status_code == 200
        album_id = album_response.json()["album_id"]
        
        # Verify album has thumbnail
        get_response = requests.get(f"{BASE_URL}/api/albums/{album_id}")
        assert get_response.status_code == 200
        album = get_response.json()["album"]
        assert album["thumbnail"] == thumbnail_url
        print(f"✓ Album created with uploaded thumbnail: album_id={album_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/albums/{album_id}")
    
    def test_upload_audio_and_create_song(self):
        """Upload audio and use streaming URL in song creation"""
        # First create an album
        album_data = {
            "title": "TEST_Audio_Upload_Album",
            "status": "active"
        }
        album_response = requests.post(f"{BASE_URL}/api/albums", json=album_data)
        assert album_response.status_code == 200
        album_id = album_response.json()["album_id"]
        
        # Upload audio
        audio_content = create_test_audio_content()
        files = {'file': ('Holy Spirit.wav', io.BytesIO(audio_content), 'audio/wav')}
        upload_response = requests.post(f"{BASE_URL}/api/upload", files=files)
        
        assert upload_response.status_code == 200
        audio_url = upload_response.json()["url"]
        
        # Create song with audio URL
        song_data = {
            "title": "Holy Spirit",
            "album_id": album_id,
            "audio_url": audio_url,
            "duration": 180,
            "status": "active"
        }
        
        song_response = requests.post(f"{BASE_URL}/api/songs", json=song_data)
        
        assert song_response.status_code == 200
        song_id = song_response.json()["song_id"]
        
        # Verify song has audio URL
        get_response = requests.get(f"{BASE_URL}/api/albums/{album_id}")
        assert get_response.status_code == 200
        songs = get_response.json()["songs"]
        assert len(songs) > 0
        assert songs[0]["audio_url"] == audio_url
        assert songs[0]["audio_url"].startswith("/api/files/")
        print(f"✓ Song created with streaming audio URL: song_id={song_id}, audio_url={audio_url}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/albums/{album_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
