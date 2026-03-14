/**
 * Audio Player Hook
 * Handles all audio playback logic including music and radio streaming
 * Extracted from UserStreamingApp.jsx
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, getAudioUrl, getImageUrl } from '@/utils/streamingHelpers';

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
  const [repeat, setRepeat] = useState('off'); // Default OFF - no repeat, continuous play to next album
  const [isLoading, setIsLoading] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  
  // Radio state
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [currentRadioStation, setCurrentRadioStation] = useState(null);
  
  const audioRef = useRef(new Audio());
  const sessionIdRef = useRef(null);
  const fetchingMoreRef = useRef(false);
  const blockAutoPlayNextRef = useRef(false); // For screen lock billing feature
  const guestLimitReachedRef = useRef(false); // For guest play limit - stop autoplay when reached
  
  // Use refs to track latest values for event handlers (avoids stale closures)
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const currentAlbumRef = useRef(currentAlbum);
  const repeatRef = useRef(repeat);
  const shuffleRef = useRef(shuffle);
  
  // Keep refs in sync with state
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { currentAlbumRef.current = currentAlbum; }, [currentAlbum]);
  useEffect(() => { repeatRef.current = repeat; }, [repeat]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);

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
          console.log('[Player] Autoplay blocked:', error.name);
          // If autoplay is blocked, show a play button or wait for user interaction
          if (error.name === 'NotAllowedError') {
            // Browser blocked autoplay - this is normal on first interaction
            // The user will need to click play
            setIsLoading(false);
            return;
          }
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

  // Handle song end - with continuous playback
  // Use a ref to store playFromQueueInternal to avoid stale closures
  const playFromQueueInternalRef = useRef(playFromQueueInternal);
  useEffect(() => { playFromQueueInternalRef.current = playFromQueueInternal; }, [playFromQueueInternal]);
  
  // Store currentSong and currentAlbum in refs for event handlers
  const currentSongRef = useRef(currentSong);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  
  // Store savePlaybackState in ref
  const savePlaybackStateRef = useRef(savePlaybackState);
  useEffect(() => { savePlaybackStateRef.current = savePlaybackState; }, [savePlaybackState]);
  
  // Setup audio event listeners ONCE on mount
  useEffect(() => {
    const audio = audioRef.current;
    
    const handleSongEnd = async () => {
      // Use refs to get latest values (avoids stale closures)
      const currentQueue = queueRef.current;
      const currentQueueIndex = queueIndexRef.current;
      const album = currentAlbumRef.current;
      const currentRepeat = repeatRef.current;
      const currentShuffle = shuffleRef.current;
      
      console.log('[Player] ========== handleSongEnd called ==========');
      console.log('[Player] Queue length:', currentQueue.length, 'Current index:', currentQueueIndex);
      console.log('[Player] Repeat mode:', currentRepeat, 'Shuffle:', currentShuffle);
      console.log('[Player] Album:', album?.title);
      
      // Track the ended session with duration (for play count) - non-blocking
      if (sessionIdRef.current) {
        axios.post(`${API}/listening/end`, {
          session_id: sessionIdRef.current,
          duration_seconds: Math.floor(audio.duration || 0)
        }).catch(e => console.log("Failed to track play end"));
      }
      
      // Check if auto-play is blocked (screen lock payment feature)
      if (blockAutoPlayNextRef.current) {
        console.log('[Player] Auto-play blocked due to screen lock billing - stopping');
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

      // If still within queue, play next song (regardless of guest limit)
      if (nextIndex < currentQueue.length) {
        console.log('[Player] Playing next song at index:', nextIndex);
        playFromQueueInternalRef.current(nextIndex, currentQueue);
        return;
      }
      
      // End of queue reached
      console.log('[Player] End of queue reached');
      
      // Check guest limit - only block fetching MORE songs
      if (guestLimitReachedRef.current) {
        console.log('[Player] Guest limit reached - stopping at end of queue');
        setIsPlaying(false);
        return;
      }
      
      // If REPEAT ALL is ON - loop back to start
      if (currentRepeat === 'all' && currentQueue.length > 0) {
        console.log('[Player] Repeat ALL - looping to start');
        playFromQueueInternalRef.current(0, currentQueue);
        return;
      }
      
      console.log('[Player] Repeat OFF - fetching more songs...');
      
      try {
        let moreSongs = [];
        const currentSongIds = new Set(currentQueue.map(q => (q.song || q).song_id));
        
        // Strategy 1: Get more songs from the same album
        if (album?.album_id) {
          try {
            console.log('[Player] Trying to get more from same album:', album.album_id);
            const albumRes = await axios.get(`${API}/user/album/${album.album_id}/songs`);
            const albumSongs = albumRes.data.songs || [];
            const newSongs = albumSongs.filter(s => !currentSongIds.has(s.song_id));
            if (newSongs.length > 0) {
              moreSongs = newSongs.map(s => ({ song: s, album }));
              console.log('[Player] Found', newSongs.length, 'more songs from same album');
            }
          } catch (e) {
            console.log('[Player] Album fetch failed:', e.message);
          }
        }
        
        // Strategy 2: Get songs from same category (different albums)
        if (moreSongs.length === 0 && album?.category_id) {
          try {
            console.log('[Player] Trying category:', album.category_id);
            const catRes = await axios.get(`${API}/user/browse/category/${album.category_id}`);
            const albums = (catRes.data.albums || []).filter(a => a.album_id !== album?.album_id);
            
            for (const fetchedAlbum of albums.slice(0, 5)) {
              try {
                const songsRes = await axios.get(`${API}/user/album/${fetchedAlbum.album_id}/songs`);
                const songs = (songsRes.data.songs || []).filter(s => !currentSongIds.has(s.song_id));
                moreSongs.push(...songs.map(s => ({ song: s, album: fetchedAlbum })));
                if (moreSongs.length >= 15) break;
              } catch (e) { }
            }
            if (moreSongs.length > 0) {
              console.log('[Player] Found', moreSongs.length, 'songs from category');
            }
          } catch (e) {
            console.log('[Player] Category fetch failed:', e.message);
          }
        }
        
        // Strategy 3: Get songs from home page sections (any content)
        if (moreSongs.length === 0) {
          try {
            console.log('[Player] Trying home page sections...');
            const homeRes = await axios.get(`${API}/user/home?platform=web`);
            const sections = homeRes.data.sections || [];
            
            for (const section of sections) {
              const items = section.items || [];
              for (const item of items) {
                if (item.album_id && item.album_id !== album?.album_id) {
                  try {
                    const songsRes = await axios.get(`${API}/user/album/${item.album_id}/songs`);
                    const songs = (songsRes.data.songs || []).filter(s => !currentSongIds.has(s.song_id));
                    if (songs.length > 0) {
                      moreSongs.push(...songs.map(s => ({ song: s, album: item })));
                      console.log('[Player] Added', songs.length, 'songs from', item.title);
                      if (moreSongs.length >= 15) break;
                    }
                  } catch (e) { }
                }
              }
              if (moreSongs.length >= 15) break;
            }
            if (moreSongs.length > 0) {
              console.log('[Player] Found', moreSongs.length, 'songs from home sections');
            }
          } catch (e) {
            console.log('[Player] Home fetch failed:', e.message);
          }
        }
        
        // If we found more songs, add to queue and play next
        if (moreSongs.length > 0) {
          console.log('[Player] SUCCESS - Adding', moreSongs.length, 'songs to queue and continuing');
          const newQueue = [...currentQueue, ...moreSongs];
          setQueue(newQueue);
          queueRef.current = newQueue;
          // Play the first new song (index = old queue length)
          playFromQueueInternalRef.current(currentQueue.length, newQueue);
          return;
        }
        
        console.log('[Player] Could not find any more songs');
      } catch (e) {
        console.error('[Player] Error in fetch more songs:', e);
      }
      
      // No more songs available - stop playback (DO NOT LOOP when repeat is off)
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
      console.log('[Player] Audio error:', e);
      setIsLoading(false);
      // Auto-skip to next on error
      handleSongEnd();
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
      return;
    }
    
    // End of queue - try to fetch more songs (if not guest limited)
    if (guestLimitReachedRef.current) {
      console.log('[Player] nextSong: Guest limit reached - cannot fetch more');
      return; // Stay on current song
    }
    
    console.log('[Player] nextSong: End of queue, fetching more...');
    
    try {
      const currentAlbumData = queue[queueIndex]?.album || currentAlbum;
      let moreSongs = [];
      const currentSongIds = new Set(queue.map(q => (q.song || q).song_id));
      
      // Strategy 1: Same category different albums
      if (currentAlbumData?.category_id) {
        try {
          const catRes = await axios.get(`${API}/user/browse/category/${currentAlbumData.category_id}`);
          const albums = (catRes.data.albums || []).filter(a => a.album_id !== currentAlbumData?.album_id);
          
          for (const fetchedAlbum of albums.slice(0, 5)) {
            try {
              const albumRes = await axios.get(`${API}/user/album/${fetchedAlbum.album_id}/songs`);
              const songs = (albumRes.data.songs || []).filter(s => !currentSongIds.has(s.song_id));
              moreSongs.push(...songs.map(s => ({ song: s, album: fetchedAlbum })));
              if (moreSongs.length >= 15) break;
            } catch (e) { }
          }
        } catch (e) {
          console.log('[Player] Category fetch failed');
        }
      }
      
      // Strategy 2: Home page sections
      if (moreSongs.length === 0) {
        try {
          const homeRes = await axios.get(`${API}/user/home?platform=web`);
          const sections = homeRes.data.sections || [];
          
          for (const section of sections) {
            for (const item of (section.items || [])) {
              if (item.album_id && item.album_id !== currentAlbumData?.album_id) {
                try {
                  const albumRes = await axios.get(`${API}/user/album/${item.album_id}/songs`);
                  const songs = (albumRes.data.songs || []).filter(s => !currentSongIds.has(s.song_id));
                  if (songs.length > 0) {
                    moreSongs.push(...songs.map(s => ({ song: s, album: item })));
                    if (moreSongs.length >= 15) break;
                  }
                } catch (e) { }
              }
            }
            if (moreSongs.length >= 15) break;
          }
        } catch (e) {
          console.log('[Player] Home fetch failed');
        }
      }
      
      if (moreSongs.length > 0) {
        console.log('[Player] nextSong: Found', moreSongs.length, 'more songs');
        const newQueue = [...queue, ...moreSongs];
        setQueue(newQueue);
        queueRef.current = newQueue;
        playFromQueue(queue.length); // Play first new song
        return;
      }
    } catch (e) {
      console.error('[Player] Error fetching more songs:', e);
    }
    
    // No more songs - DO NOT LOOP, just stop (unless repeat is on)
    if (repeat === 'all') {
      console.log('[Player] nextSong: Repeat ALL - looping');
      playFromQueue(0);
    } else {
      console.log('[Player] nextSong: No more songs, stopping');
      // Stay on current song but don't play
    }
  }, [queue, queueIndex, shuffle, playFromQueue, repeat, currentAlbum]);

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
  
  return {
    currentSong, currentAlbum, queue, queueIndex, isPlaying, currentTime, duration, 
    volume, isMuted, shuffle, repeat, isLoading, showFullPlayer, playSong, togglePlay, 
    nextSong, prevSong, seekTo, setVolume, setIsMuted, setShuffle, cycleRepeat, setShowFullPlayer,
    restorePlaybackState, savePlaybackState, setBlockAutoPlayNext, setGuestLimitReached,
    // Radio
    isRadioMode, currentRadioStation, playRadio, stopRadio
  };
};

export default useAudioPlayer;
