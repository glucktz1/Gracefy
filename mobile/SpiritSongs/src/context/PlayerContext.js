/**
 * PlayerContext - Complete Rewrite for Background Playback
 * 
 * Built from scratch using react-native-track-player v5
 * 
 * Features:
 * - Background playback (app minimized/killed)
 * - Lock screen controls with artwork
 * - Notification media controls
 * - Bluetooth/headphone controls
 * - Auto-next track
 * - Queue management
 * - Stream tracking for analytics
 * - Guest play limit (3 songs before login prompt)
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import TrackPlayer, {
  Capability,
  State,
  Event,
  RepeatMode,
  AppKilledPlaybackBehavior,
  usePlaybackState,
  useProgress,
  useActiveTrack,
} from 'react-native-track-player';
import { Platform } from 'react-native';
import { getAudioUrl, getImageUrl, playerAPI } from '../services/api';
import { useAuth } from './AuthContext';

// Create context
const PlayerContext = createContext(null);

// External audio callback (for Bible TTS to stop music)
let stopExternalAudioCallback = null;
export const setStopExternalAudioCallback = (cb) => { stopExternalAudioCallback = cb; };
export const clearStopExternalAudioCallback = () => { stopExternalAudioCallback = null; };

// Callback for showing login prompt
let showLoginPromptCallback = null;
export const setShowLoginPromptCallback = (cb) => { showLoginPromptCallback = cb; };
export const clearShowLoginPromptCallback = () => { showLoginPromptCallback = null; };

/**
 * Hook to access player functions and state
 */
export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    // Return safe defaults if used outside provider
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
      pausePlayback: async () => {},
      resumePlayback: async () => {},
    };
  }
  return context;
};

/**
 * Player Provider Component
 */
