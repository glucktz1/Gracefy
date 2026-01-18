// API Configuration - Using the production backend URL
const API_BASE_URL = 'https://faith-melody-3.preview.emergentagent.com';

export const API_URL = `${API_BASE_URL}/api`;

// Gracefy Brand Colors - Blue gradient theme
export const COLORS = {
  // Primary colors - Gracefy Blue
  primary: '#3498DB',           // Main blue
  primaryDark: '#1A295E',       // Dark blue
  primaryLight: '#5DADE2',      // Light blue
  
  // Background colors
  background: '#0A0A1A',        // Dark background with blue tint
  backgroundLight: '#121225',   // Slightly lighter
  backgroundCard: '#1A1A2E',    // Card background
  backgroundElevated: '#252540', // Elevated elements
  
  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#7f7f7f',
  
  // Accent colors - Gracefy blue gradient
  accent: '#3498DB',
  accentGradient: ['#3498DB', '#1A295E'],
  error: '#FF5252',
  warning: '#FFC107',
  success: '#4CAF50',
  
  // UI colors
  border: '#2A2A4A',
  divider: '#1A1A30',
  overlay: 'rgba(10,10,26,0.85)',
};

export const BRAND = {
  name: 'Gracefy',
  tagline: 'Christian Music Streaming',
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
  BRAND,
  FONTS,
};
