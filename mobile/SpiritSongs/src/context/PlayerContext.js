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

  // Status update handler
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis / 1000 || 0);
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);

      if (status.didJustFinish && !status.isLooping) {
        console.log('[PlayerContext] Track finished, handling track end');
        handleTrackEnd();
      }
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

  // Handle track end - with continuous play support
  const handleTrackEnd = useCallback(async () => {
    const currentRepeat = repeatRef.current;
    const currentQueue = queueRef.current;
    const currentIndex = queueIndexRef.current;
    const autoPlay = autoPlayRef.current;

    console.log('[PlayerContext] handleTrackEnd - repeat:', currentRepeat, 'index:', currentIndex, 'queue length:', currentQueue.length);

    if (currentRepeat === 'one') {
      // Repeat current track
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
    } else if (currentIndex < currentQueue.length - 1) {
      // Play next track in queue
      playTrackAtIndex(currentIndex + 1);
    } else if (currentRepeat === 'all' && currentQueue.length > 0) {
      // Loop back to start of queue
      playTrackAtIndex(0);
    } else if (autoPlay) {
      // Continuous play: fetch more songs and keep playing
      console.log('[PlayerContext] Queue ended, fetching more songs for continuous play');
      const moreSongs = await fetchMoreSongs();
      if (moreSongs.length > 0) {
        setQueue(moreSongs);
        setQueueIndex(0);
        await playTrack(moreSongs[0]);
      } else {
        setIsPlaying(false);
      }
    } else {
      // End of queue, no auto-play
      setIsPlaying(false);
    }
  }, []);

  // Play a track
  const playTrack = async (track, trackList = null, startIndex = 0) => {
    try {
      setIsLoading(true);
      console.log('[PlayerContext] Playing track:', track.title);

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
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Set queue if provided
      if (trackList) {
        setQueue(trackList);
        setQueueIndex(startIndex);
      }

      const audioUrl = getAudioUrl(track.audio_url);
      if (!audioUrl) {
        console.error('No audio URL for track');
        setIsLoading(false);
        return;
      }

      // Create and play sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setCurrentTrack(track);
      setIsLoading(false);

      // Track play in backend
      try {
        await playerAPI.trackPlay(track.song_id);
      } catch (e) {
        // Ignore tracking errors
      }
    } catch (error) {
      console.error('Error playing track:', error);
      setIsLoading(false);
      // Try next track on error
      if (queueRef.current.length > queueIndexRef.current + 1) {
        console.log('[PlayerContext] Playback error, trying next track');
        playTrackAtIndex(queueIndexRef.current + 1);
      }
    }
  };

  // Play track at index
  const playTrackAtIndex = async (index) => {
    const track = queueRef.current[index];
    if (track) {
      setQueueIndex(index);
      await playTrack(track);
    }
  };

  // Pause current playback (for external use like Bible TTS)
  const pausePlayback = async () => {
    if (soundRef.current && isPlaying) {
      await soundRef.current.pauseAsync();
      return true;
    }
    return false;
  };

  // Resume playback
  const resumePlayback = async () => {
    if (soundRef.current && !isPlaying) {
      await soundRef.current.playAsync();
    }
  };

  // Toggle play/pause
  const togglePlay = async () => {
    if (!soundRef.current) return;

    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
  };

  // Seek to position
  const seekTo = async (seconds) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(seconds * 1000);
    }
  };

  // Skip to next
  const skipNext = async () => {
    const nextIndex = queueIndex + 1;
    if (nextIndex < queue.length) {
      await playTrackAtIndex(nextIndex);
    } else if (repeat === 'all' && queue.length > 0) {
      await playTrackAtIndex(0);
    } else if (autoPlayEnabled) {
      // Fetch more songs
      const moreSongs = await fetchMoreSongs();
      if (moreSongs.length > 0) {
        setQueue(moreSongs);
        setQueueIndex(0);
        await playTrack(moreSongs[0]);
      }
    }
  };

  // Skip to previous
  const skipPrevious = async () => {
    if (position > 3) {
      // If more than 3 seconds in, restart track
      await seekTo(0);
    } else if (queueIndex > 0) {
      await playTrackAtIndex(queueIndex - 1);
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
