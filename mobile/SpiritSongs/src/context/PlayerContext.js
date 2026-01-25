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
  
  // Lock and tracking refs
  const playLockRef = useRef(false);
  const currentTrackIdRef = useRef(null);
  const isHandlingTrackEndRef = useRef(false);
  
  // CRITICAL: Track end detection for background - using polling as backup
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const lastPositionCheckRef = useRef(0);
  const trackEndCheckIntervalRef = useRef(null);

  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { autoPlayRef.current = autoPlayEnabled; }, [autoPlayEnabled]);

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
      console.log('[PlayerContext] Audio mode configured for background');
    } catch (e) {
      console.error('[PlayerContext] Error setting audio mode:', e);
    }
  };

  // Initialize
  useEffect(() => {
    configureAudioMode();

    const subscription = AppState.addEventListener('change', async (state) => {
      console.log('[PlayerContext] App state:', state);
      if (state === 'active') {
        await configureAudioMode();
      }
    });

    return () => {
      subscription?.remove();
      stopTrackEndChecker();
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  // BACKGROUND TRACK END DETECTION
  // Since didJustFinish doesn't fire reliably in background on Android,
  // we use a polling mechanism to check if track has ended
  const startTrackEndChecker = () => {
    stopTrackEndChecker();
    
    trackEndCheckIntervalRef.current = setInterval(async () => {
      if (!soundRef.current) return;
      
      try {
        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;
        
        positionRef.current = status.positionMillis / 1000;
        durationRef.current = status.durationMillis / 1000;
        
        // Check if track has essentially ended (within 0.5 seconds of end)
        const isNearEnd = durationRef.current > 0 && 
                          positionRef.current >= durationRef.current - 0.5;
        
        // Also check if playback stopped naturally (not paused by user)
        const hasFinished = status.didJustFinish || 
                           (isNearEnd && !status.isPlaying && !status.isBuffering);
        
        if (hasFinished && !isHandlingTrackEndRef.current) {
          console.log('[PlayerContext] Track end detected via polling');
          handleTrackEnd();
        }
      } catch (e) {
        // Ignore errors during status check
      }
    }, 1000); // Check every second
  };

  const stopTrackEndChecker = () => {
    if (trackEndCheckIntervalRef.current) {
      clearInterval(trackEndCheckIntervalRef.current);
      trackEndCheckIntervalRef.current = null;
    }
  };

  // Handle track end - plays next song
  const handleTrackEnd = async () => {
    if (isHandlingTrackEndRef.current) {
      console.log('[PlayerContext] Already handling track end');
      return;
    }
    
    isHandlingTrackEndRef.current = true;
    console.log('[PlayerContext] handleTrackEnd started');

    try {
      const currentRepeat = repeatRef.current;
      const currentQueue = queueRef.current;
      const currentIndex = queueIndexRef.current;

      console.log('[PlayerContext] Track end - repeat:', currentRepeat, 'index:', currentIndex, '/', currentQueue.length);

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
        console.log('[PlayerContext] Playing next track:', nextTrack?.title);
        queueIndexRef.current = nextIndex;
        setQueueIndex(nextIndex);
        await loadAndPlayTrack(nextTrack);
      } else if (currentRepeat === 'all' && currentQueue.length > 0) {
        // Loop back to start
        console.log('[PlayerContext] Looping to start of queue');
        queueIndexRef.current = 0;
        setQueueIndex(0);
        await loadAndPlayTrack(currentQueue[0]);
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
          stopTrackEndChecker();
        }
      } else {
        setIsPlaying(false);
        stopTrackEndChecker();
      }
    } catch (error) {
      console.error('[PlayerContext] Error in handleTrackEnd:', error);
    } finally {
      // Reset the flag after a short delay
      setTimeout(() => {
        isHandlingTrackEndRef.current = false;
      }, 500);
    }
  };

  // Fetch more songs for continuous play
  const fetchMoreSongs = async () => {
    try {
      // Try to get songs from the same category as current track
      const currentCategory = currentTrack?.category || currentTrack?.genre;
      let songs = [];
      
      if (currentCategory) {
        try {
          const response = await contentAPI.getSongsByCategory(currentCategory);
          songs = response.data?.songs || [];
        } catch (e) {
          // Fallback to all songs
        }
      }
      
      if (songs.length === 0) {
        const response = await contentAPI.getAllSongs();
        songs = response.data?.songs || [];
      }
      
      if (songs.length > 0) {
        // Filter out recently played and shuffle
        const recentIds = queueRef.current.slice(-10).map(s => s.song_id);
        const filtered = songs.filter(s => !recentIds.includes(s.song_id));
        return (filtered.length > 0 ? filtered : songs)
          .sort(() => Math.random() - 0.5)
          .slice(0, 20);
      }
      return [];
    } catch (error) {
      console.error('[PlayerContext] Error fetching more songs:', error);
      return [];
    }
  };

  // Playback status update callback
  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error('[PlayerContext] Playback error:', status.error);
      }
      return;
    }

    // Update state
    setPosition(status.positionMillis / 1000);
    setDuration(status.durationMillis / 1000 || 0);
    setIsPlaying(status.isPlaying);
    setIsLoading(status.isBuffering);
    
    // Update refs for polling checker
    positionRef.current = status.positionMillis / 1000;
    durationRef.current = status.durationMillis / 1000 || 0;

    // Handle track end via callback (may not fire in background)
    if (status.didJustFinish && !status.isLooping) {
      console.log('[PlayerContext] didJustFinish callback fired');
      handleTrackEnd();
    }
  };

  // Load and play a track
  const loadAndPlayTrack = async (track) => {
    if (!track) {
      console.error('[PlayerContext] No track provided');
      return false;
    }
    
    try {
      console.log('[PlayerContext] loadAndPlayTrack:', track.title);

      // Stop external audio
      if (stopExternalAudioCallback) {
        try {
          await stopExternalAudioCallback();
        } catch (e) {}
      }

      // Unload previous sound
      if (soundRef.current) {
        stopTrackEndChecker();
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (e) {}
        soundRef.current = null;
      }

      const audioUrl = getAudioUrl(track.audio_url);
      if (!audioUrl) {
        console.error('[PlayerContext] No audio URL');
        return false;
      }

      console.log('[PlayerContext] Loading:', audioUrl);

      // Create and play sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true,
          progressUpdateIntervalMillis: 500,
          positionMillis: 0,
        },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      currentTrackIdRef.current = track.song_id;
      setCurrentTrack(track);
      setIsLoading(false);
      setIsPlaying(true);

      // Start background track end checker
      startTrackEndChecker();

      // Track play
      playerAPI.trackPlay(track.song_id).catch(() => {});

      return true;
    } catch (error) {
      console.error('[PlayerContext] Error loading track:', error);
      return false;
    }
  };

  // Main play function
  const playTrack = async (track, trackList = null, startIndex = 0) => {
    if (playLockRef.current) {
      console.log('[PlayerContext] Play locked');
      return;
    }

    // Same track - toggle
    if (currentTrackIdRef.current === track.song_id && soundRef.current) {
      await togglePlay();
      return;
    }

    playLockRef.current = true;
    setIsLoading(true);

    try {
      if (trackList) {
        queueRef.current = trackList;
        queueIndexRef.current = startIndex;
        setQueue(trackList);
        setQueueIndex(startIndex);
      }

      await loadAndPlayTrack(track);
    } finally {
      setIsLoading(false);
      setTimeout(() => { playLockRef.current = false; }, 300);
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
          stopTrackEndChecker();
        } else {
          await soundRef.current.playAsync();
          startTrackEndChecker();
        }
      }
    } catch (e) {
      console.error('[PlayerContext] Toggle error:', e);
    }
  };

  // Seek
  const seekTo = async (seconds) => {
    if (soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(seconds * 1000);
      } catch (e) {}
    }
  };

  // Skip next
  const skipNext = async () => {
    if (playLockRef.current) return;
    playLockRef.current = true;

    try {
      const currentQueue = queueRef.current;
      const currentIndex = queueIndexRef.current;

      if (currentIndex < currentQueue.length - 1) {
        const nextIndex = currentIndex + 1;
        queueIndexRef.current = nextIndex;
        setQueueIndex(nextIndex);
        await loadAndPlayTrack(currentQueue[nextIndex]);
      } else if (repeatRef.current === 'all' && currentQueue.length > 0) {
        queueIndexRef.current = 0;
        setQueueIndex(0);
        await loadAndPlayTrack(currentQueue[0]);
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

  // Skip previous
  const skipPrevious = async () => {
    if (playLockRef.current) return;
    playLockRef.current = true;

    try {
      if (position > 3) {
        await seekTo(0);
      } else if (queueIndexRef.current > 0) {
        const prevIndex = queueIndexRef.current - 1;
        queueIndexRef.current = prevIndex;
        setQueueIndex(prevIndex);
        await loadAndPlayTrack(queueRef.current[prevIndex]);
      }
    } finally {
      setTimeout(() => { playLockRef.current = false; }, 300);
    }
  };

  // Pause (external)
  const pausePlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      stopTrackEndChecker();
      return true;
    }
    return false;
  };

  // Resume
  const resumePlayback = async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync();
      startTrackEndChecker();
    }
  };

  // Shuffle
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

  // Repeat
  const cycleRepeat = () => {
    const modes = ['off', 'all', 'one'];
    const idx = modes.indexOf(repeat);
    const newRepeat = modes[(idx + 1) % modes.length];
    repeatRef.current = newRepeat;
    setRepeat(newRepeat);
  };

  const toggleLike = () => setIsLiked(!isLiked);
  
  const toggleAutoPlay = () => {
    const newVal = !autoPlayEnabled;
    autoPlayRef.current = newVal;
    setAutoPlayEnabled(newVal);
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
    autoPlayEnabled,
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
