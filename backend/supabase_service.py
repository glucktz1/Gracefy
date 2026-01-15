"""
Supabase Service for High-Performance Music Streaming
Handles:
- Database sync from MongoDB to Supabase Postgres
- Audio file storage with CDN caching
- Full-text search optimization
- Byte-range streaming support
"""

import os
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from supabase import create_client, Client
import logging

logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")

# Initialize Supabase client
supabase: Optional[Client] = None

def get_supabase_client() -> Client:
    """Get or create Supabase client"""
    global supabase
    if supabase is None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise ValueError("Supabase credentials not configured")
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return supabase

# ============== DATABASE SCHEMA SETUP ==============

SCHEMA_SQL = """
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Artists/Choirs table
CREATE TABLE IF NOT EXISTS artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artist_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    bio TEXT,
    thumbnail TEXT,
    photo TEXT,
    type TEXT DEFAULT 'choir',
    followers_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_artists_artist_id ON artists(artist_id);
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm ON artists USING gin(name gin_trgm_ops);

-- Albums table
CREATE TABLE IF NOT EXISTS albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    artist_id TEXT REFERENCES artists(artist_id),
    artist_name TEXT,
    category_id TEXT,
    genre TEXT,
    thumbnail TEXT,
    cover_image TEXT,
    release_date TEXT,
    monetization_type TEXT DEFAULT 'standard',
    status TEXT DEFAULT 'active',
    songs_count INTEGER DEFAULT 0,
    total_streams INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for albums
CREATE INDEX IF NOT EXISTS idx_albums_album_id ON albums(album_id);
CREATE INDEX IF NOT EXISTS idx_albums_artist_id ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_albums_category_id ON albums(category_id);
CREATE INDEX IF NOT EXISTS idx_albums_genre ON albums(genre);
CREATE INDEX IF NOT EXISTS idx_albums_title_trgm ON albums USING gin(title gin_trgm_ops);

-- Tracks/Songs table with full optimization
CREATE TABLE IF NOT EXISTS tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    song_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    album_id TEXT REFERENCES albums(album_id),
    artist_id TEXT REFERENCES artists(artist_id),
    artist_name TEXT,
    album_title TEXT,
    genre TEXT,
    duration INTEGER DEFAULT 0,
    duration_formatted TEXT,
    track_number INTEGER DEFAULT 1,
    audio_url TEXT,
    audio_file_path TEXT,
    audio_format TEXT DEFAULT 'aac',
    bitrate INTEGER DEFAULT 128,
    file_size INTEGER DEFAULT 0,
    lyrics TEXT,
    thumbnail TEXT,
    status TEXT DEFAULT 'active',
    is_premium BOOLEAN DEFAULT FALSE,
    stream_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Full-text search column
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(artist_name, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(album_title, '')), 'C')
    ) STORED
);

-- Create indexes for tracks
CREATE INDEX IF NOT EXISTS idx_tracks_song_id ON tracks(song_id);
CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id);
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
CREATE INDEX IF NOT EXISTS idx_tracks_search ON tracks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_tracks_title_trgm ON tracks USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_name_trgm ON tracks USING gin(artist_name gin_trgm_ops);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_category_id ON categories(category_id);

-- User favorites table
CREATE TABLE IF NOT EXISTS user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    song_id TEXT REFERENCES tracks(song_id),
    album_id TEXT REFERENCES albums(album_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);

-- Listening history table
CREATE TABLE IF NOT EXISTS listening_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    song_id TEXT REFERENCES tracks(song_id),
    listened_at TIMESTAMPTZ DEFAULT NOW(),
    duration_listened INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_listening_history_user_id ON listening_history(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_history_song_id ON listening_history(song_id);

-- Function for instant search using full-text search
CREATE OR REPLACE FUNCTION search_tracks(search_query TEXT, limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
    song_id TEXT,
    title TEXT,
    artist_name TEXT,
    album_title TEXT,
    thumbnail TEXT,
    audio_url TEXT,
    duration_formatted TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.song_id,
        t.title,
        t.artist_name,
        t.album_title,
        t.thumbnail,
        t.audio_url,
        t.duration_formatted,
        ts_rank(t.search_vector, plainto_tsquery('english', search_query)) as rank
    FROM tracks t
    WHERE t.search_vector @@ plainto_tsquery('english', search_query)
       OR t.title ILIKE '%' || search_query || '%'
       OR t.artist_name ILIKE '%' || search_query || '%'
    ORDER BY rank DESC, t.stream_count DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function for updating track search on insert/update
CREATE OR REPLACE FUNCTION update_track_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS tracks_updated_at ON tracks;
CREATE TRIGGER tracks_updated_at BEFORE UPDATE ON tracks
    FOR EACH ROW EXECUTE FUNCTION update_track_timestamps();

DROP TRIGGER IF EXISTS albums_updated_at ON albums;
CREATE TRIGGER albums_updated_at BEFORE UPDATE ON albums
    FOR EACH ROW EXECUTE FUNCTION update_track_timestamps();

DROP TRIGGER IF EXISTS artists_updated_at ON artists;
CREATE TRIGGER artists_updated_at BEFORE UPDATE ON artists
    FOR EACH ROW EXECUTE FUNCTION update_track_timestamps();
"""

