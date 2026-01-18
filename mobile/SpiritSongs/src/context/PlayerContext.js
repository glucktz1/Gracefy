import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { Alert, Share, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { sessionService, getAudioUrl, contentService, libraryService } from '../services/api';
import { getLocalSongPath, downloadSong, isSongDownloaded, removeDownload } from '../services/downloadService';

const PlayerContext = createContext(null);

const SAMPLE_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
const PLAYBACK_STATE_KEY = 'playback_state';

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
  const [repeat, setRepeat] = useState('all'); // Default to 'all' for continuous playback
  const [error, setError] = useState(null);
  const [liked, setLiked] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [allAlbums, setAllAlbums] = useState([]);
  const [hasRestoredState, setHasRestoredState] = useState(false);
  
  const soundRef = useRef(null);
  const sessionIdRef = useRef(null);
  const isLoadingRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const lastPositionRef = useRef(0);

  // Configure audio for background/lock screen playback
  useEffect(() => {
    const setupAudio = async () => {
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
        console.log('Audio mode configured for background playback');
      } catch (err) {
        console.error('Error setting audio mode:', err);
      }
    };
    setupAudio();
    fetchAllAlbums();
    
    return () => {
      stopAndUnloadSound();
    };
  }, []);

  const fetchAllAlbums = async () => {
    try {
      const homeData = await contentService.getHome();
      const albums = [];
      homeData?.sections?.forEach(section => {
        if (section.items) {
          section.items.forEach(item => {
            if (item.album_id && !albums.find(a => a.album_id === item.album_id)) {
              albums.push(item);
            }
          });
        }
      });
      setAllAlbums(albums);
    } catch (error) {
      console.log('Error fetching albums:', error);
    }
  };

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

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis / 1000 || 0);
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);
      setError(null);
      
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
    console.log('Song ended. Repeat:', repeat, 'Queue:', queue.length, 'Index:', queueIndex);
    
    if (repeat === 'one') {
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
      return;
    }
    
    if (queueIndex < queue.length - 1) {
      // Play next song in queue
      playNextInternal();
    } else if (repeat === 'all') {
      // Loop back to start of queue
      setQueueIndex(0);
      const item = queue[0];
      await loadAndPlaySong(item.song || item, item.album || currentAlbum);
    } else {
      // Continue to next album even when repeat is 'off' (continuous playback)
      await playNextAlbum();
    }
  }, [repeat, queue, queueIndex, currentAlbum, allAlbums]);

  const playNextAlbum = async () => {
    if (!currentAlbum || allAlbums.length === 0) return;
    
    const currentIndex = allAlbums.findIndex(a => a.album_id === currentAlbum.album_id);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < allAlbums.length) {
      const nextAlbum = allAlbums[nextIndex];
      console.log('Auto-playing next album:', nextAlbum.title);
      
      try {
        const albumData = await contentService.getAlbum(nextAlbum.album_id);
        const songs = albumData.songs || [];
        
        if (songs.length > 0) {
          const newQueue = songs.map(song => ({ song, album: albumData.album || nextAlbum }));
          setQueue(newQueue);
          setQueueIndex(0);
          await loadAndPlaySong(songs[0], albumData.album || nextAlbum);
        }
      } catch (error) {
        console.error('Error loading next album:', error);
      }
    }
  };

  const loadAndPlaySong = async (song, album) => {
    if (isLoadingRef.current) return;
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);
      
      console.log('Loading:', song.title);
      
      await stopAndUnloadSound();
      
      if (sessionIdRef.current) {
        try { await sessionService.endSession(sessionIdRef.current); } catch (e) {}
        sessionIdRef.current = null;
      }
      
      let audioUrl = null;
      
      // Check local first
      try {
        const localPath = await getLocalSongPath(song.song_id);
        if (localPath) {
          audioUrl = localPath;
          setIsDownloaded(true);
        } else {
          setIsDownloaded(false);
        }
      } catch (e) {
        setIsDownloaded(false);
      }
      
      if (!audioUrl) {
        audioUrl = song.audio_url ? getAudioUrl(song.audio_url) : SAMPLE_AUDIO;
      }
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true,
          progressUpdateIntervalMillis: 500,
          isLooping: repeat === 'one',
        },
        onPlaybackStatusUpdate
      );
      
      soundRef.current = sound;
      globalSoundRef = sound;
      
      setCurrentSong(song);
      setCurrentAlbum(album);
      
      // Check liked status
      await checkIfLiked(song.song_id);
      
      // Start session
      try {
        const userId = await SecureStore.getItemAsync('user_id');
        const session = await sessionService.startSession(song.song_id, userId);
        sessionIdRef.current = session?.session_id;
      } catch (e) {}
      
      setIsLoading(false);
      isLoadingRef.current = false;
      
    } catch (error) {
      console.error('Error loading song:', error);
      setError(error.message);
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  const checkIfLiked = async (songId) => {
    try {
      // Check local storage
      const localFavorites = await SecureStore.getItemAsync('local_favorites');
      if (localFavorites) {
        const favList = JSON.parse(localFavorites);
        setLiked(favList.includes(songId));
      } else {
        setLiked(false);
      }
    } catch (e) {
      setLiked(false);
    }
  };

  const playSong = async (song, album, songQueue = [], index = 0) => {
    setQueue(songQueue.length > 0 ? songQueue : [{ song, album }]);
    setQueueIndex(index);
    await loadAndPlaySong(song, album);
  };

  const togglePlay = async () => {
    if (!soundRef.current) return;
    
    try {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;
      
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error toggling play:', error);
    }
  };

  const playNextInternal = async () => {
    if (queue.length === 0) return;
    
    let nextIndex;
    if (shuffle) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === queueIndex && queue.length > 1);
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeat === 'all') {
          nextIndex = 0;
        } else {
          await playNextAlbum();
          return;
        }
      }
    }
    
    setQueueIndex(nextIndex);
    const item = queue[nextIndex];
    await loadAndPlaySong(item.song || item, item.album || currentAlbum);
  };

  const playNext = async () => {
    await playNextInternal();
  };

  const playPrevious = async () => {
    if (position > 3) {
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
    if (soundRef.current) {
      soundRef.current.setIsLoopingAsync(newRepeat === 'one');
    }
  };

  const toggleShuffle = () => {
    setShuffle(prev => !prev);
  };

  // FIXED: Toggle like with proper local storage AND backend sync
  const toggleLike = async () => {
    if (!currentSong) return;
    
    try {
      const songId = currentSong.song_id;
      const newLiked = !liked;
      
      // Get current local favorites
      let localFavorites = [];
      try {
        const stored = await SecureStore.getItemAsync('local_favorites');
        if (stored) localFavorites = JSON.parse(stored);
      } catch (e) {}
      
      if (newLiked) {
        // Add to local favorites
        if (!localFavorites.includes(songId)) {
          localFavorites.push(songId);
        }
      } else {
        // Remove from local favorites
        localFavorites = localFavorites.filter(id => id !== songId);
      }
      
      // Save to local storage
      await SecureStore.setItemAsync('local_favorites', JSON.stringify(localFavorites));
      setLiked(newLiked);
      
      // Sync with backend (non-blocking)
      try {
        if (newLiked) {
          await libraryService.addFavorite(songId);
        } else {
          await libraryService.removeFavorite(songId);
        }
        console.log('Like synced to backend:', newLiked);
      } catch (e) {
        console.log('Backend sync failed (will retry later):', e.message);
      }
      
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const shareSong = async () => {
    if (!currentSong) return;
    
    try {
      await Share.share({
        message: `🎵 Check out "${currentSong.title}" by ${currentAlbum?.artist_name || 'Unknown Artist'} on Spirit Songs!`,
        title: `${currentSong.title} - Spirit Songs`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const downloadCurrentSong = async () => {
    if (!currentSong || !currentAlbum) return;
    
    if (isDownloaded) {
      Alert.alert(
        'Remove Download',
        'Remove the offline version of this song?',
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
      setIsDownloading(true);
      setDownloadProgress(0);
      
      try {
        await downloadSong(currentSong, currentAlbum, (progress) => {
          setDownloadProgress(progress);
        });
        setIsDownloaded(true);
        setIsDownloading(false);
        Alert.alert('Downloaded!', 'Song available offline');
      } catch (error) {
        setIsDownloading(false);
        Alert.alert('Download Failed', error.message || 'Could not download');
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
