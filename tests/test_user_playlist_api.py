"""
Test User Library and Playlist API Endpoints
Tests for Spirit Songs mobile app playlist functionality:
- GET /api/user/library - User library with favorites, playlists, recently_played
- POST /api/user/playlist/create - Create new playlist
- POST /api/user/playlist/{id}/add - Add song to playlist
- GET /api/user/playlist/{id} - Get playlist with songs array containing {song, album} objects
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestUserPlaylistAPI:
    """Test user library and playlist endpoints"""
    
    # Class-level variables to store test data
    test_user_token = None
    test_user_id = None
    test_playlist_id = None
    test_song_id = None
    test_album_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_01_register_test_user(self):
        """Register a test user for playlist testing"""
        unique_id = uuid.uuid4().hex[:8]
        email = f"TEST_playlist_user_{unique_id}@test.com"
        
        response = self.session.post(f"{BASE_URL}/api/user/register", json={
            "email": email,
            "password": "testpass123",
            "name": f"TEST Playlist User {unique_id}"
        })
        
        # Status assertion
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "user" in data, "Response should contain user object"
        assert "token" in data, "Response should contain token"
        assert data["user"]["email"] == email, "Email should match"
        
        # Store for subsequent tests
        TestUserPlaylistAPI.test_user_token = data["token"]
        TestUserPlaylistAPI.test_user_id = data["user"]["user_id"]
        
        print(f"✓ Registered test user: {email}")
        print(f"✓ Token: {data['token'][:20]}...")
    
    def test_02_get_user_library_empty(self):
        """GET /api/user/library - Should return empty library for new user"""
        assert TestUserPlaylistAPI.test_user_token, "Test user token required"
        
        response = self.session.get(
            f"{BASE_URL}/api/user/library",
            headers={"Authorization": f"Bearer {TestUserPlaylistAPI.test_user_token}"}
        )
        
        # Status assertion
        assert response.status_code == 200, f"Get library failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "favorites" in data, "Response should contain favorites"
        assert "playlists" in data, "Response should contain playlists"
        assert "recently_played" in data, "Response should contain recently_played"
        assert "downloads" in data, "Response should contain downloads"
        
        # New user should have empty library
        assert isinstance(data["favorites"], list), "favorites should be a list"
        assert isinstance(data["playlists"], list), "playlists should be a list"
        assert isinstance(data["recently_played"], list), "recently_played should be a list"
        
        print(f"✓ User library structure verified")
        print(f"  - favorites: {len(data['favorites'])} items")
        print(f"  - playlists: {len(data['playlists'])} items")
        print(f"  - recently_played: {len(data['recently_played'])} items")
    
    def test_03_get_user_library_unauthorized(self):
        """GET /api/user/library - Should return 401 without auth"""
        response = self.session.get(f"{BASE_URL}/api/user/library")
        
        # Status assertion
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthorized access correctly rejected")
    
    def test_04_create_playlist(self):
        """POST /api/user/playlist/create - Should create a new playlist"""
        assert TestUserPlaylistAPI.test_user_token, "Test user token required"
        
        playlist_name = f"TEST Playlist {uuid.uuid4().hex[:6]}"
        
        response = self.session.post(
            f"{BASE_URL}/api/user/playlist/create",
            headers={"Authorization": f"Bearer {TestUserPlaylistAPI.test_user_token}"},
            json={
                "name": playlist_name,
                "description": "Test playlist for API testing",
                "is_public": False
            }
        )
        
        # Status assertion
        assert response.status_code == 200, f"Create playlist failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "playlist" in data, "Response should contain playlist object"
        
        playlist = data["playlist"]
        assert "playlist_id" in playlist, "Playlist should have playlist_id"
        assert playlist["name"] == playlist_name, "Playlist name should match"
        assert playlist["user_id"] == TestUserPlaylistAPI.test_user_id, "User ID should match"
        assert isinstance(playlist["songs"], list), "songs should be a list"
        assert len(playlist["songs"]) == 0, "New playlist should have no songs"
        
        # Store for subsequent tests
        TestUserPlaylistAPI.test_playlist_id = playlist["playlist_id"]
        
        print(f"✓ Created playlist: {playlist_name}")
        print(f"✓ Playlist ID: {playlist['playlist_id']}")
    
    def test_05_create_playlist_unauthorized(self):
        """POST /api/user/playlist/create - Should return 401 without auth"""
        response = self.session.post(
            f"{BASE_URL}/api/user/playlist/create",
            json={"name": "Unauthorized Playlist"}
        )
        
        # Status assertion
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthorized playlist creation correctly rejected")
    
    def test_06_verify_playlist_in_library(self):
        """GET /api/user/library - Should show created playlist"""
        assert TestUserPlaylistAPI.test_user_token, "Test user token required"
        assert TestUserPlaylistAPI.test_playlist_id, "Test playlist ID required"
        
        response = self.session.get(
            f"{BASE_URL}/api/user/library",
            headers={"Authorization": f"Bearer {TestUserPlaylistAPI.test_user_token}"}
        )
        
        # Status assertion
        assert response.status_code == 200, f"Get library failed: {response.text}"
        
        # Data assertions
        data = response.json()
        playlists = data.get("playlists", [])
        
        # Find our created playlist
        found_playlist = None
        for pl in playlists:
            if pl.get("playlist_id") == TestUserPlaylistAPI.test_playlist_id:
                found_playlist = pl
                break
        
        assert found_playlist is not None, f"Created playlist not found in library. Playlists: {playlists}"
        assert found_playlist["user_id"] == TestUserPlaylistAPI.test_user_id, "Playlist user_id should match"
        
        print(f"✓ Playlist found in user library")
        print(f"  - Playlist name: {found_playlist.get('name')}")
        print(f"  - Total playlists: {len(playlists)}")
    
    def test_07_get_existing_songs_and_albums(self):
        """Get existing songs and albums for testing add to playlist"""
        # Get albums
        response = self.session.get(f"{BASE_URL}/api/albums")
        
        if response.status_code == 200:
            data = response.json()
            albums = data.get("albums", [])
            if albums:
                TestUserPlaylistAPI.test_album_id = albums[0].get("album_id")
                print(f"✓ Found album: {albums[0].get('title')}")
        
        # Get songs
        response = self.session.get(f"{BASE_URL}/api/songs")
        
        if response.status_code == 200:
            data = response.json()
            songs = data.get("songs", [])
            if songs:
                TestUserPlaylistAPI.test_song_id = songs[0].get("song_id")
                print(f"✓ Found song: {songs[0].get('title')}")
        
        # If no songs found, try getting songs from an album
        if not TestUserPlaylistAPI.test_song_id and TestUserPlaylistAPI.test_album_id:
            response = self.session.get(f"{BASE_URL}/api/albums/{TestUserPlaylistAPI.test_album_id}/songs")
            if response.status_code == 200:
                data = response.json()
                songs = data.get("songs", [])
                if songs:
                    TestUserPlaylistAPI.test_song_id = songs[0].get("song_id")
                    print(f"✓ Found song from album: {songs[0].get('title')}")
        
        print(f"  - Album ID: {TestUserPlaylistAPI.test_album_id}")
        print(f"  - Song ID: {TestUserPlaylistAPI.test_song_id}")
    
    def test_08_add_song_to_playlist(self):
        """POST /api/user/playlist/{id}/add - Should add song to playlist"""
        assert TestUserPlaylistAPI.test_user_token, "Test user token required"
        assert TestUserPlaylistAPI.test_playlist_id, "Test playlist ID required"
        
        if not TestUserPlaylistAPI.test_song_id:
            pytest.skip("No test song available - skipping add to playlist test")
        
        response = self.session.post(
            f"{BASE_URL}/api/user/playlist/{TestUserPlaylistAPI.test_playlist_id}/add",
            headers={"Authorization": f"Bearer {TestUserPlaylistAPI.test_user_token}"},
            json={"song_id": TestUserPlaylistAPI.test_song_id}
        )
        
        # Status assertion
        assert response.status_code == 200, f"Add to playlist failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "message" in data, "Response should contain message"
        
        print(f"✓ Added song {TestUserPlaylistAPI.test_song_id} to playlist")
    
    def test_09_add_song_to_playlist_unauthorized(self):
        """POST /api/user/playlist/{id}/add - Should return 401 without auth"""
        if not TestUserPlaylistAPI.test_playlist_id:
            pytest.skip("No test playlist available")
        
        response = self.session.post(
            f"{BASE_URL}/api/user/playlist/{TestUserPlaylistAPI.test_playlist_id}/add",
            json={"song_id": "some_song_id"}
        )
        
        # Status assertion
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthorized add to playlist correctly rejected")
    
    def test_10_add_song_to_nonexistent_playlist(self):
        """POST /api/user/playlist/{id}/add - Should return 404 for non-existent playlist"""
        assert TestUserPlaylistAPI.test_user_token, "Test user token required"
        
        response = self.session.post(
            f"{BASE_URL}/api/user/playlist/nonexistent_playlist_id/add",
            headers={"Authorization": f"Bearer {TestUserPlaylistAPI.test_user_token}"},
            json={"song_id": "some_song_id"}
        )
        
        # Status assertion
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent playlist correctly returns 404")
    
    def test_11_get_playlist_with_songs(self):
        """GET /api/user/playlist/{id} - Should return playlist with songs array containing {song, album} objects"""
        assert TestUserPlaylistAPI.test_playlist_id, "Test playlist ID required"
        
        response = self.session.get(
            f"{BASE_URL}/api/user/playlist/{TestUserPlaylistAPI.test_playlist_id}"
        )
        
        # Status assertion
        assert response.status_code == 200, f"Get playlist failed: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "playlist" in data, "Response should contain playlist object"
        assert "songs" in data, "Response should contain songs array"
        
        playlist = data["playlist"]
        songs = data["songs"]
        
        assert playlist["playlist_id"] == TestUserPlaylistAPI.test_playlist_id, "Playlist ID should match"
        assert isinstance(songs, list), "songs should be a list"
        
        # If we added a song, verify the structure
        if songs and TestUserPlaylistAPI.test_song_id:
            song_entry = songs[0]
            assert "song" in song_entry, "Each song entry should have 'song' object"
            assert "album" in song_entry, "Each song entry should have 'album' object"
            
            # Verify song structure
            song = song_entry["song"]
            assert "song_id" in song, "Song should have song_id"
            assert "title" in song, "Song should have title"
            
            # Verify album structure (can be None if album not found)
            album = song_entry["album"]
            if album:
                assert "album_id" in album, "Album should have album_id"
                assert "title" in album, "Album should have title"
            
            print(f"✓ Song entry structure verified:")
            print(f"  - Song: {song.get('title')}")
            print(f"  - Album: {album.get('title') if album else 'N/A'}")
        
        print(f"✓ Playlist retrieved with {len(songs)} songs")
        print(f"  - Playlist name: {playlist.get('name')}")
    
    def test_12_get_nonexistent_playlist(self):
        """GET /api/user/playlist/{id} - Should return 404 for non-existent playlist"""
        response = self.session.get(
            f"{BASE_URL}/api/user/playlist/nonexistent_playlist_id"
        )
        
        # Status assertion
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent playlist correctly returns 404")
    
    def test_13_create_multiple_playlists(self):
        """Create multiple playlists and verify all appear in library"""
        assert TestUserPlaylistAPI.test_user_token, "Test user token required"
        
        playlist_ids = []
        
        # Create 3 playlists
        for i in range(3):
            response = self.session.post(
                f"{BASE_URL}/api/user/playlist/create",
                headers={"Authorization": f"Bearer {TestUserPlaylistAPI.test_user_token}"},
                json={
                    "name": f"TEST Multi Playlist {i+1}",
                    "description": f"Test playlist {i+1}",
                    "is_public": False
                }
            )
            
            assert response.status_code == 200, f"Create playlist {i+1} failed: {response.text}"
            data = response.json()
            playlist_ids.append(data["playlist"]["playlist_id"])
        
        # Verify all playlists appear in library
        response = self.session.get(
            f"{BASE_URL}/api/user/library",
            headers={"Authorization": f"Bearer {TestUserPlaylistAPI.test_user_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        playlists = data.get("playlists", [])
        
        library_playlist_ids = [pl.get("playlist_id") for pl in playlists]
        
        for pl_id in playlist_ids:
            assert pl_id in library_playlist_ids, f"Playlist {pl_id} not found in library"
        
        print(f"✓ Created and verified {len(playlist_ids)} playlists in library")
        print(f"  - Total playlists in library: {len(playlists)}")
    
    def test_14_add_multiple_songs_to_playlist(self):
        """Add multiple songs to a playlist and verify"""
        assert TestUserPlaylistAPI.test_user_token, "Test user token required"
        assert TestUserPlaylistAPI.test_playlist_id, "Test playlist ID required"
        
        # Get more songs
        response = self.session.get(f"{BASE_URL}/api/songs")
        if response.status_code != 200:
            pytest.skip("Cannot get songs list")
        
        data = response.json()
        songs = data.get("songs", [])[:5]  # Get up to 5 songs
        
        if len(songs) < 2:
            pytest.skip("Not enough songs available for multi-song test")
        
        # Add each song to playlist
        added_count = 0
        for song in songs:
            response = self.session.post(
                f"{BASE_URL}/api/user/playlist/{TestUserPlaylistAPI.test_playlist_id}/add",
                headers={"Authorization": f"Bearer {TestUserPlaylistAPI.test_user_token}"},
                json={"song_id": song["song_id"]}
            )
            if response.status_code == 200:
                added_count += 1
        
        # Verify songs in playlist
        response = self.session.get(
            f"{BASE_URL}/api/user/playlist/{TestUserPlaylistAPI.test_playlist_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        playlist_songs = data.get("songs", [])
        
        print(f"✓ Added {added_count} songs to playlist")
        print(f"  - Total songs in playlist: {len(playlist_songs)}")
        
        # Verify each song has proper structure
        for song_entry in playlist_songs:
            assert "song" in song_entry, "Song entry should have 'song' object"
            assert "album" in song_entry, "Song entry should have 'album' object"
    
    def test_15_playlist_response_structure_for_mobile(self):
        """Verify playlist response structure matches what PlaylistDetailScreen expects"""
        assert TestUserPlaylistAPI.test_playlist_id, "Test playlist ID required"
        
        response = self.session.get(
            f"{BASE_URL}/api/user/playlist/{TestUserPlaylistAPI.test_playlist_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # PlaylistDetailScreen expects:
        # - playlist object with name, description, etc.
        # - songs array with {song, album} objects
        
        assert "playlist" in data, "Response must have 'playlist' key"
        assert "songs" in data, "Response must have 'songs' key"
        
        playlist = data["playlist"]
        songs = data["songs"]
        
        # Verify playlist structure
        required_playlist_fields = ["playlist_id", "name", "songs"]
        for field in required_playlist_fields:
            assert field in playlist, f"Playlist missing required field: {field}"
        
        # Verify songs structure
        if songs:
            for i, song_entry in enumerate(songs):
                assert "song" in song_entry, f"Song entry {i} missing 'song' object"
                assert "album" in song_entry, f"Song entry {i} missing 'album' object"
                
                song = song_entry["song"]
                if song:
                    # Verify song has fields needed for playback
                    assert "song_id" in song, f"Song {i} missing song_id"
                    assert "title" in song, f"Song {i} missing title"
        
        print("✓ Playlist response structure verified for mobile app")
        print(f"  - Playlist fields: {list(playlist.keys())}")
        print(f"  - Songs count: {len(songs)}")
        if songs:
            print(f"  - Song entry fields: {list(songs[0].keys())}")


class TestUserFavorites:
    """Test user favorites functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_01_add_to_favorites(self):
        """POST /api/user/favorites/add - Add song to favorites"""
        # Use existing token from playlist tests
        if not TestUserPlaylistAPI.test_user_token:
            pytest.skip("No test user token available")
        
        if not TestUserPlaylistAPI.test_song_id:
            pytest.skip("No test song available")
        
        response = self.session.post(
            f"{BASE_URL}/api/user/favorites/add",
            headers={"Authorization": f"Bearer {TestUserPlaylistAPI.test_user_token}"},
            json={
                "type": "song",
                "id": TestUserPlaylistAPI.test_song_id
            }
        )
        
        # Status assertion
        assert response.status_code == 200, f"Add to favorites failed: {response.text}"
        print(f"✓ Added song to favorites")
    
    def test_02_verify_favorites_in_library(self):
        """GET /api/user/library - Verify favorites appear with song and album data"""
        if not TestUserPlaylistAPI.test_user_token:
            pytest.skip("No test user token available")
        
        response = self.session.get(
            f"{BASE_URL}/api/user/library",
            headers={"Authorization": f"Bearer {TestUserPlaylistAPI.test_user_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        favorites = data.get("favorites", [])
        
        # Check favorites structure
        for fav in favorites:
            assert "type" in fav, "Favorite should have type"
            assert "item" in fav, "Favorite should have item"
            
            if fav["type"] == "song":
                assert "album" in fav, "Song favorite should have album"
        
        print(f"✓ Favorites structure verified")
        print(f"  - Total favorites: {len(favorites)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