async def setup_database_schema():
    """Initialize the Supabase database schema"""
    try:
        client = get_supabase_client()
        # Execute schema SQL through RPC or direct query
        # Note: This requires the SQL to be run through Supabase dashboard
        # or using the management API
        logger.info("Database schema should be set up through Supabase dashboard")
        return {"status": "Schema ready for setup", "sql": SCHEMA_SQL}
    except Exception as e:
        logger.error(f"Error setting up schema: {e}")
        return {"error": str(e)}


# ============== DATA SYNC SERVICES ==============

class SupabaseTrackService:
    """Service for managing tracks in Supabase"""
    
    def __init__(self):
        self.client = get_supabase_client()
        self.storage_bucket = "audio-files"
    
    async def sync_track_from_mongodb(self, mongo_song: dict, album_data: dict = None, artist_data: dict = None):
        """Sync a track from MongoDB to Supabase"""
        try:
            track_data = {
                "song_id": mongo_song.get("song_id"),
                "title": mongo_song.get("title"),
                "album_id": mongo_song.get("album_id"),
                "artist_id": mongo_song.get("artist_id") or mongo_song.get("singer_id"),
                "artist_name": artist_data.get("name") if artist_data else mongo_song.get("artist_name"),
                "album_title": album_data.get("title") if album_data else mongo_song.get("album_title"),
                "genre": album_data.get("genre") if album_data else None,
                "duration": mongo_song.get("duration", 0),
                "duration_formatted": mongo_song.get("duration_formatted"),
                "track_number": mongo_song.get("track_number", 1),
                "audio_url": mongo_song.get("audio_url"),
                "lyrics": mongo_song.get("lyrics"),
                "thumbnail": album_data.get("thumbnail") if album_data else mongo_song.get("thumbnail"),
                "status": mongo_song.get("status", "active"),
                "is_premium": mongo_song.get("is_premium", False),
                "stream_count": mongo_song.get("stream_count", 0)
            }
            
            # Upsert track
            result = self.client.table("tracks").upsert(
                track_data,
                on_conflict="song_id"
            ).execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Error syncing track: {e}")
            return None
    
    async def sync_album_from_mongodb(self, mongo_album: dict):
        """Sync an album from MongoDB to Supabase"""
        try:
            album_data = {
                "album_id": mongo_album.get("album_id"),
                "title": mongo_album.get("title"),
                "description": mongo_album.get("description"),
                "artist_id": mongo_album.get("artist_id") or mongo_album.get("singer_id"),
                "artist_name": mongo_album.get("artist_name"),
                "category_id": mongo_album.get("category_id"),
                "genre": mongo_album.get("genre"),
                "thumbnail": mongo_album.get("thumbnail"),
                "cover_image": mongo_album.get("cover_image"),
                "release_date": mongo_album.get("release_date"),
                "monetization_type": mongo_album.get("monetization_type", "standard"),
                "status": mongo_album.get("status", "active"),
                "songs_count": mongo_album.get("songs_count", 0),
                "total_streams": mongo_album.get("total_streams", 0)
            }
            
            result = self.client.table("albums").upsert(
                album_data,
                on_conflict="album_id"
            ).execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Error syncing album: {e}")
            return None
    
    async def sync_artist_from_mongodb(self, mongo_artist: dict):
        """Sync an artist from MongoDB to Supabase"""
        try:
            artist_data = {
                "artist_id": mongo_artist.get("singer_id") or mongo_artist.get("artist_id"),
                "name": mongo_artist.get("name"),
                "bio": mongo_artist.get("bio"),
                "thumbnail": mongo_artist.get("thumbnail"),
                "photo": mongo_artist.get("photo"),
                "type": mongo_artist.get("type", "choir"),
                "followers_count": mongo_artist.get("followers_count", 0)
            }
            
            result = self.client.table("artists").upsert(
                artist_data,
                on_conflict="artist_id"
            ).execute()
            
            return result.data
        except Exception as e:
            logger.error(f"Error syncing artist: {e}")
            return None
    
    def search_tracks(self, query: str, limit: int = 20) -> List[dict]:
        """Fast full-text search for tracks"""
        try:
            # Use the search function we created
            result = self.client.rpc(
                "search_tracks",
                {"search_query": query, "limit_count": limit}
            ).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Search error: {e}")
            # Fallback to basic search
            result = self.client.table("tracks").select("*").ilike("title", f"%{query}%").limit(limit).execute()
            return result.data or []
    
    def get_tracks_by_album(self, album_id: str) -> List[dict]:
        """Get all tracks for an album"""
        try:
            result = self.client.table("tracks").select("*").eq("album_id", album_id).order("track_number").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting tracks: {e}")
            return []
    
    def get_tracks_by_artist(self, artist_id: str) -> List[dict]:
        """Get all tracks for an artist"""
        try:
            result = self.client.table("tracks").select("*").eq("artist_id", artist_id).order("created_at", desc=True).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error getting artist tracks: {e}")
            return []
    
    def increment_stream_count(self, song_id: str):
        """Increment stream count for a track"""
        try:
            self.client.rpc("increment_stream_count", {"track_song_id": song_id}).execute()
        except Exception as e:
            logger.error(f"Error incrementing stream: {e}")


