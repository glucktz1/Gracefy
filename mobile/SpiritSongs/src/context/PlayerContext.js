/**
 * PlayerContext - Improved expo-av implementation for background playback
 * 
 * Strategy for background auto-next:
 * 1. Configure audio for background playback with staysActiveInBackground
 * 2. Use setOnPlaybackStatusUpdate with robust track end detection
 * 3. Keep a persistent notification to prevent Android from killing the service
 * 4. Use periodic timer as fallback for track end detection
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getAudioUrl, getImageUrl, playerAPI } from '../services/api';

const PlayerContext = createContext(null);

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

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
  // State
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

  // Refs
  const soundRef = useRef(null);
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const repeatRef = useRef('all');
  const autoPlayRef = useRef(true);
  const currentTrackRef = useRef(null);
  const playLockRef = useRef(false);
  const isHandlingTrackEndRef = useRef(false);
  
  // Tracking refs
  const playStartTimeRef = useRef(null);
  const playTrackedRef = useRef(false);
  const playTrackingTimerRef = useRef(null);
  const notificationIdRef = useRef(null);
  
  // Stream tracking
  const deviceIdRef = useRef(`${Platform.OS}_${Math.random().toString(36).substring(2, 10)}`);
  const currentStreamIdRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  
  // Position check timer for background fallback
  const positionCheckIntervalRef = useRef(null);
  const lastPositionRef = useRef(0);
  const stuckCountRef = useRef(0);

  // Sync refs with state
  useEffect(() => { 
    queueRef.current = queue; 
  }, [queue]);
  
  useEffect(() => { 
    queueIndexRef.current = queueIndex;
  }, [queueIndex]);
  
  useEffect(() => { 
    repeatRef.current = repeat;
  }, [repeat]);
  
  useEffect(() => { 
    autoPlayRef.current = autoPlayEnabled;
  }, [autoPlayEnabled]);
  
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Configure audio mode
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
      console.log('[Player] Audio mode configured');
    } catch (e) {
      console.error('[Player] Audio mode error:', e);
    }
  };

  // Show notification for lock screen
  const showMediaNotification = async (track) => {
    if (!track) return;
    
    try {
      if (notificationIdRef.current) {
        await Notifications.dismissNotificationAsync(notificationIdRef.current);
      }

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') return;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('media-playback', {
          name: 'Inacheza Sasa',
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          vibrationPattern: null,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `🎵 ${track.title}`,
          body: track.artist_name || 'Gracefy',
          data: { songId: track.song_id },
          sound: false,
          sticky: true,
          autoDismiss: false,
        },
        trigger: null,
      });

      notificationIdRef.current = notificationId;
    } catch (e) {
      console.error('[Player] Notification error:', e);
    }
  };

  const dismissNotification = async () => {
    if (notificationIdRef.current) {
      try {
        await Notifications.dismissNotificationAsync(notificationIdRef.current);
        notificationIdRef.current = null;
      } catch (e) {}
    }
  };

  // Initialize
  useEffect(() => {
    configureAudioMode();

    const subscription = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        await configureAudioMode();
      }
    });

    return () => {
      subscription?.remove();
      dismissNotification();
      stopPositionCheck();
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
      if (playTrackingTimerRef.current) {
        clearTimeout(playTrackingTimerRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  // Start position check timer (fallback for background track end detection)
  const startPositionCheck = () => {
    stopPositionCheck();
    
    positionCheckIntervalRef.current = setInterval(async () => {
      if (!soundRef.current) return;
      
      try {
        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;
        
        const currentPos = status.positionMillis || 0;
        const totalDur = status.durationMillis || 0;
        
        // Check if track has ended (position at end and not playing)
        if (totalDur > 0 && currentPos >= totalDur - 1000 && !status.isPlaying) {
          console.log('[Player] Position check detected track end');
          handleTrackEnd();
          return;
        }
        
        // Check if stuck at same position while supposedly playing
        if (status.isPlaying && currentPos === lastPositionRef.current) {
          stuckCountRef.current++;
          if (stuckCountRef.current >= 3) {
            console.log('[Player] Position check detected stuck playback');
            // Try to resume or skip
            try {
              await soundRef.current.playAsync();
            } catch (e) {
              handleTrackEnd();
            }
            stuckCountRef.current = 0;
          }
        } else {
          stuckCountRef.current = 0;
        }
        
        lastPositionRef.current = currentPos;
      } catch (e) {
        // Ignore errors
      }
    }, 2000); // Check every 2 seconds
  };
  
  const stopPositionCheck = () => {
    if (positionCheckIntervalRef.current) {
      clearInterval(positionCheckIntervalRef.current);
      positionCheckIntervalRef.current = null;
    }
  };

  // Play tracking
  const startPlayTracking = (songId) => {
    if (playTrackingTimerRef.current) {
      clearTimeout(playTrackingTimerRef.current);
    }
    playStartTimeRef.current = Date.now();
    playTrackedRef.current = false;

    playTrackingTimerRef.current = setTimeout(async () => {
      if (playStartTimeRef.current && !playTrackedRef.current) {
        playTrackedRef.current = true;
        try {
          await playerAPI.trackPlay(songId, {
            duration: 45,
            platform: Platform.OS
          });
          console.log('[Player] Play tracked:', songId);
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
        
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        heartbeatIntervalRef.current = setInterval(async () => {
          if (currentStreamIdRef.current) {
            try {
              await playerAPI.heartbeat(currentStreamIdRef.current, Math.floor(position / 1000));
            } catch (e) {}
          }
        }, 30000);
      }
    } catch (e) {}
  };

  const endCurrentStream = async () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
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

  // CRITICAL: Handle track end for auto-next
  const handleTrackEnd = useCallback(async () => {
    if (isHandlingTrackEndRef.current) return;
    
    isHandlingTrackEndRef.current = true;
    console.log('[Player] ===== TRACK ENDED =====');

    try {
      if (!autoPlayRef.current) {
        setIsPlaying(false);
        isHandlingTrackEndRef.current = false;
        return;
      }

      const currentQueue = queueRef.current;
      const currentIdx = queueIndexRef.current;
      const repeatMode = repeatRef.current;

      let nextIndex = currentIdx + 1;
      
      if (nextIndex >= currentQueue.length) {
        if (repeatMode === 'all' && currentQueue.length > 0) {
          nextIndex = 0;
        } else if (repeatMode === 'one') {
          nextIndex = currentIdx;
        } else {
          setIsPlaying(false);
          isHandlingTrackEndRef.current = false;
          return;
        }
      }

      const nextTrack = currentQueue[nextIndex];
      if (nextTrack) {
        console.log('[Player] Auto-next:', nextTrack.title);
        setQueueIndex(nextIndex);
        queueIndexRef.current = nextIndex;
        await loadAndPlayTrack(nextTrack, true);
      }
    } catch (e) {
      console.error('[Player] Track end error:', e);
      setIsPlaying(false);
    } finally {
      setTimeout(() => {
        isHandlingTrackEndRef.current = false;
      }, 500);
    }
  }, []);

  // Playback status callback
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error('[Player] Error:', status.error);
        setIsPlaying(false);
        setIsLoading(false);
      }
      return;
    }

    setPosition(status.positionMillis || 0);
    setDuration(status.durationMillis || 0);
    setIsPlaying(status.isPlaying);
    setIsLoading(status.isBuffering);

    // CRITICAL: Detect track end
    if (status.didJustFinish && !status.isLooping) {
      console.log('[Player] didJustFinish triggered');
      handleTrackEnd();
    }
  }, [handleTrackEnd]);

  // Load and play track
  const loadAndPlayTrack = async (track, showNotification = true) => {
    if (!track) return;

    if (stopExternalAudioCallback) {
      try { await stopExternalAudioCallback(); } catch (e) {}
    }

    await endCurrentStream();
    stopPositionCheck();

    console.log('[Player] Loading:', track.title);
    setIsLoading(true);
    setCurrentTrack(track);
    currentTrackRef.current = track;

    try {
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch (e) {}
        soundRef.current = null;
      }

      const audioUrl = getAudioUrl(track.audio_url || track.file_path);
      if (!audioUrl) throw new Error('No audio URL');

      console.log('[Player] URL:', audioUrl.substring(0, 60));

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true,
          progressUpdateIntervalMillis: 500,
        },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setIsPlaying(true);
      setIsLoading(false);

      startPlayTracking(track.song_id);
      startStreamTracking(track);
      startPositionCheck();

      if (showNotification) {
        showMediaNotification(track);
      }

      try {
        const res = await playerAPI.checkLiked(track.song_id);
        setIsLiked(res?.data?.liked || false);
      } catch (e) {
        setIsLiked(false);
      }

    } catch (e) {
      console.error('[Player] Load error:', e);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  // Play track
  const playTrack = async (track, newQueue = null, startIndex = null) => {
    if (playLockRef.current) return;
    playLockRef.current = true;

    try {
      if (newQueue && Array.isArray(newQueue)) {
        setQueue(newQueue);
        queueRef.current = newQueue;
        
        const idx = startIndex !== null ? startIndex : newQueue.findIndex(s => s.song_id === track.song_id);
        const finalIndex = idx >= 0 ? idx : 0;
        setQueueIndex(finalIndex);
        queueIndexRef.current = finalIndex;
      }

      await loadAndPlayTrack(track);
    } finally {
      setTimeout(() => { playLockRef.current = false; }, 300);
    }
  };

  // Toggle play/pause
  const togglePlay = async () => {
    if (!soundRef.current) {
      if (currentTrackRef.current) {
        await loadAndPlayTrack(currentTrackRef.current);
      }
      return;
    }

    try {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          if (status.positionMillis >= (status.durationMillis || 1) - 500) {
            await soundRef.current.setPositionAsync(0);
          }
          await soundRef.current.playAsync();
          setIsPlaying(true);
          
          if (currentTrackRef.current) {
            showMediaNotification(currentTrackRef.current);
          }
        }
      } else {
        if (currentTrackRef.current) {
          await loadAndPlayTrack(currentTrackRef.current);
        }
      }
    } catch (e) {
      console.error('[Player] Toggle error:', e);
      if (currentTrackRef.current) {
        await loadAndPlayTrack(currentTrackRef.current);
      }
    }
  };

  // Skip next
  const skipNext = async () => {
    const currentQueue = queueRef.current;
    const currentIdx = queueIndexRef.current;
    
    if (currentQueue.length === 0) return;

    let nextIndex = currentIdx + 1;
    if (nextIndex >= currentQueue.length) nextIndex = 0;

    const nextTrack = currentQueue[nextIndex];
    if (nextTrack) {
      setQueueIndex(nextIndex);
      queueIndexRef.current = nextIndex;
      await loadAndPlayTrack(nextTrack);
    }
  };

  // Skip previous
  const skipPrevious = async () => {
    const currentQueue = queueRef.current;
    const currentIdx = queueIndexRef.current;
    
    if (currentQueue.length === 0) return;

    if (position > 3000 && soundRef.current) {
      await soundRef.current.setPositionAsync(0);
      return;
    }

    let prevIndex = currentIdx - 1;
    if (prevIndex < 0) prevIndex = currentQueue.length - 1;

    const prevTrack = currentQueue[prevIndex];
    if (prevTrack) {
      setQueueIndex(prevIndex);
      queueIndexRef.current = prevIndex;
      await loadAndPlayTrack(prevTrack);
    }
  };

  // Seek
  const seekTo = async (positionMs) => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.setPositionAsync(positionMs);
      setPosition(positionMs);
    } catch (e) {}
  };

  // Toggle shuffle
  const toggleShuffle = () => setShuffle(prev => !prev);

  // Toggle repeat
  const toggleRepeat = () => {
    setRepeat(prev => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      repeatRef.current = next;
      return next;
    });
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
    } catch (e) {}
  };

  // Queue management
  const addToQueue = (track) => {
    if (track) setQueue(prev => [...prev, track]);
  };

  const playQueue = async (newQueue, index = 0) => {
    if (!newQueue?.length) return;
    setQueue(newQueue);
    queueRef.current = newQueue;
    setQueueIndex(index);
    queueIndexRef.current = index;
    await loadAndPlayTrack(newQueue[index]);
  };

  const clearQueue = () => {
    setQueue([]);
    queueRef.current = [];
    setQueueIndex(0);
    queueIndexRef.current = 0;
  };

  // Auto play
  const setAutoPlay = (enabled) => {
    setAutoPlayEnabled(enabled);
    autoPlayRef.current = enabled;
  };

  // Stop
  const stopPlayback = async () => {
    await endCurrentStream();
    stopPositionCheck();
    
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
    
    setIsPlaying(false);
    setCurrentTrack(null);
    setPosition(0);
    setDuration(0);
    
    dismissNotification();
    
    if (playTrackingTimerRef.current) {
      clearTimeout(playTrackingTimerRef.current);
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
