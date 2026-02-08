/**
 * Track Player Service - Background Playback Event Handler
 * 
 * This service runs independently and handles:
 * - Lock screen controls (play/pause/skip)
 * - Notification controls
 * - Bluetooth/headphone controls
 * - Background playback continuation
 */
import TrackPlayer, { Event } from 'react-native-track-player';

module.exports = async function() {
  // Remote play (lock screen, notification, bluetooth)
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play();
  });

  // Remote pause
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });

  // Remote stop
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.stop();
  });

  // Remote next
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    TrackPlayer.skipToNext();
  });

  // Remote previous
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    TrackPlayer.skipToPrevious();
  });

  // Remote seek (scrubbing on lock screen)
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    TrackPlayer.seekTo(event.position);
  });

  // Remote jump forward
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    const position = await TrackPlayer.getProgress().then(p => p.position);
    await TrackPlayer.seekTo(position + event.interval);
  });

  // Remote jump backward
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    const position = await TrackPlayer.getProgress().then(p => p.position);
    await TrackPlayer.seekTo(Math.max(0, position - event.interval));
  });

  // Playback queue ended - loop if repeat all
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    // This is handled in PlayerContext for repeat logic
    console.log('[TrackPlayerService] Queue ended at track:', event.track);
  });

  // Playback error
  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('[TrackPlayerService] Playback error:', event.message);
  });

  // Track changed
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (event) => {
    if (event.track) {
      console.log('[TrackPlayerService] Now playing:', event.track.title);
    }
  });
};
