import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// API Base URL - connects to existing backend
const API_BASE_URL = 'https://spiritsongs-3.preview.emergentagent.com/api';

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
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_id');
    }
    return Promise.reject(error);
  }
);

// Helper to get full audio URL
export const getAudioUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL.replace('/api', '')}${path}`;
};

// Helper to get full image URL
export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL.replace('/api', '')}${path}`;
};

// ============ AUTH API ============
export const authAPI = {
  sendOTP: (phone) => api.post('/auth/send-otp', { phone }),
  verifyOTP: (phone, otp) => api.post('/auth/verify-otp', { phone, otp }),
  getMe: () => api.get('/user/auth/me'),
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
};

// ============ CONTENT API ============
export const contentAPI = {
  getAlbums: () => api.get('/albums'),
  getAlbum: (id) => api.get(`/albums/${id}`),
  getAllSongs: () => api.get('/albums/all-songs'),
  getCategories: () => api.get('/categories'),
  getSpecialMix: (id) => api.get(`/special-mixes/${id}`),
  getSpecialMixSongs: (id) => api.get(`/special-mixes/${id}/songs`),
  search: (query) => api.get(`/search?q=${encodeURIComponent(query)}`),
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
  getNearbyChurches: (lat, lng) => api.get(`/churches/nearby?lat=${lat}&lng=${lng}`),
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
  generateTTS: (data) => api.post('/bible/tts/verse', data),
};

// ============ USER API ============
export const userAPI = {
  getProfile: () => api.get('/user/auth/me'),
  updateProfile: (data) => api.put('/user/profile', data),
  getDailyPlays: () => api.get('/user/daily-plays'),
};

export default api;
