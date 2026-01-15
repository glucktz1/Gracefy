import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';

// Get base URL without /api suffix for file streaming
const getBaseUrl = () => {
  return API_URL.replace('/api', '');
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('user_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth Services
export const authService = {
  register: async (data) => {
    const response = await api.post('/user/register', data);
    return response.data;
  },
  
  login: async (data) => {
    const response = await api.post('/user/login', data);
    return response.data;
  },
  
  getProfile: async () => {
    const response = await api.get('/user/me');
    return response.data;
  },
  
  saveToken: async (token) => {
    await SecureStore.setItemAsync('user_token', token);
  },
  
  getToken: async () => {
    return await SecureStore.getItemAsync('user_token');
  },
  
  logout: async () => {
    await SecureStore.deleteItemAsync('user_token');
    await SecureStore.deleteItemAsync('user_id');
  },
};

// Home/Content Services
export const contentService = {
  getHome: async () => {
    const response = await api.get('/user/home');
    return response.data;
  },
  
  getCategories: async () => {
    const response = await api.get('/user/browse/categories');
    return response.data;
  },
  
  getCategoryAlbums: async (categoryId) => {
    const response = await api.get(`/user/browse/category/${categoryId}`);
    return response.data;
  },
  
  getAlbum: async (albumId) => {
    const response = await api.get(`/user/album/${albumId}`);
    return response.data;
  },
  
  getAllAlbums: async () => {
    const response = await api.get('/user/albums');
    return response.data;
  },
  
  search: async (query) => {
    const response = await api.get(`/user/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },
};

// Library Services
export const libraryService = {
  getLibrary: async () => {
    const response = await api.get('/user/library');
    return response.data;
  },
  
  addToFavorites: async (type, id) => {
    const response = await api.post('/user/favorites/add', { type, id });
    return response.data;
  },
  
  removeFromFavorites: async (id) => {
    const response = await api.post('/user/favorites/remove', { id });
    return response.data;
  },
  
  createPlaylist: async (name, description = '') => {
    const response = await api.post('/user/playlist/create', { name, description });
    return response.data;
  },
  
  addToPlaylist: async (playlistId, songId) => {
    const response = await api.post(`/user/playlist/${playlistId}/add`, { song_id: songId });
    return response.data;
  },
  
  getPlaylist: async (playlistId) => {
    const response = await api.get(`/user/playlist/${playlistId}`);
    return response.data;
  },
};

// Listening Session Services
export const sessionService = {
  startSession: async (songId, userId) => {
    try {
      const response = await api.post('/listening/start', { 
        song_id: songId, 
        user_id: userId || 'anonymous' 
      });
      return response.data;
    } catch (error) {
      // Return mock session if endpoint doesn't exist
      return { session_id: `session_${Date.now()}` };
    }
  },
  
  endSession: async (sessionId) => {
    try {
      const response = await api.post('/listening/end', { session_id: sessionId });
      return response.data;
    } catch (error) {
      return { success: true };
    }
  },
};

// Get full audio URL - handles different URL formats
export const getAudioUrl = (audioUrl) => {
  if (!audioUrl) return null;
  
  const baseUrl = getBaseUrl();
  
  // If it's already a full URL, return as is
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
    return audioUrl;
  }
  
  // Handle /api/files/{id}/stream format
  if (audioUrl.startsWith('/api/files/')) {
    return `${baseUrl}${audioUrl}`;
  }
  
  // Handle file_id format - convert to streaming URL
  if (audioUrl && !audioUrl.includes('/')) {
    return `${baseUrl}/api/files/${audioUrl}/stream`;
  }
  
  // Handle relative paths
  if (audioUrl.startsWith('/')) {
    return `${baseUrl}${audioUrl}`;
  }
  
  return audioUrl;
};

// Get thumbnail URL
export const getThumbnailUrl = (thumbnailUrl) => {
  if (!thumbnailUrl) return null;
  
  const baseUrl = getBaseUrl();
  
  if (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://')) {
    return thumbnailUrl;
  }
  
  if (thumbnailUrl.startsWith('/')) {
    return `${baseUrl}${thumbnailUrl}`;
  }
  
  // Handle file_id format
  if (thumbnailUrl && !thumbnailUrl.includes('/')) {
    return `${baseUrl}/api/files/${thumbnailUrl}`;
  }
  
  return thumbnailUrl;
};

export default api;
