import TrackPlayer, { Event } from 'react-native-track-player';

// This service runs natively in the background - NO JavaScript suspension issues!
module.exports = async function() {
  
  // Handle remote play button (lock screen, notification, headphones)
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    console.log('[PlaybackService] Remote Play');
    TrackPlayer.play();
  });

  // Handle remote pause button
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    console.log('[PlaybackService] Remote Pause');
    TrackPlayer.pause();
  });

  // Handle remote next button
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    console.log('[PlaybackService] Remote Next');
    TrackPlayer.skipToNext();
  });

  // Handle remote previous button
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    console.log('[PlaybackService] Remote Previous');
    TrackPlayer.skipToPrevious();
  });

  // Handle remote stop
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    console.log('[PlaybackService] Remote Stop');
    TrackPlayer.stop();
  });

  // Handle seeking from lock screen / notification
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    console.log('[PlaybackService] Remote Seek to:', event.position);
    TrackPlayer.seekTo(event.position);
  });

  // CRITICAL: Handle when playback reaches the end of the queue
  // This fires NATIVELY even when the app is in background!
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    console.log('[PlaybackService] Queue ended, position:', event.position, 'track:', event.track);
    // The queue has ended - the PlayerContext will handle fetching more songs
    // when the app comes back to foreground, or we can loop the queue
  });

  // Handle playback errors
  TrackPlayer.addEventListener(Event.PlaybackError, (event) => {
    console.error('[PlaybackService] Playback error:', event.code, event.message);
  });

  console.log('[PlaybackService] Background service registered successfully');
};
