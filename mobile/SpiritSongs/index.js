/**
 * Custom App Entry Point
 * 
 * This file replaces the default Expo entry point to enable:
 * - Background audio playback
 * - Lock screen controls
 * - Media notification
 * 
 * Using react-native-track-player with Expo
 */

import { registerRootComponent } from 'expo';

// Dynamically import TrackPlayer to avoid expo config issues
let trackPlayerRegistered = false;

const registerTrackPlayerService = async () => {
  if (trackPlayerRegistered) return;
  
  try {
    const TrackPlayer = require('react-native-track-player').default;
    const { PlaybackService } = require('./src/services/PlaybackService');
    
    TrackPlayer.registerPlaybackService(() => PlaybackService);
    trackPlayerRegistered = true;
    console.log('[index.js] TrackPlayer service registered');
  } catch (e) {
    console.log('[index.js] TrackPlayer registration error:', e.message);
  }
};

// Register TrackPlayer service
registerTrackPlayerService();

// Import and register the app
import App from './App';
registerRootComponent(App);

