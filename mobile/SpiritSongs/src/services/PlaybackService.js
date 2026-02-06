/**
 * PlaybackService - Background Audio Service
 * 
 * This service handles all remote media events:
 * - Lock screen controls (play, pause, next, previous, seek)
 * - Notification controls
 * - Headphone/Bluetooth controls
 * - Auto-play next track
 */

import TrackPlayer, { Event, RepeatMode } from 'react-native-track-player';

export async function PlaybackService() {
  // Remote Play - from lock screen, notification, headphones
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.log('[PlaybackService] Remote Play');
    TrackPlayer.play();
  });

  // Remote Pause
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.log('[PlaybackService] Remote Pause');
    TrackPlayer.pause();
  });

  // Remote Stop
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    console.log('[PlaybackService] Remote Stop');
    TrackPlayer.stop();
  });

  // Remote Next - skip to next track
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    console.log('[PlaybackService] Remote Next');
    TrackPlayer.skipToNext();
  });

  // Remote Previous - skip to previous track
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    console.log('[PlaybackService] Remote Previous');
    TrackPlayer.skipToPrevious();
  });

  // Remote Seek - seek to position (from lock screen slider)
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    console.log('[PlaybackService] Remote Seek:', event.position);
    TrackPlayer.seekTo(event.position);
  });

  // Remote Jump Forward (some headphones)
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    const position = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(position.position + (event.interval || 15));
  });

  // Remote Jump Backward (some headphones)
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    const position = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(Math.max(0, position.position - (event.interval || 15)));
  });

  // Playback Queue Ended - handle auto-repeat
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    console.log('[PlaybackService] Queue Ended at position:', event.position);
    
    // Get current repeat mode
    const repeatMode = await TrackPlayer.getRepeatMode();
    
    if (repeatMode === RepeatMode.Queue) {
      // Loop back to start of queue
      const queue = await TrackPlayer.getQueue();
      if (queue.length > 0) {
        await TrackPlayer.skip(0);
        await TrackPlayer.play();
        console.log('[PlaybackService] Looped back to start');
      }
    }
  });

  // Playback Active Track Changed
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    console.log('[PlaybackService] Track Changed:', event.track?.title);
  });

  // Playback State Changed
  TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
    console.log('[PlaybackService] State:', event.state);
  });

  // Playback Error
  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('[PlaybackService] Error:', event.message);
  });

  console.log('[PlaybackService] Initialized');
}

export default PlaybackService;
