/**
 * Track Player Service - Handles background playback events
 * This runs as a separate service even when the app UI is not visible
 */
import TrackPlayer, { Event, State } from 'react-native-track-player';

module.exports = async function() {
  // Handle remote play event (from lock screen, notification, bluetooth)
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    console.log('[TrackPlayer] RemotePlay event');
    try {
      await TrackPlayer.play();
    } catch (e) {
      console.error('[TrackPlayer] RemotePlay error:', e);
    }
  });

  // Handle remote pause event
  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    console.log('[TrackPlayer] RemotePause event');
    try {
      await TrackPlayer.pause();
    } catch (e) {
      console.error('[TrackPlayer] RemotePause error:', e);
    }
  });

  // Handle remote stop event
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    console.log('[TrackPlayer] RemoteStop event');
    try {
      await TrackPlayer.stop();
    } catch (e) {
      console.error('[TrackPlayer] RemoteStop error:', e);
    }
  });

  // Handle skip to next
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    console.log('[TrackPlayer] RemoteNext event');
    try {
      await TrackPlayer.skipToNext();
    } catch (e) {
      console.error('[TrackPlayer] RemoteNext error:', e);
    }
  });

  // Handle skip to previous
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    console.log('[TrackPlayer] RemotePrevious event');
    try {
      await TrackPlayer.skipToPrevious();
    } catch (e) {
      console.error('[TrackPlayer] RemotePrevious error:', e);
    }
  });

  // Handle seek
  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    console.log('[TrackPlayer] RemoteSeek event:', event.position);
    try {
      await TrackPlayer.seekTo(event.position);
    } catch (e) {
      console.error('[TrackPlayer] RemoteSeek error:', e);
    }
  });

  // Handle playback queue ended - auto-restart queue if repeat all
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    console.log('[TrackPlayer] PlaybackQueueEnded event');
    // Queue ended, will be handled by PlayerContext for repeat logic
  });

  // Handle playback error
  TrackPlayer.addEventListener(Event.PlaybackError, async (event) => {
    console.error('[TrackPlayer] PlaybackError:', event.message, event.code);
  });

  // Handle track change
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
    console.log('[TrackPlayer] Track changed:', event.track?.title);
  });

  // Handle playback state change
  TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
    console.log('[TrackPlayer] State changed:', event.state);
  });
};
