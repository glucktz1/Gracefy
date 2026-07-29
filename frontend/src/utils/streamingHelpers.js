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
      // localStorage persists across tabs and reloads → instant paint on
      // subsequent visits (sessionStorage was tab-scoped, defeated by refresh).
      const item = localStorage.getItem(`gracefy_cache_${key}`);
      if (!item) return null;
      const { data, timestamp } = JSON.parse(item);
      if (Date.now() - timestamp > CACHE_DURATION) {
        localStorage.removeItem(`gracefy_cache_${key}`);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  },
  set: (key, data) => {
    try {
      localStorage.setItem(`gracefy_cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignore storage errors (quota exceeded, private-browsing, etc.)
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

// ============ BUNNY CDN OPTIMIZER ============
// Bunny CDN supports on-the-fly image resize + format conversion via URL
// params. Passing `?width=X&quality=85&format=auto` on any `.b-cdn.net` URL
// returns a WebP variant sized to X px wide — typically 5-10x smaller than
// the original JPEG. Massive win for grid thumbnails on 3G/4G.
//
// - `?width=` picks a resized rendition (aspect ratio preserved)
// - `?quality=` 1-100 (85 is near-lossless, ~40% smaller than 100)
// - `?format=auto` returns webp/avif to modern browsers, falls back to jpg
//
// Non-Bunny URLs (data:, other CDNs, Firebase, etc.) pass through unchanged
// so we don't accidentally break their contracts.
const isBunnyCdnUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.includes('.b-cdn.net');
};

const withBunnyOptimizer = (url, opts = {}) => {
  if (!isBunnyCdnUrl(url)) return url;
  // If the URL already has optimizer params, leave it alone.
  if (/[?&](width|quality|format|aspect_ratio)=/.test(url)) return url;
  const {
    width = 600,     // default for grid thumbnails — matches @2x on ~300px cards
    quality = 85,
    format = 'auto', // webp for modern browsers, jpg fallback
  } = opts;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}width=${width}&quality=${quality}&format=${format}`;
};

// Helper function to get proper image/thumbnail URL - handles CDN URLs
// The optional `sizeOpts` argument controls Bunny Optimizer params for
// Bunny CDN URLs (no-op for other hosts). Common presets:
//   • Mini-player art:  { width: 200 }
//   • Grid thumbnail:   {}  (default width=600)
//   • Hero banner:      { width: 1400 }
export const getImageUrl = (imageUrl, sizeOpts) => {
  if (!imageUrl) return null;
  
  // If it starts with data:, it's a base64 image
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  
  // If it's already a full URL (https://), just apply Bunny Optimizer if applicable
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return withBunnyOptimizer(imageUrl, sizeOpts);
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

// Get thumbnail URL helper - handles both thumbnail and thumbnail_url fields.
// Auto-optimizes Bunny CDN URLs (WebP + resize). Pass `sizeOpts` to override
// the default 600px width — e.g. `getThumbnail(album, { width: 200 })` for
// the mini-player art, or `{ width: 1400 }` for the hero banner.
export const getThumbnail = (item, sizeOpts) => {
  if (!item) return null;
  // Prefer direct thumbnail URL, then thumbnail_url field, then thumbnail field
  const url = item.thumbnail_url || item.thumbnail;
  return getImageUrl(url, sizeOpts);
};


// Fisher–Yates shuffle (returns new array, never mutates input)
export const shuffleArray = (arr) => {
  if (!Array.isArray(arr) || arr.length <= 1) return arr ?? [];
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Shuffle items inside the home sections we want randomised on each open.
// Curated sections (hero, quick_access, neno_la_leo, bible, categories, radio,
// hot_new_releases [chronological], most_listened [ranked]) keep their order.
const SHUFFLE_SKIP_TYPES = new Set([
  "hero",
  "quick_access",
  "neno_la_leo",
  "bible",
  "categories",
  "category",
  "radio",
  "hot_new_releases",
  "hot_releases",
  "most_listened",
  "mostListened",
]);

export const shuffleHomeSections = (sections) => {
  if (!Array.isArray(sections)) return sections;
  return sections.map((section) => {
    const sectionType = (section.section_type || section.type || "").toString();
    const title = (section.title || "").toLowerCase();
    // Skip curated/ranked sections
    if (SHUFFLE_SKIP_TYPES.has(sectionType)) return section;
    if (title.includes("hivi karibuni") || title.includes("hot") || title.includes("most listened")) return section;
    if (!Array.isArray(section.items) || section.items.length <= 1) return section;
    return { ...section, items: shuffleArray(section.items) };
  });
};
