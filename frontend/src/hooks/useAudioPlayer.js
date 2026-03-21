/**
 * Audio Player Hook
 * Handles all audio playback logic including music and radio streaming
 * 
 * CONTINUOUS PLAYBACK LOGIC (mirrored from native mobile app):
 * - Uses /api/recommendations/next-songs endpoint for intelligent next-song selection
 * - Pre-fetches recommendations when 2 songs from queue end
 * - Seamlessly adds new songs to queue for uninterrupted playback
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, getAudioUrl, getImageUrl, SAMPLE_AUDIO_URL } from '@/utils/streamingHelpers';

const useAudioPlayer = () => {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // Default OFF - continuous play with recommendations
  const [isLoading, setIsLoading] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [continuousPlay, setContinuousPlay] = useState(true); // Auto-recommendation enabled by default
  
  // Radio state
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [currentRadioStation, setCurrentRadioStation] = useState(null);
  
  const audioRef = useRef(new Audio());
  const sessionIdRef = useRef(null);
  const isFetchingRecommendationsRef = useRef(false); // Prevent duplicate fetches
  const blockAutoPlayNextRef = useRef(false); // For screen lock billing feature
  const guestLimitReachedRef = useRef(false); // For guest play limit - stop autoplay when reached
  
  // Use refs to track latest values for event handlers (avoids stale closures)
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const currentAlbumRef = useRef(currentAlbum);
  const currentSongRef = useRef(currentSong);
  const repeatRef = useRef(repeat);
  const shuffleRef = useRef(shuffle);
  const continuousPlayRef = useRef(continuousPlay);
  
  // Keep refs in sync with state
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { currentAlbumRef.current = currentAlbum; }, [currentAlbum]);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { continuousPlayRef.current = continuousPlay; }, [continuousPlay]);

  // ============ FETCH RECOMMENDATIONS FOR CONTINUOUS PLAY ============
  // This mirrors the native mobile app's logic in PlayerContext.js
  const fetchAndAddRecommendations = useCallback(async (currentSongId) => {
    // Prevent duplicate fetches
    if (isFetchingRecommendationsRef.current) {
      console.log('[Player] Already fetching recommendations, skipping...');
      return false;
    }
    
    // Don't fetch in shuffle mode
    if (shuffleRef.current) {
      console.log('[Player] Shuffle mode active, skipping recommendation fetch');
      return false;
    }
    
    isFetchingRecommendationsRef.current = true;
    console.log('[Player] Fetching recommendations for continuous play...');
    
    try {
      const userId = localStorage.getItem('user_id') || null;
      const res = await axios.get(`${API}/recommendations/next-songs`, {
        params: {
          current_song_id: currentSongId,
          user_id: userId,
          limit: 10
        }
      });
      
      if (res.data?.songs && res.data.songs.length > 0) {
        const currentQueue = queueRef.current;
        const currentSongIds = new Set(currentQueue.map(q => (q.song || q).song_id));
        
        // Filter out songs already in queue
        const newSongs = res.data.songs.filter(song => !currentSongIds.has(song.song_id));
        
        if (newSongs.length > 0) {
          console.log(`[Player] Adding ${newSongs.length} recommended songs to queue`);
          console.log('[Player] Criteria used:', res.data.criteria_used);
          
          // Format songs with album info for queue
          const formattedSongs = newSongs.map(song => ({
            song: song,
            album: {
              album_id: song.album_id,
              title: song.album_title,
              thumbnail: song.album_thumbnail || song.thumbnail,
              artist_name: song.artist_name
            }
          }));
          
          // Add to queue
          const updatedQueue = [...currentQueue, ...formattedSongs];
          setQueue(updatedQueue);
          queueRef.current = updatedQueue;
          
          return true;
        } else {
          console.log('[Player] All recommended songs already in queue');
        }
      } else {
        console.log('[Player] No recommendations returned');
      }
    } catch (e) {
      console.log('[Player] Recommendation fetch error:', e.message);
    } finally {
      isFetchingRecommendationsRef.current = false;
    }
    
    return false;
  }, []);

  // Track plays when leaving page
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (sessionIdRef.current && audioRef.current) {
        const duration = Math.floor(audioRef.current.currentTime);
        // Use sendBeacon for reliability on page unload
        // Play counts only if duration >= 45 seconds
        navigator.sendBeacon(
          `${API}/listening/end`,
          JSON.stringify({ 
            session_id: sessionIdRef.current,
            duration_seconds: duration 
          })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Save playback state to localStorage
  const savePlaybackState = useCallback((song, album, time) => {
    if (song && album) {
      localStorage.setItem('lastPlayback', JSON.stringify({
        song,
        album,
        time: time || 0,
        timestamp: Date.now()
      }));
    }
  }, []);

  // Restore playback state from localStorage
  const restorePlaybackState = useCallback(() => {
    try {
      const saved = localStorage.getItem('lastPlayback');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.log("Error restoring playback state");
    }
    return null;
  }, []);

  // Volume control
  useEffect(() => {
    audioRef.current.volume = isMuted ? 0 : volume / 100;
  }, [volume, isMuted]);

  // Play a song from the queue by index
  // Preload next song for faster playback
  const preloadNextSong = useCallback((currentIndex, currentQueue) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < currentQueue.length) {
      const nextItem = currentQueue[nextIndex];
      const nextSong = nextItem.song || nextItem;
      if (nextSong?.audio_url) {
        const nextAudioUrl = getAudioUrl(nextSong.audio_url);
        const preloadAudio = new Audio();
        preloadAudio.preload = 'auto';
        preloadAudio.src = nextAudioUrl;
        console.log('[Player] Preloading next song:', nextSong.title);
      }
    }
  }, []);

  const playFromQueueInternal = useCallback(async (index, queueRef) => {
    console.log('[Player] playFromQueueInternal called with index:', index);
    const q = queueRef || queue;
    if (index < 0 || index >= q.length) {
      console.log('[Player] Invalid index or empty queue, index:', index, 'queue length:', q.length);
      return;
    }
    
    // IMPORTANT: Stop and reset current audio before playing new one
    // This prevents two songs from playing simultaneously
    try {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } catch (e) {
      console.log('[Player] Error stopping current audio:', e);
    }
    
    const item = q[index];
    const song = item.song || item;
    console.log('[Player] Playing song:', song?.title);
    
    // Get album from queue item - this is critical for cross-album playback
    // Each queue item MUST have its own album reference attached
    const album = item.album || null;
    
    // Get thumbnail from multiple sources in priority order
    const thumbnail = album?.thumbnail || 
                      album?.thumbnail_url || 
                      song?.album_thumbnail || 
                      song?.thumbnail || 
                      song?.thumbnail_url ||
                      currentAlbumRef.current?.thumbnail;
    
    // Ensure album has thumbnail for UI display
    const enrichedAlbum = album ? {
      ...album,
      thumbnail: thumbnail || album.thumbnail
    } : currentAlbumRef.current;
    
    console.log('[Player] Track change:', {
      title: song.title,
      album: enrichedAlbum?.title,
      thumbnail: thumbnail ? 'YES' : 'NO'
    });
    
    setQueueIndex(index);
    setCurrentSong(song);
    setCurrentAlbum(enrichedAlbum);
    // Update ref immediately so UI reflects the new album
    if (enrichedAlbum) {
      currentAlbumRef.current = enrichedAlbum;
    }
    setIsLoading(true);

    // Update MediaSession for lock screen controls with new song metadata
    if ('mediaSession' in navigator && song) {
      const artworkUrl = getImageUrl(thumbnail);
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Unknown Track',
        artist: enrichedAlbum?.artist_name || song?.artist_name || 'Gracefy',
        album: enrichedAlbum?.title || 'Gracefy',
        artwork: artworkUrl ? [
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      });
    }

    // Use helper to get proper audio URL (handles CDN, relative, and file IDs)
    const audioUrl = getAudioUrl(song.audio_url);
    console.log('[Player] Audio URL:', audioUrl);
    
    // Validate audio URL before attempting to play
    if (!audioUrl || audioUrl === SAMPLE_AUDIO_URL) {
      console.error('[Player] Invalid or missing audio URL for song:', song.title);
      setIsLoading(false);
      return;
    }
    
    // Set preload to auto for faster loading
    audioRef.current.preload = 'auto';
    audioRef.current.src = audioUrl;
    
    try {
      // Use play() with promise handling for better browser compatibility
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log('[Player] Autoplay started successfully');
          // Preload next song after current starts playing
          preloadNextSong(index, q);
        }).catch(error => {
          console.log('[Player] Autoplay blocked:', error.name, error.message);
          // If autoplay is blocked, show a play button or wait for user interaction
          if (error.name === 'NotAllowedError') {
            // Browser blocked autoplay - this is normal on first interaction
            // The user will need to click play
            setIsLoading(false);
            return;
          }
          // Log other errors for debugging
          if (error.name === 'NotSupportedError') {
            console.error('[Player] Audio format not supported or URL invalid:', audioUrl);
          }
          setIsLoading(false);
        });
      }
      
      // Determine content type for analytics
      const isTeaching = song.is_teaching || song.song_id?.startsWith('lesson_');
      
      const res = await axios.post(`${API}/listening/start`, { 
        song_id: isTeaching ? null : song.song_id,
        content_type: isTeaching ? 'teaching_lesson' : 'song',
        content_id: song.song_id,
        album_id: album?.album_id,
        user_id: localStorage.getItem('user_id') || 'anonymous',
        platform: /Mobi|Android/i.test(navigator.userAgent) ? 'app' : 'web'
      });
      sessionIdRef.current = res.data.session_id;
    } catch (e) {
      console.error("Playback failed:", e);
      setIsLoading(false);
    }
  }, [queue, preloadNextSong]);

  // Handle song end - with continuous playback using recommendations API
  // Use a ref to store playFromQueueInternal to avoid stale closures
  const playFromQueueInternalRef = useRef(playFromQueueInternal);
  useEffect(() => { playFromQueueInternalRef.current = playFromQueueInternal; }, [playFromQueueInternal]);
  
  // Store fetchAndAddRecommendations in ref for event handlers
  const fetchAndAddRecommendationsRef = useRef(fetchAndAddRecommendations);
  useEffect(() => { fetchAndAddRecommendationsRef.current = fetchAndAddRecommendations; }, [fetchAndAddRecommendations]);
  
  // Store savePlaybackState in ref
  const savePlaybackStateRef = useRef(savePlaybackState);
  useEffect(() => { savePlaybackStateRef.current = savePlaybackState; }, [savePlaybackState]);
  
  // Setup audio event listeners ONCE on mount
  useEffect(() => {
    const audio = audioRef.current;
    
    // ============ HANDLE SONG END - MIRRORS NATIVE APP LOGIC ============
    const handleSongEnd = async () => {
      // Use refs to get latest values (avoids stale closures)
      const currentQueue = queueRef.current;
      const currentQueueIndex = queueIndexRef.current;
      const currentRepeat = repeatRef.current;
      const currentShuffle = shuffleRef.current;
      const currentContinuousPlay = continuousPlayRef.current;
      const song = currentSongRef.current;
      
      console.log('[Player] ========== handleSongEnd called ==========');
      console.log('[Player] Queue length:', currentQueue.length, 'Current index:', currentQueueIndex);
      console.log('[Player] Repeat:', currentRepeat, 'Shuffle:', currentShuffle, 'ContinuousPlay:', currentContinuousPlay);
      
      // Track the ended session with duration (for play count) - non-blocking
      if (sessionIdRef.current) {
        axios.post(`${API}/listening/end`, {
          session_id: sessionIdRef.current,
          duration_seconds: Math.floor(audio.duration || 0)
        }).catch(e => console.log("Failed to track play end"));
      }
      
      // Check if auto-play is blocked (screen lock payment feature or guest limit)
      if (blockAutoPlayNextRef.current) {
        console.log('[Player] Auto-play blocked - stopping');
        blockAutoPlayNextRef.current = false;
        setIsPlaying(false);
        return;
      }
      
      // REPEAT ONE - replay same song
      if (currentRepeat === 'one') {
        console.log('[Player] Repeat ONE - replaying same song');
        audio.currentTime = 0;
        audio.play().catch(e => console.log('[Player] Autoplay blocked:', e));
        return;
      }

      // Calculate next index
      let nextIndex = currentQueueIndex + 1;
      
      if (currentShuffle && currentQueue.length > 1) {
        do {
          nextIndex = Math.floor(Math.random() * currentQueue.length);
        } while (nextIndex === currentQueueIndex && currentQueue.length > 1);
        console.log('[Player] Shuffle - random index:', nextIndex);
      }

      console.log('[Player] Next index:', nextIndex, 'Queue length:', currentQueue.length);

      // If still within queue, play next song
      if (nextIndex < currentQueue.length) {
        console.log('[Player] Playing next song at index:', nextIndex);
        playFromQueueInternalRef.current(nextIndex, currentQueue);
        return;
      }
      
      // End of queue reached
      console.log('[Player] End of queue reached');
      
      // If REPEAT ALL is ON - loop back to start (like native app)
      if (currentRepeat === 'all' && currentQueue.length > 0) {
        console.log('[Player] Repeat ALL - looping to start');
        playFromQueueInternalRef.current(0, currentQueue);
        return;
      }
      
      // CONTINUOUS PLAY MODE (mirrors native app) - fetch recommendations
      if (currentContinuousPlay && currentQueue.length > 0) {
        const lastItem = currentQueue[currentQueue.length - 1];
        const lastSong = lastItem.song || lastItem;
        
        if (lastSong?.song_id) {
          console.log('[Player] Continuous play - fetching recommendations for:', lastSong.song_id);
          
          // Fetch recommendations using the dedicated API
          const added = await fetchAndAddRecommendationsRef.current(lastSong.song_id);
          
          if (added) {
            // New songs were added to queue, play the next one
            const updatedQueue = queueRef.current;
            if (currentQueue.length < updatedQueue.length) {
              console.log('[Player] Playing first recommended song');
              playFromQueueInternalRef.current(currentQueue.length, updatedQueue);
              return;
            }
          }
        }
      }
      
      // No more songs available - stop playback
      console.log('[Player] No more songs - stopping playback');
      setIsPlaying(false);
    };
    
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Save position every 5 seconds
      const song = currentSongRef.current;
      const album = currentAlbumRef.current;
      if (song && album && Math.floor(audio.currentTime) % 5 === 0) {
        savePlaybackStateRef.current(song, album, audio.currentTime);
      }
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const onEnded = () => {
      console.log('[Player] Audio ended event fired!');
      handleSongEnd();
    };
    const onError = (e) => {
      const audio = audioRef.current;
      const error = audio.error;
      let errorMessage = 'Unknown error';
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Playback aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error - check your connection';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio decoding error';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio format not supported or source not found';
            break;
        }
      }
      
      console.error('[Player] Audio error:', errorMessage, {
        src: audio.src,
        networkState: audio.networkState,
        readyState: audio.readyState,
        error: error
      });
      
      // Show toast notification for the error
      const currentSong = currentSongRef.current;
      if (currentSong) {
        toast.error(`Failed to play "${currentSong.title}": ${errorMessage}`);
      }
      
      setIsLoading(false);
      // Auto-skip to next on error (but don't keep skipping if all songs fail)
      // handleSongEnd();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, []); // Empty dependency array - setup ONCE on mount

  const playFromQueue = useCallback((index) => {
    playFromQueueInternal(index, queue);
  }, [playFromQueueInternal, queue]);

  // Setup MediaSession API for lock screen/notification controls (web)
  const updateMediaSession = useCallback((song, album) => {
    if ('mediaSession' in navigator && song) {
      const artworkUrl = getImageUrl(album?.thumbnail);
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Unknown Track',
        artist: album?.artist_name || 'Gracefy',
        album: album?.title || 'Gracefy',
        artwork: artworkUrl ? [
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      });
    }
  }, []);

  const playSong = useCallback(async (song, album, songQueue = [], index = 0) => {
    // IMPORTANT: Stop any currently playing audio first to prevent multiple songs playing
    try {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } catch (e) {
      console.log('[Player] Error stopping current audio:', e);
    }
    
    // End previous session with duration
    if (sessionIdRef.current && audioRef.current) {
      try {
        const duration = Math.floor(audioRef.current.currentTime);
        await axios.post(`${API}/listening/end`, { 
          session_id: sessionIdRef.current,
          duration_seconds: duration
        });
      } catch (e) {
        console.log("Error ending session");
      }
    }

    setQueue(songQueue.length > 0 ? songQueue : [{ song, album }]);
    setQueueIndex(index);
    setCurrentSong(song);
    setCurrentAlbum(album);
    setIsLoading(true);

    // Update MediaSession for lock screen controls
    updateMediaSession(song, album);

    // Use helper to get proper audio URL (handles CDN, relative, and file IDs)
    const audioUrl = getAudioUrl(song.audio_url);
    
    audioRef.current.src = audioUrl;
    
    try {
      await audioRef.current.play();
      const res = await axios.post(`${API}/listening/start`, { 
        song_id: song.song_id,
        album_id: album?.album_id,
        user_id: localStorage.getItem('user_id') || 'anonymous'
      });
      sessionIdRef.current = res.data.session_id;
    } catch (e) {
      console.error("Playback failed:", e);
      setIsLoading(false);
    }
  }, [updateMediaSession]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }, [isPlaying]);

  const nextSong = useCallback(async () => {
    if (queue.length === 0) return;
    
    let nextIndex;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1;
    }
    
    // If still within queue, play next song
    if (nextIndex < queue.length) {
      playFromQueue(nextIndex);
      
      // Pre-fetch recommendations when 2 songs from queue end (like native app)
      if (continuousPlay && !shuffle && queue.length - nextIndex <= 2) {
        const currentItem = queue[nextIndex];
        const song = currentItem.song || currentItem;
        if (song?.song_id) {
          console.log('[Player] Pre-fetching recommendations (near end of queue)');
          fetchAndAddRecommendations(song.song_id);
        }
      }
      return;
    }
    
    // End of queue reached
    console.log('[Player] nextSong: End of queue');
    
    // If REPEAT ALL - loop back
    if (repeat === 'all') {
      console.log('[Player] nextSong: Repeat ALL - looping');
      playFromQueue(0);
      return;
    }
    
    // CONTINUOUS PLAY - fetch recommendations and play
    if (continuousPlay) {
      const currentItem = queue[queueIndex];
      const song = currentItem?.song || currentItem;
      
      if (song?.song_id) {
        console.log('[Player] nextSong: Fetching recommendations...');
        const added = await fetchAndAddRecommendations(song.song_id);
        
        if (added) {
          // Play first new song - use queueRef to get updated queue length after async fetch
          const updatedQueue = queueRef.current;
          const nextIdx = queue.length; // Original queue length = index of first new song
          console.log('[Player] nextSong: Playing recommended song at index', nextIdx, 'queue now has', updatedQueue.length, 'songs');
          playFromQueueInternal(nextIdx, updatedQueue);
          return;
        }
      }
    }
    
    // No more songs available
    console.log('[Player] nextSong: No more songs, staying on current');
  }, [queue, queueIndex, shuffle, playFromQueue, playFromQueueInternal, repeat, continuousPlay, fetchAndAddRecommendations]);

  const prevSong = useCallback(() => {
    if (currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (queue.length === 0) return;
    
    // If at first song, stay there (don't loop to end)
    if (queueIndex === 0) {
      audioRef.current.currentTime = 0;
      return;
    }
    
    playFromQueue(queueIndex - 1);
  }, [queue, queueIndex, currentTime, playFromQueue]);

  // Setup MediaSession action handlers for background playback controls
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        audioRef.current.play();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        audioRef.current.pause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', prevSong);
      navigator.mediaSession.setActionHandler('nexttrack', nextSong);
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          audioRef.current.currentTime = details.seekTime;
        }
      });
    }
  }, [nextSong, prevSong]);

  const seekTo = useCallback((value) => {
    audioRef.current.currentTime = value;
    setCurrentTime(value);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  }, []);

  // Method to block auto-play of next song (for screen lock billing)
  const setBlockAutoPlayNext = (block) => {
    blockAutoPlayNextRef.current = block;
  };
  
  // Method to set guest limit reached flag (stops autoplay when current song ends)
  const setGuestLimitReached = (reached) => {
    guestLimitReachedRef.current = reached;
  };
  
  // Play radio station
  const playRadio = async (station) => {
    if (!station?.url_resolved) {
      console.error('[Player] No radio URL provided');
      return;
    }
    
    console.log('[Player] Playing radio:', station.name);
    setIsLoading(true);
    
    try {
      // Stop current music playback
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Clear music state
      setCurrentSong(null);
      setCurrentAlbum(null);
      setQueue([]);
      setQueueIndex(0);
      
      // Set radio mode
      setIsRadioMode(true);
      setCurrentRadioStation(station);
      
      // Determine stream URL - use proxy for HTTP streams
      let streamUrl = station.url_resolved;
      if (streamUrl && streamUrl.startsWith('http://')) {
        streamUrl = `${API}/radio/stream/${station.station_id}`;
        console.log('[Player] Using proxy for HTTP stream');
      }
      
      // Play radio stream
      audioRef.current.src = streamUrl;
      audioRef.current.crossOrigin = "anonymous";
      
      await audioRef.current.play();
      setIsPlaying(true);
      setDuration(0); // Live streams have no duration
      
      // Track radio play
      try {
        await axios.post(`${API}/radio/play`, {
          station_id: station.station_id,
          platform: 'web'
        });
      } catch (e) {
        console.log('[Player] Radio tracking failed:', e);
      }
      
      console.log('[Player] Radio playing successfully');
    } catch (error) {
      console.error('[Player] Radio play error:', error);
      toast.error(`Failed to play ${station.name}. The stream may be temporarily unavailable.`);
      setIsRadioMode(false);
      setCurrentRadioStation(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Stop radio and clear state
  const stopRadio = () => {
    if (isRadioMode) {
      audioRef.current.pause();
      audioRef.current.src = '';
      setIsRadioMode(false);
      setCurrentRadioStation(null);
      setIsPlaying(false);
    }
  };
  
  // Toggle continuous play mode (auto-recommendations)
  const toggleContinuousPlay = useCallback(() => {
    setContinuousPlay(prev => {
      const newValue = !prev;
      console.log(`[Player] Continuous play ${newValue ? 'enabled' : 'disabled'}`);
      // If enabling continuous play, disable shuffle (like native app)
      if (newValue && shuffle) {
        setShuffle(false);
      }
      return newValue;
    });
  }, [shuffle]);
  
  return {
    currentSong, currentAlbum, queue, queueIndex, isPlaying, currentTime, duration, 
    volume, isMuted, shuffle, repeat, isLoading, showFullPlayer, playSong, togglePlay, 
    nextSong, prevSong, seekTo, setVolume, setIsMuted, setShuffle, cycleRepeat, setShowFullPlayer,
    restorePlaybackState, savePlaybackState, setBlockAutoPlayNext, setGuestLimitReached,
    // Continuous play (auto-recommendations) - mirrors native app
    continuousPlay, toggleContinuousPlay,
    // Radio
    isRadioMode, currentRadioStation, playRadio, stopRadio
  };
};

export default useAudioPlayer;
