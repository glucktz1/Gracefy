// Lazy loader for react-native-track-player
// The actual require happens at runtime via Metro bundler, not during EAS config parse

let _TrackPlayer = null;
let _Capability = null;
let _Event = null;
let _RepeatMode = null;
let _State = null;
let _usePlaybackState = null;
let _useProgress = null;
let _useActiveTrack = null;
let _isLoaded = false;

// This function is called at RUNTIME, after Metro bundles everything
export const loadTrackPlayer = () => {
  if (_isLoaded) return true;
  
  // Use global.require to ensure this only runs at runtime
  // Metro will handle the actual bundling
  if (typeof __DEV__ !== 'undefined' || true) {
    try {
      // Dynamic require - Metro handles this at bundle time, not EAS config time
      const moduleName = 'react-native-track-player';
      const tp = __non_webpack_require__ ? __non_webpack_require__(moduleName) : require(moduleName);
      
      _TrackPlayer = tp.default || tp;
      _Capability = tp.Capability;
      _Event = tp.Event;
      _RepeatMode = tp.RepeatMode;
      _State = tp.State;
      _usePlaybackState = tp.usePlaybackState;
      _useProgress = tp.useProgress;
      _useActiveTrack = tp.useActiveTrack;
      _isLoaded = true;
      
      // Register playback service
      if (_TrackPlayer && _TrackPlayer.registerPlaybackService) {
        _TrackPlayer.registerPlaybackService(() => require('../services/playbackService'));
      }
      
      console.log('[TrackPlayerLoader] Successfully loaded react-native-track-player');
      return true;
    } catch (e) {
      console.warn('[TrackPlayerLoader] Failed to load:', e.message);
      return false;
    }
  }
  return false;
};

export const getTrackPlayer = () => _TrackPlayer;
export const getCapability = () => _Capability;
export const getEvent = () => _Event;
export const getRepeatMode = () => _RepeatMode;
export const getState = () => _State;
export const getUsePlaybackState = () => _usePlaybackState;
export const getUseProgress = () => _useProgress;
export const getUseActiveTrack = () => _useActiveTrack;
export const isTrackPlayerLoaded = () => _isLoaded;
