// Gracefy Blue Theme - Inspired by the app logo
export const COLORS = {
  // Primary colors - Blue theme from logo
  primary: '#00A8E8',        // Vibrant cyan blue
  primaryDark: '#0077B6',    // Darker blue
  primaryLight: '#48CAE4',   // Lighter blue
  
  // Background colors
  background: '#0A1628',     // Dark navy blue
  surface: '#122135',        // Slightly lighter navy
  card: '#1A2D47',           // Card background
  cardHover: '#243B5C',      // Card hover state
  
  // Text colors
  text: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0C4E8',  // Light blue tinted
  textMuted: '#6B8CAE',      // Muted blue
  
  // Accent colors
  accent: '#00A8E8',
  error: '#FF4757',
  warning: '#FFA502',
  success: '#2ED573',
  
  // UI elements
  border: '#2A4060',
  divider: '#1A2D47',
  overlay: 'rgba(10, 22, 40, 0.85)',
  
  // Gradients
  gradientStart: '#00A8E8',
  gradientMiddle: '#0077B6',
  gradientEnd: '#0A1628',
  
  // Player
  playerBackground: '#122135',
  progressBar: '#2A4060',
  progressFill: '#00A8E8',
  
  // Onboarding specific
  onboardingOverlay: 'rgba(10, 22, 40, 0.7)',
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
