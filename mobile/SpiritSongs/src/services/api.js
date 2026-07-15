import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// API Base URL - reads from environment variable for deployment flexibility
const getBackendUrl = () => {
  // Try Expo public env var first, then Constants extra config
  const url = process.env.EXPO_PUBLIC_BACKEND_URL || 
              Constants.expoConfig?.extra?.backendUrl;
  
  if (!url) {
    console.error('[API] EXPO_PUBLIC_BACKEND_URL not configured, using fallback');
    // For production builds, use the production URL
    return 'https://faith-audio-platform.emergent.host';
  }
  
  return url;
};

export const API_BASE_URL = `${getBackendUrl()}/api`;

// Simple in-memory cache for frequently accessed data
const cache = new Map();
const CACHE_DURATION = 60000; // 1 minute cache

const getCached = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  cache.delete(key);
  return null;
};

const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// Create axios instance with optimized timeout.
// 45s so slow 3G/5G-fringe connections still complete large payloads like
// /home/app (6s+ cold on production). Was 15s which was timing out for users
// on real-world networks, causing the "Hakuna Maudhui" no-content screen.
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      console.log('[API] Request to:', config.url);
      console.log('[API] Token exists:', !!token);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log('[API] Added auth header');
      } else {
        console.log('[API] No token found in SecureStore');
      }
    } catch (e) {
      console.log('[API] Error getting token:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('[API] Response OK:', response.config?.url);
    return response;
  },
  async (error) => {
    // Log detailed error info for debugging
    console.error('[API] Request failed:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      code: error.code,
    });
    return Promise.reject(error);
  }
);

// Helper to get full audio URL
export const getAudioUrl = (path) => {
  if (!path) return null;
  // Local file (downloaded songs) - return as-is
  if (path.startsWith('file://')) return path;
  // Already a full URL (CDN or external)
  if (path.startsWith('http')) return path;
  // Internal file URL - needs full backend URL
  const baseUrl = API_BASE_URL.replace('/api', '');
  // If path starts with /api, use it directly, otherwise add /api prefix
  if (path.startsWith('/api/')) {
    return `${baseUrl}${path}`;
  }
  return `${baseUrl}/api${path.startsWith('/') ? '' : '/'}${path}`;
};

// Helper to get full image URL
export const getImageUrl = (path) => {
  if (!path) return null;
  // Handle data URLs (base64)
  if (path.startsWith('data:')) return path;
  // Handle full URLs
  if (path.startsWith('http')) return path;
  // Handle relative paths
  return `${API_BASE_URL.replace('/api', '')}${path}`;
};

// ============ AUTH API ============
export const authAPI = {
  // User login with email/phone and password (legacy - fallback)
  login: (email, password) => api.post('/user/login', { email, password }),
  loginWithPhone: (phone, password) => api.post('/user/login', { phone, password }),
  
  // User registration (legacy - fallback)
  register: (data) => api.post('/user/register', data),
  
  // Phone OTP authentication
  sendOTP: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOTP: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  
  // Forgot password flow
  forgotPasswordSend: (email) => api.post('/auth/forgot-password/send', { email }),
  forgotPasswordVerify: (email, otp) => api.post('/auth/forgot-password/verify', { email, otp }),
  forgotPasswordReset: (email, otp, newPassword) => api.post('/auth/forgot-password/reset', { email, otp, new_password: newPassword }),
  
  // Google OAuth - uses session_id from OAuth provider (legacy)
  googleStart: (redirectUri) => api.get(`/user/auth/google-start?redirect_uri=${encodeURIComponent(redirectUri)}&platform=mobile`),
  googleCallback: (sessionId) => api.post('/user/auth/google-callback', { session_id: sessionId }),
  
  // Auth methods (admin configurable)
  getAuthMethods: () => api.get('/auth/available-methods'),
  
  // Session
  getMe: (token) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return api.get('/user/me', { headers });
  },
  getProfile: () => api.get('/user/me'),
  logout: () => api.post('/auth/logout'),
};

