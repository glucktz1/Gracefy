// API Configuration - Using the production backend URL
const API_BASE_URL = 'https://faithtunes-5.preview.emergentagent.com';

export const API_URL = `${API_BASE_URL}/api`;

export const COLORS = {
  // Primary colors
  primary: '#1DB954',
  primaryDark: '#1ed760',
  
  // Background colors
  background: '#121212',
  backgroundLight: '#181818',
  backgroundCard: '#282828',
  backgroundElevated: '#333333',
  
  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#7f7f7f',
  
  // Accent colors
  accent: '#1DB954',
  error: '#FF5252',
  warning: '#FFC107',
  
  // UI colors
  border: '#404040',
  divider: '#333333',
  overlay: 'rgba(0,0,0,0.7)',
};

export const FONTS = {
  bold: '700',
  semiBold: '600',
  medium: '500',
  regular: '400',
};

export default {
  API_URL,
  API_BASE_URL,
  COLORS,
  FONTS,
};
