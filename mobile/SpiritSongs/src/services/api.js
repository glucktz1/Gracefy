import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_URL, API_BASE_URL } from '../config';

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
    const response = await api.post('/listening/start', { 
      song_id: songId, 
      user_id: userId || 'anonymous' 
    });
    return response.data;
  },
  
  endSession: async (sessionId) => {
    const response = await api.post('/listening/end', { session_id: sessionId });
    return response.data;
  },
};

// Get full audio URL
export const getAudioUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('/api/files/')) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
};

export default api;