// ============ FIREBASE AUTH API ============
export const firebaseAuthAPI = {
  // Verify Firebase ID token and get/create user
  verifyToken: (idToken) => api.post('/firebase/auth/verify', { id_token: idToken }),
  
  // Get Firebase config
  getConfig: () => api.get('/firebase/config'),
  
  // Save FCM token for push notifications
  saveFcmToken: (userId, fcmToken, platform, deviceName) => api.post('/firebase/fcm/token', {
    user_id: userId,
    fcm_token: fcmToken,
    platform,
    device_name: deviceName
  }),
  
  // Remove FCM token (on logout)
  removeFcmToken: (userId) => api.delete(`/firebase/fcm/token/${userId}`),
};

// ============ HOME API ============
export const homeAPI = {
  getHome: async () => {
    console.log('[API] Fetching home data...');
    const cached = getCached('home');
    if (cached) {
      console.log('[API] Returning cached home data');
      return { data: cached };
    }
    try {
      const response = await api.get('/user/home');
      console.log('[API] Home data fetched successfully, sections:', response.data?.sections?.length || 0);
      setCache('home', response.data);
      return response;
    } catch (error) {
      console.error('[API] Error fetching home:', error.message);
      throw error;
    }
  },
  getGeoHome: (country) => api.get(`/user/home/geo${country ? `?country=${country}` : ''}`),
  getHeroContent: () => api.get('/layout/hero-content'),
  getSections: () => api.get('/layout/sections'),
  getBurners: () => api.get('/layout/burners'),
  getSpecialMixes: () => api.get('/special-mixes'),
  getAppHome: async () => {
    console.log('[API] Fetching app home from /home/app...');
    try {
      const response = await api.get('/home/app');
      console.log('[API] App home fetched successfully, sections:', response.data?.sections?.length || 0);
      return response;
    } catch (error) {
      console.error('[API] Error fetching app home:', error.message);
      throw error;
    }
  },
  getLeaderContent: () => api.get('/layout/religious-leaders'),
  getQuickAccess: () => api.get('/layout/sections?type=quick_access'),
  getHomeFilters: () => api.get('/layout/home-filters'),
  // Album methods
  getAlbums: () => api.get('/albums'),
  getAlbum: (id) => api.get(`/albums/${id}`),
  getAlbumSongs: (id) => api.get(`/albums/${id}`), // Returns {album, songs}
  // Category methods - use song-categories as primary source
  getCategories: async () => {
    const cached = getCached('categories');
    if (cached) return { data: cached };
    const response = await api.get('/song-categories/all');
    setCache('categories', response.data);
    return response;
  },
  getSongCategories: () => api.get('/song-categories/all'),
  // Spotify-style: categories with total_songs counts for the Quick Access tile badge.
  // Backed by /api/song-categories?with_counts=true (60s server cache).
  getSongCategoriesWithCounts: async () => {
    const cached = getCached('song_categories_counts');
    if (cached) return { data: cached };
    const response = await api.get('/song-categories?with_counts=true');
    setCache('song_categories_counts', response.data);
    return response;
  },
  // Mix methods
  getMixSongs: (id) => api.get(`/special-mixes/${id}/songs`),
  // Tags
  getTags: () => api.get('/admin/tags'),
  // Clear cache (useful after updates)
  clearCache: () => cache.clear(),
};

// ============ GEO CONTENT API ============
export const geoAPI = {
  detectCountry: () => api.get('/geo/detect-country'),
  getUserCountry: (userId) => api.get(`/geo/user-country${userId ? `?user_id=${userId}` : ''}`),
  setCountryOverride: (userId, countryCode) => api.post('/geo/user-country-override', { user_id: userId, country_code: countryCode }),
  getLocalizedFeed: (country, contentType = 'albums') => api.get(`/geo/localized-feed?user_country=${country}&content_type=${contentType}`),
  getCountries: () => api.get('/geo/countries'),
  getSettings: () => api.get('/geo/settings'),
};

