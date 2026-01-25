import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import TrackPlayer, {
  Capability,
  Event,
  RepeatMode,
  State,
  usePlaybackState,
  useProgress,
  useTrackPlayerEvents,
} from 'react-native-track-player';
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

// Setup TrackPlayer service
const setupPlayer = async () => {
  try {
    await TrackPlayer.setupPlayer({
      // Android specific options
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
      // Android specific
      android: {
        appKilledPlaybackBehavior: 'ContinuePlayback',
      },
    });
    
    console.log('[TrackPlayer] Setup complete');
    return true;
  } catch (error) {
    console.error('[TrackPlayer] Setup error:', error);
    return false;
  }
};

export const PlayerProvider = ({ children }) => {
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('all');
  const [isLiked, setIsLiked] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

  // Use TrackPlayer hooks
  const playbackState = usePlaybackState();
  const progress = useProgress();
  
  // Refs
  const queueRef = useRef([]);
  const autoPlayRef = useRef(true);
  const playLockRef = useRef(false);

  // Derived state
  const isPlaying = playbackState.state === State.Playing;
  const position = progress.position || 0;
  const duration = progress.duration || 0;

  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { autoPlayRef.current = autoPlayEnabled; }, [autoPlayEnabled]);

  // Initialize TrackPlayer
  useEffect(() => {
    let mounted = true;

    const initPlayer = async () => {
      const isSetup = await setupPlayer();
      if (mounted && isSetup) {
        setIsPlayerReady(true);
        
        // Set default repeat mode
        await TrackPlayer.setRepeatMode(RepeatMode.Queue);
      }
    };

    initPlayer();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen for track change events (THIS IS THE KEY FOR BACKGROUND!)
  useTrackPlayerEvents([Event.PlaybackActiveTrackChanged, Event.PlaybackQueueEnded], async (event) => {
    console.log('[TrackPlayer] Event:', event.type);
    
    if (event.type === Event.PlaybackActiveTrackChanged) {
      if (event.track) {
        console.log('[TrackPlayer] Track changed to:', event.track.title);
        setCurrentTrack({
          song_id: event.track.id,
          title: event.track.title,
          artist_name: event.track.artist,
          thumbnail: event.track.artwork,
          audio_url: event.track.url,
        });
        
        // Update queue index
        const idx = await TrackPlayer.getActiveTrackIndex();
        if (idx !== null) {
          setQueueIndex(idx);
        }
        
        // Track play in backend
        if (event.track.id) {
          playerAPI.trackPlay(event.track.id).catch(() => {});
        }
      }
    }
    
    if (event.type === Event.PlaybackQueueEnded && autoPlayRef.current) {
      console.log('[TrackPlayer] Queue ended, fetching more songs...');
      const moreSongs = await fetchMoreSongs();
      if (moreSongs.length > 0) {
        await addTracksToQueue(moreSongs, true);
        await TrackPlayer.play();
      }
    }
  });

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

  // Convert our track format to TrackPlayer format
  const convertToTrackPlayerFormat = (track) => ({
    id: track.song_id,
    url: getAudioUrl(track.audio_url),
    title: track.title,
    artist: track.artist_name || 'Unknown',
    artwork: track.thumbnail ? getAudioUrl(track.thumbnail) : undefined,
  });

  // Add tracks to queue
  const addTracksToQueue = async (tracks, clearFirst = false) => {
    if (clearFirst) {
      await TrackPlayer.reset();
    }
    
    const formattedTracks = tracks.map(convertToTrackPlayerFormat);
    await TrackPlayer.add(formattedTracks);
    
    queueRef.current = tracks;
    setQueue(tracks);
  };

  // Main play function
  const playTrack = async (track, trackList = null, startIndex = 0) => {
    if (!isPlayerReady) {
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
        try {
          await stopExternalAudioCallback();
        } catch (e) {}
      }

      // Reset and add tracks
      await TrackPlayer.reset();
      
      if (trackList && trackList.length > 0) {
        await addTracksToQueue(trackList);
        await TrackPlayer.skip(startIndex);
      } else {
        await addTracksToQueue([track]);
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
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  // Seek
  const seekTo = async (seconds) => {
    await TrackPlayer.seekTo(seconds);
  };

  // Skip next
  const skipNext = async () => {
    try {
      await TrackPlayer.skipToNext();
    } catch (e) {
      // End of queue - handled by PlaybackQueueEnded event
      console.log('[PlayerContext] No next track');
    }
  };

  // Skip previous
  const skipPrevious = async () => {
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

  // Pause (external)
  const pausePlayback = async () => {
    await TrackPlayer.pause();
    return true;
  };

  // Resume
  const resumePlayback = async () => {
    await TrackPlayer.play();
  };

  // Shuffle
  const toggleShuffle = async () => {
    setShuffle(!shuffle);
    // TrackPlayer doesn't have built-in shuffle, would need to re-order queue
  };

  // Repeat
  const cycleRepeat = async () => {
    const modes = ['off', 'all', 'one'];
    const idx = modes.indexOf(repeat);
    const newRepeat = modes[(idx + 1) % modes.length];
    setRepeat(newRepeat);
    
    // Map to TrackPlayer repeat modes
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
