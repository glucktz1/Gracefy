/**
 * Custom App Entry Point
 * Registers the TrackPlayer service for background playback BEFORE the app renders
 */

import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';

// Register the playback service - MUST be done before app renders
TrackPlayer.registerPlaybackService(() => require('./src/services/trackPlayerService'));

registerRootComponent(App);
