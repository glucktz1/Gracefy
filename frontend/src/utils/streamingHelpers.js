/**
 * Streaming App Utility Functions
 * Extracted from UserStreamingApp.jsx for better code organization
 */

import { BookOpen, Star, Cross, Church, Flame, Sun, Music2 } from "lucide-react";

// Backend URL - uses same origin for production, env var for dev
const getBackendUrl = () => {
  // For production domains (gracefy.net, emergent.host), use same origin
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production domains - use same origin (frontend and backend on same domain)
    if (hostname === 'gracefy.net' || 
        hostname === 'www.gracefy.net' || 
        hostname.endsWith('.emergent.host')) {
      console.log('[Gracefy] Production mode - using same origin');
      return window.location.origin;
    }
    
    // Preview/dev domains - use env var or fallback
    if (hostname.includes('preview.emergentagent.com')) {
      const envUrl = process.env.REACT_APP_BACKEND_URL;
      if (envUrl) {
        console.log('[Gracefy] Dev mode - using env var');
        return envUrl;
      }
    }
    
    // Fallback to same origin
    return window.location.origin;
  }
  
  // Server-side fallback
  return process.env.REACT_APP_BACKEND_URL || '';
};

export const BACKEND_URL = getBackendUrl();
export const API = `${BACKEND_URL}/api`;

// Log API URL on first load for debugging
if (typeof window !== 'undefined') {
  console.log('[Gracefy] API URL:', API, '| Hostname:', window.location.hostname);
}

// Client-side cache for faster page loads
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const cache = {
  get: (key) => {
    try {
      const item = sessionStorage.getItem(`gracefy_cache_${key}`);
      if (!item) return null;
      const { data, timestamp } = JSON.parse(item);
      if (Date.now() - timestamp > CACHE_DURATION) {
        sessionStorage.removeItem(`gracefy_cache_${key}`);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  },
  set: (key, data) => {
    try {
      sessionStorage.setItem(`gracefy_cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignore storage errors
    }
  }
};

// Sample audio for demo (royalty-free)
export const SAMPLE_AUDIO_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

// Helper function to get proper audio URL - handles CDN URLs, relative URLs, and file IDs
export const getAudioUrl = (audioUrl) => {
  if (!audioUrl) return SAMPLE_AUDIO_URL;
  
  // If it's already a full CDN URL (https://), return as is
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
    return audioUrl;
  }
  
  // If it's a relative file URL (/api/files/{file_id}), add /stream for actual content
  if (audioUrl.startsWith('/api/files/') && !audioUrl.endsWith('/stream')) {
    return `${BACKEND_URL}${audioUrl}/stream`;
  }
  
  // If it's just a file ID, construct the streaming URL
  if (audioUrl && !audioUrl.includes('/')) {
    return `${BACKEND_URL}/api/files/${audioUrl}/stream`;
  }
  
  // Handle other relative paths
  if (audioUrl.startsWith('/')) {
    return `${BACKEND_URL}${audioUrl}`;
  }
  
  return audioUrl;
};

// Helper function to get proper image/thumbnail URL - handles CDN URLs
export const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  
  // If it's already a full URL (https://), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If it starts with data:, it's a base64 image
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  
  // Handle /api/files/{file_id} format - add /stream suffix for proper streaming
  if (imageUrl.startsWith('/api/files/') && !imageUrl.endsWith('/stream')) {
    return `${BACKEND_URL}${imageUrl}/stream`;
  }
  
  // Handle relative paths
  if (imageUrl.startsWith('/')) {
    return `${BACKEND_URL}${imageUrl}`;
  }
  
  return imageUrl;
};

// Category icons mapping
export const categoryIcons = {
  'prayers': BookOpen,
  'christmas': Star,
  'lent': Cross,
  'catechism': Church,
  'worship': Flame,
  'gospel': Sun,
  'hymns': Music2,
  'praise': Star,
  'default': Music2
};

// Format time helper
export const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Get thumbnail URL helper - handles both thumbnail and thumbnail_url fields
export const getThumbnail = (item) => {
  if (!item) return null;
  // Prefer direct thumbnail URL, then thumbnail_url field, then thumbnail field
  const url = item.thumbnail_url || item.thumbnail;
  return getImageUrl(url);
};
