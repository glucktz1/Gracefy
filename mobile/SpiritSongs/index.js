import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';

import App from './App';

// Register the playback service for background audio
// This MUST be at the top level, not inside a component
TrackPlayer.registerPlaybackService(() => require('./src/services/playbackService'));

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
