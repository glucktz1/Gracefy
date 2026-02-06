import { registerRootComponent } from 'expo';

import App from './App';

// Note: TrackPlayer service registration moved to App.js
// to avoid expo config read issues during EAS build

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
