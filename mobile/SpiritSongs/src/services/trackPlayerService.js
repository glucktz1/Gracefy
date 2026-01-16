/**
 * Track Player Service - Using react-native-track-player for lock screen controls
 */

import TrackPlayer, { 
  Capability, 
  Event, 
  State,
  RepeatMode,
  AppKilledPlaybackBehavior
} from 'react-native-track-player';

// Service setup - runs in background
export async function setupPlayer() {
  let isSetup = false;
  
  try {
    // Check if player is already initialized
    await TrackPlayer.getActiveTrack();
    isSetup = true;
  } catch (error) {
    // Player not initialized, set it up
    await TrackPlayer.setupPlayer({
      maxCacheSize: 1024 * 5, // 5MB cache
    });
    
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      progressUpdateEventInterval: 1,
    });
    
    isSetup = true;
  }
  
  return isSetup;
}

// Add a track to the queue
export async function addTrack(song, album) {
  const track = {
    id: song.song_id,
    url: song.audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    title: song.title || 'Unknown Track',
    artist: album?.artist_name || song.artist_name || 'Unknown Artist',
    album: album?.title || 'Spirit Songs',
    artwork: song.thumbnail || album?.thumbnail,
    duration: song.duration || 0,
  };
  
  await TrackPlayer.add(track);
  return track;
}

// Play a song
export async function playSong(song, album, queue = []) {
  await TrackPlayer.reset();
  
  // Add all tracks to queue
  const tracks = queue.length > 0 
    ? queue.map(item => ({
        id: (item.song || item).song_id,
        url: (item.song || item).audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        title: (item.song || item).title || 'Unknown Track',
        artist: (item.album || album)?.artist_name || 'Unknown Artist',
        album: (item.album || album)?.title || 'Spirit Songs',
        artwork: (item.song || item).thumbnail || (item.album || album)?.thumbnail,
        duration: (item.song || item).duration || 0,
      }))
    : [{
        id: song.song_id,
        url: song.audio_url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        title: song.title || 'Unknown Track',
        artist: album?.artist_name || 'Unknown Artist',
        album: album?.title || 'Spirit Songs',
        artwork: song.thumbnail || album?.thumbnail,
        duration: song.duration || 0,
      }];
  
  await TrackPlayer.add(tracks);
  
  // Find the index of the song to play
  const songIndex = tracks.findIndex(t => t.id === song.song_id);
  if (songIndex > 0) {
    await TrackPlayer.skip(songIndex);
  }
  
  await TrackPlayer.play();
}

// Playback controls
export async function play() {
  await TrackPlayer.play();
}

export async function pause() {
  await TrackPlayer.pause();
}

export async function skipToNext() {
  await TrackPlayer.skipToNext();
}

export async function skipToPrevious() {
  await TrackPlayer.skipToPrevious();
}

export async function seekTo(position) {
  await TrackPlayer.seekTo(position);
}

export async function setRepeatMode(mode) {
  const repeatModes = {
    'off': RepeatMode.Off,
    'one': RepeatMode.Track,
    'all': RepeatMode.Queue,
  };
  await TrackPlayer.setRepeatMode(repeatModes[mode] || RepeatMode.Queue);
}

export async function getProgress() {
  const progress = await TrackPlayer.getProgress();
  return {
    position: progress.position,
    duration: progress.duration,
    buffered: progress.buffered,
  };
}

export async function getState() {
  return await TrackPlayer.getPlaybackState();
}

export async function getCurrentTrack() {
  return await TrackPlayer.getActiveTrack();
}

// Playback service - handles background events
export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
}

export default {
  setupPlayer,
  playSong,
  play,
  pause,
  skipToNext,
  skipToPrevious,
  seekTo,
  setRepeatMode,
  getProgress,
  getState,
  getCurrentTrack,
  PlaybackService,
};
