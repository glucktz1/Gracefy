// playbackService.js - Background audio service for react-native-track-player
// This runs NATIVELY and doesn't depend on JavaScript being active

module.exports = async function() {
  const TrackPlayer = require('react-native-track-player').default;
  const { Event } = require('react-native-track-player');

  // Remote play (from lock screen, notification, or headphones)
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.log('[PlaybackService] RemotePlay');
    TrackPlayer.play();
  });

  // Remote pause
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.log('[PlaybackService] RemotePause');
    TrackPlayer.pause();
  });

  // Remote next - THIS IS KEY for background advancement
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    console.log('[PlaybackService] RemoteNext');
    TrackPlayer.skipToNext();
  });

  // Remote previous
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    console.log('[PlaybackService] RemotePrevious');
    TrackPlayer.skipToPrevious();
  });

  // Remote stop
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    console.log('[PlaybackService] RemoteStop');
    TrackPlayer.stop();
  });

  // Remote seek (from notification slider)
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    console.log('[PlaybackService] RemoteSeek', event.position);
    TrackPlayer.seekTo(event.position);
  });

  // Playback state changes
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    console.log('[PlaybackService] PlaybackState:', event.state);
  });

  // Track changed - fires when moving to next/prev track
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    console.log('[PlaybackService] ActiveTrackChanged:', event.track?.title);
  });

  // Queue ended - all tracks finished
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, (event) => {
    console.log('[PlaybackService] QueueEnded at position:', event.position);
  });

  // Playback error
  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('[PlaybackService] Error:', event.code, event.message);
  });

  console.log('[PlaybackService] Service registered successfully');
};