export const PlayerProvider = ({ children }) => {
  // ============ AUTH CONTEXT ============
  const { isAuthenticated, incrementGuestPlayCount, user } = useAuth();

  // ============ STATE ============
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('all');
  const [isLiked, setIsLiked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [continuousPlay, setContinuousPlay] = useState(true); // Auto-recommendation on by default

  // ============ HOOKS FROM TRACK PLAYER ============
  const playbackState = usePlaybackState();
  const progress = useProgress(500); // Update every 500ms
  const activeTrack = useActiveTrack();

  // ============ REFS ============
  const queueRef = useRef([]);
  const repeatRef = useRef('all');
  const shuffleRef = useRef(false);
  const continuousPlayRef = useRef(true);
  const setupCompleteRef = useRef(false);
  const isFetchingRecommendationsRef = useRef(false);
  
  // Analytics tracking
  const deviceIdRef = useRef(`${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`);
  const streamIdRef = useRef(null);
  const heartbeatRef = useRef(null);
  const playStartTimeRef = useRef(null);
  const playTrackedRef = useRef(false);
  const playTrackingTimerRef = useRef(null);

  // ============ DERIVED STATE ============
  const isPlaying = playbackState.state === State.Playing;
  const position = (progress.position || 0) * 1000; // Convert to milliseconds
  const duration = (progress.duration || 0) * 1000; // Convert to milliseconds

  // ============ SYNC REFS ============
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { continuousPlayRef.current = continuousPlay; }, [continuousPlay]);

  // ============ SETUP PLAYER ============
  const setupPlayer = useCallback(async () => {
    if (setupCompleteRef.current) return true;

    try {
      console.log('[Player] Initializing TrackPlayer...');

      // Check if already initialized
      const currentTrack = await TrackPlayer.getActiveTrack().catch(() => null);
      if (currentTrack !== null) {
        console.log('[Player] Already initialized');
        setupCompleteRef.current = true;
        setIsReady(true);
        return true;
      }

      // Setup player with configuration
      await TrackPlayer.setupPlayer({
        autoHandleInterruptions: true,
      });

      // Configure player options for background playback
      await TrackPlayer.updateOptions({
        // Android: Continue playback when app is killed
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        },
        // Capabilities shown in notification/lock screen
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
          Capability.SeekTo,
        ],
        // Compact notification capabilities
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
        // Progress bar in notification
        progressUpdateEventInterval: 2,
      });

      // Set default repeat mode to queue (repeat all)
      await TrackPlayer.setRepeatMode(RepeatMode.Queue);

      setupCompleteRef.current = true;
      setIsReady(true);
      console.log('[Player] Setup complete');
      return true;
    } catch (error) {
      console.error('[Player] Setup failed:', error);
      return false;
    }
  }, []);

  // ============ FETCH RECOMMENDATIONS FOR CONTINUOUS PLAY ============
  const fetchAndAddRecommendations = async (currentSongId) => {
    if (isFetchingRecommendationsRef.current) return;
    if (shuffleRef.current) return; // Don't fetch recommendations in shuffle mode
    
    isFetchingRecommendationsRef.current = true;
    console.log('[Player] Fetching recommendations for continuous play...');
    
    try {
      const userId = user?.user_id || null;
      const res = await playerAPI.getNextSongRecommendations(currentSongId, userId, 10);
      
      if (res?.data?.songs && res.data.songs.length > 0) {
        const newSongs = res.data.songs.filter(
          song => !queueRef.current.find(q => q.song_id === song.song_id)
        );
        
        if (newSongs.length > 0) {
          console.log(`[Player] Adding ${newSongs.length} recommended songs to queue`);
          
          // Add songs to queue
          const updatedQueue = [...queueRef.current, ...newSongs];
          setQueue(updatedQueue);
          queueRef.current = updatedQueue;
          
          // Add to TrackPlayer
          const tracksToAdd = newSongs.map(toTrackPlayerFormat);
          await TrackPlayer.add(tracksToAdd);
        }
      }
    } catch (e) {
      console.log('[Player] Recommendation fetch error:', e.message);
    } finally {
      isFetchingRecommendationsRef.current = false;
    }
  };

  // ============ INITIALIZE ON MOUNT ============
  useEffect(() => {
    setupPlayer();

    // Listen for queue end to handle repeat or continuous play
    const queueEndedSub = TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
      console.log('[Player] Queue ended');
      
      // If shuffle is on, let repeat handle it (repeat all shuffles again)
      if (shuffleRef.current) {
        if (repeatRef.current === 'all' && queueRef.current.length > 0) {
          try {
            await TrackPlayer.skip(0);
            await TrackPlayer.play();
          } catch (e) {
            console.error('[Player] Restart queue error:', e);
          }
        }
        return;
      }
      
      // Continuous play mode - fetch recommendations and keep playing
      if (continuousPlayRef.current && queueRef.current.length > 0) {
        const lastTrack = queueRef.current[queueRef.current.length - 1];
        if (lastTrack?.song_id) {
          await fetchAndAddRecommendations(lastTrack.song_id);
          
          // Check if we added new songs
          const trackPlayerQueue = await TrackPlayer.getQueue();
          const currentIndex = await TrackPlayer.getActiveTrackIndex();
          
          if (currentIndex !== null && currentIndex < trackPlayerQueue.length - 1) {
            try {
              await TrackPlayer.skipToNext();
            } catch (e) {
              console.error('[Player] Skip to recommended error:', e);
            }
          }
        }
      } else if (repeatRef.current === 'all' && queueRef.current.length > 0) {
        // Regular repeat all
        try {
          await TrackPlayer.skip(0);
          await TrackPlayer.play();
        } catch (e) {
          console.error('[Player] Restart queue error:', e);
        }
      }
    });

    // Listen for track change to pre-fetch recommendations
    const trackChangedSub = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
      if (!event?.track) return;
      
      // When we're near the end of the queue, pre-fetch more recommendations
      if (continuousPlayRef.current && !shuffleRef.current) {
        const currentIndex = await TrackPlayer.getActiveTrackIndex();
        const trackPlayerQueue = await TrackPlayer.getQueue();
        
        // If we're 2 songs from the end, fetch more
        if (currentIndex !== null && trackPlayerQueue.length - currentIndex <= 2) {
          const currentTrackInQueue = queueRef.current[currentIndex];
          if (currentTrackInQueue?.song_id) {
            fetchAndAddRecommendations(currentTrackInQueue.song_id);
          }
        }
      }
    });

    // Cleanup
    return () => {
      queueEndedSub.remove();
      trackChangedSub.remove();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (playTrackingTimerRef.current) clearTimeout(playTrackingTimerRef.current);
    };
  }, [setupPlayer, user]);

  // ============ SYNC ACTIVE TRACK ============
  useEffect(() => {
    if (activeTrack && queue.length > 0) {
      const idx = queue.findIndex(t => 
        t.song_id === activeTrack.id || 
        t.song_id === activeTrack.songId ||
        t.title === activeTrack.title
      );
      
      if (idx >= 0) {
        if (idx !== queueIndex) {
          setQueueIndex(idx);
        }
        if (!currentTrack || currentTrack.song_id !== queue[idx].song_id) {
          setCurrentTrack(queue[idx]);
          checkLikedStatus(queue[idx].song_id);
        }
      }
    }
  }, [activeTrack, queue]);

  // ============ ANALYTICS: STREAM TRACKING ============
  const startStreamTracking = async (track) => {
    await endStreamTracking();
    
    try {
      const res = await playerAPI.startStream(track.song_id, deviceIdRef.current, {
        platform: Platform.OS,
        album_id: track.album_id
      });
      
      if (res?.data?.stream_id) {
        streamIdRef.current = res.data.stream_id;
        
        // Heartbeat every 30 seconds
        heartbeatRef.current = setInterval(async () => {
          if (streamIdRef.current) {
            try {
              await playerAPI.heartbeat(streamIdRef.current, Math.floor(progress.position));
            } catch (e) {}
          }
        }, 30000);
      }
    } catch (e) {
      console.log('[Player] Stream tracking error:', e.message);
    }
  };

  const endStreamTracking = async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    
    if (streamIdRef.current) {
      try {
        const duration = playStartTimeRef.current 
          ? Math.floor((Date.now() - playStartTimeRef.current) / 1000) 
          : 0;
        await playerAPI.endStream(streamIdRef.current, duration);
      } catch (e) {}
      streamIdRef.current = null;
    }
  };

  // ============ ANALYTICS: PLAY TRACKING ============
  const startPlayTracking = (songId) => {
    if (playTrackingTimerRef.current) {
      clearTimeout(playTrackingTimerRef.current);
    }
    
    playStartTimeRef.current = Date.now();
    playTrackedRef.current = false;

    // Track play after 45 seconds
    playTrackingTimerRef.current = setTimeout(async () => {
      if (!playTrackedRef.current) {
        playTrackedRef.current = true;
        try {
          await playerAPI.trackPlay(songId, { duration: 45, platform: Platform.OS });
        } catch (e) {}
      }
    }, 45000);
  };

  // ============ CHECK LIKED STATUS ============
  const checkLikedStatus = async (songId) => {
    try {
      const res = await playerAPI.checkLiked(songId);
      setIsLiked(res?.data?.liked || false);
    } catch (e) {
      setIsLiked(false);
    }
  };

  // ============ CONVERT TRACK FORMAT ============
  const toTrackPlayerFormat = (track) => ({
    id: track.song_id,
    songId: track.song_id, // Keep reference to original ID
    url: getAudioUrl(track.audio_url || track.file_path),
    title: track.title || 'Unknown Title',
    artist: track.artist_name || 'Unknown Artist',
    album: track.album_title || '',
    artwork: getImageUrl(track.thumbnail || track.cover_url || track.album_thumbnail) || 'https://via.placeholder.com/300',
    duration: track.duration || 0,
  });

  // ============ PUBLIC API ============

  /**
   * Play a track with optional queue
   */
  const playTrack = async (track, newQueue = null, startIndex = null) => {
    if (!track) return;

    // ============ GUEST PLAY LIMIT CHECK ============
    // Check if guest user has reached their play limit
    if (!isAuthenticated) {
      const shouldPrompt = await incrementGuestPlayCount();
      if (shouldPrompt && showLoginPromptCallback) {
        showLoginPromptCallback();
        // Still allow playing, but show prompt
      }
    }

    // Ensure player is ready
    if (!setupCompleteRef.current) {
      const ready = await setupPlayer();
      if (!ready) return;
    }

    // Stop external audio (e.g., Bible TTS)
    if (stopExternalAudioCallback) {
      try { await stopExternalAudioCallback(); } catch (e) {}
    }

    setIsLoading(true);
    console.log('[Player] Playing:', track.title);

    try {
      // End previous stream
      await endStreamTracking();

      // Reset player queue
      await TrackPlayer.reset();

      // Determine queue and index
      let tracksToPlay = [];
      let playIndex = 0;

      if (newQueue && Array.isArray(newQueue) && newQueue.length > 0) {
        // New queue provided
        setQueue(newQueue);
        queueRef.current = newQueue;
        playIndex = startIndex ?? newQueue.findIndex(t => t.song_id === track.song_id);
        if (playIndex < 0) playIndex = 0;
        tracksToPlay = newQueue.map(toTrackPlayerFormat);
      } else if (queue.length > 0) {
        // Use existing queue
        playIndex = queue.findIndex(t => t.song_id === track.song_id);
        if (playIndex < 0) playIndex = 0;
        tracksToPlay = queue.map(toTrackPlayerFormat);
      } else {
        // Single track
        setQueue([track]);
        queueRef.current = [track];
        tracksToPlay = [toTrackPlayerFormat(track)];
        playIndex = 0;
      }

      // Add tracks to player
      await TrackPlayer.add(tracksToPlay);

      // Skip to the correct track and play
      if (playIndex > 0) {
        await TrackPlayer.skip(playIndex);
      }
      await TrackPlayer.play();

      // Update state
      setQueueIndex(playIndex);
      setCurrentTrack(track);

      // Start analytics tracking
      startPlayTracking(track.song_id);
      startStreamTracking(track);

      // Check liked status
      checkLikedStatus(track.song_id);

      console.log('[Player] Playing successfully');
    } catch (error) {
      console.error('[Player] Play error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggle play/pause
   */
  const togglePlay = async () => {
    if (!setupCompleteRef.current) return;

    try {
      if (isPlaying) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('[Player] Toggle error:', error);
    }
  };

  /**
   * Skip to next track
   */
  const skipNext = async () => {
    if (!setupCompleteRef.current) return;

    try {
      const queue = await TrackPlayer.getQueue();
      const currentIndex = await TrackPlayer.getActiveTrackIndex();

      if (currentIndex !== null && currentIndex < queue.length - 1) {
        await TrackPlayer.skipToNext();
      } else if (repeat === 'all' && queue.length > 0) {
        await TrackPlayer.skip(0);
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('[Player] Skip next error:', error);
    }
  };

  /**
   * Skip to previous track
   */
  const skipPrevious = async () => {
    if (!setupCompleteRef.current) return;

    try {
      // If more than 3 seconds in, restart current track
      if (progress.position > 3) {
        await TrackPlayer.seekTo(0);
        return;
      }

      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      if (currentIndex !== null && currentIndex > 0) {
        await TrackPlayer.skipToPrevious();
      } else if (repeat === 'all' && queueRef.current.length > 0) {
        await TrackPlayer.skip(queueRef.current.length - 1);
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('[Player] Skip previous error:', error);
    }
  };

  /**
   * Seek to position (in milliseconds)
   */
  const seekTo = async (ms) => {
    if (!setupCompleteRef.current) return;

    try {
      await TrackPlayer.seekTo(ms / 1000); // Convert to seconds
    } catch (error) {
      console.error('[Player] Seek error:', error);
    }
  };

  /**
   * Toggle shuffle mode
   */
  const toggleShuffle = () => {
    setShuffle(prev => !prev);
    // Note: Shuffle implementation would require reordering the queue
  };

  /**
   * Toggle repeat mode (off -> all -> one -> off)
   */
  const toggleRepeat = async () => {
    const modes = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeat);
    const newRepeat = modes[(currentIndex + 1) % modes.length];
    
    setRepeat(newRepeat);
    repeatRef.current = newRepeat;

    try {
      const trackPlayerMode = 
        newRepeat === 'one' ? RepeatMode.Track :
        newRepeat === 'all' ? RepeatMode.Queue :
        RepeatMode.Off;
      
      await TrackPlayer.setRepeatMode(trackPlayerMode);
    } catch (error) {
      console.error('[Player] Set repeat error:', error);
    }
  };

  /**
   * Toggle like status for current track
   */
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
      console.error('[Player] Toggle like error:', error);
    }
  };

  /**
   * Add track to end of queue
   */
  const addToQueue = async (track) => {
    if (!track) return;

    setQueue(prev => [...prev, track]);
    queueRef.current = [...queueRef.current, track];

    if (setupCompleteRef.current) {
      try {
        await TrackPlayer.add(toTrackPlayerFormat(track));
      } catch (error) {
        console.error('[Player] Add to queue error:', error);
      }
    }
  };

  /**
   * Play a new queue from specific index
   */
  const playQueue = async (newQueue, index = 0) => {
    if (!newQueue?.length) return;
    await playTrack(newQueue[index], newQueue, index);
  };

  /**
   * Clear the queue
   */
  const clearQueue = async () => {
    setQueue([]);
    queueRef.current = [];
    setQueueIndex(0);
    setCurrentTrack(null);

    if (setupCompleteRef.current) {
      try {
        await TrackPlayer.reset();
      } catch (error) {
        console.error('[Player] Clear queue error:', error);
      }
    }
  };

  /**
   * Set auto-play enabled (placeholder)
   */
  const setAutoPlay = (enabled) => {
    // Auto-play is handled by TrackPlayer automatically
  };

  /**
   * Stop playback completely
   */
  const stopPlayback = async () => {
    await endStreamTracking();
    
    if (playTrackingTimerRef.current) {
      clearTimeout(playTrackingTimerRef.current);
    }

    if (setupCompleteRef.current) {
      try {
        await TrackPlayer.reset();
      } catch (error) {}
    }

    setCurrentTrack(null);
    setQueueIndex(0);
  };

  /**
   * Pause playback (for external use like Bible TTS)
   */
  const pausePlayback = async () => {
    if (setupCompleteRef.current && isPlaying) {
      try {
        await TrackPlayer.pause();
      } catch (error) {}
    }
  };

  /**
   * Resume playback (for external use)
   */
  const resumePlayback = async () => {
    if (setupCompleteRef.current && !isPlaying && currentTrack) {
      try {
        await TrackPlayer.play();
      } catch (error) {}
    }
  };

  // ============ CONTEXT VALUE ============
  const contextValue = {
    // State
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
    
    // Actions
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
    pausePlayback,
    resumePlayback,
  };

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  );
};

export default PlayerContext;
