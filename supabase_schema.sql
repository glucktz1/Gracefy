-- Spirit Songs High-Performance Streaming Database Schema
-- Run this SQL in your Supabase SQL Editor

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
    artist_id TEXT,
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
    album_id TEXT,
    artist_id TEXT,
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
    song_id TEXT,
    album_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);

-- Listening history table
CREATE TABLE IF NOT EXISTS listening_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    song_id TEXT,
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

-- Function for incrementing stream count
CREATE OR REPLACE FUNCTION increment_stream_count(track_song_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE tracks SET stream_count = stream_count + 1, updated_at = NOW()
    WHERE song_id = track_song_id;
END;
$$ LANGUAGE plpgsql;

-- Function for updating timestamps
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

-- Enable Row Level Security (RLS) for public access
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access on tracks" ON tracks FOR SELECT USING (true);
CREATE POLICY "Allow public read access on albums" ON albums FOR SELECT USING (true);
CREATE POLICY "Allow public read access on artists" ON artists FOR SELECT USING (true);
CREATE POLICY "Allow public read access on categories" ON categories FOR SELECT USING (true);

-- Create policies for insert/update (service role only)
CREATE POLICY "Allow service role insert on tracks" ON tracks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role update on tracks" ON tracks FOR UPDATE USING (true);
CREATE POLICY "Allow service role insert on albums" ON albums FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role update on albums" ON albums FOR UPDATE USING (true);
CREATE POLICY "Allow service role insert on artists" ON artists FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role update on artists" ON artists FOR UPDATE USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
