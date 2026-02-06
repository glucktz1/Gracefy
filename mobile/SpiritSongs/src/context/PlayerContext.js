/**
 * PlayerContext - react-native-track-player Implementation
 * 
 * This provides:
 * - Background audio playback (app minimized/screen locked)
 * - Lock screen controls (play, pause, next, previous, seek)
 * - Media notification with album art
 * - Auto-next when track ends
 * - Headphone/Bluetooth controls
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import TrackPlayer, { 
  usePlaybackState, 
  useProgress, 
  useActiveTrack,
  State,
  RepeatMode,
  Capability,
  AppKilledPlaybackBehavior
} from 'react-native-track-player';
import { Platform } from 'react-native';
import { getAudioUrl, getImageUrl, playerAPI } from '../services/api';

const PlayerContext = createContext(null);

// Global callback for stopping external audio
let stopExternalAudioCallback = null;

export const setStopExternalAudioCallback = (callback) => {
  stopExternalAudioCallback = callback;
};

export const clearStopExternalAudioCallback = () => {
  stopExternalAudioCallback = null;
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    console.warn('[PlayerContext] usePlayer called outside provider');
    return {
      currentTrack: null,
      queue: [],
      queueIndex: 0,
      isPlaying: false,
      isLoading: false,
      position: 0,
      duration: 0,
      shuffle: false,
      repeat: 'all',
      isLiked: false,
      playTrack: async () => {},
      togglePlay: async () => {},
      togglePlayPause: async () => {},
      skipNext: async () => {},
      skipPrevious: async () => {},
      seekTo: async () => {},
      toggleShuffle: () => {},
      toggleRepeat: () => {},
      toggleLike: async () => {},
      addToQueue: () => {},
      playQueue: async () => {},
      clearQueue: () => {},
      setAutoPlay: () => {},
      stopPlayback: async () => {},
    };
  }
  return context;
};

// Setup TrackPlayer
const setupPlayer = async () => {
  try {
    // Check if already setup
    try {
      const state = await TrackPlayer.getPlaybackState();
      if (state) {
        console.log('[PlayerContext] TrackPlayer already setup');
        return true;
      }
    } catch (e) {
      // Not setup yet, continue
    }

    await TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
    });

    await TrackPlayer.updateOptions({
      // Capabilities for lock screen / notification
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      // Compact capabilities (notification)
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      // Progress updates
      progressUpdateEventInterval: 1,
      // Android specific
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
      },
    });

    // Set default repeat mode (repeat all)
    await TrackPlayer.setRepeatMode(RepeatMode.Queue);

    console.log('[PlayerContext] TrackPlayer setup complete');
    return true;
  } catch (error) {
    console.error('[PlayerContext] Setup error:', error);
    return false;
  }
};

export const PlayerProvider = ({ children }) => {
  // TrackPlayer hooks
  const playbackState = usePlaybackState();
  const progress = useProgress(200); // Update every 200ms
  const activeTrack = useActiveTrack();

  // Local state
  const [isReady, setIsReady] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('all');
  const [isLiked, setIsLiked] = useState(false);

  // Refs for tracking
  const deviceIdRef = useRef(`${Platform.OS}_${Math.random().toString(36).substr(2, 8)}`);
  const currentStreamIdRef = useRef(null);
  const playStartTimeRef = useRef(null);
  const playTrackedRef = useRef(false);
  const playTrackingTimerRef = useRef(null);

  // Derived state
  const isPlaying = playbackState.state === State.Playing;
  const isLoading = playbackState.state === State.Loading || 
                    playbackState.state === State.Buffering ||
                    playbackState.state === State.Connecting;
  const position = Math.floor((progress.position || 0) * 1000);
  const duration = Math.floor((progress.duration || 0) * 1000);

  // Initialize TrackPlayer
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      const success = await setupPlayer();
      if (mounted) {
        setIsReady(success);
      }
    };

    init();

    return () => {
      mounted = false;
      // Cleanup
      if (playTrackingTimerRef.current) {
        clearTimeout(playTrackingTimerRef.current);
      }
    };
  }, []);

  // Sync current track with active track
  useEffect(() => {
    if (activeTrack) {
      // Convert back to our format
      const track = {
        song_id: activeTrack.id,
        title: activeTrack.title,
        artist_name: activeTrack.artist,
        thumbnail: activeTrack.artwork,
        album_id: activeTrack.album,
        audio_url: activeTrack.url,
        ...(activeTrack.originalData || {})
      };
      setCurrentTrack(track);
      
      // Check liked status
      checkLikedStatus(track.song_id);
      
      // Start play tracking
      startPlayTracking(track.song_id);
      
      // Start stream tracking
      startStreamTracking(track);
    } else {
      setCurrentTrack(null);
    }
  }, [activeTrack?.id]);

  // Update queue index when track changes
  useEffect(() => {
    const updateIndex = async () => {
      try {
        const idx = await TrackPlayer.getActiveTrackIndex();
        if (idx !== null && idx !== undefined) {
          setQueueIndex(idx);
        }
      } catch (e) {}
    };
    
    if (activeTrack) {
      updateIndex();
    }
  }, [activeTrack?.id]);

  // Check liked status
  const checkLikedStatus = async (songId) => {
    if (!songId) return;
    try {
      const response = await playerAPI.checkLiked(songId);
      setIsLiked(response?.data?.liked || false);
    } catch (e) {
      setIsLiked(false);
    }
  };

  // Play tracking (for 45+ second counts)
  const startPlayTracking = (songId) => {
    if (playTrackingTimerRef.current) {
      clearTimeout(playTrackingTimerRef.current);
    }
    
    playStartTimeRef.current = Date.now();
    playTrackedRef.current = false;

    playTrackingTimerRef.current = setTimeout(async () => {
      if (!playTrackedRef.current) {
        playTrackedRef.current = true;
        try {
          await playerAPI.trackPlay(songId, {
            duration: 45,
            platform: Platform.OS
          });
          console.log('[PlayerContext] Play tracked:', songId);
        } catch (e) {}
      }
    }, 45000);
  };

  // Stream tracking
  const startStreamTracking = async (track) => {
    await endCurrentStream();
    
    try {
      const response = await playerAPI.startStream(
        track.song_id,
        deviceIdRef.current,
        { platform: Platform.OS, album_id: track.album_id }
      );
      
      if (response?.data?.stream_id) {
        currentStreamIdRef.current = response.data.stream_id;
      }
    } catch (e) {}
  };

  const endCurrentStream = async () => {
    if (currentStreamIdRef.current) {
      try {
        const dur = playStartTimeRef.current 
          ? Math.floor((Date.now() - playStartTimeRef.current) / 1000)
          : 0;
        await playerAPI.endStream(currentStreamIdRef.current, dur);
      } catch (e) {}
      currentStreamIdRef.current = null;
    }
  };

  // Convert song to TrackPlayer format
  const songToTrack = (song) => {
    if (!song) return null;
    
    const audioUrl = getAudioUrl(song.audio_url || song.file_path);
    const artworkUrl = getImageUrl(song.thumbnail || song.thumbnail_url || song.album_thumbnail);
    
    return {
      id: song.song_id,
      url: audioUrl,
      title: song.title || 'Unknown',
      artist: song.artist_name || 'Unknown Artist',
      artwork: artworkUrl || 'https://via.placeholder.com/300',
      album: song.album_id || '',
      duration: song.duration || 0,
      // Store original data
      originalData: song
    };
  };

  // Play a track
  const playTrack = async (track, newQueue = null, startIndex = null) => {
    if (!isReady || !track) {
      console.log('[PlayerContext] Not ready or no track');
      return;
    }

    // Stop external audio
    if (stopExternalAudioCallback) {
      try { await stopExternalAudioCallback(); } catch (e) {}
    }

    try {
      console.log('[PlayerContext] Playing:', track.title);

      // Reset queue
      await TrackPlayer.reset();

      // Build track list
      let tracks = [];
      if (newQueue && Array.isArray(newQueue) && newQueue.length > 0) {
        tracks = newQueue.map(songToTrack).filter(Boolean);
        setQueue(newQueue);
      } else {
        tracks = [songToTrack(track)];
        setQueue([track]);
      }

      // Add all tracks to queue
      await TrackPlayer.add(tracks);

      // Find starting index
      let playIndex = 0;
      if (startIndex !== null && startIndex >= 0) {
        playIndex = startIndex;
      } else if (newQueue && newQueue.length > 0) {
        playIndex = newQueue.findIndex(s => s.song_id === track.song_id);
        if (playIndex < 0) playIndex = 0;
      }

      // Skip to track and play
      if (playIndex > 0) {
        await TrackPlayer.skip(playIndex);
      }
      
      await TrackPlayer.play();
      setQueueIndex(playIndex);
      
      console.log('[PlayerContext] Playing index:', playIndex, 'of', tracks.length);
    } catch (error) {
      console.error('[PlayerContext] Play error:', error);
    }
  };

  // Toggle play/pause
  const togglePlay = async () => {
    if (!isReady) return;

    try {
      if (isPlaying) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('[PlayerContext] Toggle error:', error);
    }
  };

  // Skip next
  const skipNext = async () => {
    if (!isReady) return;
    
    try {
      await TrackPlayer.skipToNext();
    } catch (error) {
      // At end of queue - loop to start
      try {
        await TrackPlayer.skip(0);
        await TrackPlayer.play();
      } catch (e) {
        console.error('[PlayerContext] Skip next error:', e);
      }
    }
  };

  // Skip previous
  const skipPrevious = async () => {
    if (!isReady) return;
    
    try {
      // If more than 3 seconds in, restart track
      if (progress.position > 3) {
        await TrackPlayer.seekTo(0);
      } else {
        await TrackPlayer.skipToPrevious();
      }
    } catch (error) {
      // At start of queue - loop to end
      try {
        const q = await TrackPlayer.getQueue();
        if (q.length > 0) {
          await TrackPlayer.skip(q.length - 1);
          await TrackPlayer.play();
        }
      } catch (e) {
        console.error('[PlayerContext] Skip prev error:', e);
      }
    }
  };

  // Seek
  const seekTo = async (positionMs) => {
    if (!isReady) return;
    try {
      await TrackPlayer.seekTo(positionMs / 1000);
    } catch (e) {
      console.error('[PlayerContext] Seek error:', e);
    }
  };

  // Toggle shuffle
  const toggleShuffle = () => {
    setShuffle(prev => !prev);
    // Note: TrackPlayer doesn't have built-in shuffle
    // Would need to manually reorder queue
  };

  // Toggle repeat
  const toggleRepeat = async () => {
    if (!isReady) return;
    
    try {
      const currentMode = await TrackPlayer.getRepeatMode();
      let newMode;
      let newState;
      
      if (currentMode === RepeatMode.Off) {
        newMode = RepeatMode.Queue;
        newState = 'all';
      } else if (currentMode === RepeatMode.Queue) {
        newMode = RepeatMode.Track;
        newState = 'one';
      } else {
        newMode = RepeatMode.Off;
        newState = 'off';
      }
      
      await TrackPlayer.setRepeatMode(newMode);
      setRepeat(newState);
    } catch (e) {
      console.error('[PlayerContext] Repeat error:', e);
    }
  };

  // Toggle like
  const toggleLike = async () => {
    if (!currentTrack?.song_id) return;
    
    try {
      if (isLiked) {
        await playerAPI.unlikeSong(currentTrack.song_id);
        setIsLiked(false);
      } else {
        await playerAPI.likeSong(currentTrack.song_id);
        setIsLiked(true);
      }
    } catch (e) {
      console.error('[PlayerContext] Like error:', e);
    }
  };

  // Add to queue
  const addToQueue = async (track) => {
    if (!isReady || !track) return;
    
    try {
      const playerTrack = songToTrack(track);
      await TrackPlayer.add(playerTrack);
      setQueue(prev => [...prev, track]);
    } catch (e) {
      console.error('[PlayerContext] Add to queue error:', e);
    }
  };

  // Play queue
  const playQueue = async (newQueue, index = 0) => {
    if (!newQueue?.length) return;
    await playTrack(newQueue[index], newQueue, index);
  };

  // Clear queue
  const clearQueue = async () => {
    if (!isReady) return;
    
    try {
      await TrackPlayer.reset();
      setQueue([]);
      setQueueIndex(0);
    } catch (e) {
      console.error('[PlayerContext] Clear error:', e);
    }
  };

  // Set auto play
  const setAutoPlay = async (enabled) => {
    if (!isReady) return;
    
    try {
      if (enabled) {
        await TrackPlayer.setRepeatMode(RepeatMode.Queue);
        setRepeat('all');
      } else {
        await TrackPlayer.setRepeatMode(RepeatMode.Off);
        setRepeat('off');
      }
    } catch (e) {}
  };

  // Stop playback
  const stopPlayback = async () => {
    await endCurrentStream();
    
    if (playTrackingTimerRef.current) {
      clearTimeout(playTrackingTimerRef.current);
    }
    
    if (!isReady) return;
    
    try {
      await TrackPlayer.reset();
      setCurrentTrack(null);
      setQueue([]);
      setQueueIndex(0);
    } catch (e) {
      console.error('[PlayerContext] Stop error:', e);
    }
  };

  const value = {
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    isLoading,
    position,
    duration,
    shuffle,
    repeat,
    isLiked,
    isReady,
    playTrack,
    togglePlay,
    togglePlayPause: togglePlay,
    skipNext,
    skipPrevious,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    toggleLike,
    addToQueue,
    playQueue,
    clearQueue,
    setAutoPlay,
    stopPlayback,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

export default PlayerContext;
