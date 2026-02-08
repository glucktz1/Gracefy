/**
 * App Entry Point
 * 
 * Registers TrackPlayer service for background playback
 * MUST be done before app renders
 */

import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';

// Register the background playback service
// This enables lock screen controls, notification controls, etc.
TrackPlayer.registerPlaybackService(() => require('./src/services/trackPlayerService'));

// Register the main app component
registerRootComponent(App);
