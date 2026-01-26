import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { AppState, Platform } from 'react-native';
import { getAudioUrl, playerAPI, contentAPI } from '../services/api';

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
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
};

export const PlayerProvider = ({ children }) => {
  // Player state
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('all');
  const [isLiked, setIsLiked] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  // Refs for background-safe access
  const soundRef = useRef(null);
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const repeatRef = useRef('all');
  const autoPlayRef = useRef(true);
  const durationRef = useRef(0);
  const isPlayingRef = useRef(false);
  
  // CRITICAL: Lock to prevent simultaneous playback when user taps quickly
  const playLockRef = useRef(false);
  const currentTrackIdRef = useRef(null);
  
  // Track if we're handling track end to prevent double-trigger
  const isHandlingTrackEndRef = useRef(false);
  
  // BACKGROUND POLLING: Interval ref for position monitoring
  const pollingIntervalRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { autoPlayRef.current = autoPlayEnabled; }, [autoPlayEnabled]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  // Configure audio mode for background playback
  const configureAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      console.log('[PlayerContext] Audio mode configured for background playback');
    } catch (e) {
      console.error('[PlayerContext] Error setting audio mode:', e);
    }
  };

  // CRITICAL: Start background polling for track completion
  const startBackgroundPolling = () => {
    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    console.log('[PlayerContext] Starting background polling for track completion');
    
    // Poll every 1 second to check if track has ended
    pollingIntervalRef.current = setInterval(async () => {
      if (!soundRef.current || !isPlayingRef.current) return;
      
      try {
        const status = await soundRef.current.getStatusAsync();
        
        if (status.isLoaded) {
          const currentPos = status.positionMillis;
          const totalDuration = status.durationMillis;
          
          // Update UI state
          setPosition(currentPos / 1000);
          if (totalDuration) {
            setDuration(totalDuration / 1000);
            durationRef.current = totalDuration / 1000;
          }
          setIsPlaying(status.isPlaying);
          isPlayingRef.current = status.isPlaying;
          
          // CRITICAL: Detect track completion
          // Check if we're within 500ms of the end OR if didJustFinish is true
          if (totalDuration && currentPos >= totalDuration - 500) {
            console.log('[PlayerContext] POLLING detected track near end:', currentPos, '/', totalDuration);
            
            // Double-check the track has actually finished
            if (!status.isPlaying && currentPos >= totalDuration - 1000) {
              console.log('[PlayerContext] POLLING: Track finished, advancing...');
              playNextTrackInternal();
            }
          }
          
          // Also handle didJustFinish if it fires
          if (status.didJustFinish && !status.isLooping) {
            console.log('[PlayerContext] POLLING: didJustFinish detected');
            playNextTrackInternal();
          }
        }
      } catch (error) {
        // Sound might be unloaded, ignore errors
      }
    }, 1000);
  };

  // Stop background polling
  const stopBackgroundPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('[PlayerContext] Stopped background polling');
    }
  };

  // Initialize audio on mount
  useEffect(() => {
    configureAudioMode();
    startBackgroundPolling();

    // Re-configure when app comes to foreground
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      console.log('[PlayerContext] App state changed to:', nextAppState);
      if (nextAppState === 'active') {
        await configureAudioMode();
        // Restart polling when app becomes active
        startBackgroundPolling();
      }
    });

    return () => {
      subscription?.remove();
      stopBackgroundPolling();
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // Fetch more songs for continuous play
  const fetchMoreSongs = async () => {
    try {
      const response = await contentAPI.getAllSongs();
      const songs = response.data?.songs || [];
      if (songs.length > 0) {
        return songs.sort(() => Math.random() - 0.5).slice(0, 20);
      }
      return [];
    } catch (error) {
      console.error('[PlayerContext] Error fetching more songs:', error);
      return [];
    }
  };

  // Play next track - used by polling and onPlaybackStatusUpdate for auto-advance
  const playNextTrackInternal = async () => {
    if (isHandlingTrackEndRef.current) {
      console.log('[PlayerContext] Already handling track end, skipping');
      return;
    }
    
    isHandlingTrackEndRef.current = true;
    
    try {
      const currentRepeat = repeatRef.current;
      const currentQueue = queueRef.current;
      const currentIndex = queueIndexRef.current;

      console.log('[PlayerContext] playNextTrackInternal - repeat:', currentRepeat, 'index:', currentIndex, 'queue:', currentQueue.length);

      if (currentRepeat === 'one') {
        // Repeat current track
        if (soundRef.current) {
          await soundRef.current.setPositionAsync(0);
          await soundRef.current.playAsync();
        }
      } else if (currentIndex < currentQueue.length - 1) {
        // Play next track in queue
        const nextIndex = currentIndex + 1;
        const nextTrack = currentQueue[nextIndex];
        if (nextTrack) {
          console.log('[PlayerContext] Auto-advancing to next track:', nextTrack.title);
          queueIndexRef.current = nextIndex;
          setQueueIndex(nextIndex);
          await loadAndPlayTrack(nextTrack);
        }
      } else if (currentRepeat === 'all' && currentQueue.length > 0) {
        // Loop back to start of queue
        const firstTrack = currentQueue[0];
        console.log('[PlayerContext] Looping to start:', firstTrack.title);
        queueIndexRef.current = 0;
        setQueueIndex(0);
        await loadAndPlayTrack(firstTrack);
      } else if (autoPlayRef.current) {
        // Fetch more songs for continuous play
        console.log('[PlayerContext] Fetching more songs...');
        const moreSongs = await fetchMoreSongs();
        if (moreSongs.length > 0) {
          queueRef.current = moreSongs;
          queueIndexRef.current = 0;
          setQueue(moreSongs);
          setQueueIndex(0);
          await loadAndPlayTrack(moreSongs[0]);
        } else {
          setIsPlaying(false);
          isPlayingRef.current = false;
        }
      } else {
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    } catch (error) {
      console.error('[PlayerContext] Error in playNextTrackInternal:', error);
    } finally {
      // Reset the lock after a short delay
      setTimeout(() => {
        isHandlingTrackEndRef.current = false;
      }, 1000);
    }
  };

  // Status update handler - still useful for foreground updates
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error('[PlayerContext] Playback error:', status.error);
      }
      return;
    }

    // Update UI state
    setPosition(status.positionMillis / 1000);
    setDuration(status.durationMillis / 1000 || 0);
    durationRef.current = status.durationMillis / 1000 || 0;
    setIsPlaying(status.isPlaying);
    isPlayingRef.current = status.isPlaying;
    setIsLoading(status.isBuffering);

    // Handle track end - backup to polling
    if (status.didJustFinish && !status.isLooping) {
      console.log('[PlayerContext] onPlaybackStatusUpdate: Track finished');
      playNextTrackInternal();
    }
  }, []);

  // Core function to load and play a track - handles the actual audio loading
  const loadAndPlayTrack = async (track) => {
    try {
      console.log('[PlayerContext] loadAndPlayTrack:', track.title, 'id:', track.song_id);

      // Stop any external audio first
      if (stopExternalAudioCallback) {
        try {
          await stopExternalAudioCallback();
        } catch (e) {
          console.log('[PlayerContext] Error stopping external audio:', e);
        }
      }

      // Unload previous sound completely
      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.log('[PlayerContext] Error unloading previous sound:', e);
        }
        soundRef.current = null;
      }

      const audioUrl = getAudioUrl(track.audio_url);
      if (!audioUrl) {
        console.error('[PlayerContext] No audio URL for track:', track.title);
        return false;
      }

      console.log('[PlayerContext] Loading audio from:', audioUrl);

      // Create and play sound with frequent progress updates
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true, 
          progressUpdateIntervalMillis: 500,
        },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      currentTrackIdRef.current = track.song_id;
      setCurrentTrack(track);
      setIsLoading(false);
      setIsPlaying(true);
      isPlayingRef.current = true;

      // Ensure polling is running
      if (!pollingIntervalRef.current) {
        startBackgroundPolling();
      }

      // Track play in backend (non-blocking)
      playerAPI.trackPlay(track.song_id).catch(() => {});

      return true;
    } catch (error) {
      console.error('[PlayerContext] Error in loadAndPlayTrack:', error);
      return false;
    }
  };

  // Main entry point for playing tracks - WITH LOCK to prevent simultaneous playback
  const playTrack = async (track, trackList = null, startIndex = 0) => {
    // CRITICAL: Prevent multiple simultaneous play calls
    if (playLockRef.current) {
      console.log('[PlayerContext] Play locked, ignoring duplicate call for:', track.title);
      return;
    }

    // If same track is already playing, just toggle play/pause
    if (currentTrackIdRef.current === track.song_id && soundRef.current) {
      console.log('[PlayerContext] Same track requested, toggling play');
      await togglePlay();
      return;
    }

    playLockRef.current = true;
    setIsLoading(true);

    try {
      console.log('[PlayerContext] playTrack:', track.title);

      // Update queue if provided
      if (trackList) {
        queueRef.current = trackList;
        queueIndexRef.current = startIndex;
        setQueue(trackList);
        setQueueIndex(startIndex);
      }

      // Load and play the track
      const success = await loadAndPlayTrack(track);

      if (!success && queueRef.current.length > queueIndexRef.current + 1) {
        // Try next track on error
        console.log('[PlayerContext] Playback failed, trying next track');
        const nextIndex = queueIndexRef.current + 1;
        queueIndexRef.current = nextIndex;
        setQueueIndex(nextIndex);
        await loadAndPlayTrack(queueRef.current[nextIndex]);
      }
    } catch (error) {
      console.error('[PlayerContext] Error in playTrack:', error);
    } finally {
      setIsLoading(false);
      // Release lock after a short delay to prevent rapid double-taps
      setTimeout(() => {
        playLockRef.current = false;
      }, 300);
    }
  };

  // Play track at specific index
  const playTrackAtIndex = async (index) => {
    const track = queueRef.current[index];
    if (track) {
      queueIndexRef.current = index;
      setQueueIndex(index);
      await loadAndPlayTrack(track);
    }
  };

  // Pause current playback
  const pausePlayback = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        isPlayingRef.current = false;
        return true;
      } catch (e) {
        console.error('[PlayerContext] Error pausing:', e);
        return false;
      }
    }
    return false;
  };

  // Resume playback
  const resumePlayback = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.playAsync();
        setIsPlaying(true);
        isPlayingRef.current = true;
      } catch (e) {
        console.error('[PlayerContext] Error resuming:', e);
      }
    }
  };

  // Toggle play/pause
  const togglePlay = async () => {
    if (!soundRef.current) return;

    try {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
          isPlayingRef.current = false;
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
          isPlayingRef.current = true;
        }
      }
    } catch (e) {
      console.error('[PlayerContext] Error toggling play:', e);
    }
  };

  // Seek to position
  const seekTo = async (seconds) => {
    if (soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(seconds * 1000);
      } catch (e) {
        console.error('[PlayerContext] Error seeking:', e);
      }
    }
  };

  // Skip to next track
  const skipNext = async () => {
    if (playLockRef.current) return;
    playLockRef.current = true;

    try {
      const currentQueue = queueRef.current;
      const currentIndex = queueIndexRef.current;
      const nextIndex = currentIndex + 1;

      console.log('[PlayerContext] skipNext - current:', currentIndex, 'next:', nextIndex, 'queue:', currentQueue.length);

      if (nextIndex < currentQueue.length) {
        await playTrackAtIndex(nextIndex);
      } else if (repeatRef.current === 'all' && currentQueue.length > 0) {
        await playTrackAtIndex(0);
      } else if (autoPlayRef.current) {
        const moreSongs = await fetchMoreSongs();
        if (moreSongs.length > 0) {
          queueRef.current = moreSongs;
          queueIndexRef.current = 0;
          setQueue(moreSongs);
          setQueueIndex(0);
          await loadAndPlayTrack(moreSongs[0]);
        }
      }
    } finally {
      setTimeout(() => { playLockRef.current = false; }, 300);
    }
  };

  // Skip to previous track
  const skipPrevious = async () => {
    if (playLockRef.current) return;
    playLockRef.current = true;

    try {
      const currentIndex = queueIndexRef.current;

      if (position > 3) {
        await seekTo(0);
      } else if (currentIndex > 0) {
        await playTrackAtIndex(currentIndex - 1);
      }
    } finally {
      setTimeout(() => { playLockRef.current = false; }, 300);
    }
  };

  // Toggle shuffle
  const toggleShuffle = () => {
    setShuffle(!shuffle);
    if (!shuffle && queue.length > 1) {
      const current = queue[queueIndex];
      const rest = queue.filter((_, i) => i !== queueIndex);
      const shuffled = rest.sort(() => Math.random() - 0.5);
      const newQueue = [current, ...shuffled];
      queueRef.current = newQueue;
      setQueue(newQueue);
      queueIndexRef.current = 0;
      setQueueIndex(0);
    }
  };

  // Cycle repeat mode
  const cycleRepeat = () => {
    const modes = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeat);
    const newRepeat = modes[(currentIndex + 1) % modes.length];
    repeatRef.current = newRepeat;
    setRepeat(newRepeat);
  };

  // Toggle like
  const toggleLike = () => {
    setIsLiked(!isLiked);
  };

  // Toggle auto play
  const toggleAutoPlay = () => {
    const newValue = !autoPlayEnabled;
    autoPlayRef.current = newValue;
    setAutoPlayEnabled(newValue);
  };

  const value = {
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
    autoPlayEnabled,
    // Actions
    playTrack,
    togglePlay,
    seekTo,
    skipNext,
    skipPrevious,
    toggleShuffle,
    cycleRepeat,
    toggleLike,
    toggleAutoPlay,
    setQueue,
    pausePlayback,
    resumePlayback,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};
