// Lazy loader for react-native-track-player to avoid EAS config parse issues
// This file delays loading until runtime (after Metro bundler processes it)

let _TrackPlayer = null;
let _Capability = null;
let _Event = null;
let _RepeatMode = null;
let _State = null;
let _usePlaybackState = null;
let _useProgress = null;
let _useActiveTrack = null;
let _isLoaded = false;

export const loadTrackPlayer = () => {
  if (_isLoaded) return true;
  
  try {
    const tp = require('react-native-track-player');
    _TrackPlayer = tp.default;
    _Capability = tp.Capability;
    _Event = tp.Event;
    _RepeatMode = tp.RepeatMode;
    _State = tp.State;
    _usePlaybackState = tp.usePlaybackState;
    _useProgress = tp.useProgress;
    _useActiveTrack = tp.useActiveTrack;
    _isLoaded = true;
    
    // Register playback service
    _TrackPlayer.registerPlaybackService(() => require('./playbackService'));
    
    console.log('[TrackPlayerLoader] Successfully loaded react-native-track-player');
    return true;
  } catch (e) {
    console.warn('[TrackPlayerLoader] Failed to load:', e.message);
    return false;
  }
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
