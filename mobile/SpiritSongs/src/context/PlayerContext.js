import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { sessionService, getAudioUrl } from '../services/api';
import * as SecureStore from 'expo-secure-store';

const PlayerContext = createContext(null);

// Sample audio for fallback/demo
const SAMPLE_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

export const PlayerProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // off, all, one
  const [error, setError] = useState(null);
  
  const soundRef = useRef(null);
  const sessionIdRef = useRef(null);

  // Configure audio mode on mount
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        console.log('Audio mode configured successfully');
      } catch (err) {
        console.error('Error setting audio mode:', err);
      }
    };
    setupAudio();
    
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Playback status update handler
  const onPlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis / 1000 || 0);
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);
      setError(null);
      
      // Handle song end
      if (status.didJustFinish && !status.isLooping) {
        handleSongEnd();
      }
    } else if (status.error) {
      console.error('Playback error:', status.error);
      setError(status.error);
      setIsLoading(false);
    }
  }, []);

  const handleSongEnd = useCallback(async () => {
    if (repeat === 'one') {
      // Replay current song
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
    } else {
      // Play next
      playNext();
    }
  }, [repeat, queue, queueIndex, shuffle]);

  const loadAndPlaySong = async (song, album) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Loading song:', song.title, 'Audio URL:', song.audio_url);
      
      // Unload previous sound
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          console.log('Error unloading previous sound:', e);
        }
        soundRef.current = null;
      }
      
      // End previous session
      if (sessionIdRef.current) {
        try {
          await sessionService.endSession(sessionIdRef.current);
        } catch (e) {
          console.log('Error ending session:', e);
        }
      }
      
      // Determine audio URL
      let audioUrl = null;
      
      // Try to get the actual audio URL
      if (song.audio_url) {
        audioUrl = getAudioUrl(song.audio_url);
        console.log('Resolved audio URL:', audioUrl);
      }
      
      // Fallback to sample audio if no URL
      if (!audioUrl) {
        console.log('No audio URL found, using sample audio');
        audioUrl = SAMPLE_AUDIO;
      }
      
      // Check if file is downloaded locally
      try {
        const downloadPath = `${FileSystem.documentDirectory}songs/${song.song_id}.mp3`;
        const fileInfo = await FileSystem.getInfoAsync(downloadPath);
        if (fileInfo.exists) {
          console.log('Using downloaded file:', downloadPath);
          audioUrl = downloadPath;
        }
      } catch (e) {
        // Ignore file check errors
      }
      
      console.log('Final audio URL:', audioUrl);
      
      // Create and load sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true,
          progressUpdateIntervalMillis: 500,
        },
        onPlaybackStatusUpdate
      );
      
      soundRef.current = sound;
      setCurrentSong(song);
      setCurrentAlbum(album);
      
      // Start listening session
      try {
        const userId = await SecureStore.getItemAsync('user_id');
        const session = await sessionService.startSession(song.song_id, userId);
        sessionIdRef.current = session?.session_id;
      } catch (e) {
        console.log('Session tracking error (non-critical):', e);
      }
      
      setIsLoading(false);
      console.log('Song loaded successfully');
      
    } catch (error) {
      console.error('Error loading song:', error);
      setError(error.message || 'Failed to load audio');
      setIsLoading(false);
      
      // Try fallback to sample audio
      try {
        console.log('Attempting fallback to sample audio...');
        const { sound } = await Audio.Sound.createAsync(
          { uri: SAMPLE_AUDIO },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        soundRef.current = sound;
        setCurrentSong(song);
        setCurrentAlbum(album);
        setIsLoading(false);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  };

  const playSong = async (song, album, songQueue = [], index = 0) => {
    console.log('playSong called:', song?.title);
    setQueue(songQueue.length > 0 ? songQueue : [{ song, album }]);
    setQueueIndex(index);
    await loadAndPlaySong(song, album);
  };

  const togglePlay = async () => {
    if (!soundRef.current) {
      console.log('No sound loaded');
      return;
    }
    
    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error toggling play:', error);
    }
  };

  const playNext = async () => {
    if (queue.length === 0) return;
    
    let nextIndex;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeat === 'all') {
          nextIndex = 0;
        } else {
          return;
        }
      }
    }
    
    setQueueIndex(nextIndex);
    const item = queue[nextIndex];
    await loadAndPlaySong(item.song || item, item.album || currentAlbum);
  };

  const playPrevious = async () => {
    if (position > 3) {
      // Restart current song if more than 3 seconds in
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
      }
      return;
    }
    
    if (queue.length === 0) return;
    
    const prevIndex = queueIndex === 0 ? queue.length - 1 : queueIndex - 1;
    setQueueIndex(prevIndex);
    const item = queue[prevIndex];
    await loadAndPlaySong(item.song || item, item.album || currentAlbum);
  };

  const seekTo = async (seconds) => {
    if (soundRef.current) {
      try {
        await soundRef.current.setPositionAsync(seconds * 1000);
      } catch (error) {
        console.error('Error seeking:', error);
      }
    }
  };

  const cycleRepeat = () => {
    setRepeat(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  };

  const value = {
    currentSong,
    currentAlbum,
    queue,
    queueIndex,
    isPlaying,
    isLoading,
    position,
    duration,
    shuffle,
    repeat,
    error,
    playSong,
    togglePlay,
    playNext,
    playPrevious,
    seekTo,
    setShuffle,
    cycleRepeat,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
