/**
 * Zustand Store for Audio Playback State
 * Optimized for minimal re-renders and fast updates
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Audio } from 'expo-av';
import { STREAMING_CONFIG } from '../services/supabase';

// Audio mode configuration for high-quality playback
const configureAudioMode = async () => {
  try {
    await Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      allowsRecordingIOS: false,
      interruptionModeIOS: 1, // DoNotMix
      interruptionModeAndroid: 1, // DoNotMix
    });
  } catch (error) {
    console.warn('Audio mode config error:', error);
  }
};

// Initialize audio mode
configureAudioMode();

// Player store with zustand
export const usePlayerStore = create(
  subscribeWithSelector((set, get) => ({
    // Current track state
    currentTrack: null,
    queue: [],
    queueIndex: 0,
    
    // Playback state
    isPlaying: false,
    isLoading: false,
    isBuffering: false,
    
    // Progress state
    position: 0,
    duration: 0,
    bufferedPosition: 0,
    
    // Volume and settings
    volume: 1.0,
    isMuted: false,
    repeatMode: 'off', // 'off', 'one', 'all'
    shuffleEnabled: false,
    
    // Audio object reference
    sound: null,
    
    // Error state
    error: null,

    // ============== ACTIONS ==============
    
    // Load and play a track
    loadTrack: async (track, queue = [], startIndex = 0) => {
      const { sound: currentSound } = get();
      
      // Unload current sound
      if (currentSound) {
        try {
          await currentSound.unloadAsync();
        } catch (e) {
          console.warn('Error unloading sound:', e);
        }
      }
      
      set({
        isLoading: true,
        error: null,
        currentTrack: track,
        queue: queue.length > 0 ? queue : [track],
        queueIndex: startIndex,
        position: 0,
        duration: 0,
      });
      
      try {
        // Create new sound with optimized buffer settings
        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri: track.audio_url },
          {
            shouldPlay: true,
            volume: get().volume,
            progressUpdateIntervalMillis: 500,
            positionMillis: 0,
            // Buffer configuration for low-latency streaming
            androidImplementation: 'MediaPlayer',
          },
          get()._onPlaybackStatusUpdate
        );
        
        set({
          sound: newSound,
          isLoading: false,
          isPlaying: status.isPlaying,
          duration: status.durationMillis || 0,
        });
        
        return true;
      } catch (error) {
        console.error('Load track error:', error);
        set({
          isLoading: false,
          error: error.message || 'Failed to load track',
        });
        return false;
      }
    },

    // Play/Resume
    play: async () => {
      const { sound, currentTrack } = get();
      
      if (!sound && currentTrack) {
        // Reload if sound was unloaded
        return get().loadTrack(currentTrack, get().queue, get().queueIndex);
      }
      
      if (sound) {
        try {
          await sound.playAsync();
          set({ isPlaying: true });
        } catch (error) {
          console.error('Play error:', error);
        }
      }
    },

    // Pause
    pause: async () => {
      const { sound } = get();
      if (sound) {
        try {
          await sound.pauseAsync();
          set({ isPlaying: false });
        } catch (error) {
          console.error('Pause error:', error);
        }
      }
    },

    // Toggle play/pause
    togglePlayPause: async () => {
      const { isPlaying } = get();
      if (isPlaying) {
        await get().pause();
      } else {
        await get().play();
      }
    },

    // Seek to position
    seekTo: async (positionMs) => {
      const { sound } = get();
      if (sound) {
        try {
          await sound.setPositionAsync(positionMs);
          set({ position: positionMs });
        } catch (error) {
          console.error('Seek error:', error);
        }
      }
    },

    // Skip to next track
    skipToNext: async () => {
      const { queue, queueIndex, repeatMode, shuffleEnabled } = get();
      if (queue.length === 0) return;
      
      let nextIndex;
      
      if (shuffleEnabled) {
        nextIndex = Math.floor(Math.random() * queue.length);
      } else {
        nextIndex = queueIndex + 1;
        if (nextIndex >= queue.length) {
          if (repeatMode === 'all') {
            nextIndex = 0;
          } else {
            return; // End of queue
          }
        }
      }
      
      const nextTrack = queue[nextIndex];
      if (nextTrack) {
        await get().loadTrack(nextTrack, queue, nextIndex);
      }
    },

    // Skip to previous track
    skipToPrevious: async () => {
      const { queue, queueIndex, position } = get();
      
      // If more than 3 seconds in, restart current track
      if (position > 3000) {
        await get().seekTo(0);
        return;
      }
      
      if (queue.length === 0) return;
      
      let prevIndex = queueIndex - 1;
      if (prevIndex < 0) {
        prevIndex = queue.length - 1; // Loop to end
      }
      
      const prevTrack = queue[prevIndex];
      if (prevTrack) {
        await get().loadTrack(prevTrack, queue, prevIndex);
      }
    },

    // Set volume
    setVolume: async (volume) => {
      const { sound } = get();
      const clampedVolume = Math.max(0, Math.min(1, volume));
      
      if (sound) {
        try {
          await sound.setVolumeAsync(clampedVolume);
        } catch (error) {
          console.warn('Volume set error:', error);
        }
      }
      
      set({ volume: clampedVolume, isMuted: clampedVolume === 0 });
    },

    // Toggle mute
    toggleMute: async () => {
      const { isMuted, volume, sound } = get();
      const newVolume = isMuted ? (volume || 1.0) : 0;
      
      if (sound) {
        try {
          await sound.setVolumeAsync(newVolume);
        } catch (error) {
          console.warn('Mute toggle error:', error);
        }
      }
      
      set({ isMuted: !isMuted });
    },

    // Set repeat mode
    setRepeatMode: (mode) => {
      set({ repeatMode: mode });
    },

    // Toggle shuffle
    toggleShuffle: () => {
      set((state) => ({ shuffleEnabled: !state.shuffleEnabled }));
    },

    // Add to queue
    addToQueue: (track) => {
      set((state) => ({
        queue: [...state.queue, track],
      }));
    },

    // Clear queue
    clearQueue: () => {
      set({
        queue: [],
        queueIndex: 0,
      });
    },

    // Reset player
    reset: async () => {
      const { sound } = get();
      
      if (sound) {
        try {
          await sound.unloadAsync();
        } catch (e) {
          console.warn('Unload error:', e);
        }
      }
      
      set({
        currentTrack: null,
        queue: [],
        queueIndex: 0,
        isPlaying: false,
        isLoading: false,
        position: 0,
        duration: 0,
        sound: null,
        error: null,
      });
    },

    // Internal playback status update handler
    _onPlaybackStatusUpdate: (status) => {
      if (status.isLoaded) {
        set({
          isPlaying: status.isPlaying,
          isBuffering: status.isBuffering,
          position: status.positionMillis || 0,
          duration: status.durationMillis || 0,
        });
        
        // Handle track completion
        if (status.didJustFinish && !status.isLooping) {
          const { repeatMode } = get();
          if (repeatMode === 'one') {
            get().seekTo(0);
            get().play();
          } else {
            get().skipToNext();
          }
        }
      } else if (status.error) {
        console.error('Playback error:', status.error);
        set({ error: status.error, isPlaying: false });
      }
    },
  }))
);

// Selector hooks for optimized component re-renders
export const useCurrentTrack = () => usePlayerStore((state) => state.currentTrack);
export const useIsPlaying = () => usePlayerStore((state) => state.isPlaying);
export const useIsLoading = () => usePlayerStore((state) => state.isLoading);
export const useProgress = () => usePlayerStore((state) => ({
  position: state.position,
  duration: state.duration,
  bufferedPosition: state.bufferedPosition,
}));
export const useVolume = () => usePlayerStore((state) => state.volume);
export const useQueue = () => usePlayerStore((state) => ({
  queue: state.queue,
  queueIndex: state.queueIndex,
}));
export const usePlayerControls = () => usePlayerStore((state) => ({
  play: state.play,
  pause: state.pause,
  togglePlayPause: state.togglePlayPause,
  seekTo: state.seekTo,
  skipToNext: state.skipToNext,
  skipToPrevious: state.skipToPrevious,
  setVolume: state.setVolume,
  toggleMute: state.toggleMute,
  loadTrack: state.loadTrack,
  addToQueue: state.addToQueue,
}));

export default usePlayerStore;
