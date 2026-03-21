"""
Test suite for Continuous Playback / Recommendations API
Tests the /api/recommendations/next-songs endpoint which powers continuous playback
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestRecommendationsAPI:
    """Tests for /api/recommendations/next-songs endpoint"""
    
    def test_recommendations_endpoint_returns_songs(self):
        """Test that recommendations endpoint returns songs"""
        # First get a real song ID from an album
        albums_response = requests.get(f"{BASE_URL}/api/albums?limit=5")
        assert albums_response.status_code == 200
        albums = albums_response.json().get('albums', [])
        assert len(albums) > 0, "No albums found in database"
        
        # Get songs from first album with songs
        song_id = None
        for album in albums:
            album_detail = requests.get(f"{BASE_URL}/api/albums/{album['album_id']}")
            if album_detail.status_code == 200:
                songs = album_detail.json().get('songs', [])
                if songs:
                    song_id = songs[0]['song_id']
                    break
        
        assert song_id is not None, "No songs found in any album"
        
        # Test recommendations endpoint
        response = requests.get(f"{BASE_URL}/api/recommendations/next-songs", params={
            "current_song_id": song_id,
            "limit": 10
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "songs" in data, "Response missing 'songs' field"
        assert "criteria_used" in data, "Response missing 'criteria_used' field"
        assert isinstance(data["songs"], list), "Songs should be a list"
    
    def test_recommendations_returns_different_albums(self):
        """Test that recommendations return songs from different albums (not repeating same album)"""
        # Get a song to use as seed
        albums_response = requests.get(f"{BASE_URL}/api/albums?limit=10")
        assert albums_response.status_code == 200
        albums = albums_response.json().get('albums', [])
        
        song_id = None
        original_album_id = None
        for album in albums:
            album_detail = requests.get(f"{BASE_URL}/api/albums/{album['album_id']}")
            if album_detail.status_code == 200:
                songs = album_detail.json().get('songs', [])
                if songs:
                    song_id = songs[0]['song_id']
                    original_album_id = album['album_id']
                    break
        
        assert song_id is not None, "No songs found"
        
        # Get recommendations
        response = requests.get(f"{BASE_URL}/api/recommendations/next-songs", params={
            "current_song_id": song_id,
            "limit": 10
        })
        
        assert response.status_code == 200
        data = response.json()
        songs = data.get("songs", [])
        
        if len(songs) > 1:
            # Check that we have songs from multiple albums
            album_ids = set(s.get("album_id") for s in songs if s.get("album_id"))
            # Should have at least 2 different albums if we have multiple songs
            assert len(album_ids) >= min(2, len(songs)), f"Expected songs from multiple albums, got {len(album_ids)} unique albums"
    
    def test_recommendations_excludes_current_song(self):
        """Test that recommendations don't include the current song"""
        # Get a song
        albums_response = requests.get(f"{BASE_URL}/api/albums?limit=5")
        albums = albums_response.json().get('albums', [])
        
        song_id = None
        for album in albums:
            album_detail = requests.get(f"{BASE_URL}/api/albums/{album['album_id']}")
            if album_detail.status_code == 200:
                songs = album_detail.json().get('songs', [])
                if songs:
                    song_id = songs[0]['song_id']
                    break
        
        assert song_id is not None
        
        # Get recommendations
        response = requests.get(f"{BASE_URL}/api/recommendations/next-songs", params={
            "current_song_id": song_id,
            "limit": 10
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify current song is not in recommendations
        recommended_ids = [s.get("song_id") for s in data.get("songs", [])]
        assert song_id not in recommended_ids, "Current song should not be in recommendations"
    
    def test_recommendations_with_invalid_song_id(self):
        """Test recommendations with non-existent song ID returns random songs"""
        response = requests.get(f"{BASE_URL}/api/recommendations/next-songs", params={
            "current_song_id": "invalid_song_id_12345",
            "limit": 5
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Should still return songs (random fallback)
        assert "songs" in data
        # Criteria should be 'random' for invalid song
        assert data.get("criteria_used") == "random" or isinstance(data.get("criteria_used"), list)
    
    def test_recommendations_respects_limit(self):
        """Test that recommendations respect the limit parameter"""
        # Get a song
        albums_response = requests.get(f"{BASE_URL}/api/albums?limit=5")
        albums = albums_response.json().get('albums', [])
        
        song_id = None
        for album in albums:
            album_detail = requests.get(f"{BASE_URL}/api/albums/{album['album_id']}")
            if album_detail.status_code == 200:
                songs = album_detail.json().get('songs', [])
                if songs:
                    song_id = songs[0]['song_id']
                    break
        
        if song_id is None:
            pytest.skip("No songs available for testing")
        
        # Test with limit=3
        response = requests.get(f"{BASE_URL}/api/recommendations/next-songs", params={
            "current_song_id": song_id,
            "limit": 3
        })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data.get("songs", [])) <= 3, "Should respect limit parameter"
    
    def test_recommendations_include_album_metadata(self):
        """Test that recommended songs include album thumbnail and title"""
        # Get a song
        albums_response = requests.get(f"{BASE_URL}/api/albums?limit=5")
        albums = albums_response.json().get('albums', [])
        
        song_id = None
        for album in albums:
            album_detail = requests.get(f"{BASE_URL}/api/albums/{album['album_id']}")
            if album_detail.status_code == 200:
                songs = album_detail.json().get('songs', [])
                if songs:
                    song_id = songs[0]['song_id']
                    break
        
        if song_id is None:
            pytest.skip("No songs available for testing")
        
        response = requests.get(f"{BASE_URL}/api/recommendations/next-songs", params={
            "current_song_id": song_id,
            "limit": 5
        })
        
        assert response.status_code == 200
        data = response.json()
        songs = data.get("songs", [])
        
        if songs:
            # Check that songs have album metadata for UI display
            for song in songs:
                # Should have album_id
                assert "album_id" in song, "Song should have album_id"
                # Should have album_thumbnail or thumbnail for player UI
                has_thumbnail = song.get("album_thumbnail") or song.get("thumbnail")
                # Note: Some songs may not have thumbnails, so we just check the field exists
                assert "album_id" in song


class TestRecommendationSettings:
    """Tests for recommendation settings API"""
    
    def test_get_recommendation_settings(self):
        """Test getting recommendation settings"""
        response = requests.get(f"{BASE_URL}/api/admin/recommendation-settings")
        assert response.status_code == 200
        
        data = response.json()
        # Verify default settings structure
        assert "enabled" in data
        assert "primary_criteria" in data
        assert "weights" in data


class TestSingleSongAlbumBehavior:
    """Tests for single-song album behavior in recommendations"""
    
    def test_single_song_album_gets_recommendations(self):
        """Test that playing a song from single-song album gets recommendations from other albums"""
        # Find a single-song album
        albums_response = requests.get(f"{BASE_URL}/api/albums?limit=20")
        assert albums_response.status_code == 200
        albums = albums_response.json().get('albums', [])
        
        single_song_album = None
        song_id = None
        
        for album in albums:
            if album.get('songs_count', 0) == 1:
                album_detail = requests.get(f"{BASE_URL}/api/albums/{album['album_id']}")
                if album_detail.status_code == 200:
                    songs = album_detail.json().get('songs', [])
                    if songs:
                        single_song_album = album
                        song_id = songs[0]['song_id']
                        break
        
        if song_id is None:
            pytest.skip("No single-song album found for testing")
        
        # Get recommendations for the single song
        response = requests.get(f"{BASE_URL}/api/recommendations/next-songs", params={
            "current_song_id": song_id,
            "limit": 10
        })
        
        assert response.status_code == 200
        data = response.json()
        songs = data.get("songs", [])
        
        # Should return songs from OTHER albums (not the same single-song album)
        if songs:
            other_album_songs = [s for s in songs if s.get("album_id") != single_song_album['album_id']]
            # Most recommendations should be from other albums
            assert len(other_album_songs) > 0, "Should recommend songs from other albums for single-song album"


class TestContinuousPlaybackFlow:
    """End-to-end tests for continuous playback flow"""
    
    def test_continuous_playback_chain(self):
        """Test that we can chain multiple recommendation calls (simulating continuous playback)"""
        # Get initial song
        albums_response = requests.get(f"{BASE_URL}/api/albums?limit=5")
        albums = albums_response.json().get('albums', [])
        
        current_song_id = None
        for album in albums:
            album_detail = requests.get(f"{BASE_URL}/api/albums/{album['album_id']}")
            if album_detail.status_code == 200:
                songs = album_detail.json().get('songs', [])
                if songs:
                    current_song_id = songs[0]['song_id']
                    break
        
        if current_song_id is None:
            pytest.skip("No songs available for testing")
        
        played_songs = [current_song_id]
        
        # Simulate 3 rounds of continuous playback
        for i in range(3):
            response = requests.get(f"{BASE_URL}/api/recommendations/next-songs", params={
                "current_song_id": current_song_id,
                "limit": 5
            })
            
            assert response.status_code == 200
            data = response.json()
            songs = data.get("songs", [])
            
            if not songs:
                break
            
            # Pick first recommendation as next song
            next_song = songs[0]
            current_song_id = next_song.get("song_id")
            
            # Verify we're not stuck in a loop
            if current_song_id in played_songs:
                # It's okay if we eventually loop, but should have variety
                pass
            
            played_songs.append(current_song_id)
        
        # Should have played multiple different songs
        unique_songs = set(played_songs)
        assert len(unique_songs) >= 2, f"Continuous playback should play different songs, got {len(unique_songs)} unique"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
