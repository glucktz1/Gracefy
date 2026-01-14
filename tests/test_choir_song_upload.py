"""
Test Choir Song Upload Feature
Tests the choir song upload modal and backend endpoint
"""
import pytest
import requests
import os
import hashlib
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
CHOIR_EMAIL = "testchoir@example.com"
CHOIR_PASSWORD = "test123"


class TestChoirSongUpload:
    """Test choir song upload functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.choir_token = None
        self.choir_id = None
        
    def login_choir(self):
        """Login as choir and get session token"""
        response = self.session.post(f"{BASE_URL}/api/choir/login", json={
            "email": CHOIR_EMAIL,
            "password": CHOIR_PASSWORD
        })
        assert response.status_code == 200, f"Choir login failed: {response.text}"
        data = response.json()
        self.choir_token = data.get("session_token")
        self.choir_id = data.get("choir_id")
        self.session.headers.update({"Authorization": f"Bearer {self.choir_token}"})
        return data
    
    # ============== Backend API Tests ==============
    
    def test_choir_login(self):
        """Test choir login works"""
        data = self.login_choir()
        assert "session_token" in data
        assert "choir_id" in data
        print(f"SUCCESS: Choir login successful, choir_id: {data['choir_id']}")
    
    def test_song_upload_without_album(self):
        """Test song upload request without album_id (album is optional)"""
        self.login_choir()
        
        # Submit song without album_id
        response = self.session.post(f"{BASE_URL}/api/choir/songs/upload", json={
            "title": "TEST_Song_No_Album",
            "duration_formatted": "3:45",
            "lyrics": "Test lyrics for song without album",
            "audio_url": "/api/files/test123/stream"
        })
        
        assert response.status_code == 200, f"Song upload failed: {response.text}"
        data = response.json()
        assert "request_id" in data
        assert "message" in data
        print(f"SUCCESS: Song upload without album accepted, request_id: {data['request_id']}")
    
    def test_song_upload_with_audio_url(self):
        """Test song upload request with audio_url parameter"""
        self.login_choir()
        
        # Submit song with audio_url
        response = self.session.post(f"{BASE_URL}/api/choir/songs/upload", json={
            "title": "TEST_Song_With_Audio",
            "duration_formatted": "4:20",
            "lyrics": "Test lyrics with audio URL",
            "audio_url": "/api/files/audio123/stream"
        })
        
        assert response.status_code == 200, f"Song upload failed: {response.text}"
        data = response.json()
        assert "request_id" in data
        print(f"SUCCESS: Song upload with audio_url accepted, request_id: {data['request_id']}")
    
    def test_song_upload_with_album(self):
        """Test song upload request with album_id"""
        self.login_choir()
        
        # First get choir's albums
        albums_response = self.session.get(f"{BASE_URL}/api/choir/my-albums")
        assert albums_response.status_code == 200
        albums = albums_response.json().get("albums", [])
        
        if albums:
            album_id = albums[0]["album_id"]
            
            # Submit song with album_id
            response = self.session.post(f"{BASE_URL}/api/choir/songs/upload", json={
                "title": "TEST_Song_With_Album",
                "album_id": album_id,
                "duration_formatted": "3:30",
                "lyrics": "Test lyrics with album",
                "audio_url": "/api/files/audio456/stream"
            })
            
            assert response.status_code == 200, f"Song upload failed: {response.text}"
            data = response.json()
            assert "request_id" in data
            print(f"SUCCESS: Song upload with album accepted, request_id: {data['request_id']}")
        else:
            pytest.skip("No albums available for testing")
    
    def test_song_upload_requires_title(self):
        """Test that song title is required"""
        self.login_choir()
        
        # Submit song without title
        response = self.session.post(f"{BASE_URL}/api/choir/songs/upload", json={
            "duration_formatted": "3:45",
            "audio_url": "/api/files/test/stream"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("SUCCESS: Song upload correctly requires title")
    
    def test_file_upload_endpoint(self):
        """Test file upload endpoint for audio files"""
        self.login_choir()
        
        # Create a mock audio file (small WAV header)
        wav_header = bytes([
            0x52, 0x49, 0x46, 0x46,  # "RIFF"
            0x24, 0x00, 0x00, 0x00,  # File size
            0x57, 0x41, 0x56, 0x45,  # "WAVE"
            0x66, 0x6D, 0x74, 0x20,  # "fmt "
            0x10, 0x00, 0x00, 0x00,  # Chunk size
            0x01, 0x00,              # Audio format (PCM)
            0x01, 0x00,              # Num channels
            0x44, 0xAC, 0x00, 0x00,  # Sample rate (44100)
            0x88, 0x58, 0x01, 0x00,  # Byte rate
            0x02, 0x00,              # Block align
            0x10, 0x00,              # Bits per sample
            0x64, 0x61, 0x74, 0x61,  # "data"
            0x00, 0x00, 0x00, 0x00   # Data size
        ])
        
        files = {
            'file': ('test_song.wav', io.BytesIO(wav_header), 'audio/wav')
        }
        
        # Remove Content-Type header for multipart upload
        headers = {"Authorization": f"Bearer {self.choir_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200, f"File upload failed: {response.text}"
        data = response.json()
        assert "url" in data
        print(f"SUCCESS: Audio file upload works, url: {data['url']}")
    
    def test_content_requests_list(self):
        """Test that content requests are listed"""
        self.login_choir()
        
        response = self.session.get(f"{BASE_URL}/api/choir/my-content-requests")
        assert response.status_code == 200
        data = response.json()
        assert "requests" in data
        print(f"SUCCESS: Content requests retrieved, count: {len(data['requests'])}")
    
    def test_my_albums_list(self):
        """Test that choir albums are listed"""
        self.login_choir()
        
        response = self.session.get(f"{BASE_URL}/api/choir/my-albums")
        assert response.status_code == 200
        data = response.json()
        assert "albums" in data
        print(f"SUCCESS: Albums retrieved, count: {len(data['albums'])}")


class TestFileUploadIntegration:
    """Test file upload integration for choir song upload"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.choir_token = None
        
    def login_choir(self):
        """Login as choir"""
        response = self.session.post(f"{BASE_URL}/api/choir/login", json={
            "email": CHOIR_EMAIL,
            "password": CHOIR_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        self.choir_token = data.get("session_token")
        return data
    
    def test_full_upload_flow(self):
        """Test complete flow: upload audio file, then submit song request"""
        self.login_choir()
        
        # Step 1: Upload audio file
        wav_header = bytes([
            0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
            0x57, 0x41, 0x56, 0x45, 0x66, 0x6D, 0x74, 0x20,
            0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
            0x44, 0xAC, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
            0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61,
            0x00, 0x00, 0x00, 0x00
        ])
        
        files = {'file': ('my_test_song.wav', io.BytesIO(wav_header), 'audio/wav')}
        headers = {"Authorization": f"Bearer {self.choir_token}"}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/upload",
            files=files,
            headers=headers
        )
        
        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        upload_data = upload_response.json()
        audio_url = upload_data.get("url")
        print(f"Step 1 SUCCESS: Audio uploaded, url: {audio_url}")
        
        # Step 2: Submit song request with audio URL
        self.session.headers.update({
            "Authorization": f"Bearer {self.choir_token}",
            "Content-Type": "application/json"
        })
        
        song_response = self.session.post(f"{BASE_URL}/api/choir/songs/upload", json={
            "title": "TEST_Integration_Song",
            "duration_formatted": "3:45",
            "lyrics": "Integration test lyrics",
            "audio_url": audio_url
        })
        
        assert song_response.status_code == 200, f"Song submit failed: {song_response.text}"
        song_data = song_response.json()
        print(f"Step 2 SUCCESS: Song request submitted, request_id: {song_data['request_id']}")
        
        # Step 3: Verify request appears in list
        requests_response = self.session.get(f"{BASE_URL}/api/choir/my-content-requests")
        assert requests_response.status_code == 200
        requests_data = requests_response.json()
        
        # Find our request
        found = False
        for req in requests_data.get("requests", []):
            if req.get("content_data", {}).get("title") == "TEST_Integration_Song":
                found = True
                assert req.get("content_data", {}).get("audio_url") == audio_url
                print(f"Step 3 SUCCESS: Request found in list with correct audio_url")
                break
        
        assert found, "Request not found in content requests list"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
