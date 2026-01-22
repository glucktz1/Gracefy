// Spotify-inspired dark theme for Gracefy
export const COLORS = {
  // Primary colors
  primary: '#1DB954',      // Spotify green
  primaryDark: '#1aa34a',
  primaryLight: '#1ed760',
  
  // Background colors
  background: '#121212',
  surface: '#181818',
  card: '#282828',
  cardHover: '#333333',
  
  // Text colors
  text: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#727272',
  
  // Accent colors
  accent: '#1DB954',
  error: '#E91429',
  warning: '#F59B23',
  success: '#1DB954',
  
  // UI elements
  border: '#333333',
  divider: '#282828',
  overlay: 'rgba(0, 0, 0, 0.7)',
  
  // Gradients
  gradientStart: '#1DB954',
  gradientEnd: '#191414',
  
  // Player
  playerBackground: '#181818',
  progressBar: '#535353',
  progressFill: '#1DB954',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 48,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.37,
    shadowRadius: 7.49,
    elevation: 8,
  },
};
