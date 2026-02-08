/**
 * PlayerContext - Using react-native-track-player for reliable background playback
 * 
 * Features:
 * - Background/lock screen playback with notification controls
 * - Lock screen artwork and controls (like Spotify)
 * - Automatic next track when song ends
 * - Single playback (no double audio)
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import TrackPlayer, {
  Capability,
  State,
  Event,
  RepeatMode,
  AppKilledPlaybackBehavior,
  usePlaybackState,
  useProgress,
  useActiveTrack,
} from 'react-native-track-player';
import { Platform, AppState } from 'react-native';
import { getAudioUrl, getImageUrl, playerAPI } from '../services/api';

const PlayerContext = createContext(null);

// External audio callback for stopping other audio sources
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
  const [isLoading, setIsLoading] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('all');
  const [isLiked, setIsLiked] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Use track player hooks
  const playbackState = usePlaybackState();
  const progress = useProgress(1000);
  const activeTrack = useActiveTrack();

  // Refs
  const queueRef = useRef([]);
  const repeatRef = useRef('all');
  const isInitializedRef = useRef(false);
  
  // Stream tracking
  const deviceIdRef = useRef(`${Platform.OS}_${Math.random().toString(36).substr(2, 8)}`);
  const streamIdRef = useRef(null);
  const heartbeatRef = useRef(null);
  const playStartTimeRef = useRef(null);
  const playTrackedRef = useRef(false);
  const playTrackingTimerRef = useRef(null);

  // Derived state
  const isPlaying = playbackState.state === State.Playing;
  const position = progress.position * 1000; // Convert to ms
  const duration = progress.duration * 1000; // Convert to ms

  // Sync refs
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);

  // ==================== SETUP TRACK PLAYER ====================
  const setupPlayer = async () => {
    if (isInitializedRef.current) return;
    
    try {
      console.log('[Player] Setting up TrackPlayer...');
      
      // Check if already set up
      try {
        await TrackPlayer.getActiveTrack();
        console.log('[Player] TrackPlayer already initialized');
        isInitializedRef.current = true;
        setIsPlayerReady(true);
        return;
      } catch {
        // Not initialized, continue setup
      }

      await TrackPlayer.setupPlayer({
        maxCacheSize: 1024 * 50, // 50 MB cache
        autoHandleInterruptions: true,
      });

      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        },
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
          Capability.SkipToPrevious,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        progressUpdateEventInterval: 1,
      });

      // Set initial repeat mode
      await TrackPlayer.setRepeatMode(RepeatMode.Queue);

      isInitializedRef.current = true;
      setIsPlayerReady(true);
      console.log('[Player] TrackPlayer setup complete');
    } catch (error) {
      console.error('[Player] Setup error:', error);
    }
  };

  // Initialize on mount
  useEffect(() => {
    setupPlayer();

    // Listen for track change events
    const trackChangeSub = TrackPlayer.addEventListener(
      Event.PlaybackActiveTrackChanged,
      async (event) => {
        if (event.track) {
          console.log('[Player] Active track changed:', event.track.title);
          // Update current track from our queue
          const trackIndex = queueRef.current.findIndex(t => 
            t.song_id === event.track.id || t.title === event.track.title
          );
          if (trackIndex >= 0) {
            setQueueIndex(trackIndex);
            setCurrentTrack(queueRef.current[trackIndex]);
            
            // Check liked status
            try {
              const res = await playerAPI.checkLiked(queueRef.current[trackIndex].song_id);
              setIsLiked(res?.data?.liked || false);
            } catch (e) { setIsLiked(false); }
          }
        }
      }
    );

    // Listen for queue end
    const queueEndSub = TrackPlayer.addEventListener(
      Event.PlaybackQueueEnded,
      async (event) => {
        console.log('[Player] Queue ended');
        // If repeat all, restart queue
        if (repeatRef.current === 'all' && queueRef.current.length > 0) {
          try {
            await TrackPlayer.skip(0);
            await TrackPlayer.play();
          } catch (e) {
            console.error('[Player] Restart queue error:', e);
          }
        }
      }
    );

    return () => {
      trackChangeSub.remove();
      queueEndSub.remove();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (playTrackingTimerRef.current) clearTimeout(playTrackingTimerRef.current);
    };
  }, []);

  // Sync active track with our state
  useEffect(() => {
    if (activeTrack && queue.length > 0) {
      const idx = queue.findIndex(t => 
        t.song_id === activeTrack.id || t.title === activeTrack.title
      );
      if (idx >= 0 && idx !== queueIndex) {
        setQueueIndex(idx);
        setCurrentTrack(queue[idx]);
      }
    }
  }, [activeTrack, queue]);

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
        heartbeatRef.current = setInterval(async () => {
          if (streamIdRef.current) {
            try { 
              await playerAPI.heartbeat(streamIdRef.current, Math.floor(progress.position)); 
            } catch (e) {}
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

  // ==================== CONVERT TRACK FORMAT ====================
  const convertToTrackPlayerFormat = (track) => {
    const audioUrl = getAudioUrl(track.audio_url || track.file_path);
    const artworkUrl = getImageUrl(track.thumbnail || track.cover_url || track.album_thumbnail);
    
    return {
      id: track.song_id,
      url: audioUrl,
      title: track.title || 'Unknown',
      artist: track.artist_name || 'Unknown Artist',
      album: track.album_title || '',
      artwork: artworkUrl || 'https://via.placeholder.com/300',
      duration: track.duration || 0,
    };
  };

  // ==================== PUBLIC API ====================
  
  const playTrack = async (track, newQueue = null, startIndex = null) => {
    if (!isPlayerReady) {
      console.log('[Player] Not ready yet');
      await setupPlayer();
    }

    // Stop external audio
    if (stopExternalAudioCallback) {
      try { await stopExternalAudioCallback(); } catch (e) {}
    }

    setIsLoading(true);
    console.log('[Player] Playing:', track.title);

    try {
      // End previous stream
      await endStream();

      // Reset the player
      await TrackPlayer.reset();

      // Set up queue
      let tracksToAdd = [];
      let playIndex = 0;

      if (newQueue && Array.isArray(newQueue) && newQueue.length > 0) {
        setQueue(newQueue);
        queueRef.current = newQueue;
        
        playIndex = startIndex ?? newQueue.findIndex(s => s.song_id === track.song_id);
        if (playIndex < 0) playIndex = 0;
        
        tracksToAdd = newQueue.map(convertToTrackPlayerFormat);
      } else if (queue.length > 0) {
        tracksToAdd = queue.map(convertToTrackPlayerFormat);
        playIndex = queue.findIndex(s => s.song_id === track.song_id);
        if (playIndex < 0) playIndex = 0;
      } else {
        tracksToAdd = [convertToTrackPlayerFormat(track)];
        setQueue([track]);
        queueRef.current = [track];
        playIndex = 0;
      }

      // Add tracks and play
      await TrackPlayer.add(tracksToAdd);
      await TrackPlayer.skip(playIndex);
      await TrackPlayer.play();

      setQueueIndex(playIndex);
      setCurrentTrack(track);
      
      // Start tracking
      startPlayTracking(track.song_id);
      startStreamTracking(track);

      // Check liked status
      try {
        const res = await playerAPI.checkLiked(track.song_id);
        setIsLiked(res?.data?.liked || false);
      } catch (e) { setIsLiked(false); }

      console.log('[Player] ✓ Playing:', track.title);
    } catch (error) {
      console.error('[Player] Play error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = async () => {
    if (!isPlayerReady) return;
    
    try {
      if (isPlaying) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('[Player] Toggle play error:', error);
    }
  };

  const skipNext = async () => {
    if (!isPlayerReady) return;
    
    try {
      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      const queueLength = (await TrackPlayer.getQueue()).length;
      
      if (currentIndex !== null && currentIndex < queueLength - 1) {
        await TrackPlayer.skipToNext();
      } else if (repeat === 'all' && queueLength > 0) {
        // Loop to first track
        await TrackPlayer.skip(0);
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('[Player] Skip next error:', error);
    }
  };

  const skipPrevious = async () => {
    if (!isPlayerReady) return;
    
    try {
      // If more than 3 seconds in, restart current track
      if (progress.position > 3) {
        await TrackPlayer.seekTo(0);
        return;
      }
      
      const currentIndex = await TrackPlayer.getActiveTrackIndex();
      if (currentIndex !== null && currentIndex > 0) {
        await TrackPlayer.skipToPrevious();
      } else if (repeat === 'all' && queue.length > 0) {
        // Loop to last track
        await TrackPlayer.skip(queue.length - 1);
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error('[Player] Skip previous error:', error);
    }
  };

  const seekTo = async (ms) => {
    if (!isPlayerReady) return;
    
    try {
      await TrackPlayer.seekTo(ms / 1000); // Convert to seconds
    } catch (error) {
      console.error('[Player] Seek error:', error);
    }
  };

  const toggleShuffle = () => setShuffle(p => !p);

  const toggleRepeat = async () => {
    const newRepeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
    setRepeat(newRepeat);
    repeatRef.current = newRepeat;
    
    try {
      if (newRepeat === 'one') {
        await TrackPlayer.setRepeatMode(RepeatMode.Track);
      } else if (newRepeat === 'all') {
        await TrackPlayer.setRepeatMode(RepeatMode.Queue);
      } else {
        await TrackPlayer.setRepeatMode(RepeatMode.Off);
      }
    } catch (e) {
      console.error('[Player] Set repeat mode error:', e);
    }
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
    } catch (e) {
      console.error('[Player] Toggle like error:', e);
    }
  };

  const addToQueue = async (track) => {
    if (!track) return;
    
    setQueue(prev => [...prev, track]);
    
    if (isPlayerReady) {
      try {
        await TrackPlayer.add(convertToTrackPlayerFormat(track));
      } catch (e) {
        console.error('[Player] Add to queue error:', e);
      }
    }
  };

  const playQueue = async (newQueue, index = 0) => {
    if (!newQueue?.length) return;
    await playTrack(newQueue[index], newQueue, index);
  };

  const clearQueue = async () => {
    setQueue([]);
    queueRef.current = [];
    setQueueIndex(0);
    
    if (isPlayerReady) {
      try {
        await TrackPlayer.reset();
      } catch (e) {}
    }
  };

  const setAutoPlay = (enabled) => {
    setAutoPlayEnabled(enabled);
  };

  const stopPlayback = async () => {
    await endStream();
    
    if (isPlayerReady) {
      try {
        await TrackPlayer.reset();
      } catch (e) {}
    }
    
    setCurrentTrack(null);
    setQueueIndex(0);
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
