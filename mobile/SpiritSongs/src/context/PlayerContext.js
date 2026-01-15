import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { Alert, Share } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { sessionService, getAudioUrl, contentService, libraryService } from '../services/api';
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
  const [allAlbums, setAllAlbums] = useState([]); // For auto-play next album
  
  const soundRef = useRef(null);
  const sessionIdRef = useRef(null);
  const isLoadingRef = useRef(false);

  // Configure audio mode on mount - IMPORTANT for lock screen playback
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

  // Fetch all albums for auto-play next album feature
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
      console.log('Error fetching albums for auto-play:', error);
    }
  };

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
      
      // Handle song end - auto-play next
      if (status.didJustFinish && !status.isLooping) {
        handleSongEnd();
      }
    } else if (status.error) {
      console.error('Playback error:', status.error);
      setError(status.error);
      setIsLoading(false);
    }
  }, []);

  // Handle song end - play next song in album, or next album
  const handleSongEnd = useCallback(async () => {
    console.log('Song ended. Repeat mode:', repeat, 'Queue length:', queue.length, 'Index:', queueIndex);
    
    if (repeat === 'one') {
      // Replay current song
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
      return;
    }
    
    // Check if there are more songs in the queue
    if (queueIndex < queue.length - 1) {
      // Play next song in queue/album
      playNext();
    } else if (repeat === 'all') {
      // Restart queue from beginning
      setQueueIndex(0);
      const item = queue[0];
      await loadAndPlaySong(item.song || item, item.album || currentAlbum);
    } else {
      // End of album - try to play next album
      await playNextAlbum();
    }
  }, [repeat, queue, queueIndex, currentAlbum, allAlbums]);

  // Play next album automatically
  const playNextAlbum = async () => {
    if (!currentAlbum || allAlbums.length === 0) {
      console.log('No more albums to play');
      return;
    }
    
    // Find current album index
    const currentIndex = allAlbums.findIndex(a => a.album_id === currentAlbum.album_id);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < allAlbums.length) {
      const nextAlbum = allAlbums[nextIndex];
      console.log('Auto-playing next album:', nextAlbum.title);
      
      try {
        // Fetch songs for next album
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
    } else {
      console.log('Reached end of all albums');
    }
  };

  const loadAndPlaySong = async (song, album) => {
    if (isLoadingRef.current) {
      console.log('Already loading a song, skipping...');
      return;
    }
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);
      
      console.log('Loading song:', song.title, 'Song ID:', song.song_id);
      
      await stopAndUnloadSound();
      
      // End previous session
      if (sessionIdRef.current) {
        try {
          await sessionService.endSession(sessionIdRef.current);
        } catch (e) {}
        sessionIdRef.current = null;
      }
      
      // Determine audio URL
      let audioUrl = null;
      let isLocalFile = false;
      
      // Check for local download first
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
        setIsDownloaded(false);
      }
      
      // Remote URL if not local
      if (!audioUrl) {
        if (song.audio_url) {
          audioUrl = getAudioUrl(song.audio_url);
        }
        if (!audioUrl) {
          audioUrl = SAMPLE_AUDIO;
        }
      }
      
      // Create and load sound
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
      
      // Check if song is liked
      await checkIfLiked(song.song_id);
      
      // Start listening session
      try {
        const userId = await SecureStore.getItemAsync('user_id');
        const session = await sessionService.startSession(song.song_id, userId);
        sessionIdRef.current = session?.session_id;
      } catch (e) {}
      
      setIsLoading(false);
      isLoadingRef.current = false;
      
    } catch (error) {
      console.error('Error loading song:', error);
      setError(error.message || 'Failed to load audio');
      setIsLoading(false);
      isLoadingRef.current = false;
      
      // Fallback
      try {
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
        isLoadingRef.current = false;
      }
    }
  };

  // Check if current song is liked
  const checkIfLiked = async (songId) => {
    try {
      const favorites = await SecureStore.getItemAsync('favorites');
      if (favorites) {
        const favList = JSON.parse(favorites);
        setLiked(favList.includes(songId));
      } else {
        setLiked(false);
      }
    } catch (e) {
      setLiked(false);
    }
  };

  const playSong = async (song, album, songQueue = [], index = 0) => {
    console.log('playSong called:', song?.title, 'albumId:', album?.album_id);
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

  const playNext = async () => {
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
          // Auto-play next album
          await playNextAlbum();
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

  // Toggle like - saves to local storage AND syncs with backend
  const toggleLike = async () => {
    if (!currentSong) return;
    
    try {
      let favorites = [];
      const stored = await SecureStore.getItemAsync('favorites');
      if (stored) {
        favorites = JSON.parse(stored);
      }
      
      const newLiked = !liked;
      
      if (newLiked) {
        // Add to favorites
        if (!favorites.includes(currentSong.song_id)) {
          favorites.push(currentSong.song_id);
        }
        
        // Sync with backend
        try {
          await libraryService.addFavorite(currentSong.song_id);
        } catch (e) {
          console.log('Backend sync error (non-critical):', e);
        }
      } else {
        // Remove from favorites
        favorites = favorites.filter(id => id !== currentSong.song_id);
        
        // Sync with backend
        try {
          await libraryService.removeFavorite(currentSong.song_id);
        } catch (e) {
          console.log('Backend sync error (non-critical):', e);
        }
      }
      
      await SecureStore.setItemAsync('favorites', JSON.stringify(favorites));
      setLiked(newLiked);
      
    } catch (error) {
      console.error('Error toggling like:', error);
    }
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
      setIsDownloading(true);
      setDownloadProgress(0);
      
      try {
        await downloadSong(currentSong, currentAlbum, (progress) => {
          setDownloadProgress(progress);
        });
        setIsDownloaded(true);
        setIsDownloading(false);
        Alert.alert('Downloaded!', 'Song is now available offline');
      } catch (error) {
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
