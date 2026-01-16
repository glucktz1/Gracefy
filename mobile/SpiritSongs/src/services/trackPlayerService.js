/**
 * Track Player Service - For lock screen controls like Spotify
 * Uses react-native-track-player for native media notifications
 */

import TrackPlayer, {
  Capability,
  Event,
  RepeatMode,
  State,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';

let isSetup = false;

// Setup the track player
export async function setupPlayer() {
  if (isSetup) {
    console.log('Track player already setup');
    return true;
  }

  try {
    await TrackPlayer.setupPlayer({
      maxCacheSize: 1024 * 10, // 10MB cache
    });

    // Configure player options for lock screen controls
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      // Capabilities that show on lock screen
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      // Compact view capabilities (notification)
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      // Update progress every second
      progressUpdateEventInterval: 1,
    });

    // Set default repeat mode
    await TrackPlayer.setRepeatMode(RepeatMode.Queue);

    isSetup = true;
    console.log('Track player setup complete');
    return true;
  } catch (error) {
    console.error('Error setting up track player:', error);
    return false;
  }
}

// Convert song to track format
export function songToTrack(song, album) {
  return {
    id: song.song_id,
    url: song.audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    title: song.title || 'Unknown Track',
    artist: song.artist_name || album?.artist_name || 'Unknown Artist',
    album: album?.title || 'Spirit Songs',
    artwork: song.thumbnail || album?.thumbnail || undefined,
    duration: song.duration || 0,
  };
}

// Play a song with queue
export async function playSong(song, album, queue = [], startIndex = 0) {
  try {
    // Reset the player
    await TrackPlayer.reset();

    // Convert queue to tracks
    const tracks = queue.length > 0
      ? queue.map(item => songToTrack(item.song || item, item.album || album))
      : [songToTrack(song, album)];

    // Add all tracks to queue
    await TrackPlayer.add(tracks);

    // Skip to the selected track
    if (startIndex > 0 && startIndex < tracks.length) {
      await TrackPlayer.skip(startIndex);
    }

    // Start playback
    await TrackPlayer.play();

    return true;
  } catch (error) {
    console.error('Error playing song:', error);
    return false;
  }
}

// Playback controls
export async function play() {
  await TrackPlayer.play();
}

export async function pause() {
  await TrackPlayer.pause();
}

export async function togglePlayPause() {
  const state = await TrackPlayer.getPlaybackState();
  if (state.state === State.Playing) {
    await TrackPlayer.pause();
  } else {
    await TrackPlayer.play();
  }
}

export async function skipToNext() {
  await TrackPlayer.skipToNext();
}

export async function skipToPrevious() {
  const position = await TrackPlayer.getProgress();
  // If more than 3 seconds in, restart current track
  if (position.position > 3) {
    await TrackPlayer.seekTo(0);
  } else {
    await TrackPlayer.skipToPrevious();
  }
}

export async function seekTo(position) {
  await TrackPlayer.seekTo(position);
}

export async function setRepeatMode(mode) {
  const modes = {
    off: RepeatMode.Off,
    one: RepeatMode.Track,
    all: RepeatMode.Queue,
  };
  await TrackPlayer.setRepeatMode(modes[mode] || RepeatMode.Queue);
}

export async function getProgress() {
  return await TrackPlayer.getProgress();
}

export async function getState() {
  return await TrackPlayer.getPlaybackState();
}

export async function getCurrentTrack() {
  return await TrackPlayer.getActiveTrack();
}

export async function getQueue() {
  return await TrackPlayer.getQueue();
}

// Playback service - handles remote events (lock screen, notification, etc.)
export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.stop();
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    const progress = await TrackPlayer.getProgress();
    if (progress.position > 3) {
      TrackPlayer.seekTo(0);
    } else {
      TrackPlayer.skipToPrevious();
    }
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
    TrackPlayer.seekTo(event.position);
  });

  // Handle playback queue ended
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (data) => {
    // Auto-repeat queue
    const queue = await TrackPlayer.getQueue();
    if (queue.length > 0) {
      await TrackPlayer.skip(0);
      await TrackPlayer.play();
    }
  });
}

export default {
  setupPlayer,
  playSong,
  play,
  pause,
  togglePlayPause,
  skipToNext,
  skipToPrevious,
  seekTo,
  setRepeatMode,
  getProgress,
  getState,
  getCurrentTrack,
  getQueue,
  PlaybackService,
};
