/**
 * PlayerContext - Using react-native-track-player
 * 
 * Features:
 * - Background playback that continues when app is backgrounded
 * - Lock screen controls (play, pause, next, previous)
 * - Auto-next when song ends
 * - Media notification with album art
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import TrackPlayer, { 
  usePlaybackState, 
  useProgress, 
  useActiveTrack,
  State,
  Event,
  RepeatMode
} from 'react-native-track-player';
import { Platform } from 'react-native';
import { getAudioUrl, getImageUrl, playerAPI } from '../services/api';
import { setupTrackPlayer } from '../services/trackPlayerService';

const PlayerContext = createContext(null);

// Global callback for stopping external audio (like Bible TTS)
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
    console.warn('usePlayer called outside PlayerProvider - returning defaults');
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

export const PlayerProvider = ({ children }) => {
  // Track player hooks
  const playbackState = usePlaybackState();
  const progress = useProgress();
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
  const deviceIdRef = useRef(`${Platform.OS}_${Math.random().toString(36).substring(2, 10)}`);
  const currentStreamIdRef = useRef(null);
  const playStartTimeRef = useRef(null);
  const playTrackedRef = useRef(false);
  const playTrackingTimerRef = useRef(null);

  // Derived state
  const isPlaying = playbackState.state === State.Playing;
  const isLoading = playbackState.state === State.Loading || playbackState.state === State.Buffering;
  const position = Math.floor(progress.position * 1000); // Convert to ms
  const duration = Math.floor(progress.duration * 1000); // Convert to ms

  // Initialize track player
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const success = await setupTrackPlayer();
      if (mounted) {
        setIsReady(success);
        console.log('[PlayerContext] Track player ready:', success);
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Sync current track with active track
  useEffect(() => {
    if (activeTrack) {
      const track = {
        song_id: activeTrack.id,
        title: activeTrack.title,
        artist_name: activeTrack.artist,
        thumbnail: activeTrack.artwork,
        album_id: activeTrack.album,
        audio_url: activeTrack.url,
        ...activeTrack.customData
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
    const updateQueueIndex = async () => {
      try {
        const index = await TrackPlayer.getActiveTrackIndex();
        if (index !== null && index !== undefined) {
          setQueueIndex(index);
        }
      } catch (e) {
        // Ignore
      }
    };
    
    if (activeTrack) {
      updateQueueIndex();
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
      if (playStartTimeRef.current && !playTrackedRef.current) {
        const listenDuration = Date.now() - playStartTimeRef.current;
        if (listenDuration >= 45000) {
          playTrackedRef.current = true;
          try {
            await playerAPI.trackPlay(songId, {
              duration: Math.floor(listenDuration / 1000),
              platform: Platform.OS
            });
            console.log('[PlayerContext] Play tracked:', songId);
          } catch (e) {
            // Ignore
          }
        }
      }
    }, 45000);
  };

  // Stream tracking for real-time analytics
  const startStreamTracking = async (track) => {
    // End previous stream
    await endCurrentStream();
    
    try {
      const response = await playerAPI.startStream(
        track.song_id,
        deviceIdRef.current,
        {
          platform: Platform.OS,
          album_id: track.album_id
        }
      );
      
      if (response?.data?.stream_id) {
        currentStreamIdRef.current = response.data.stream_id;
        console.log('[PlayerContext] Stream started:', response.data.stream_id);
      }
    } catch (e) {
      console.log('[PlayerContext] Stream tracking error:', e.message);
    }
  };

  const endCurrentStream = async () => {
    if (currentStreamIdRef.current) {
      try {
        const listenDuration = playStartTimeRef.current 
          ? Math.floor((Date.now() - playStartTimeRef.current) / 1000)
          : 0;
        await playerAPI.endStream(currentStreamIdRef.current, listenDuration);
        console.log('[PlayerContext] Stream ended');
      } catch (e) {
        // Ignore
      }
      currentStreamIdRef.current = null;
    }
  };

  // Convert our song format to track player format
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
      album: song.album_id,
      duration: song.duration || 0,
      // Store original song data
      customData: song
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
      try {
        await stopExternalAudioCallback();
      } catch (e) {}
    }

    try {
      console.log('[PlayerContext] Playing:', track.title);

      // Reset the queue
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

      // Add tracks to queue
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
      console.log('[PlayerContext] Playing index:', playIndex);
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
      console.error('[PlayerContext] Toggle play error:', error);
    }
  };

  // Skip to next track
  const skipNext = async () => {
    if (!isReady) return;
    
    try {
      await TrackPlayer.skipToNext();
    } catch (error) {
      // If at end, loop to start
      try {
        await TrackPlayer.skip(0);
        await TrackPlayer.play();
      } catch (e) {
        console.error('[PlayerContext] Skip next error:', e);
      }
    }
  };

  // Skip to previous track
  const skipPrevious = async () => {
    if (!isReady) return;
    
    try {
      // If more than 3 seconds into song, restart it
      if (progress.position > 3) {
        await TrackPlayer.seekTo(0);
      } else {
        await TrackPlayer.skipToPrevious();
      }
    } catch (error) {
      // If at start, loop to end
      try {
        const queueLength = await TrackPlayer.getQueue();
        if (queueLength.length > 0) {
          await TrackPlayer.skip(queueLength.length - 1);
          await TrackPlayer.play();
        }
      } catch (e) {
        console.error('[PlayerContext] Skip previous error:', e);
      }
    }
  };

  // Seek to position
  const seekTo = async (positionMs) => {
    if (!isReady) return;
    
    try {
      await TrackPlayer.seekTo(positionMs / 1000); // Convert to seconds
    } catch (error) {
      console.error('[PlayerContext] Seek error:', error);
    }
  };

  // Toggle shuffle
  const toggleShuffle = async () => {
    // Note: react-native-track-player doesn't have built-in shuffle
    // We'd need to implement this manually by reordering the queue
    setShuffle(prev => !prev);
  };

  // Toggle repeat mode
  const toggleRepeat = async () => {
    if (!isReady) return;
    
    try {
      const currentMode = await TrackPlayer.getRepeatMode();
      let newMode;
      
      if (currentMode === RepeatMode.Off) {
        newMode = RepeatMode.Queue;
        setRepeat('all');
      } else if (currentMode === RepeatMode.Queue) {
        newMode = RepeatMode.Track;
        setRepeat('one');
      } else {
        newMode = RepeatMode.Off;
        setRepeat('off');
      }
      
      await TrackPlayer.setRepeatMode(newMode);
    } catch (error) {
      console.error('[PlayerContext] Toggle repeat error:', error);
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
    } catch (error) {
      console.error('[PlayerContext] Like error:', error);
    }
  };

  // Add to queue
  const addToQueue = async (track) => {
    if (!isReady || !track) return;
    
    try {
      const playerTrack = songToTrack(track);
      await TrackPlayer.add(playerTrack);
      setQueue(prev => [...prev, track]);
    } catch (error) {
      console.error('[PlayerContext] Add to queue error:', error);
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
    } catch (error) {
      console.error('[PlayerContext] Clear queue error:', error);
    }
  };

  // Set auto play (handled by repeat mode)
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
    } catch (error) {
      console.error('[PlayerContext] Set auto play error:', error);
    }
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
    } catch (error) {
      console.error('[PlayerContext] Stop error:', error);
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
