/**
 * PlayerContext - Optimized expo-av for Background Playback
 * 
 * This implementation follows best practices:
 * 1. Audio mode configured early with staysActiveInBackground
 * 2. DuckOthers for proper audio interruption handling
 * 3. Persistent notification for Android foreground service
 * 4. Background timer for track end detection
 * 5. Proper cleanup and state management
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { getAudioUrl, getImageUrl, playerAPI } from '../services/api';

const PlayerContext = createContext(null);

// Background task name
const AUDIO_BACKGROUND_TASK = 'AUDIO_BACKGROUND_TASK';

// Configure notifications for lock screen
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
  const deviceIdRef = useRef(`${Platform.OS}_${Math.random().toString(36).substr(2, 8)}`);
  const currentStreamIdRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  
  // Background check
  const backgroundCheckRef = useRef(null);

  // Sync refs
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { autoPlayRef.current = autoPlayEnabled; }, [autoPlayEnabled]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

  // ============== AUDIO MODE CONFIGURATION ==============
  // This is CRITICAL - must be called early and with correct settings
  const configureAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        // CRITICAL: Allow background playback
        staysActiveInBackground: true,
        
        // iOS specific
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        
        // Android specific  
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        playThroughEarpieceAndroid: false,
        
        // Recording
        allowsRecordingIOS: false,
      });
      console.log('[Player] Audio mode configured for background playback');
      return true;
    } catch (e) {
      console.error('[Player] Audio mode error:', e);
      return false;
    }
  };

  // ============== NOTIFICATION (LOCK SCREEN) ==============
  const showMediaNotification = async (track) => {
    if (!track) return;
    
    try {
      // Dismiss old notification
      if (notificationIdRef.current) {
        await Notifications.dismissNotificationAsync(notificationIdRef.current);
      }

      // Request permission
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') return;
      }

      // Create channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('music-playback', {
          name: 'Inacheza Sasa',
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          vibrationPattern: null,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
      }

      // Show notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `🎵 ${track.title || 'Playing'}`,
          body: track.artist_name || 'Gracefy Music',
          data: { songId: track.song_id, type: 'music-player' },
          sound: false,
          sticky: true,
          autoDismiss: false,
          categoryIdentifier: 'music-playback',
        },
        trigger: null,
      });

      notificationIdRef.current = notificationId;
      console.log('[Player] Notification shown');
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

  // ============== BACKGROUND CHECK (FALLBACK) ==============
  const startBackgroundCheck = () => {
    stopBackgroundCheck();
    
    // Check every 1.5 seconds
    backgroundCheckRef.current = setInterval(async () => {
      if (!soundRef.current) return;
      
      try {
        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;
        
        // Update state
        setPosition(status.positionMillis || 0);
        setDuration(status.durationMillis || 0);
        setIsPlaying(status.isPlaying);
        
        // Check if track ended
        const pos = status.positionMillis || 0;
        const dur = status.durationMillis || 0;
        
        if (dur > 0 && pos >= dur - 500 && !status.isPlaying) {
          console.log('[Player] Background check: track ended');
          handleTrackEnd();
        }
      } catch (e) {
        // Ignore errors in background check
      }
    }, 1500);
  };
  
  const stopBackgroundCheck = () => {
    if (backgroundCheckRef.current) {
      clearInterval(backgroundCheckRef.current);
      backgroundCheckRef.current = null;
    }
  };

  // ============== INITIALIZATION ==============
  useEffect(() => {
    // Configure audio mode immediately
    configureAudioMode();

    // Re-configure on app foreground
    const subscription = AppState.addEventListener('change', async (state) => {
      console.log('[Player] App state:', state);
      if (state === 'active') {
        await configureAudioMode();
      }
    });

    return () => {
      subscription?.remove();
      dismissNotification();
      stopBackgroundCheck();
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

  // ============== PLAY TRACKING ==============
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
          console.log('[Player] Play tracked');
        } catch (e) {}
      }
    }, 45000);
  };

  // ============== STREAM TRACKING ==============
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

  // ============== TRACK END HANDLER (AUTO-NEXT) ==============
  const handleTrackEnd = useCallback(async () => {
    if (isHandlingTrackEndRef.current) return;
    
    isHandlingTrackEndRef.current = true;
    console.log('[Player] ===== HANDLING TRACK END =====');

    try {
      if (!autoPlayRef.current) {
        setIsPlaying(false);
        isHandlingTrackEndRef.current = false;
        return;
      }

      const currentQueue = queueRef.current;
      const currentIdx = queueIndexRef.current;
      const repeatMode = repeatRef.current;

      console.log('[Player] Queue:', currentQueue.length, 'Index:', currentIdx, 'Repeat:', repeatMode);

      let nextIndex = currentIdx + 1;
      
      if (nextIndex >= currentQueue.length) {
        if (repeatMode === 'all' && currentQueue.length > 0) {
          nextIndex = 0;
          console.log('[Player] Looping to start');
        } else if (repeatMode === 'one') {
          nextIndex = currentIdx;
          console.log('[Player] Repeating track');
        } else {
          console.log('[Player] End of queue');
          setIsPlaying(false);
          isHandlingTrackEndRef.current = false;
          return;
        }
      }

      const nextTrack = currentQueue[nextIndex];
      if (nextTrack) {
        console.log('[Player] Playing next:', nextTrack.title);
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

  // ============== PLAYBACK STATUS CALLBACK ==============
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error('[Player] Error:', status.error);
        setIsPlaying(false);
        setIsLoading(false);
      }
      return;
    }

    // Update state
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

  // ============== LOAD AND PLAY TRACK ==============
  const loadAndPlayTrack = async (track, showNotification = true) => {
    if (!track) return;

    // Stop external audio
    if (stopExternalAudioCallback) {
      try { await stopExternalAudioCallback(); } catch (e) {}
    }

    // End previous stream
    await endCurrentStream();
    stopBackgroundCheck();

    console.log('[Player] Loading:', track.title);
    setIsLoading(true);
    setCurrentTrack(track);
    currentTrackRef.current = track;

    try {
      // Ensure audio mode is configured
      await configureAudioMode();

      // Unload previous sound
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch (e) {}
        soundRef.current = null;
      }

      // Get audio URL
      const audioUrl = getAudioUrl(track.audio_url || track.file_path);
      if (!audioUrl) throw new Error('No audio URL');

      console.log('[Player] URL:', audioUrl.substring(0, 60));

      // Create and load sound
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
      setIsPlaying(true);
      setIsLoading(false);

      // Start tracking
      startPlayTracking(track.song_id);
      startStreamTracking(track);
      
      // Start background check (fallback for track end detection)
      startBackgroundCheck();

      // Show notification
      if (showNotification) {
        showMediaNotification(track);
      }

      // Check liked status
      try {
        const res = await playerAPI.checkLiked(track.song_id);
        setIsLiked(res?.data?.liked || false);
      } catch (e) {
        setIsLiked(false);
      }

      console.log('[Player] ✓ Playing:', track.title);
    } catch (e) {
      console.error('[Player] Load error:', e);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  // ============== PUBLIC API ==============
  
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
          // Restart if at end
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

  const seekTo = async (positionMs) => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.setPositionAsync(positionMs);
      setPosition(positionMs);
    } catch (e) {}
  };

  const toggleShuffle = () => setShuffle(prev => !prev);

  const toggleRepeat = () => {
    setRepeat(prev => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      repeatRef.current = next;
      return next;
    });
  };

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

  const setAutoPlay = (enabled) => {
    setAutoPlayEnabled(enabled);
    autoPlayRef.current = enabled;
  };

  const stopPlayback = async () => {
    await endCurrentStream();
    stopBackgroundCheck();
    
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
