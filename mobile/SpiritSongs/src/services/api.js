import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// API Base URL - connects to existing backend
export const API_BASE_URL = 'https://cdn-control.preview.emergentagent.com/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.log('Error getting token:', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Don't clear auth in interceptor - let AuthContext handle it
    // This prevents race conditions and ensures proper state management
    console.log('API Error:', error.config?.url, error.response?.status);
    return Promise.reject(error);
  }
);

// Helper to get full audio URL
export const getAudioUrl = (path) => {
  if (!path) return null;
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
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL.replace('/api', '')}${path}`;
};

// ============ AUTH API ============
export const authAPI = {
  // User login with email/phone and password
  login: (email, password) => api.post('/user/login', { email, password }),
  loginWithPhone: (phone, password) => api.post('/user/login', { phone, password }),
  
  // User registration
  register: (data) => api.post('/user/register', data),
  
  // Phone OTP authentication
  sendOTP: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOTP: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  
  // Forgot password flow
  forgotPasswordSend: (email) => api.post('/auth/forgot-password/send', { email }),
  forgotPasswordVerify: (email, otp) => api.post('/auth/forgot-password/verify', { email, otp }),
  forgotPasswordReset: (email, otp, newPassword) => api.post('/auth/forgot-password/reset', { email, otp, new_password: newPassword }),
  
  // Google OAuth - uses session_id from Emergent OAuth
  googleCallback: (sessionId) => api.post('/user/auth/google-callback', { session_id: sessionId }),
  
  // Session
  getMe: () => api.get('/user/me'),
  logout: () => api.post('/auth/logout'),
};

// ============ HOME API ============
export const homeAPI = {
  getHome: () => api.get('/user/home'),
  getHeroContent: () => api.get('/layout/hero-content'),
  getSections: () => api.get('/layout/sections'),
  getBurners: () => api.get('/layout/burners'),
  getSpecialMixes: () => api.get('/special-mixes'),
  getAppHome: () => api.get('/home/app'),
  getLeaderContent: () => api.get('/layout/religious-leaders'),
  getQuickAccess: () => api.get('/layout/sections?type=quick_access'),
  getHomeFilters: () => api.get('/layout/home-filters'),
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

// ============ CONTENT API ============
export const contentAPI = {
  getAlbums: () => api.get('/albums'),
  getAlbum: (id) => api.get(`/albums/${id}`),
  getAllSongs: () => api.get('/albums/all-songs'),
  getCategories: () => api.get('/categories'),
  getSpecialMix: (id) => api.get(`/special-mixes/${id}`),
  getSpecialMixSongs: (id) => api.get(`/special-mixes/${id}/songs`),
  getMixSongs: (id) => api.get(`/special-mixes/${id}/songs`),  // Alias for getSpecialMixSongs
  search: (query) => api.get(`/search?q=${encodeURIComponent(query)}`),
  getSongDownloadUrl: (songId) => api.get(`/songs/${songId}/download`),
};

// ============ LIBRARY API ============
export const libraryAPI = {
  getLikedSongs: () => api.get('/library/likes'),
  likeSong: (songId) => api.post(`/library/like/${songId}`),
  unlikeSong: (songId) => api.delete(`/library/like/${songId}`),
  getPlaylists: () => api.get('/library/playlists'),
  createPlaylist: (data) => api.post('/library/playlists', data),
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
  trackPlay: (songId) => api.post('/listening/track-play', { song_id: songId }),
  startSession: (songId) => api.post('/sessions/start', { song_id: songId }),
  endSession: (sessionId, duration) => api.post(`/sessions/${sessionId}/end`, { duration }),
};

// ============ BIBLE API ============
export const bibleAPI = {
  getBooks: (language = 'sw') => api.get(`/bible/books?language=${language}`),
  getChapters: (bookName) => api.get(`/bible/books/${encodeURIComponent(bookName)}/chapters`),
  getVerses: (bookName, chapter) => api.get(`/bible/books/${encodeURIComponent(bookName)}/chapters/${chapter}`),
  getSnippets: () => api.get('/bible/snippets'),
  getFeaturedSnippets: () => api.get('/bible/featured-snippets'),
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

// ============ BILLING/SUBSCRIPTION API ============
export const billingAPI = {
  getPlans: () => api.get('/monetization/plans'),
  getSettings: () => api.get('/monetization/settings'),
  getUserSubscription: () => api.get('/user/subscription-status'),
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

export default api;
