/**
 * CDN and Static Asset Configuration for Gracefy
 * 
 * This module provides utilities for serving static assets through CDN
 * and optimizing asset delivery.
 */

// CDN Configuration - set these in environment variables for production
export const CDN_CONFIG = {
  // Primary CDN URL for images/media
  MEDIA_CDN_URL: process.env.REACT_APP_MEDIA_CDN_URL || '',
  
  // Audio CDN URL (can be different for audio streaming)
  AUDIO_CDN_URL: process.env.REACT_APP_AUDIO_CDN_URL || '',
  
  // Static assets CDN (JS, CSS, fonts)
  STATIC_CDN_URL: process.env.REACT_APP_STATIC_CDN_URL || '',
  
  // Enable CDN (set to false for local development)
  ENABLED: process.env.REACT_APP_CDN_ENABLED === 'true',
};

// Backend URL for API calls
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

/**
 * Get the optimal URL for an image/thumbnail
 * Falls back to backend thumbnail API if no CDN
 */
export function getImageUrl(imageUrl, options = {}) {
  if (!imageUrl) return null;
  
  // If it's already a full URL, check if we should route through CDN
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // If CDN is enabled and URL matches our storage, route through CDN
    if (CDN_CONFIG.ENABLED && CDN_CONFIG.MEDIA_CDN_URL) {
      // Check if it's our storage URL that should go through CDN
      if (imageUrl.includes('supabase') || imageUrl.includes('storage')) {
        // Extract the path and serve through CDN
        try {
          const url = new URL(imageUrl);
          return `${CDN_CONFIG.MEDIA_CDN_URL}${url.pathname}`;
        } catch {
          return imageUrl;
        }
      }
    }
    return imageUrl;
  }
  
  // If it's an item ID (for thumbnail API)
  if (imageUrl && !imageUrl.includes('/')) {
    return `${BACKEND_URL}/api/thumbnails/${imageUrl}`;
  }
  
  // Relative URL - prepend backend
  return `${BACKEND_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}

/**
 * Get the optimal URL for audio files
 */
export function getAudioUrl(audioUrl) {
  if (!audioUrl) return null;
  
  // If it's already a full URL
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
    // Route through audio CDN if enabled
    if (CDN_CONFIG.ENABLED && CDN_CONFIG.AUDIO_CDN_URL) {
      if (audioUrl.includes('supabase') || audioUrl.includes('storage')) {
        try {
          const url = new URL(audioUrl);
          return `${CDN_CONFIG.AUDIO_CDN_URL}${url.pathname}`;
        } catch {
          return audioUrl;
        }
      }
    }
    return audioUrl;
  }
  
  // Relative URL
  return `${BACKEND_URL}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
}

/**
 * Preload critical images for better LCP
 */
export function preloadImage(url) {
  if (!url) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = getImageUrl(url);
  document.head.appendChild(link);
}

/**
 * Image component with lazy loading and CDN support
 */
export function OptimizedImage({ src, alt, className, ...props }) {
  const optimizedSrc = getImageUrl(src);
  
  return (
    <img
      src={optimizedSrc}
      alt={alt || ''}
      className={className}
      loading="lazy"
      decoding="async"
      {...props}
    />
  );
}

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(baseUrl, sizes = [320, 640, 960, 1280]) {
  if (!baseUrl || !CDN_CONFIG.ENABLED) return null;
  
  return sizes
    .map(size => `${getImageUrl(baseUrl)}?w=${size} ${size}w`)
    .join(', ');
}

export default {
  CDN_CONFIG,
  getImageUrl,
  getAudioUrl,
  preloadImage,
  OptimizedImage,
  generateSrcSet,
};
