/**
 * Supabase Client Configuration
 * High-performance music streaming client
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = 'https://kriyklawulghbchndmkp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyaXlrbGF3dWxnaGJjaG5kbWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTA4ODMsImV4cCI6MjA4NDA2Njg4M30.7FgxLsJNF1CmizK0yhlwsOk8KMeOLjZ-cN4Nfum8buU';

// Custom storage adapter for Expo SecureStore
const ExpoSecureStoreAdapter = {
  getItem: async (key) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn('SecureStore getItem error:', error);
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.warn('SecureStore setItem error:', error);
    }
  },
  removeItem: async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn('SecureStore removeItem error:', error);
    }
  },
};

// Create Supabase client with optimized settings
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-client-info': 'spiritsongs-mobile',
    },
  },
});

// Storage bucket for audio files
export const AUDIO_BUCKET = 'audio-files';

// Get CDN URL for audio file
export const getAudioUrl = (filePath) => {
  if (!filePath) return null;
  
  // If already a full URL, return as-is
  if (filePath.startsWith('http')) {
    return filePath;
  }
  
  // Get public URL from Supabase Storage
  const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(filePath);
  return data?.publicUrl;
};

// Streaming configuration for optimal playback
export const STREAMING_CONFIG = {
  minBufferMs: 2000,      // 2 second initial buffer for instant start
  maxBufferMs: 30000,     // 30 second buffer for stability
  playbackBufferMs: 5000,
  bufferForPlaybackAfterRebufferMs: 5000,
  bitrate: 128000,        // 128kbps AAC
  format: 'aac',
};

// Track service for database operations
export const trackService = {
  // Search tracks with full-text search
  searchTracks: async (query, limit = 20) => {
    try {
      // Try full-text search first
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

  // Get tracks by artist
  getTracksByArtist: async (artistId) => {
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('artist_id', artistId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get artist tracks error:', error);
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

  // Get recent tracks
  getRecentTracks: async (limit = 20) => {
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get recent tracks error:', error);
      return [];
    }
  },

  // Get popular tracks
  getPopularTracks: async (limit = 20) => {
    try {
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .order('stream_count', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get popular tracks error:', error);
      return [];
    }
  },
};

// Album service
export const albumService = {
  // Get all albums
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

  // Get album by ID
  getAlbumById: async (albumId) => {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('album_id', albumId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get album error:', error);
      return null;
    }
  },

  // Get albums by artist
  getAlbumsByArtist: async (artistId) => {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('artist_id', artistId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get artist albums error:', error);
      return [];
    }
  },
};

// Artist service
export const artistService = {
  // Get all artists
  getArtists: async (limit = 50) => {
    try {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .order('followers_count', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Get artists error:', error);
      return [];
    }
  },

  // Get artist by ID
  getArtistById: async (artistId) => {
    try {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .eq('artist_id', artistId)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get artist error:', error);
      return null;
    }
  },
};

export default supabase;
