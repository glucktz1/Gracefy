import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { getAudioUrl, playerAPI, contentAPI } from '../services/api';

// Dynamic import to avoid expo config parse issues
let TrackPlayer;
let Capability, Event, RepeatMode, State;
let usePlaybackState, useProgress, useActiveTrack;

// We need to handle this carefully for EAS build
try {
  const tp = require('react-native-track-player');
  TrackPlayer = tp.default;
  Capability = tp.Capability;
  Event = tp.Event;
  RepeatMode = tp.RepeatMode;
  State = tp.State;
  usePlaybackState = tp.usePlaybackState;
  useProgress = tp.useProgress;
  useActiveTrack = tp.useActiveTrack;
  
  // Register playback service immediately after import
  TrackPlayer.registerPlaybackService(() => require('../services/playbackService'));
} catch (e) {
  console.warn('[PlayerContext] TrackPlayer not available:', e.message);
}

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

// Track if player is already set up (singleton)
let isPlayerSetup = false;

// Setup TrackPlayer - only call once!
const setupPlayer = async () => {
  if (!TrackPlayer) return false;
  if (isPlayerSetup) {
    console.log('[PlayerContext] Player already setup');
    return true;
  }

  try {
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
    
    // Set repeat mode to queue (loop through all songs)
    await TrackPlayer.setRepeatMode(RepeatMode.Queue);
    
    isPlayerSetup = true;
    console.log('[PlayerContext] TrackPlayer setup complete');
    return true;
  } catch (error) {
    console.error('[PlayerContext] TrackPlayer setup error:', error);
    return false;
  }
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

  // Use TrackPlayer hooks for reactive state (if available)
  const playbackState = usePlaybackState ? usePlaybackState() : { state: null };
  const progress = useProgress ? useProgress() : { position: 0, duration: 0 };
  const activeTrack = useActiveTrack ? useActiveTrack() : null;
  
  // Refs for non-reactive access
  const queueRef = useRef([]);
  const autoPlayRef = useRef(true);
  const playLockRef = useRef(false);

  // Derived state from TrackPlayer
  const isPlayingDerived = State ? playbackState.state === State.Playing : false;
  const positionDerived = progress.position || 0;
  const durationDerived = progress.duration || 0;

  // Update state from hooks
  useEffect(() => {
    setIsPlaying(isPlayingDerived);
  }, [isPlayingDerived]);

  useEffect(() => {
    setPosition(positionDerived);
    setDuration(durationDerived);
  }, [positionDerived, durationDerived]);

  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { autoPlayRef.current = autoPlayEnabled; }, [autoPlayEnabled]);

  // Update current track when active track changes
  useEffect(() => {
    if (activeTrack && TrackPlayer) {
      setCurrentTrack({
        song_id: activeTrack.id,
        title: activeTrack.title,
        artist_name: activeTrack.artist,
        thumbnail: activeTrack.artwork,
        audio_url: activeTrack.url,
      });
      
      // Update queue index
      TrackPlayer.getActiveTrackIndex().then(idx => {
        if (idx !== null) setQueueIndex(idx);
      });
      
      // Track play in backend
      if (activeTrack.id) {
        playerAPI.trackPlay(activeTrack.id).catch(() => {});
      }
    }
  }, [activeTrack]);

  // Initialize TrackPlayer
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!TrackPlayer) {
        console.warn('[PlayerContext] TrackPlayer not available');
        return;
      }
      
      const success = await setupPlayer();
      if (mounted && success) {
        setIsPlayerReady(true);
      }
    };

    init();

    // Handle queue ended event to fetch more songs
    let queueEndedSub;
    if (TrackPlayer && Event) {
      queueEndedSub = TrackPlayer.addEventListener(
        Event.PlaybackQueueEnded,
        async () => {
          console.log('[PlayerContext] Queue ended event received');
          if (autoPlayRef.current) {
            const moreSongs = await fetchMoreSongs();
            if (moreSongs.length > 0) {
              await addTracksToQueue(moreSongs, false);
            }
          }
        }
      );
    }

    return () => {
      mounted = false;
      if (queueEndedSub) queueEndedSub.remove();
    };
  }, []);

  // Fetch more songs for continuous play
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
      console.error('[PlayerContext] Error fetching more songs:', error);
      return [];
    }
  };

  // Convert track format to TrackPlayer format
  const toTrackPlayerFormat = (track) => ({
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
    
    const formatted = tracks.map(toTrackPlayerFormat);
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

    // Same track - toggle play/pause
    if (currentTrack?.song_id === track.song_id) {
      await togglePlay();
      return;
    }

    playLockRef.current = true;
    setIsLoading(true);

    try {
      // Stop external audio first
      if (stopExternalAudioCallback) {
        try { await stopExternalAudioCallback(); } catch (e) {}
      }

      // Reset and add tracks
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

  // Toggle play/pause
  const togglePlay = async () => {
    if (!TrackPlayer) return;
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  // Seek to position
  const seekTo = async (seconds) => {
    if (TrackPlayer) await TrackPlayer.seekTo(seconds);
  };

  // Skip to next track
  const skipNext = async () => {
    if (!TrackPlayer) return;
    try {
      await TrackPlayer.skipToNext();
    } catch (e) {
      console.log('[PlayerContext] No next track');
    }
  };

  // Skip to previous track
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

  // Pause playback (for external use)
  const pausePlayback = async () => {
    if (TrackPlayer) await TrackPlayer.pause();
    return true;
  };

  // Resume playback
  const resumePlayback = async () => {
    if (TrackPlayer) await TrackPlayer.play();
  };

  // Toggle shuffle
  const toggleShuffle = () => {
    setShuffle(!shuffle);
  };

  // Cycle repeat mode
  const cycleRepeat = async () => {
    if (!TrackPlayer || !RepeatMode) return;
    
    const modes = ['off', 'all', 'one'];
    const idx = modes.indexOf(repeat);
    const newRepeat = modes[(idx + 1) % modes.length];
    setRepeat(newRepeat);
    
    switch (newRepeat) {
      case 'off':
        await TrackPlayer.setRepeatMode(RepeatMode.Off);
        break;
      case 'all':
        await TrackPlayer.setRepeatMode(RepeatMode.Queue);
        break;
      case 'one':
        await TrackPlayer.setRepeatMode(RepeatMode.Track);
        break;
    }
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
