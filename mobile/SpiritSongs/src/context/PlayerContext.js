import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { sessionService, getAudioUrl } from '../services/api';
import * as SecureStore from 'expo-secure-store';
import { Platform, Alert, Share } from 'react-native';
import { getLocalSongPath, downloadSong, isSongDownloaded, removeDownload } from '../services/downloadService';

const PlayerContext = createContext(null);

// Sample audio for fallback/demo
const SAMPLE_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

// Singleton sound reference to ensure only one audio plays at a time
let globalSoundRef = null;

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
  const [liked, setLiked] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const soundRef = useRef(null);
  const sessionIdRef = useRef(null);
  const isLoadingRef = useRef(false);

  // Configure audio mode on mount - IMPORTANT for lock screen playback
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true, // Keep playing when app is in background
          playsInSilentModeIOS: true,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix, // Stop other audio when this plays
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix, // Stop other audio when this plays
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        console.log('Audio mode configured for background playback');
      } catch (err) {
        console.error('Error setting audio mode:', err);
      }
    };
    setupAudio();
    
    return () => {
      // Cleanup on unmount
      stopAndUnloadSound();
    };
  }, []);

  // Stop and unload any existing sound
  const stopAndUnloadSound = async () => {
    try {
      if (globalSoundRef) {
        const status = await globalSoundRef.getStatusAsync();
        if (status.isLoaded) {
          await globalSoundRef.stopAsync();
          await globalSoundRef.unloadAsync();
        }
        globalSoundRef = null;
      }
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        }
        soundRef.current = null;
      }
    } catch (e) {
      console.log('Error stopping sound:', e);
    }
  };

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
    // Prevent multiple simultaneous load attempts
    if (isLoadingRef.current) {
      console.log('Already loading a song, skipping...');
      return;
    }
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);
      
      console.log('Loading song:', song.title, 'Song ID:', song.song_id);
      
      // CRITICAL: Stop and unload any existing sound FIRST
      await stopAndUnloadSound();
      
      // End previous session
      if (sessionIdRef.current) {
        try {
          await sessionService.endSession(sessionIdRef.current);
        } catch (e) {
          console.log('Error ending session:', e);
        }
        sessionIdRef.current = null;
      }
      
      // Determine audio URL - First check for local download
      let audioUrl = null;
      let isLocalFile = false;
      
      // Check if file is downloaded locally FIRST (highest priority)
      try {
        const localPath = await getLocalSongPath(song.song_id);
        if (localPath) {
          console.log('Using downloaded file:', localPath);
          audioUrl = localPath;
          isLocalFile = true;
          setIsDownloaded(true);
        } else {
          setIsDownloaded(false);
        }
      } catch (e) {
        console.log('Error checking local file:', e);
        setIsDownloaded(false);
      }
      
      // If not local, try to get the remote audio URL
      if (!audioUrl) {
        if (song.audio_url) {
          audioUrl = getAudioUrl(song.audio_url);
          console.log('Resolved remote audio URL:', audioUrl);
        }
        
        // Fallback to sample audio if no URL
        if (!audioUrl) {
          console.log('No audio URL found, using sample audio');
          audioUrl = SAMPLE_AUDIO;
        }
      }
      
      console.log('Final audio URL:', audioUrl, 'isLocal:', isLocalFile);
      
      // Create and load sound with background playback support
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true,
          progressUpdateIntervalMillis: 500,
          // These help with lock screen controls
          isLooping: repeat === 'one',
        },
        onPlaybackStatusUpdate
      );
      
      // Store in both local and global refs
      soundRef.current = sound;
      globalSoundRef = sound;
      
      setCurrentSong(song);
      setCurrentAlbum(album);
      
      // Check if song is liked
      try {
        const favorites = await SecureStore.getItemAsync('favorites');
        if (favorites) {
          const favList = JSON.parse(favorites);
          setLiked(favList.includes(song.song_id));
        }
      } catch (e) {}
      
      // Start listening session
      try {
        const userId = await SecureStore.getItemAsync('user_id');
        const session = await sessionService.startSession(song.song_id, userId);
        sessionIdRef.current = session?.session_id;
      } catch (e) {
        console.log('Session tracking error (non-critical):', e);
      }
      
      setIsLoading(false);
      isLoadingRef.current = false;
      console.log('Song loaded and playing successfully');
      
    } catch (error) {
      console.error('Error loading song:', error);
      setError(error.message || 'Failed to load audio');
      setIsLoading(false);
      isLoadingRef.current = false;
      
      // Try fallback to sample audio
      try {
        console.log('Attempting fallback to sample audio...');
        await stopAndUnloadSound();
        const { sound } = await Audio.Sound.createAsync(
          { uri: SAMPLE_AUDIO },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        soundRef.current = sound;
        globalSoundRef = sound;
        setCurrentSong(song);
        setCurrentAlbum(album);
        setIsLoading(false);
        isLoadingRef.current = false;
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        isLoadingRef.current = false;
      }
    }
  };

  const playSong = async (song, album, songQueue = [], index = 0) => {
    console.log('playSong called:', song?.title, 'albumId:', album?.album_id);
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
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        console.log('Sound not loaded');
        return;
      }
      
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
      // Get random index different from current
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === queueIndex && queue.length > 1);
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
    const newRepeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
    setRepeat(newRepeat);
    
    // Update looping on current sound
    if (soundRef.current) {
      soundRef.current.setIsLoopingAsync(newRepeat === 'one');
    }
  };

  const toggleShuffle = () => {
    setShuffle(prev => !prev);
  };

  const toggleLike = async () => {
    if (!currentSong) return;
    
    try {
      let favorites = [];
      const stored = await SecureStore.getItemAsync('favorites');
      if (stored) {
        favorites = JSON.parse(stored);
      }
      
      if (liked) {
        favorites = favorites.filter(id => id !== currentSong.song_id);
      } else {
        favorites.push(currentSong.song_id);
      }
      
      await SecureStore.setItemAsync('favorites', JSON.stringify(favorites));
      setLiked(!liked);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const addToPlaylist = async (playlistId) => {
    // This would call the API to add current song to playlist
    console.log('Adding song to playlist:', playlistId);
  };

  // Share song
  const shareSong = async () => {
    if (!currentSong) return;
    
    try {
      await Share.share({
        message: `🎵 Check out "${currentSong.title}" by ${currentAlbum?.artist_name || 'Unknown Artist'} on Spirit Songs!\n\nDownload the app to listen now.`,
        title: `${currentSong.title} - Spirit Songs`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Download current song for offline listening
  const downloadCurrentSong = async () => {
    if (!currentSong || !currentAlbum) return;
    
    if (isDownloaded) {
      // Remove download
      Alert.alert(
        'Remove Download',
        'This will remove the offline version of this song.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeDownload(currentSong.song_id);
                setIsDownloaded(false);
                Alert.alert('Removed', 'Song removed from downloads');
              } catch (error) {
                Alert.alert('Error', 'Failed to remove download');
              }
            },
          },
        ]
      );
    } else {
      // Download the song
      setIsDownloading(true);
      setDownloadProgress(0);
      
      try {
        await downloadSong(currentSong, currentAlbum, (progress) => {
          setDownloadProgress(progress);
        });
        setIsDownloaded(true);
        setIsDownloading(false);
        Alert.alert('Downloaded', 'Song is now available offline');
      } catch (error) {
        console.error('Download error:', error);
        setIsDownloading(false);
        Alert.alert('Download Failed', error.message || 'Could not download song');
      }
    }
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
    liked,
    isDownloaded,
    isDownloading,
    downloadProgress,
    playSong,
    togglePlay,
    playNext,
    playPrevious,
    seekTo,
    setShuffle,
    toggleShuffle,
    cycleRepeat,
    toggleLike,
    addToPlaylist,
    shareSong,
    downloadCurrentSong,
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
