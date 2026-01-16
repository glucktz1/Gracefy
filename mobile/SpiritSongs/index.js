import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './src/services/trackPlayerService';

import App from './App';

// Register the playback service for lock screen controls
TrackPlayer.registerPlaybackService(() => PlaybackService);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
