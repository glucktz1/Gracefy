import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
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

// Lazy-load TrackPlayer to avoid ESM issues during EAS config parsing
let TrackPlayer = null;
let Capability = null;
let RepeatMode = null;
let State = null;
let Event = null;
let isTrackPlayerAvailable = false;

const loadTrackPlayer = () => {
  if (TrackPlayer !== null) return isTrackPlayerAvailable;
  
  try {
    const tp = require('react-native-track-player');
    TrackPlayer = tp.default;
    Capability = tp.Capability;
    RepeatMode = tp.RepeatMode;
    State = tp.State;
    Event = tp.Event;
    isTrackPlayerAvailable = true;
    console.log('[PlayerContext] TrackPlayer loaded successfully');
    return true;
  } catch (e) {
    console.warn('[PlayerContext] TrackPlayer not available:', e.message);
    isTrackPlayerAvailable = false;
    return false;
  }
};

// Setup status
let isPlayerSetup = false;
let setupPromise = null;

const setupPlayer = async () => {
  if (!loadTrackPlayer()) return false;
  if (isPlayerSetup) return true;
  if (setupPromise) return setupPromise;
  
  setupPromise = (async () => {
    try {
      // Register playback service
      TrackPlayer.registerPlaybackService(() => require('./playbackService'));
      
      await TrackPlayer.setupPlayer({
        minBuffer: 15,
        maxBuffer: 50,
        playBuffer: 2,
        backBuffer: 10,
      });
      
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
          Capability.SeekTo,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
      });
      
      // Set repeat mode to loop queue
      await TrackPlayer.setRepeatMode(RepeatMode.Queue);
      
      isPlayerSetup = true;
      console.log('[PlayerContext] TrackPlayer setup complete');
      return true;
    } catch (error) {
      console.error('[PlayerContext] Setup error:', error);
      setupPromise = null;
      return false;
    }
  })();
  
  return setupPromise;
};

