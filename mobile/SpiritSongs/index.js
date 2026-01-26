import { registerRootComponent } from 'expo';

import App from './App';

// NOTE: TrackPlayer.registerPlaybackService is called inside App.js useEffect
// to avoid "expo config" read failures during EAS build

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
