/**
 * PlayerContext - Fixed for Single Playback & Background Continuous Play
 * 
 * Key Fixes:
 * 1. SINGLE PLAYBACK: Ensures previous sound is fully stopped before new one starts
 * 2. BACKGROUND PLAY: Proper audio mode + interval-based track end detection
 * 3. AUTO-NEXT: Works when app is backgrounded or screen is locked
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getAudioUrl, getImageUrl, playerAPI } from '../services/api';

const PlayerContext = createContext(null);

// Notification config
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// External audio callback
let stopExternalAudioCallback = null;
export const setStopExternalAudioCallback = (cb) => { stopExternalAudioCallback = cb; };
export const clearStopExternalAudioCallback = () => { stopExternalAudioCallback = null; };

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    return {
      currentTrack: null, queue: [], queueIndex: 0, isPlaying: false,
      isLoading: false, position: 0, duration: 0, shuffle: false,
      repeat: 'all', isLiked: false,
      playTrack: async () => {}, togglePlay: async () => {},
      togglePlayPause: async () => {}, skipNext: async () => {},
      skipPrevious: async () => {}, seekTo: async () => {},
      toggleShuffle: () => {}, toggleRepeat: () => {},
      toggleLike: async () => {}, addToQueue: () => {},
      playQueue: async () => {}, clearQueue: () => {},
      setAutoPlay: () => {}, stopPlayback: async () => {},
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

  // CRITICAL: Single sound reference
  const soundRef = useRef(null);
  
  // Queue refs for background access
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const repeatRef = useRef('all');
  const autoPlayRef = useRef(true);
  const currentTrackRef = useRef(null);
  
  // Locks to prevent race conditions
  const isLoadingRef = useRef(false);
  const isHandlingEndRef = useRef(false);
  
  // Tracking
  const playStartTimeRef = useRef(null);
  const playTrackedRef = useRef(false);
  const playTrackingTimerRef = useRef(null);
  const notificationIdRef = useRef(null);
  
  // Stream tracking
  const deviceIdRef = useRef(`${Platform.OS}_${Math.random().toString(36).substr(2, 8)}`);
  const streamIdRef = useRef(null);
  const heartbeatRef = useRef(null);
  
  // Background monitoring
  const monitorRef = useRef(null);

  // Sync refs
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { autoPlayRef.current = autoPlayEnabled; }, [autoPlayEnabled]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

  // ==================== AUDIO MODE ====================
  const configureAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
        playThroughEarpieceAndroid: false,
        allowsRecordingIOS: false,
      });
      console.log('[Player] Audio configured');
    } catch (e) {
      console.error('[Player] Audio config error:', e);
    }
  };

  // ==================== NOTIFICATION ====================
  const showNotification = async (track) => {
    if (!track) return;
    try {
      if (notificationIdRef.current) {
        await Notifications.dismissNotificationAsync(notificationIdRef.current);
      }

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('now-playing', {
          name: 'Now Playing',
          importance: Notifications.AndroidImportance.LOW,
          sound: null,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      notificationIdRef.current = await Notifications.scheduleNotificationAsync({
        content: {
          title: `🎵 ${track.title}`,
          body: track.artist_name || 'Gracefy',
          sound: false,
          sticky: true,
        },
        trigger: null,
      });
    } catch (e) {}
  };

  const dismissNotification = async () => {
    if (notificationIdRef.current) {
      try {
        await Notifications.dismissNotificationAsync(notificationIdRef.current);
      } catch (e) {}
      notificationIdRef.current = null;
    }
  };

  // ==================== BACKGROUND MONITOR ====================
  // This detects track end when app is backgrounded
  const startMonitor = () => {
    stopMonitor();
    
    monitorRef.current = setInterval(async () => {
      if (!soundRef.current || isHandlingEndRef.current) return;
      
      try {
        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;
        
        // Update UI state
        setPosition(status.positionMillis || 0);
        setDuration(status.durationMillis || 0);
        setIsPlaying(status.isPlaying);
        
        // Detect track end
        const pos = status.positionMillis || 0;
        const dur = status.durationMillis || 0;
        
        if (dur > 0 && pos >= dur - 500 && !status.isPlaying) {
          console.log('[Player] Monitor: Track ended');
          handleTrackEnd();
        }
      } catch (e) {}
    }, 1000);
  };
  
  const stopMonitor = () => {
    if (monitorRef.current) {
      clearInterval(monitorRef.current);
      monitorRef.current = null;
    }
  };

  // ==================== INIT ====================
  useEffect(() => {
    configureAudio();
    
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') configureAudio();
    });

    return () => {
      sub?.remove();
      stopMonitor();
      dismissNotification();
      stopSound();
      if (playTrackingTimerRef.current) clearTimeout(playTrackingTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  // ==================== STOP SOUND (CRITICAL) ====================
  const stopSound = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
      } catch (e) {}
      try {
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
  };

  // ==================== PLAY TRACKING ====================
  const startPlayTracking = (songId) => {
    if (playTrackingTimerRef.current) clearTimeout(playTrackingTimerRef.current);
    playStartTimeRef.current = Date.now();
    playTrackedRef.current = false;

    playTrackingTimerRef.current = setTimeout(async () => {
      if (!playTrackedRef.current) {
        playTrackedRef.current = true;
        try {
          await playerAPI.trackPlay(songId, { duration: 45, platform: Platform.OS });
        } catch (e) {}
      }
    }, 45000);
  };

  // ==================== STREAM TRACKING ====================
  const startStreamTracking = async (track) => {
    await endStream();
    try {
      const res = await playerAPI.startStream(track.song_id, deviceIdRef.current, {
        platform: Platform.OS,
        album_id: track.album_id
      });
      if (res?.data?.stream_id) {
        streamIdRef.current = res.data.stream_id;
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(async () => {
          if (streamIdRef.current) {
            try { await playerAPI.heartbeat(streamIdRef.current, Math.floor(position / 1000)); } catch (e) {}
          }
        }, 30000);
      }
    } catch (e) {}
  };

  const endStream = async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (streamIdRef.current) {
      try {
        const dur = playStartTimeRef.current ? Math.floor((Date.now() - playStartTimeRef.current) / 1000) : 0;
        await playerAPI.endStream(streamIdRef.current, dur);
      } catch (e) {}
      streamIdRef.current = null;
    }
  };

  // ==================== AUTO-NEXT (TRACK END) ====================
  const handleTrackEnd = useCallback(async () => {
    if (isHandlingEndRef.current) return;
    isHandlingEndRef.current = true;
    
    console.log('[Player] === TRACK END ===');

    try {
      if (!autoPlayRef.current) {
        setIsPlaying(false);
        return;
      }

      const q = queueRef.current;
      const idx = queueIndexRef.current;
      const rep = repeatRef.current;

      let next = idx + 1;
      
      if (next >= q.length) {
        if (rep === 'all' && q.length > 0) {
          next = 0;
        } else if (rep === 'one') {
          next = idx;
        } else {
          setIsPlaying(false);
          return;
        }
      }

      const nextTrack = q[next];
      if (nextTrack) {
        console.log('[Player] Auto-next:', nextTrack.title);
        setQueueIndex(next);
        queueIndexRef.current = next;
        await loadAndPlay(nextTrack);
      }
    } catch (e) {
      console.error('[Player] Auto-next error:', e);
      setIsPlaying(false);
    } finally {
      setTimeout(() => { isHandlingEndRef.current = false; }, 300);
    }
  }, []);

  // ==================== PLAYBACK STATUS ====================
  const onStatus = useCallback((status) => {
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

    // Track end detection (primary method)
    if (status.didJustFinish && !status.isLooping) {
      console.log('[Player] didJustFinish');
      handleTrackEnd();
    }
  }, [handleTrackEnd]);

  // ==================== LOAD AND PLAY ====================
  const loadAndPlay = async (track) => {
    if (!track || isLoadingRef.current) return;
    isLoadingRef.current = true;

    // Stop external audio
    if (stopExternalAudioCallback) {
      try { await stopExternalAudioCallback(); } catch (e) {}
    }

    // CRITICAL: Stop any existing playback FIRST
    stopMonitor();
    await endStream();
    await stopSound();

    console.log('[Player] Loading:', track.title);
    setIsLoading(true);
    setCurrentTrack(track);
    currentTrackRef.current = track;

    try {
      await configureAudio();

      const url = getAudioUrl(track.audio_url || track.file_path);
      if (!url) throw new Error('No audio URL');

      console.log('[Player] URL:', url.substring(0, 50));

      // Create new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        onStatus
      );

      soundRef.current = sound;
      setIsPlaying(true);
      setIsLoading(false);
      isLoadingRef.current = false;

      // Start tracking
      startPlayTracking(track.song_id);
      startStreamTracking(track);
      startMonitor();
      showNotification(track);

      // Check liked
      try {
        const res = await playerAPI.checkLiked(track.song_id);
        setIsLiked(res?.data?.liked || false);
      } catch (e) { setIsLiked(false); }

      console.log('[Player] ✓ Playing');
    } catch (e) {
      console.error('[Player] Load error:', e);
      setIsLoading(false);
      setIsPlaying(false);
      isLoadingRef.current = false;
    }
  };

  // ==================== PUBLIC API ====================
  
  const playTrack = async (track, newQueue = null, startIndex = null) => {
    if (newQueue && Array.isArray(newQueue)) {
      setQueue(newQueue);
      queueRef.current = newQueue;
      const idx = startIndex ?? newQueue.findIndex(s => s.song_id === track.song_id);
      const finalIdx = idx >= 0 ? idx : 0;
      setQueueIndex(finalIdx);
      queueIndexRef.current = finalIdx;
    }
    await loadAndPlay(track);
  };

  const togglePlay = async () => {
    if (!soundRef.current) {
      if (currentTrackRef.current) await loadAndPlay(currentTrackRef.current);
      return;
    }

    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        if (currentTrackRef.current) await loadAndPlay(currentTrackRef.current);
        return;
      }

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        if (status.positionMillis >= (status.durationMillis || 1) - 500) {
          await soundRef.current.setPositionAsync(0);
        }
        await soundRef.current.playAsync();
        setIsPlaying(true);
        if (currentTrackRef.current) showNotification(currentTrackRef.current);
      }
    } catch (e) {
      if (currentTrackRef.current) await loadAndPlay(currentTrackRef.current);
    }
  };

  const skipNext = async () => {
    const q = queueRef.current;
    if (q.length === 0) return;
    
    let next = queueIndexRef.current + 1;
    if (next >= q.length) next = 0;
    
    setQueueIndex(next);
    queueIndexRef.current = next;
    await loadAndPlay(q[next]);
  };

  const skipPrevious = async () => {
    const q = queueRef.current;
    if (q.length === 0) return;
    
    if (position > 3000 && soundRef.current) {
      await soundRef.current.setPositionAsync(0);
      return;
    }
    
    let prev = queueIndexRef.current - 1;
    if (prev < 0) prev = q.length - 1;
    
    setQueueIndex(prev);
    queueIndexRef.current = prev;
    await loadAndPlay(q[prev]);
  };

  const seekTo = async (ms) => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.setPositionAsync(ms);
      setPosition(ms);
    } catch (e) {}
  };

  const toggleShuffle = () => setShuffle(p => !p);

  const toggleRepeat = () => {
    setRepeat(p => {
      const next = p === 'off' ? 'all' : p === 'all' ? 'one' : 'off';
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
    if (track) setQueue(p => [...p, track]);
  };

  const playQueue = async (newQueue, index = 0) => {
    if (!newQueue?.length) return;
    setQueue(newQueue);
    queueRef.current = newQueue;
    setQueueIndex(index);
    queueIndexRef.current = index;
    await loadAndPlay(newQueue[index]);
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
    stopMonitor();
    await endStream();
    await stopSound();
    setIsPlaying(false);
    setCurrentTrack(null);
    setPosition(0);
    setDuration(0);
    dismissNotification();
    if (playTrackingTimerRef.current) clearTimeout(playTrackingTimerRef.current);
  };

  return (
    <PlayerContext.Provider value={{
      currentTrack, queue, queueIndex, isPlaying, isLoading,
      position, duration, shuffle, repeat, isLiked,
      playTrack, togglePlay, togglePlayPause: togglePlay,
      skipNext, skipPrevious, seekTo, toggleShuffle, toggleRepeat,
      toggleLike, addToQueue, playQueue, clearQueue,
      setAutoPlay, stopPlayback,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};

export default PlayerContext;
