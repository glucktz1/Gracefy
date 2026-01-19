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
  
  // Use refs to track current state for callbacks (avoids stale closure issues)
  const queueRef = useRef([]);
  const queueIndexRef = useRef(0);
  const repeatRef = useRef('all');
  const shuffleRef = useRef(false);
  const currentAlbumRef = useRef(null);
  const allAlbumsRef = useRef([]);
  
  // Keep refs in sync with state
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { currentAlbumRef.current = currentAlbum; }, [currentAlbum]);
  useEffect(() => { allAlbumsRef.current = allAlbums; }, [allAlbums]);

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
    restorePlaybackState();
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      savePlaybackState();
      stopAndUnloadSound();
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    lastPositionRef.current = position;
    if (currentSong && position > 0 && Math.floor(position) % 10 === 0) {
      savePlaybackState();
    }
  }, [position, currentSong]);

  const handleAppStateChange = async (nextAppState) => {
    if (appStateRef.current.match(/active/) && nextAppState.match(/inactive|background/)) {
      await savePlaybackState();
    }
    appStateRef.current = nextAppState;
  };

  const savePlaybackState = async () => {
    if (!currentSong) return;
    
    try {
      const state = {
        songId: currentSong.song_id,
        songData: currentSong,
        albumData: currentAlbum,
        position: lastPositionRef.current || position,
        queueIndex: queueIndex,
        timestamp: Date.now(),
      };
      await SecureStore.setItemAsync(PLAYBACK_STATE_KEY, JSON.stringify(state));
      console.log('Saved playback state at position:', state.position);
    } catch (e) {
      console.log('Error saving playback state:', e);
    }
  };

  const restorePlaybackState = async () => {
    if (hasRestoredState) return;
    
    try {
      const savedState = await SecureStore.getItemAsync(PLAYBACK_STATE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        
        const hoursSinceSaved = (Date.now() - state.timestamp) / (1000 * 60 * 60);
        if (hoursSinceSaved < 24 && state.songData && state.position > 0) {
          console.log('Restoring playback state:', state.songData.title, 'at position:', state.position);
          
          setCurrentSong(state.songData);
          setCurrentAlbum(state.albumData);
          setPosition(state.position);
          setHasRestoredState(true);
        }
      }
    } catch (e) {
      console.log('Error restoring playback state:', e);
    }
  };

  const resumeFromLastPosition = async () => {
    if (!currentSong) return;
    
    try {
      const savedState = await SecureStore.getItemAsync(PLAYBACK_STATE_KEY);
      if (savedState) {
        const state = JSON.parse(savedState);
        if (state.songId === currentSong.song_id && state.position > 0) {
          await loadAndPlaySong(currentSong, currentAlbum, state.position);
          return true;
        }
      }
    } catch (e) {
      console.log('Error resuming:', e);
    }
    
    await loadAndPlaySong(currentSong, currentAlbum);
    return false;
  };

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
      allAlbumsRef.current = albums;
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

  // FIXED: Handle song end with refs to avoid stale closures
  const handleSongEnd = useCallback(async () => {
    const currentQueue = queueRef.current;
    const currentIndex = queueIndexRef.current;
    const currentRepeat = repeatRef.current;
    const currentShuffle = shuffleRef.current;
    const album = currentAlbumRef.current;
    const albums = allAlbumsRef.current;
    
    console.log('Song ended. Repeat:', currentRepeat, 'Queue:', currentQueue.length, 'Index:', currentIndex);
    
    // Repeat one - loop the same song
    if (currentRepeat === 'one') {
      if (soundRef.current) {
        try {
          await soundRef.current.setPositionAsync(0);
          await soundRef.current.playAsync();
        } catch (e) {
          console.log('Error looping song:', e);
        }
      }
      return;
    }
    
    // Calculate next index
    let nextIndex;
    if (currentShuffle) {
      // Random next song from queue
      do {
        nextIndex = Math.floor(Math.random() * currentQueue.length);
      } while (nextIndex === currentIndex && currentQueue.length > 1);
    } else {
      nextIndex = currentIndex + 1;
    }
    
    // If there's a next song in the queue, play it
    if (nextIndex < currentQueue.length) {
      console.log('Playing next song in queue:', nextIndex);
      setQueueIndex(nextIndex);
      queueIndexRef.current = nextIndex;
      const item = currentQueue[nextIndex];
      await loadAndPlaySong(item.song || item, item.album || album);
      return;
    }
    
    // Queue exhausted - check repeat mode
    if (currentRepeat === 'all') {
      // Loop back to start of queue
      console.log('Looping back to start of queue');
      setQueueIndex(0);
      queueIndexRef.current = 0;
      const item = currentQueue[0];
      await loadAndPlaySong(item.song || item, item.album || album);
      return;
    }
    
    // Repeat is 'off' - play next album automatically for continuous playback
    console.log('Queue finished, looking for next album...');
    await playNextAlbumInternal(album, albums);
  }, []);

  // Internal function to play next album (uses parameters instead of state)
  const playNextAlbumInternal = async (currentAlbumData, albumsList) => {
    if (!currentAlbumData || !albumsList || albumsList.length === 0) {
      console.log('No more albums to play');
      return;
    }
    
    const currentIndex = albumsList.findIndex(a => a.album_id === currentAlbumData.album_id);
    let nextIndex = currentIndex + 1;
    
    // If we've reached the end, loop back to start
    if (nextIndex >= albumsList.length) {
      nextIndex = 0;
    }
    
    // Avoid playing the same album if only one exists
    if (albumsList.length === 1) {
      console.log('Only one album available, not auto-playing');
      return;
    }
    
    const nextAlbum = albumsList[nextIndex];
    console.log('Auto-playing next album:', nextAlbum.title);
    
    try {
      const albumData = await contentService.getAlbum(nextAlbum.album_id);
      const songs = albumData.songs || [];
      
      if (songs.length > 0) {
        const newQueue = songs.map(song => ({ song, album: albumData.album || nextAlbum }));
        setQueue(newQueue);
        queueRef.current = newQueue;
        setQueueIndex(0);
        queueIndexRef.current = 0;
        await loadAndPlaySong(songs[0], albumData.album || nextAlbum);
      } else {
        // Try the next album if this one has no songs
        await playNextAlbumInternal(nextAlbum, albumsList);
      }
    } catch (error) {
      console.error('Error loading next album:', error);
    }
  };

  const playNextAlbum = async () => {
    await playNextAlbumInternal(currentAlbumRef.current, allAlbumsRef.current);
  };

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis / 1000 || 0);
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);
      setError(null);
      
      // FIXED: Check for song end
      if (status.didJustFinish && !status.isLooping) {
        console.log('Playback finished, triggering handleSongEnd');
        handleSongEnd();
      }
    } else if (status.error) {
      console.error('Playback error:', status.error);
      setError(status.error);
      setIsLoading(false);
    }
  }, [handleSongEnd]);

  const loadAndPlaySong = async (song, album, startPosition = 0) => {
    if (isLoadingRef.current) {
      console.log('Already loading a song, skipping...');
      return;
    }
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);
      
      console.log('Loading:', song.title, startPosition > 0 ? `from position ${startPosition}s` : '');
      
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
      
      console.log('Creating sound from:', audioUrl.substring(0, 50) + '...');
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { 
          shouldPlay: true,
          progressUpdateIntervalMillis: 500,
          isLooping: repeatRef.current === 'one',
          positionMillis: startPosition * 1000,
        },
        onPlaybackStatusUpdate
      );
      
      soundRef.current = sound;
      globalSoundRef = sound;
      
      setCurrentSong(song);
      setCurrentAlbum(album);
      currentAlbumRef.current = album;
      
      await checkIfLiked(song.song_id);
      
      try {
        const userId = await SecureStore.getItemAsync('user_id');
        const session = await sessionService.startSession(song.song_id, userId);
        sessionIdRef.current = session?.session_id;
      } catch (e) {}
      
      setIsLoading(false);
      isLoadingRef.current = false;
      
      console.log('Now playing:', song.title);
      
    } catch (error) {
      console.error('Error loading song:', error);
      setError(error.message);
      setIsLoading(false);
      isLoadingRef.current = false;
      
      // If loading fails, try next song after a short delay
      setTimeout(() => {
        console.log('Load failed, trying next song...');
        playNextInternal();
      }, 1000);
    }
  };

  const checkIfLiked = async (songId) => {
    try {
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
    const newQueue = songQueue.length > 0 ? songQueue : [{ song, album }];
    setQueue(newQueue);
    queueRef.current = newQueue;
    setQueueIndex(index);
    queueIndexRef.current = index;
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
    const currentQueue = queueRef.current;
    const currentIndex = queueIndexRef.current;
    const currentShuffle = shuffleRef.current;
    const currentRepeat = repeatRef.current;
    const album = currentAlbumRef.current;
    
    if (currentQueue.length === 0) return;
    
    let nextIndex;
    if (currentShuffle) {
      do {
        nextIndex = Math.floor(Math.random() * currentQueue.length);
      } while (nextIndex === currentIndex && currentQueue.length > 1);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= currentQueue.length) {
        if (currentRepeat === 'all') {
          nextIndex = 0;
        } else {
          await playNextAlbum();
          return;
        }
      }
    }
    
    setQueueIndex(nextIndex);
    queueIndexRef.current = nextIndex;
    const item = currentQueue[nextIndex];
    await loadAndPlaySong(item.song || item, item.album || album);
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
    
    const currentQueue = queueRef.current;
    const currentIndex = queueIndexRef.current;
    const album = currentAlbumRef.current;
    
    if (currentQueue.length === 0) return;
    
    const prevIndex = currentIndex === 0 ? currentQueue.length - 1 : currentIndex - 1;
    setQueueIndex(prevIndex);
    queueIndexRef.current = prevIndex;
    const item = currentQueue[prevIndex];
    await loadAndPlaySong(item.song || item, item.album || album);
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
    repeatRef.current = newRepeat;
    if (soundRef.current) {
      soundRef.current.setIsLoopingAsync(newRepeat === 'one');
    }
  };

  const toggleShuffle = () => {
    setShuffle(prev => {
      const newValue = !prev;
      shuffleRef.current = newValue;
      return newValue;
    });
  };

  const toggleLike = async () => {
    if (!currentSong) return;
    
    try {
      const songId = currentSong.song_id;
      const newLiked = !liked;
      
      let localFavorites = [];
      try {
        const stored = await SecureStore.getItemAsync('local_favorites');
        if (stored) localFavorites = JSON.parse(stored);
      } catch (e) {}
      
      if (newLiked) {
        if (!localFavorites.includes(songId)) {
          localFavorites.push(songId);
        }
      } else {
        localFavorites = localFavorites.filter(id => id !== songId);
      }
      
      await SecureStore.setItemAsync('local_favorites', JSON.stringify(localFavorites));
      setLiked(newLiked);
      
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
    hasRestoredState,
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
    resumeFromLastPosition,
    savePlaybackState,
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
