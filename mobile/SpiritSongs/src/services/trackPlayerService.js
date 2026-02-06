/**
 * Track Player Service
 * Handles background playback, lock screen controls, and media session
 */

import TrackPlayer, { Event, RepeatMode, Capability, AppKilledPlaybackBehavior } from 'react-native-track-player';

// This service is registered in index.js
export async function PlaybackService() {
  // Handle remote events
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.log('[TrackPlayer] Remote pause');
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.log('[TrackPlayer] Remote play');
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    console.log('[TrackPlayer] Remote next');
    TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    console.log('[TrackPlayer] Remote previous');
    TrackPlayer.skipToPrevious();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    console.log('[TrackPlayer] Remote stop');
    TrackPlayer.stop();
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    console.log('[TrackPlayer] Remote seek:', event.position);
    TrackPlayer.seekTo(event.position);
  });

  // Handle playback state changes
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    console.log('[TrackPlayer] Playback state:', event.state);
  });

  // Handle track changes
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    console.log('[TrackPlayer] Track changed:', event.track?.title);
  });

  // Handle playback errors
  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('[TrackPlayer] Playback error:', event.message);
  });

  // Handle queue ended
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, (event) => {
    console.log('[TrackPlayer] Queue ended, position:', event.position);
    // Auto-repeat if at end
    TrackPlayer.getRepeatMode().then(mode => {
      if (mode === RepeatMode.Queue) {
        TrackPlayer.skip(0);
        TrackPlayer.play();
      }
    });
  });
}

// Setup function to be called on app start
export async function setupTrackPlayer() {
  try {
    // Check if already initialized
    const currentTrack = await TrackPlayer.getActiveTrack().catch(() => null);
    if (currentTrack !== null) {
      console.log('[TrackPlayer] Already initialized');
      return true;
    }
  } catch (e) {
    // Not initialized, continue with setup
  }

  try {
    await TrackPlayer.setupPlayer({
      // Android specific options
      autoHandleInterruptions: true,
    });

    // Configure player capabilities
    await TrackPlayer.updateOptions({
      // Capabilities that will show on lock screen / notification
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.Stop,
        Capability.SeekTo,
      ],
      // Capabilities that will show only when playing
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      // What to do when app is killed
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      },
      // Notification customization
      progressUpdateEventInterval: 1,
    });

    // Set default repeat mode to repeat queue
    await TrackPlayer.setRepeatMode(RepeatMode.Queue);

    console.log('[TrackPlayer] Setup complete');
    return true;
  } catch (error) {
    console.error('[TrackPlayer] Setup error:', error);
    return false;
  }
}

export default { PlaybackService, setupTrackPlayer };
