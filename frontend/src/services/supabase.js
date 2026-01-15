/**
 * Supabase Client for Web PWA
 * High-performance music streaming
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kriyklawulghbchndmkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaXlrbGF3dWxnaGJjaG5kbWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTA4ODMsImV4cCI6MjA4NDA2Njg4M30.7FgxLsJNF1CmizK0yhlwsOk8KMeOLjZ-cN4Nfum8buU';

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Audio bucket name
export const AUDIO_BUCKET = 'audio-files';

// Get CDN URL for audio file
export const getAudioUrl = (filePath) => {
  if (!filePath) return null;
  if (filePath.startsWith('http')) return filePath;
  
  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(filePath);
  return data?.publicUrl;
};

// Streaming configuration
export const STREAMING_CONFIG = {
  minBufferMs: 2000,
  maxBufferMs: 30000,
  bitrate: 128000,
  format: 'aac',
};

// Track service
export const trackService = {
  // Fast full-text search
  searchTracks: async (query, limit = 20) => {
    try {
      const { data, error } = await supabase.rpc('search_tracks', {
        search_query: query,
        limit_count: limit,
      });
      
      if (error) {
        // Fallback to basic search
        const { data: fallbackData } = await supabase
          .from('tracks')
          .select('*')
          .or(`title.ilike.%${query}%,artist_name.ilike.%${query}%`)
          .limit(limit);
        return fallbackData || [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  },

  // Get tracks by album
  getTracksByAlbum: async (albumId) => {
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('album_id', albumId)
        .order('track_number', { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get tracks error:', error);
      return [];
    }
  },

  // Increment stream count
  incrementStreamCount: async (songId) => {
    try {
      await supabase.rpc('increment_stream_count', { track_song_id: songId });
    } catch (error) {
      console.warn('Stream count increment failed:', error);
    }
  },
};

// Album service
export const albumService = {
  getAlbums: async (limit = 50) => {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get albums error:', error);
      return [];
    }
  },
};

export default supabase;