class SupabaseStorageService:
    """Service for managing audio file storage in Supabase"""
    
    def __init__(self):
        self.client = get_supabase_client()
        self.bucket_name = "audio-files"
    
    def get_public_url(self, file_path: str) -> str:
        """Get CDN-cached public URL for an audio file"""
        try:
            response = self.client.storage.from_(self.bucket_name).get_public_url(file_path)
            return response
        except Exception as e:
            logger.error(f"Error getting public URL: {e}")
            return None
    
    def upload_audio_file(self, file_path: str, file_data: bytes, content_type: str = "audio/mp4") -> dict:
        """Upload audio file to Supabase Storage"""
        try:
            # Generate a unique path
            file_extension = ".m4a"  # AAC format
            storage_path = f"tracks/{uuid.uuid4().hex}{file_extension}"
            
            response = self.client.storage.from_(self.bucket_name).upload(
                path=storage_path,
                file=file_data,
                file_options={
                    "content-type": content_type,
                    "cache-control": "public, max-age=31536000"  # 1 year cache
                }
            )
            
            # Get public URL with CDN caching
            public_url = self.get_public_url(storage_path)
            
            return {
                "path": storage_path,
                "public_url": public_url,
                "size": len(file_data)
            }
        except Exception as e:
            logger.error(f"Error uploading audio: {e}")
            return None
    
    def delete_audio_file(self, file_path: str) -> bool:
        """Delete audio file from storage"""
        try:
            self.client.storage.from_(self.bucket_name).remove([file_path])
            return True
        except Exception as e:
            logger.error(f"Error deleting audio: {e}")
            return False


# ============== API ENDPOINTS FOR STREAMING ==============

def get_streaming_url(audio_path: str) -> dict:
    """Get optimized streaming URL with byte-range support headers"""
    storage = SupabaseStorageService()
    public_url = storage.get_public_url(audio_path)
    
    return {
        "url": public_url,
        "headers": {
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000",
            "Content-Type": "audio/mp4"
        },
        "streaming_config": {
            "min_buffer_seconds": 2,
            "max_buffer_seconds": 30,
            "bitrate": 128000,
            "format": "aac"
        }
    }


# Singleton instances
track_service = None
storage_service = None

def get_track_service() -> SupabaseTrackService:
    global track_service
    if track_service is None:
        track_service = SupabaseTrackService()
    return track_service

def get_storage_service() -> SupabaseStorageService:
    global storage_service
    if storage_service is None:
        storage_service = SupabaseStorageService()
    return storage_service
