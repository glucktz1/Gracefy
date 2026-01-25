import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
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
  const [isLoading, setIsLoading] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('all');
  const [isLiked, setIsLiked] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  // Use expo-audio player hook - this handles background audio natively
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  // Refs for background-safe access
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const repeatRef = useRef('all');
  const autoPlayRef = useRef(true);
  
  // Lock to prevent simultaneous playback
  const playLockRef = useRef(false);
  const currentTrackIdRef = useRef(null);
  const isHandlingTrackEndRef = useRef(false);

  // Derived state from status
  const isPlaying = status?.playing || false;
  const position = (status?.currentTime || 0);
  const duration = (status?.duration || 0);

  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { autoPlayRef.current = autoPlayEnabled; }, [autoPlayEnabled]);

  // Configure audio mode for background playback
  useEffect(() => {
    const configureAudio = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          shouldRouteThroughEarpiece: false,
        });
        console.log('[PlayerContext] expo-audio configured for background playback');
      } catch (e) {
        console.error('[PlayerContext] Error configuring audio mode:', e);
      }
    };
    
    configureAudio();

    // Re-configure when app becomes active
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        await configureAudio();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Handle track completion - CRITICAL for continuous play
  useEffect(() => {
    if (status?.didJustFinish && !isHandlingTrackEndRef.current) {
      console.log('[PlayerContext] Track finished, playing next...');
      isHandlingTrackEndRef.current = true;
      playNextTrack().finally(() => {
        isHandlingTrackEndRef.current = false;
      });
    }
  }, [status?.didJustFinish]);

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

  // Play next track in queue
  const playNextTrack = async () => {
    const currentRepeat = repeatRef.current;
    const currentQueue = queueRef.current;
    const currentIndex = queueIndexRef.current;

    console.log('[PlayerContext] playNextTrack - repeat:', currentRepeat, 'index:', currentIndex, 'queue:', currentQueue.length);

    try {
      if (currentRepeat === 'one') {
        // Repeat current track
        player.seekTo(0);
        player.play();
      } else if (currentIndex < currentQueue.length - 1) {
        // Play next track
        const nextIndex = currentIndex + 1;
        const nextTrack = currentQueue[nextIndex];
        if (nextTrack) {
          queueIndexRef.current = nextIndex;
          setQueueIndex(nextIndex);
          await loadAndPlayTrack(nextTrack);
        }
      } else if (currentRepeat === 'all' && currentQueue.length > 0) {
        // Loop to start
        queueIndexRef.current = 0;
        setQueueIndex(0);
        await loadAndPlayTrack(currentQueue[0]);
      } else if (autoPlayRef.current) {
        // Fetch more songs
        const moreSongs = await fetchMoreSongs();
        if (moreSongs.length > 0) {
          queueRef.current = moreSongs;
          queueIndexRef.current = 0;
          setQueue(moreSongs);
          setQueueIndex(0);
          await loadAndPlayTrack(moreSongs[0]);
        }
      }
    } catch (error) {
      console.error('[PlayerContext] Error in playNextTrack:', error);
    }
  };

  // Core function to load and play a track
  const loadAndPlayTrack = async (track) => {
    try {
      console.log('[PlayerContext] loadAndPlayTrack:', track.title);

      // Stop external audio first
      if (stopExternalAudioCallback) {
        try {
          await stopExternalAudioCallback();
        } catch (e) {
          console.log('[PlayerContext] Error stopping external audio:', e);
        }
      }

      const audioUrl = getAudioUrl(track.audio_url);
      if (!audioUrl) {
        console.error('[PlayerContext] No audio URL for track:', track.title);
        return false;
      }

      console.log('[PlayerContext] Loading audio from:', audioUrl);

      // Replace the audio source - expo-audio handles this cleanly
      player.replace({ uri: audioUrl });
      player.play();

      currentTrackIdRef.current = track.song_id;
      setCurrentTrack(track);
      setIsLoading(false);

      // Track play in backend
      playerAPI.trackPlay(track.song_id).catch(() => {});

      return true;
    } catch (error) {
      console.error('[PlayerContext] Error in loadAndPlayTrack:', error);
      return false;
    }
  };

  // Main entry point for playing tracks
  const playTrack = async (track, trackList = null, startIndex = 0) => {
    // Prevent simultaneous plays
    if (playLockRef.current) {
      console.log('[PlayerContext] Play locked, ignoring:', track.title);
      return;
    }

    // Same track - toggle play/pause
    if (currentTrackIdRef.current === track.song_id) {
      togglePlay();
      return;
    }

    playLockRef.current = true;
    setIsLoading(true);

    try {
      // Update queue if provided
      if (trackList) {
        queueRef.current = trackList;
        queueIndexRef.current = startIndex;
        setQueue(trackList);
        setQueueIndex(startIndex);
      }

      await loadAndPlayTrack(track);
    } catch (error) {
      console.error('[PlayerContext] Error in playTrack:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => { playLockRef.current = false; }, 300);
    }
  };

  // Toggle play/pause
  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  // Seek to position
  const seekTo = (seconds) => {
    player.seekTo(seconds);
  };

  // Skip to next
  const skipNext = async () => {
    if (playLockRef.current) return;
    playLockRef.current = true;

    try {
      const currentQueue = queueRef.current;
      const currentIndex = queueIndexRef.current;
      const nextIndex = currentIndex + 1;

      if (nextIndex < currentQueue.length) {
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

  // Skip to previous
  const skipPrevious = async () => {
    if (playLockRef.current) return;
    playLockRef.current = true;

    try {
      if (position > 3) {
        seekTo(0);
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

  // Pause playback (for external use)
  const pausePlayback = async () => {
    player.pause();
    return true;
  };

  // Resume playback
  const resumePlayback = async () => {
    player.play();
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
    const idx = modes.indexOf(repeat);
    const newRepeat = modes[(idx + 1) % modes.length];
    repeatRef.current = newRepeat;
    setRepeat(newRepeat);
  };

  // Toggle like
  const toggleLike = () => {
    setIsLiked(!isLiked);
  };

  // Toggle auto play
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