// ============ LEADER CONTENT API ============
export const leaderContentAPI = {
  getAll: (category, skip = 0, limit = 20) => {
    let url = `/leader-content?skip=${skip}&limit=${limit}`;
    if (category) url += `&category=${category}`;
    return api.get(url);
  },
  getByLeader: (leaderId) => api.get(`/leaders/${leaderId}/content`),
  getLeaders: () => api.get('/layout/religious-leaders'),
  getMafundisho: () => api.get('/mafundisho'),
  getMafundishoDetail: (containerId) => api.get(`/mafundisho/${containerId}`),
};

// ============ NENO LA LEO API ============
export const nenoLaLeoAPI = {
  getActive: () => api.get('/neno-la-leo/active'),
  getById: (id) => api.get(`/neno-la-leo/${id}`),
  trackPlay: (id, audioType = 'reading') => api.post(`/neno-la-leo/${id}/play?audio_type=${audioType}`),
};

// ============ CONTENT API ============
export const contentAPI = {
  getAlbums: () => api.get('/albums'),
  getAlbum: (id) => api.get(`/albums/${id}`),
  getAllSongs: () => api.get('/albums/all-songs'),
  getCategories: () => api.get('/song-categories/all'),
  getSpecialMix: (id) => api.get(`/special-mixes/${id}`),
  getSpecialMixSongs: (id) => api.get(`/special-mixes/${id}/songs`),
  getMixSongs: (id) => api.get(`/special-mixes/${id}/songs`),  // Alias for getSpecialMixSongs
  search: (query) => api.get(`/user/search?q=${encodeURIComponent(query)}`),
  getSongDownloadUrl: (songId) => api.get(`/songs/${songId}/download`),
};

// ============ SEARCH API ============
export const searchAPI = {
  search: (query) => api.get(`/user/search?q=${encodeURIComponent(query)}`),
  searchByCategory: (categoryId) => api.get(`/user/browse/category/${categoryId}`),
  getCategoryContent: (categoryId) => api.get(`/user/browse/category/${categoryId}`),
};

// ============ LIBRARY API ============
export const libraryAPI = {
  getLikedSongs: () => api.get('/library/likes'),
  likeSong: (songId) => api.post(`/library/like/${songId}`),
  unlikeSong: (songId) => api.delete(`/library/like/${songId}`),
  getPlaylists: () => api.get('/library/playlists'),
  getPlaylistSongs: (playlistId) => api.get(`/user/playlist/${playlistId}`),
  createPlaylist: (data) => api.post('/library/playlists', data),
  deletePlaylist: (playlistId) => api.delete(`/library/playlists/${playlistId}`),
  addToPlaylist: (playlistId, songId) => api.post(`/library/playlists/${playlistId}/songs/${songId}`),
  removeFromPlaylist: (playlistId, songId) => api.delete(`/library/playlists/${playlistId}/songs/${songId}`),
  getHistory: () => api.get('/library/history'),
};

// ============ CHURCH API ============
export const churchAPI = {
  getChurches: () => api.get('/churches'),
  getChurch: (id) => api.get(`/churches/${id}`),
  getChurchFull: (id, userId = null) => api.get(`/churches/${id}/full${userId ? `?user_id=${userId}` : ''}`),
  getChurchAnnouncements: (id) => api.get(`/churches/${id}/announcements`),
  getNearbyChurches: (lat, lng) => api.get(`/churches/nearby?lat=${lat}&lng=${lng}`),
  followChurch: (churchId) => api.post('/user/follow', { entity_type: 'church', entity_id: churchId }),
  unfollowChurch: (churchId) => api.delete('/user/unfollow', { data: { entity_type: 'church', entity_id: churchId } }),
};