export const PlayerProvider = ({ children }) => {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
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

  const queueRef = useRef([]);
  const autoPlayRef = useRef(true);
  const playLockRef = useRef(false);
  const pollIntervalRef = useRef(null);

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { autoPlayRef.current = autoPlayEnabled; }, [autoPlayEnabled]);

  // Initialize player
  useEffect(() => {
    let mounted = true;
    let eventSubs = [];

    const init = async () => {
      const success = await setupPlayer();
      if (!mounted) return;
      
      if (success && TrackPlayer && Event) {
        setIsPlayerReady(true);
        
        // Subscribe to track changes
        const trackChangeSub = TrackPlayer.addEventListener(
          Event.PlaybackActiveTrackChanged,
          async (event) => {
            if (event.track) {
              console.log('[PlayerContext] Track changed:', event.track.title);
              setCurrentTrack({
                song_id: event.track.id,
                title: event.track.title,
                artist_name: event.track.artist,
                thumbnail: event.track.artwork,
                audio_url: event.track.url,
              });
              
              const idx = await TrackPlayer.getActiveTrackIndex();
              if (idx !== null) setQueueIndex(idx);
              
              // Track play in backend
              if (event.track.id) {
                playerAPI.trackPlay(event.track.id).catch(() => {});
              }
            }
          }
        );
        eventSubs.push(trackChangeSub);

        // Subscribe to queue ended
        const queueEndSub = TrackPlayer.addEventListener(
          Event.PlaybackQueueEnded,
          async () => {
            console.log('[PlayerContext] Queue ended');
            if (autoPlayRef.current) {
              const moreSongs = await fetchMoreSongs();
              if (moreSongs.length > 0) {
                await addTracksToQueue(moreSongs, false);
              }
            }
          }
        );
        eventSubs.push(queueEndSub);

        // Start polling for state updates
        startPolling();
      }
    };

    init();

    return () => {
      mounted = false;
      eventSubs.forEach(sub => sub?.remove?.());
      stopPolling();
    };
  }, []);

  // Poll for playback state
  const startPolling = () => {
    if (pollIntervalRef.current) return;
    
    pollIntervalRef.current = setInterval(async () => {
      if (!TrackPlayer || !isPlayerSetup) return;
      
      try {
        const state = await TrackPlayer.getPlaybackState();
        setIsPlaying(state.state === State?.Playing);
        
        const progress = await TrackPlayer.getProgress();
        setPosition(progress.position || 0);
        setDuration(progress.duration || 0);
      } catch (e) {
        // Ignore errors
      }
    }, 500);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Fetch more songs
  const fetchMoreSongs = async () => {
    try {
      const response = await contentAPI.getAllSongs();
      const songs = response.data?.songs || [];
      if (songs.length > 0) {
        const recentIds = queueRef.current.slice(-10).map(s => s.song_id);
        const filtered = songs.filter(s => !recentIds.includes(s.song_id));
        return (filtered.length > 0 ? filtered : songs)
          .sort(() => Math.random() - 0.5)
          .slice(0, 20);
      }
      return [];
    } catch (error) {
      console.error('[PlayerContext] Fetch error:', error);
      return [];
    }
  };

  // Convert to TrackPlayer format
  const toTrackFormat = (track) => ({
    id: track.song_id,
    url: getAudioUrl(track.audio_url),
    title: track.title || 'Unknown',
    artist: track.artist_name || 'Unknown Artist',
    artwork: track.thumbnail ? getAudioUrl(track.thumbnail) : undefined,
  });

  // Add tracks to queue
  const addTracksToQueue = async (tracks, clearFirst = false) => {
    if (!TrackPlayer) return;
    
    if (clearFirst) {
      await TrackPlayer.reset();
    }
    
    const formatted = tracks.map(toTrackFormat);
    await TrackPlayer.add(formatted);
    
    queueRef.current = clearFirst ? tracks : [...queueRef.current, ...tracks];
    setQueue(queueRef.current);
  };

  // Main play function
  const playTrack = async (track, trackList = null, startIndex = 0) => {
    if (!TrackPlayer || !isPlayerReady) {
      console.log('[PlayerContext] Player not ready');
      return;
    }

    if (playLockRef.current) {
      console.log('[PlayerContext] Play locked');
      return;
    }

    // Same track - toggle
    if (currentTrack?.song_id === track.song_id) {
      await togglePlay();
      return;
    }

    playLockRef.current = true;
    setIsLoading(true);

    try {
      // Stop external audio
      if (stopExternalAudioCallback) {
        try { await stopExternalAudioCallback(); } catch (e) {}
      }

      await TrackPlayer.reset();
      
      if (trackList && trackList.length > 0) {
        await addTracksToQueue(trackList, true);
        await TrackPlayer.skip(startIndex);
      } else {
        await addTracksToQueue([track], true);
      }
      
      await TrackPlayer.play();
      console.log('[PlayerContext] Playing:', track.title);
    } catch (error) {
      console.error('[PlayerContext] Play error:', error);
    } finally {
      setIsLoading(false);
      setTimeout(() => { playLockRef.current = false; }, 300);
    }
  };

  const togglePlay = async () => {
    if (!TrackPlayer) return;
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const seekTo = async (seconds) => {
    if (TrackPlayer) await TrackPlayer.seekTo(seconds);
  };

  const skipNext = async () => {
    if (!TrackPlayer) return;
    try {
      await TrackPlayer.skipToNext();
    } catch (e) {
      console.log('[PlayerContext] No next track');
    }
  };

  const skipPrevious = async () => {
    if (!TrackPlayer) return;
    if (position > 3) {
      await TrackPlayer.seekTo(0);
    } else {
      try {
        await TrackPlayer.skipToPrevious();
      } catch (e) {
        await TrackPlayer.seekTo(0);
      }
    }
  };

  const pausePlayback = async () => {
    if (TrackPlayer) await TrackPlayer.pause();
    return true;
  };

  const resumePlayback = async () => {
    if (TrackPlayer) await TrackPlayer.play();
  };

  const toggleShuffle = () => {
    setShuffle(!shuffle);
  };

  const cycleRepeat = async () => {
    if (!TrackPlayer || !RepeatMode) return;
    
    const modes = ['off', 'all', 'one'];
    const idx = modes.indexOf(repeat);
    const newRepeat = modes[(idx + 1) % modes.length];
    setRepeat(newRepeat);
    
    switch (newRepeat) {
      case 'off': await TrackPlayer.setRepeatMode(RepeatMode.Off); break;
      case 'all': await TrackPlayer.setRepeatMode(RepeatMode.Queue); break;
      case 'one': await TrackPlayer.setRepeatMode(RepeatMode.Track); break;
    }
  };

  const toggleLike = () => setIsLiked(!isLiked);
  
  const toggleAutoPlay = () => {
    const val = !autoPlayEnabled;
    autoPlayRef.current = val;
    setAutoPlayEnabled(val);
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
    isPlayerReady,
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
