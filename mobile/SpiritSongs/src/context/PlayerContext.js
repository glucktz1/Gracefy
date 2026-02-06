import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { getAudioUrl, playerAPI, contentAPI } from '../services/api';

const PlayerContext = createContext(null);

// Background task name
const BACKGROUND_AUDIO_TASK = 'BACKGROUND_AUDIO_TASK';

// Configure notifications for media controls
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Global callback for stopping external audio (like Bible TTS)
let stopExternalAudioCallback = null;

export const setStopExternalAudioCallback = (callback) => {
  stopExternalAudioCallback = callback;
};

export const clearStopExternalAudioCallback = () => {
  stopExternalAudioCallback = null;
};

// Global player state for background task access
let globalPlayerState = {
  queue: [],
  queueIndex: 0,
  repeat: 'all',
  autoPlay: true,
  onTrackEnd: null,
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
  const currentTrackRef = useRef(null);
  
  // CRITICAL: Lock to prevent simultaneous playback
  const playLockRef = useRef(false);
  const currentTrackIdRef = useRef(null);
  
  // Track end handling
  const isHandlingTrackEndRef = useRef(false);
  
  // Play tracking
  const playStartTimeRef = useRef(null);
  const playTrackedRef = useRef(false);
  const playTrackingTimerRef = useRef(null);
  
  // Media notification ID
  const notificationIdRef = useRef(null);
  
  // Stream tracking for analytics
  const currentStreamIdRef = useRef(null);
  const deviceIdRef = useRef(`${Platform.OS}_${Math.random().toString(36).substring(2, 10)}`);
  const heartbeatIntervalRef = useRef(null);

  // Keep refs and global state in sync
  useEffect(() => { 
    queueRef.current = queue; 
    globalPlayerState.queue = queue;
  }, [queue]);
  
  useEffect(() => { 
    queueIndexRef.current = queueIndex;
    globalPlayerState.queueIndex = queueIndex;
  }, [queueIndex]);
  
  useEffect(() => { 
    repeatRef.current = repeat;
    globalPlayerState.repeat = repeat;
  }, [repeat]);
  
  useEffect(() => { 
    autoPlayRef.current = autoPlayEnabled;
    globalPlayerState.autoPlay = autoPlayEnabled;
  }, [autoPlayEnabled]);
  
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

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

  // Show media notification for lock screen controls
  const showMediaNotification = async (track) => {
    if (!track) return;
    
    try {
      // Cancel previous notification
      if (notificationIdRef.current) {
        await Notifications.dismissNotificationAsync(notificationIdRef.current);
      }

      // Request permissions
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') return;
      }

      // Set notification channel for Android (media style)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('media-playback', {
          name: 'Media Playback',
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          vibrationPattern: null,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      // Show notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: track.title || 'Playing',
          body: track.artist_name || 'Gracefy',
          data: { songId: track.song_id },
          sound: false,
          priority: Notifications.AndroidNotificationPriority.LOW,
          sticky: true,
          autoDismiss: false,
        },
        trigger: null, // Show immediately
      });

      notificationIdRef.current = notificationId;
      console.log('[PlayerContext] Media notification shown');
    } catch (e) {
      console.error('[PlayerContext] Notification error:', e);
    }
  };

  // Dismiss media notification
  const dismissMediaNotification = async () => {
    if (notificationIdRef.current) {
      try {
        await Notifications.dismissNotificationAsync(notificationIdRef.current);
        notificationIdRef.current = null;
      } catch (e) {
        // Ignore
      }
    }
  };

  // Initialize audio on mount
  useEffect(() => {
    configureAudioMode();

    // Re-configure when app comes to foreground
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      console.log('[PlayerContext] App state changed to:', nextAppState);
      if (nextAppState === 'active') {
        await configureAudioMode();
        // Sync state with sound status
        if (soundRef.current) {
          try {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded) {
              setIsPlaying(status.isPlaying);
              setPosition(status.positionMillis || 0);
              setDuration(status.durationMillis || 0);
            }
          } catch (e) {
            // Ignore
          }
        }
      }
    });

    // Cleanup on unmount
    return () => {
      subscription?.remove();
      dismissMediaNotification();
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
      if (playTrackingTimerRef.current) {
        clearTimeout(playTrackingTimerRef.current);
      }
    };
  }, []);

  // Track play for 45+ seconds
  const startPlayTracking = (songId) => {
    if (playTrackingTimerRef.current) {
      clearTimeout(playTrackingTimerRef.current);
    }
    playStartTimeRef.current = Date.now();
    playTrackedRef.current = false;

    playTrackingTimerRef.current = setTimeout(() => {
      if (playStartTimeRef.current && !playTrackedRef.current) {
        const listenDuration = Date.now() - playStartTimeRef.current;
        if (listenDuration >= 45000) {
          playTrackedRef.current = true;
          trackPlay(songId);
        }
      }
    }, 45000);
  };

  const trackPlay = async (songId) => {
    if (!songId) return;
    try {
      await playerAPI.trackPlay(songId);
      console.log('[PlayerContext] Play tracked for:', songId);
    } catch (e) {
      // Silently fail
    }
  };

  // Handle track end - AUTO NEXT SONG
  const handleTrackEnd = useCallback(async () => {
    if (isHandlingTrackEndRef.current) {
      console.log('[PlayerContext] Already handling track end, skipping');
      return;
    }
    
    isHandlingTrackEndRef.current = true;
    console.log('[PlayerContext] ===== TRACK ENDED =====');
    console.log('[PlayerContext] Queue length:', queueRef.current.length);
    console.log('[PlayerContext] Current index:', queueIndexRef.current);
    console.log('[PlayerContext] Repeat mode:', repeatRef.current);
    console.log('[PlayerContext] AutoPlay:', autoPlayRef.current);

    try {
      // If autoplay disabled, just stop
      if (!autoPlayRef.current) {
        console.log('[PlayerContext] AutoPlay disabled, stopping');
        setIsPlaying(false);
        isHandlingTrackEndRef.current = false;
        return;
      }

      const currentQueue = queueRef.current;
      const currentIdx = queueIndexRef.current;
      const repeatMode = repeatRef.current;

      // Calculate next index
      let nextIndex = currentIdx + 1;
      
      if (nextIndex >= currentQueue.length) {
        // End of queue
        if (repeatMode === 'all' && currentQueue.length > 0) {
          // Loop back to start
          nextIndex = 0;
          console.log('[PlayerContext] Looping to start of queue');
        } else if (repeatMode === 'one') {
          // Repeat current
          nextIndex = currentIdx;
          console.log('[PlayerContext] Repeating current track');
        } else {
          // Stop playback
          console.log('[PlayerContext] End of queue, stopping');
          setIsPlaying(false);
          isHandlingTrackEndRef.current = false;
          return;
        }
      }

      // Play next track
      const nextTrack = currentQueue[nextIndex];
      if (nextTrack) {
        console.log('[PlayerContext] Playing next track:', nextTrack.title);
        setQueueIndex(nextIndex);
        await loadAndPlayTrack(nextTrack, false);
      } else {
        console.log('[PlayerContext] No next track available');
        setIsPlaying(false);
      }
    } catch (e) {
      console.error('[PlayerContext] Error in handleTrackEnd:', e);
      setIsPlaying(false);
    } finally {
      // Reset lock after a short delay to prevent rapid re-triggering
      setTimeout(() => {
        isHandlingTrackEndRef.current = false;
      }, 500);
    }
  }, []);

  // Update global state with handleTrackEnd callback
  useEffect(() => {
    globalPlayerState.onTrackEnd = handleTrackEnd;
  }, [handleTrackEnd]);

  // Playback status callback - CRITICAL for background auto-next
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error('[PlayerContext] Playback error:', status.error);
        setIsPlaying(false);
        setIsLoading(false);
      }
      return;
    }

    // Update position and duration
    setPosition(status.positionMillis || 0);
    setDuration(status.durationMillis || 0);
    setIsPlaying(status.isPlaying);
    setIsLoading(status.isBuffering);

    // CRITICAL: Handle track end for auto-next
    if (status.didJustFinish && !status.isLooping) {
      console.log('[PlayerContext] Track finished, triggering auto-next');
      handleTrackEnd();
    }
  }, [handleTrackEnd]);

  // Load and play a track
  const loadAndPlayTrack = async (track, showNotification = true) => {
    if (!track) {
      console.log('[PlayerContext] No track to play');
      return;
    }

    // Stop any external audio (Bible TTS, etc.)
    if (stopExternalAudioCallback) {
      try {
        await stopExternalAudioCallback();
      } catch (e) {
        // Ignore
      }
    }

    // End previous stream if exists
    await endCurrentStream();

    console.log('[PlayerContext] Loading track:', track.title);
    setIsLoading(true);
    setCurrentTrack(track);
    currentTrackIdRef.current = track.song_id;

    try {
      // Unload previous sound
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          // Ignore
        }
        soundRef.current = null;
      }

      // Get audio URL
      const audioUrl = getAudioUrl(track.audio_url || track.file_path);
      if (!audioUrl) {
        throw new Error('No audio URL available');
      }

      console.log('[PlayerContext] Audio URL:', audioUrl.substring(0, 80));

      // Start stream tracking for analytics
      await startStreamTracking(track);

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

      // Start play tracking (for 45+ second counts)
      startPlayTracking(track.song_id);

      // Show media notification for lock screen
      if (showNotification) {
        showMediaNotification(track);
      }

      // Check liked status
      try {
        const response = await playerAPI.checkLiked(track.song_id);
        setIsLiked(response?.data?.liked || false);
      } catch (e) {
        setIsLiked(false);
      }

      console.log('[PlayerContext] Track loaded and playing:', track.title);
    } catch (e) {
      console.error('[PlayerContext] Error loading track:', e);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  // Start stream tracking for real-time analytics
  const startStreamTracking = async (track) => {
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
        
        // Start heartbeat interval (every 30 seconds)
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        heartbeatIntervalRef.current = setInterval(async () => {
          if (currentStreamIdRef.current) {
            try {
              const currentPosition = Math.floor((position || 0) / 1000);
              await playerAPI.heartbeat(currentStreamIdRef.current, currentPosition);
            } catch (e) {
              // Ignore heartbeat errors
            }
          }
        }, 30000);
      }
    } catch (e) {
      console.log('[PlayerContext] Stream tracking error:', e.message);
      // Don't fail playback if stream tracking fails
    }
  };

  // End current stream
  const endCurrentStream = async () => {
    // Clear heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    // End the stream
    if (currentStreamIdRef.current) {
      try {
        const listenDuration = playStartTimeRef.current 
          ? Math.floor((Date.now() - playStartTimeRef.current) / 1000)
          : 0;
        await playerAPI.endStream(currentStreamIdRef.current, listenDuration);
        console.log('[PlayerContext] Stream ended:', currentStreamIdRef.current);
      } catch (e) {
        // Ignore end stream errors
      }
      currentStreamIdRef.current = null;
    }
  };

  // Play a track (public API)
  const playTrack = async (track, newQueue = null, startIndex = null) => {
    // Prevent rapid multiple calls
    if (playLockRef.current) {
      console.log('[PlayerContext] Play locked, ignoring');
      return;
    }

    playLockRef.current = true;

    try {
      // Update queue if provided
      if (newQueue && Array.isArray(newQueue)) {
        setQueue(newQueue);
        queueRef.current = newQueue;
        globalPlayerState.queue = newQueue;
        
        // Find track index in queue
        const idx = startIndex !== null ? startIndex : newQueue.findIndex(s => s.song_id === track.song_id);
        const finalIndex = idx >= 0 ? idx : 0;
        setQueueIndex(finalIndex);
        queueIndexRef.current = finalIndex;
        globalPlayerState.queueIndex = finalIndex;
      }

      await loadAndPlayTrack(track);
    } finally {
      // Release lock after short delay
      setTimeout(() => {
        playLockRef.current = false;
      }, 300);
    }
  };

  // Toggle play/pause - IMPROVED for stopped state
  const togglePlay = async () => {
    if (!soundRef.current) {
      // If no sound but we have a current track, reload it
      if (currentTrackRef.current) {
        console.log('[PlayerContext] No sound loaded, reloading current track');
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
          // If track finished, restart from beginning
          if (status.positionMillis >= (status.durationMillis || 1) - 500) {
            await soundRef.current.setPositionAsync(0);
          }
          await soundRef.current.playAsync();
          setIsPlaying(true);
          
          // Re-show notification
          if (currentTrackRef.current) {
            showMediaNotification(currentTrackRef.current);
          }
        }
      } else {
        // Sound not loaded, reload the track
        if (currentTrackRef.current) {
          console.log('[PlayerContext] Sound not loaded, reloading');
          await loadAndPlayTrack(currentTrackRef.current);
        }
      }
    } catch (e) {
      console.error('[PlayerContext] Error toggling play:', e);
      // Try to reload on error
      if (currentTrackRef.current) {
        await loadAndPlayTrack(currentTrackRef.current);
      }
    }
  };

  // Skip to next track
  const skipNext = async () => {
    const currentQueue = queueRef.current;
    const currentIdx = queueIndexRef.current;
    
    if (currentQueue.length === 0) return;

    let nextIndex = currentIdx + 1;
    if (nextIndex >= currentQueue.length) {
      nextIndex = 0; // Loop to start
    }

    const nextTrack = currentQueue[nextIndex];
    if (nextTrack) {
      console.log('[PlayerContext] Skipping to next:', nextTrack.title);
      setQueueIndex(nextIndex);
      queueIndexRef.current = nextIndex;
      await loadAndPlayTrack(nextTrack);
    }
  };

  // Skip to previous track
  const skipPrevious = async () => {
    const currentQueue = queueRef.current;
    const currentIdx = queueIndexRef.current;
    
    if (currentQueue.length === 0) return;

    // If more than 3 seconds into song, restart current song
    if (position > 3000 && soundRef.current) {
      await soundRef.current.setPositionAsync(0);
      return;
    }

    let prevIndex = currentIdx - 1;
    if (prevIndex < 0) {
      prevIndex = currentQueue.length - 1; // Loop to end
    }

    const prevTrack = currentQueue[prevIndex];
    if (prevTrack) {
      console.log('[PlayerContext] Skipping to previous:', prevTrack.title);
      setQueueIndex(prevIndex);
      queueIndexRef.current = prevIndex;
      await loadAndPlayTrack(prevTrack);
    }
  };

  // Seek to position
  const seekTo = async (positionMs) => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.setPositionAsync(positionMs);
      setPosition(positionMs);
    } catch (e) {
      console.error('[PlayerContext] Seek error:', e);
    }
  };

  // Toggle shuffle
  const toggleShuffle = () => {
    setShuffle(prev => !prev);
  };

  // Toggle repeat mode
  const toggleRepeat = () => {
    setRepeat(prev => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      repeatRef.current = next;
      globalPlayerState.repeat = next;
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
    } catch (e) {
      console.error('[PlayerContext] Like error:', e);
    }
  };

  // Add to queue
  const addToQueue = (track) => {
    if (!track) return;
    setQueue(prev => [...prev, track]);
  };

  // Play queue from index
  const playQueue = async (newQueue, index = 0) => {
    if (!newQueue?.length) return;
    
    setQueue(newQueue);
    queueRef.current = newQueue;
    globalPlayerState.queue = newQueue;
    
    setQueueIndex(index);
    queueIndexRef.current = index;
    globalPlayerState.queueIndex = index;
    
    await loadAndPlayTrack(newQueue[index]);
  };

  // Clear queue
  const clearQueue = () => {
    setQueue([]);
    queueRef.current = [];
    globalPlayerState.queue = [];
    setQueueIndex(0);
    queueIndexRef.current = 0;
    globalPlayerState.queueIndex = 0;
  };

  // Set auto play
  const setAutoPlay = (enabled) => {
    setAutoPlayEnabled(enabled);
    autoPlayRef.current = enabled;
    globalPlayerState.autoPlay = enabled;
  };

  // Stop playback completely
  const stopPlayback = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        // Ignore
      }
      soundRef.current = null;
    }
    
    setIsPlaying(false);
    setCurrentTrack(null);
    setPosition(0);
    setDuration(0);
    
    dismissMediaNotification();
    
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
