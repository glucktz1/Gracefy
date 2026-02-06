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
import TrackPlayer from 'react-native-track-player';

import App from './App';
import { PlaybackService } from './src/services/PlaybackService';

// Register the playback service BEFORE registering the app
// This is critical for background audio to work
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Register the main app component
registerRootComponent(App);
