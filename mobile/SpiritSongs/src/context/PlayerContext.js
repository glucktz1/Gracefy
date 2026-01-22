import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getAudioUrl, playerAPI } from '../services/api';

const PlayerContext = createContext(null);

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
  const [repeat, setRepeat] = useState('off'); // 'off', 'all', 'one'
  const [isLiked, setIsLiked] = useState(false);

  // Refs
  const soundRef = useRef(null);
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const repeatRef = useRef('off');

  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

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
      } catch (e) {
        console.error('Error setting audio mode:', e);
      }
    };
    setup();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Status update handler
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis / 1000 || 0);
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);

      if (status.didJustFinish && !status.isLooping) {
        handleTrackEnd();
      }
    }
  }, []);

  // Handle track end
  const handleTrackEnd = useCallback(async () => {
    const currentRepeat = repeatRef.current;
    const currentQueue = queueRef.current;
    const currentIndex = queueIndexRef.current;

    if (currentRepeat === 'one') {
      // Repeat current track
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
    } else if (currentIndex < currentQueue.length - 1) {
      // Play next track
      playTrackAtIndex(currentIndex + 1);
    } else if (currentRepeat === 'all' && currentQueue.length > 0) {
      // Loop back to start
      playTrackAtIndex(0);
    } else {
      // End of queue
      setIsPlaying(false);
    }
  }, []);

  // Play a track
  const playTrack = async (track, trackList = null, startIndex = 0) => {
    try {
      setIsLoading(true);

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
    // Actions
    playTrack,
    togglePlay,
    seekTo,
    skipNext,
    skipPrevious,
    toggleShuffle,
    cycleRepeat,
    toggleLike,
    setQueue,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};
