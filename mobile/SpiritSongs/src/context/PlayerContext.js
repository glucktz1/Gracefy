import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
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
  const [repeat, setRepeat] = useState('all'); // Default to 'all' for continuous play
  const [isLiked, setIsLiked] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true); // Enable continuous play

  // Refs
  const soundRef = useRef(null);
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const repeatRef = useRef('all');
  const autoPlayRef = useRef(true);

  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { autoPlayRef.current = autoPlayEnabled; }, [autoPlayEnabled]);

  // Configure audio for background playback
  useEffect(() => {
    const setup = async () => {
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
        console.error('Error setting audio mode:', e);
      }
    };
    setup();

    // Handle app state changes for background playback
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Handle app state changes (background/foreground)
  const handleAppStateChange = async (nextAppState) => {
    console.log('[PlayerContext] App state changed to:', nextAppState);
    // Audio should continue playing in background due to staysActiveInBackground: true
    // Re-configure audio mode when coming back to foreground
    if (nextAppState === 'active') {
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
      } catch (e) {
        console.error('Error reconfiguring audio mode:', e);
      }
    }
  };

  // Status update handler - CRITICAL for background playback
  // This must work even when app is in background
  const onPlaybackStatusUpdate = useCallback(async (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis / 1000 || 0);
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);

      // CRITICAL: Handle track end for continuous playback
      if (status.didJustFinish && !status.isLooping) {
        console.log('[PlayerContext] Track finished in background/foreground');
        
        // Use refs directly to avoid stale closure issues in background
        const currentRepeat = repeatRef.current;
        const currentQueue = queueRef.current;
        const currentIndex = queueIndexRef.current;
        
        console.log('[PlayerContext] Background track end - repeat:', currentRepeat, 'index:', currentIndex, 'queue:', currentQueue.length);

        try {
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
              console.log('[PlayerContext] Playing next track:', nextTrack.title);
              queueIndexRef.current = nextIndex;
              setQueueIndex(nextIndex);
              await playTrackInternal(nextTrack);
            }
          } else if (currentRepeat === 'all' && currentQueue.length > 0) {
            // Loop back to start of queue
            const firstTrack = currentQueue[0];
            console.log('[PlayerContext] Looping to start:', firstTrack.title);
            queueIndexRef.current = 0;
            setQueueIndex(0);
            await playTrackInternal(firstTrack);
          } else if (autoPlayRef.current) {
            // Continuous play: fetch more songs
            console.log('[PlayerContext] Fetching more songs for continuous play');
            const moreSongs = await fetchMoreSongs();
            if (moreSongs.length > 0) {
              queueRef.current = moreSongs;
              queueIndexRef.current = 0;
              setQueue(moreSongs);
              setQueueIndex(0);
              await playTrackInternal(moreSongs[0]);
            } else {
              setIsPlaying(false);
            }
          } else {
            setIsPlaying(false);
          }
        } catch (error) {
          console.error('[PlayerContext] Error handling track end:', error);
          // Try to continue playback despite error
          if (currentQueue.length > currentIndex + 1) {
            const nextTrack = currentQueue[currentIndex + 1];
            if (nextTrack) {
              queueIndexRef.current = currentIndex + 1;
              setQueueIndex(currentIndex + 1);
              await playTrackInternal(nextTrack);
            }
          }
        }
      }
    } else if (status.error) {
      console.error('[PlayerContext] Playback error:', status.error);
    }
  }, []);

  // Fetch more songs for continuous play
  const fetchMoreSongs = async () => {
    try {
      const response = await contentAPI.getAllSongs();
      const songs = response.data?.songs || [];
      if (songs.length > 0) {
        // Shuffle and return random songs
        return songs.sort(() => Math.random() - 0.5).slice(0, 20);
      }
      return [];
    } catch (error) {
      console.error('[PlayerContext] Error fetching more songs:', error);
      return [];
    }
  };

  // Internal play function - used for background track advancement
  // This doesn't modify queue, just plays the track
  const playTrackInternal = async (track) => {
    try {
      console.log('[PlayerContext] playTrackInternal:', track.title);

      // Stop any external audio (like Bible TTS) before playing music
      if (stopExternalAudioCallback) {
        try {
          await stopExternalAudioCallback();
        } catch (e) {
          console.log('[PlayerContext] Error stopping external audio:', e);
        }
      }

      // Unload previous sound
      if (soundRef.current) {
        try {
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

      // Create and play sound with background-safe callback
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true, 
          progressUpdateIntervalMillis: 500,
          // Ensure audio continues in background
          staysActiveInBackground: true,
        },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setCurrentTrack(track);
      setIsLoading(false);
      setIsPlaying(true);

      // Track play in backend (non-blocking)
      playerAPI.trackPlay(track.song_id).catch(() => {});
      
      return true;
    } catch (error) {
      console.error('[PlayerContext] Error in playTrackInternal:', error);
      return false;
    }
  };

  // Handle track end - simplified, main logic moved to onPlaybackStatusUpdate
  const handleTrackEnd = useCallback(async () => {
    // This is now handled directly in onPlaybackStatusUpdate for better background support
    console.log('[PlayerContext] handleTrackEnd called (legacy)');
  }, []);

  // Play a track - main entry point for playing tracks
  const playTrack = async (track, trackList = null, startIndex = 0) => {
    try {
      setIsLoading(true);
      console.log('[PlayerContext] Playing track:', track.title);

      // Set queue if provided
      if (trackList) {
        queueRef.current = trackList;
        queueIndexRef.current = startIndex;
        setQueue(trackList);
        setQueueIndex(startIndex);
      }

      // Use internal play function
      const success = await playTrackInternal(track);
      
      if (!success && queueRef.current.length > queueIndexRef.current + 1) {
        // Try next track on error
        console.log('[PlayerContext] Playback error, trying next track');
        const nextIndex = queueIndexRef.current + 1;
        queueIndexRef.current = nextIndex;
        setQueueIndex(nextIndex);
        await playTrackInternal(queueRef.current[nextIndex]);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error playing track:', error);
      setIsLoading(false);
    }
  };

  // Play track at index - uses refs for background safety
  const playTrackAtIndex = async (index) => {
    const track = queueRef.current[index];
    if (track) {
      queueIndexRef.current = index;
      setQueueIndex(index);
      await playTrackInternal(track);
    }
  };

  // Pause current playback (for external use like Bible TTS)
  const pausePlayback = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
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
      } catch (e) {
        console.error('[PlayerContext] Error resuming:', e);
      }
    }
  };

  // Toggle play/pause
  const togglePlay = async () => {
    if (!soundRef.current) return;

    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
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

  // Skip to next - uses refs for background safety
  const skipNext = async () => {
    const currentQueue = queueRef.current;
    const currentIndex = queueIndexRef.current;
    const nextIndex = currentIndex + 1;
    
    console.log('[PlayerContext] skipNext - current:', currentIndex, 'next:', nextIndex, 'queue:', currentQueue.length);
    
    if (nextIndex < currentQueue.length) {
      await playTrackAtIndex(nextIndex);
    } else if (repeatRef.current === 'all' && currentQueue.length > 0) {
      await playTrackAtIndex(0);
    } else if (autoPlayRef.current) {
      // Fetch more songs
      const moreSongs = await fetchMoreSongs();
      if (moreSongs.length > 0) {
        queueRef.current = moreSongs;
        queueIndexRef.current = 0;
        setQueue(moreSongs);
        setQueueIndex(0);
        await playTrackInternal(moreSongs[0]);
      }
    }
  };

  // Skip to previous - uses refs for background safety
  const skipPrevious = async () => {
    const currentIndex = queueIndexRef.current;
    
    if (position > 3) {
      // If more than 3 seconds in, restart track
      await seekTo(0);
    } else if (currentIndex > 0) {
      await playTrackAtIndex(currentIndex - 1);
    }
  };

  // Toggle shuffle
  const toggleShuffle = () => {
    setShuffle(!shuffle);
    if (!shuffle && queue.length > 1) {
      // Shuffle the queue (keeping current track at position 0)
      const current = queue[queueIndex];
      const rest = queue.filter((_, i) => i !== queueIndex);
      const shuffled = rest.sort(() => Math.random() - 0.5);
      setQueue([current, ...shuffled]);
      setQueueIndex(0);
    }
  };

  // Cycle repeat mode
  const cycleRepeat = () => {
    const modes = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeat);
    setRepeat(modes[(currentIndex + 1) % modes.length]);
  };

  // Toggle like
  const toggleLike = () => {
    setIsLiked(!isLiked);
    // TODO: Call API to like/unlike
  };

  // Toggle auto play
  const toggleAutoPlay = () => {
    setAutoPlayEnabled(!autoPlayEnabled);
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