// ============ PLAYER API ============
export const playerAPI = {
  // Track play after 45+ seconds (for play counting and revenue)
  trackPlay: (songId, options = {}) => api.post('/listening/track-play', { 
    song_id: songId,
    duration: options.duration || 0,
    platform: options.platform || 'app',
    album_id: options.album_id
  }),
  
  // Real-time stream tracking (for live analytics)
  startStream: (songId, deviceId, options = {}) => api.post('/listening/start-stream', {
    song_id: songId,
    device_id: deviceId,
    platform: options.platform || 'android',
    album_id: options.album_id
  }),
  
  heartbeat: (streamId, position = 0) => api.post('/listening/heartbeat', {
    stream_id: streamId,
    position: position
  }),
  
  endStream: (streamId, duration = 0) => api.post('/listening/end-stream', {
    stream_id: streamId,
    duration: duration
  }),
  
  // Legacy session endpoints (kept for compatibility)
  startSession: (songId) => api.post('/sessions/start', { song_id: songId }),
  endSession: (sessionId, duration) => api.post(`/sessions/${sessionId}/end`, { duration }),
  
  // Like/unlike
  likeSong: (songId) => api.post('/user/favorites/add', { id: songId, type: 'song' }),
  unlikeSong: (songId) => api.post('/user/favorites/remove', { id: songId, type: 'song' }),
  checkLiked: (songId) => api.get(`/user/favorites/check?type=song&id=${songId}`),
  
  // Recommendations for continuous play
  getNextSongRecommendations: (currentSongId, userId = null, limit = 10) => 
    api.get(`/recommendations/next-songs?current_song_id=${currentSongId}${userId ? `&user_id=${userId}` : ''}&limit=${limit}`),
  getUserRecommendations: (userId, limit = 20) => 
    api.get(`/recommendations/for-user?user_id=${userId}&limit=${limit}`),
  getTrending: (limit = 20) => 
    api.get(`/recommendations/trending?limit=${limit}`),
};

// ============ BIBLE API ============
export const bibleAPI = {
  getBooks: (language = 'sw') => api.get(`/bible/books?language=${language}`),
  getChapters: (bookName) => api.get(`/bible/books/${encodeURIComponent(bookName)}/chapters`),
  getVerses: (bookName, chapter) => api.get(`/bible/books/${encodeURIComponent(bookName)}/chapters/${chapter}`),
  getSnippets: () => api.get('/bible/snippets'),
  getFeaturedSnippets: () => api.get('/bible/featured-snippets'),
  // Get TTS settings from backend (public endpoint for mobile)
  getTtsSettings: () => api.get('/bible/tts-settings'),
  // TTS APIs - use book_name parameter for backend compatibility
  generateTTS: (data) => api.post('/bible/tts/verse', {
    book_name: data.book,
    chapter: data.chapter,
    verse: data.verse,
    voice: data.voice,
    language: data.language || 'sw'
  }),
  generatePassageTTS: (data) => api.post('/bible/tts/passage', {
    book_name: data.book,
    chapter: data.chapter,
    start_verse: data.start_verse,
    end_verse: data.end_verse,
    voice: data.voice,
    speed: data.speed,
    language: data.language || 'sw'
  }),
  getListeningStatus: () => api.get('/bible/listening-status'),
  trackListening: (data) => api.post('/bible/listening-track', data),
  logListeningHistory: (data) => api.post('/bible/listening-history', data),
  getListeningHistory: (userId, limit = 50) => api.get(`/bible/listening-history/${userId}?limit=${limit}`),
};

// ============ USER API ============
export const userAPI = {
  getProfile: () => api.get('/user/auth/me'),
  updateProfile: (data) => api.put('/user/profile', data),
  getDailyPlays: () => api.get('/user/daily-plays'),
};

// ============ ADVERTISING API ============
export const advertisingAPI = {
  // Get next ad to play (called by player)
  getNextAd: (params) => api.get('/advertising/next-ad', { params }),
  // Record ad impression (called after ad plays)
  recordImpression: (data) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });
    return api.post('/advertising/impression', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  // Get advertising settings
  getSettings: () => api.get('/advertising/settings'),
};

// ============ BILLING/SUBSCRIPTION API ============
export const billingAPI = {
  getPlans: () => api.get('/monetization/plans'),
  getSettings: () => api.get('/monetization/settings'),
  // Add cache-busting timestamp to ensure fresh billing status
  getBillingStatus: () => api.get(`/billing-status?_t=${Date.now()}`),
  getUserSubscription: (userId) => api.get(`/user/subscription-status?user_id=${userId}&_t=${Date.now()}`),
  getCurrentSubscription: (userId) => api.get(`/subscription/current?user_id=${userId}`),
  subscribe: (planId, paymentData) => api.post('/user/subscribe', { plan_id: planId, ...paymentData }),
  // Azam Pay specific endpoints
  initiateAzamPay: (userId, planId, phoneNumber) => 
    api.post('/payment/azampay/checkout', { user_id: userId, plan_id: planId, phone_number: phoneNumber }),
  getPaymentStatus: (transactionId) => api.get(`/payment/azampay/status/${transactionId}`),
  // Test mode: Confirm payment manually (for demo/testing)
  testConfirmPayment: (transactionId, action = 'confirm') => 
    api.post(`/payment/azampay/test-confirm/${transactionId}`, { action }),
  getUserTransactions: () => api.get('/user/transactions'),
};

// ============ DEVICE FINGERPRINTING API ============
export const deviceAPI = {
  // Register device for fraud prevention
  registerDevice: (deviceData) => api.post('/analytics/register-device', deviceData),
  // Check fraud status for a user
  checkFraud: (userId) => api.get(`/analytics/device-fraud-check/${userId}`),
};

// ============ DOWNLOAD TRACKING API ============
export const downloadTrackingAPI = {
  // Record a download
  recordDownload: (contentType, contentId, userId, deviceId) => api.post('/analytics/record-download', {
    content_type: contentType,
    content_id: contentId,
    user_id: userId,
    device_id: deviceId
  }),
  // Get user's download history
  getUserDownloads: (userId) => api.get(`/analytics/user-downloads/${userId}`),
};

// ============ LIVE LISTENER TRACKING API ============
export const liveTrackingAPI = {
  // Send heartbeat while playing
  heartbeat: (data) => api.post('/analytics/heartbeat', data),
  // Stop listening
  stopListening: (sessionId) => api.post('/analytics/stop-listening', { session_id: sessionId }),
  // Get live listeners (admin)
  getLiveListeners: () => api.get('/analytics/live-listeners'),
};

// ============ FEEDBACK API ============
export const feedbackAPI = {
  // Submit feedback from mobile app
  submit: (data) => api.post('/feedback/submit', data),
};

// ============ CHAT/SUPPORT API ============
export const chatAPI = {
  // Get chat conversations
  getConversations: () => api.get('/chat/conversations'),
  // Get messages in a conversation
  getMessages: (conversationId) => api.get(`/chat/conversations/${conversationId}/messages`),
  // Send a message
  sendMessage: (conversationId, message) => api.post(`/chat/conversations/${conversationId}/messages`, { message }),
  // Start new conversation (support chat)
  startSupportChat: () => api.post('/chat/support/start'),
  // Get or create support conversation
  getSupportChat: () => api.get('/chat/support'),
};

// ============ DEVICE & ERROR TRACKING API ============
export const trackingAPI = {
  // Track device info (call on app launch and login)
  trackDevice: (deviceData) => api.post('/analytics/track-device', deviceData),
  // Report errors automatically
  reportError: (errorData) => api.post('/errors/report', errorData),
};

// ============ RADIO API ============
export const radioAPI = {
  // Get list of enabled radio stations
  getStations: (params = {}) => api.get('/radio/stations', { params }),
  // Get single station details
  getStation: (stationId) => api.get(`/radio/stations/${stationId}`),
  // Track radio play start
  trackPlay: (data) => api.post('/radio/play', data),
  // Track radio play stop
  trackStop: (data) => api.post('/radio/stop', data),
};

export default api;
