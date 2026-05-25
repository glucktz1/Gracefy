/**
 * Audio Player Hook
 * Handles all audio playback logic including music and radio streaming
 * 
 * FEATURES:
 * - HLS Adaptive Streaming: Auto-adjusts quality based on network speed
 * - Continuous Playback: Uses /api/recommendations/next-songs for intelligent next-song selection
 * - Pre-fetches recommendations when 2 songs from queue end
 * - Seamlessly adds new songs to queue for uninterrupted playback
 * - Falls back to MP3 if HLS is not available
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import Hls from 'hls.js';
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
  const [streamingQuality, setStreamingQuality] = useState('auto'); // 'auto', 'low', 'medium', 'high'
  
  // Radio state
  const [isRadioMode, setIsRadioMode] = useState(false);
  const [currentRadioStation, setCurrentRadioStation] = useState(null);
  
  const audioRef = useRef(new Audio());
  const hlsRef = useRef(null); // HLS.js instance
  const sessionIdRef = useRef(null);
  const isFetchingRecommendationsRef = useRef(false); // Prevent duplicate fetches
  const blockAutoPlayNextRef = useRef(false); // For screen lock billing feature
  const guestLimitReachedRef = useRef(false); // For guest play limit - stop autoplay when reached
  const consecutiveErrorsRef = useRef(0); // Safeguard against infinite skip loop on errors
  
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

  // ============ HLS ADAPTIVE STREAMING HELPERS ============
  
  /**
   * Cleanup HLS instance when switching songs or unmounting
   */
  const cleanupHls = useCallback(() => {
    if (hlsRef.current) {
      console.log('[Player] Cleaning up HLS instance');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);
  
  /**
   * Setup HLS playback for a song with adaptive streaming
   * Falls back to direct MP3 if HLS is not available or fails
   * 
   * Performance: We cache whether HLS works in sessionStorage so subsequent
   * songs go straight to MP3 when HLS is known to fail (e.g., missing CORS
   * headers on the CDN). This eliminates the 3-5s manifest retry delay.
   */
  const setupAudioSource = useCallback((song, onReady) => {
    const audio = audioRef.current;
    const hlsUrl = song.hls_url;
    const mp3Url = getAudioUrl(song.audio_url);
    // Persist HLS-broken across reloads (not just the tab session).
    // Production CDN often returns no CORS on .m3u8, causing a 3s timeout
    // on every first song after each page reload. Once we've confirmed HLS
    // fails, remember it for 24h so MP3 is used directly.
    const HLS_BROKEN_KEY = 'hls_broken_until';
    let hlsKnownBroken = false;
    try {
      const sessionFlag = sessionStorage.getItem('hls_broken') === '1';
      const persistedUntil = parseInt(localStorage.getItem(HLS_BROKEN_KEY) || '0', 10);
      hlsKnownBroken = sessionFlag || (persistedUntil > Date.now());
    } catch (_) { /* storage disabled */ }
    
    // Tell the browser to aggressively preload audio bytes BEFORE we set src.
    // Without this, on slow networks the browser delays the byte fetch until
    // .play() is called → adds 500-1500ms to perceived load time.
    audio.preload = 'auto';
    
    // Cleanup any existing HLS instance
    cleanupHls();
    
    // Check if song has HLS and browser supports it (skip if we already know HLS fails this session)
    if (hlsUrl && Hls.isSupported() && !hlsKnownBroken) {
      console.log('[Player] Using HLS adaptive streaming:', hlsUrl);
      
      const hls = new Hls({
        // Auto quality selection based on bandwidth
        autoStartLoad: true,
        startLevel: -1, // Auto-select starting quality
        capLevelToPlayerSize: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // Fail fast on CORS / network errors so we fall back to MP3 quickly
        manifestLoadingMaxRetry: 1,
        manifestLoadingRetryDelay: 500,
        manifestLoadingTimeOut: 2000,
        levelLoadingMaxRetry: 1,
        levelLoadingTimeOut: 2000,
        fragLoadingMaxRetry: 2,
      });
      
      hlsRef.current = hls;
      
      hls.loadSource(hlsUrl);
      hls.attachMedia(audio);
      
      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log('[Player] HLS manifest loaded, quality levels:', data.levels.length);
        if (onReady) onReady();
      });
      
      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        const level = hls.levels[data.level];
        console.log(`[Player] HLS quality switched to: ${level?.bitrate / 1000}kbps`);
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('[Player] HLS error:', data.type, data.details);
        
        if (data.fatal) {
          // Remember HLS is broken across reloads (24h TTL).
          try {
            sessionStorage.setItem('hls_broken', '1');
            localStorage.setItem(HLS_BROKEN_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
          } catch (e) {}
          
          // If we don't have an MP3 fallback URL, there's nothing to do but
          // skip the song. The audio element's `error` event handler will
          // catch this via "no supported sources" and advance the queue.
          const canFallback = mp3Url && mp3Url !== SAMPLE_AUDIO_URL;
          
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('[Player] HLS network error, falling back to MP3');
              cleanupHls();
              if (canFallback) {
                audio.src = mp3Url;
                if (onReady) onReady();
              } else {
                // No MP3 → trigger the audio error path to skip song
                try { audio.removeAttribute('src'); audio.load(); } catch (_) {}
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('[Player] HLS media error, attempting recovery');
              try {
                hls.recoverMediaError();
              } catch (recoveryErr) {
                console.warn('[Player] HLS recovery threw, falling back to MP3:', recoveryErr?.message);
                cleanupHls();
                if (canFallback) {
                  audio.src = mp3Url;
                  if (onReady) onReady();
                }
              }
              break;
            default:
              console.log('[Player] HLS fatal error, falling back to MP3');
              cleanupHls();
              if (canFallback) {
                audio.src = mp3Url;
                if (onReady) onReady();
              } else {
                try { audio.removeAttribute('src'); audio.load(); } catch (_) {}
              }
              break;
          }
        }
      });
      
    } else if (hlsUrl && audio.canPlayType('application/vnd.apple.mpegurl') && !hlsKnownBroken) {
      // Native HLS support (Safari)
      console.log('[Player] Using native HLS (Safari):', hlsUrl);
      audio.src = hlsUrl;
      if (onReady) onReady();
      
    } else {
      // No HLS available (or known broken this session), use direct MP3
      if (hlsKnownBroken) {
        console.log('[Player] HLS known broken, using MP3 direct:', mp3Url);
      } else {
        console.log('[Player] Using direct MP3:', mp3Url);
      }
      audio.src = mp3Url;
      if (onReady) onReady();
    }
    
    return { hlsUrl, mp3Url };
  }, [cleanupHls]);
  
  // Cleanup HLS on unmount
  useEffect(() => {
    return () => {
      cleanupHls();
    };
  }, [cleanupHls]);

  // Global swallower for known audio errors so the React DEV error overlay
  // doesn't surface "The element has no supported sources." as a fatal page
  // crash. The audio element's own `error` event handler already takes care
  // of skipping to the next song — these errors are intentional fall-throughs,
  // not bugs the user should see.
  useEffect(() => {
    const AUDIO_ERROR_PATTERNS = [
      'no supported sources',
      'media error: format',
      'NotSupportedError',
      'MEDIA_ELEMENT_ERROR',
    ];
    const isKnownAudioError = (msg) => {
      if (!msg || typeof msg !== 'string') return false;
      return AUDIO_ERROR_PATTERNS.some(p => msg.toLowerCase().includes(p.toLowerCase()));
    };
    const onUnhandledRejection = (event) => {
      const reason = event.reason;
      const msg = reason?.message || String(reason || '');
      if (isKnownAudioError(msg)) {
        console.warn('[Player] Swallowed audio promise rejection:', msg);
        event.preventDefault();
      }
    };
    const onWindowError = (event) => {
      const msg = event?.message || event?.error?.message || '';
      if (isKnownAudioError(msg)) {
        console.warn('[Player] Swallowed audio window error:', msg);
        event.preventDefault();
        return true;
      }
      return false;
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onWindowError, true);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onWindowError, true);
    };
  }, []);

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

  // Periodic heartbeat while playing - keeps the user on the live listener
  // dashboard for as long as audio is actively playing (every 20s).
  useEffect(() => {
    if (!isPlaying) return undefined;
    const interval = setInterval(() => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      const position = Math.floor(audioRef.current?.currentTime || 0);
      // Fire-and-forget. Use keepalive so it survives tab background.
      try {
        fetch(`${API}/listening/ping`, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sid, position_seconds: position }),
        }).catch(() => {});
      } catch (_) {}
    }, 20000);
    return () => clearInterval(interval);
  }, [isPlaying]);

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

    // Validate audio URL before attempting to play.
    // Songs from /recommendations/next-songs may arrive without audio_url
    // OR with hls_url pointing to a broken manifest. If we have NEITHER a
    // usable mp3 NOR an hls_url, skip the song silently (don't show error
    // overlay) and advance the queue. This prevents the "no supported sources"
    // runtime error from killing autoplay continuity.
    const hasHls = !!song.hls_url;
    const audioUrl = getAudioUrl(song.audio_url);
    const hasUsableMp3 = audioUrl && audioUrl !== SAMPLE_AUDIO_URL;
    if (!hasHls && !hasUsableMp3) {
      console.warn('[Player] Song has no usable source, skipping silently:', song.title || song.song_id);
      setIsLoading(false);
      // Advance the queue without surfacing an error to the user.
      const nextIdx = index + 1;
      if (nextIdx < q.length) {
        setTimeout(() => playFromQueueInternalRef.current(nextIdx, q), 50);
      }
      return;
    }
    
    // Set preload to auto for faster loading
    audioRef.current.preload = 'auto';
    
    // Setup audio source (HLS with fallback to MP3)
    setupAudioSource(song, async () => {
      try {
        // Use play() with promise handling for better browser compatibility
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log('[Player] Playback started successfully');
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
              console.error('[Player] Audio format not supported or URL invalid');
            }
            setIsLoading(false);
          });
        }
      } catch (e) {
        console.error('[Player] Play error:', e);
        setIsLoading(false);
      }
    });
    
    try {
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
      console.log('[Player] Guest limit reached:', guestLimitReachedRef.current);
      
      // Track the ended session with duration (for play count) - non-blocking
      // Uses fetch+keepalive so the request survives a redirect / nav.
      if (sessionIdRef.current) {
        try {
          fetch(`${API}/listening/end`, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionIdRef.current,
              duration_seconds: Math.floor(audio.duration || 0),
            }),
          }).catch(() => {});
        } catch (_) {}
      }
      
      // Check if auto-play is blocked (screen lock payment feature or guest limit)
      if (blockAutoPlayNextRef.current) {
        console.log('[Player] Auto-play blocked (screen lock) - stopping');
        blockAutoPlayNextRef.current = false;
        setIsPlaying(false);
        return;
      }
      
      // CRITICAL: Check if guest limit reached - STOP playback until user signs in
      if (guestLimitReachedRef.current) {
        console.log('[Player] GUEST LIMIT REACHED - stopping playback, user must sign in');
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

      // Auto-skip to next on error (with safeguard against infinite skip loop)
      // If 3+ consecutive songs fail, stop trying so we don't hammer the user with toasts.
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current <= 3 && !guestLimitReachedRef.current && !blockAutoPlayNextRef.current) {
        console.log(`[Player] Auto-skipping after error (attempt ${consecutiveErrorsRef.current}/3)`);
        // Defer to avoid same-tick recursion
        setTimeout(() => handleSongEnd(), 250);
      } else if (consecutiveErrorsRef.current > 3) {
        console.warn('[Player] Too many consecutive errors — stopping playback');
        setIsPlaying(false);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => {
      setIsLoading(false);
      consecutiveErrorsRef.current = 0; // Reset error counter on successful playback
    };

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

  // Setup MediaSession action handlers for lock screen controls
  // These need to be set up ONCE and persist throughout the app lifecycle
  useEffect(() => {
    if ('mediaSession' in navigator) {
      // Play action
      navigator.mediaSession.setActionHandler('play', () => {
        console.log('[MediaSession] Play action triggered');
        audioRef.current.play().catch(e => console.log('[MediaSession] Play failed:', e));
      });
      
      // Pause action
      navigator.mediaSession.setActionHandler('pause', () => {
        console.log('[MediaSession] Pause action triggered');
        audioRef.current.pause();
      });
      
      // Previous track
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        console.log('[MediaSession] Previous track action triggered');
        const currentQueue = queueRef.current;
        const currentIndex = queueIndexRef.current;
        if (currentIndex > 0) {
          playFromQueueInternalRef.current(currentIndex - 1, currentQueue);
        } else if (currentQueue.length > 0) {
          // Loop to last song
          playFromQueueInternalRef.current(currentQueue.length - 1, currentQueue);
        }
      });
      
      // Next track
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        console.log('[MediaSession] Next track action triggered');
        const currentQueue = queueRef.current;
        const currentIndex = queueIndexRef.current;
        if (currentIndex < currentQueue.length - 1) {
          playFromQueueInternalRef.current(currentIndex + 1, currentQueue);
        } else if (repeatRef.current === 'all' && currentQueue.length > 0) {
          // Loop to first song
          playFromQueueInternalRef.current(0, currentQueue);
        }
      });
      
      // Seek backward
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skipTime = details.seekOffset || 10;
        audioRef.current.currentTime = Math.max(audioRef.current.currentTime - skipTime, 0);
      });
      
      // Seek forward
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skipTime = details.seekOffset || 10;
        audioRef.current.currentTime = Math.min(audioRef.current.currentTime + skipTime, audioRef.current.duration || 0);
      });
      
      // Seek to specific position
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          audioRef.current.currentTime = details.seekTime;
        }
      });
      
      console.log('[MediaSession] Action handlers registered');
    }
    
    return () => {
      // Cleanup action handlers on unmount
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      }
    };
  }, []);
  
  // Update MediaSession playback state when playing/paused
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);
  
  // Update MediaSession position state periodically
  useEffect(() => {
    if ('mediaSession' in navigator && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: audioRef.current.playbackRate || 1,
          position: currentTime
        });
      } catch (e) {
        // Position state not supported or invalid values
      }
    }
  }, [currentTime, duration]);

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
    
    // End previous session with duration (keepalive fetch survives rapid skip/nav)
    if (sessionIdRef.current && audioRef.current) {
      try {
        const dur = Math.floor(audioRef.current.currentTime);
        fetch(`${API}/listening/end`, {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionIdRef.current, duration_seconds: dur }),
        }).catch(() => {});
      } catch (_) {}
    }

    setQueue(songQueue.length > 0 ? songQueue : [{ song, album }]);
    setQueueIndex(index);
    setCurrentSong(song);
    setCurrentAlbum(album);
    setIsLoading(true);

    // Update MediaSession for lock screen controls
    updateMediaSession(song, album);

    // Validate audio URL before attempting to play
    const audioUrl = getAudioUrl(song.audio_url);
    if (!audioUrl || audioUrl === SAMPLE_AUDIO_URL) {
      // Even without MP3, HLS may still play
      if (!song.hls_url) {
        console.error('[Player] Invalid or missing audio URL for song:', song.title);
        setIsLoading(false);
        return;
      }
    }

    // Faster initial start: tell the browser to begin buffering aggressively
    audioRef.current.preload = 'auto';

    // Setup audio source (HLS with fallback to MP3) — same fast path as queue playback
    setupAudioSource(song, async () => {
      try {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.log('[Player] Autoplay/Play error:', error.name, error.message);
            setIsLoading(false);
          });
        }
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
    });
  }, [updateMediaSession, setupAudioSource]);

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
    // HLS Adaptive Streaming
    streamingQuality, setStreamingQuality,
    // Radio
    isRadioMode, currentRadioStation, playRadio, stopRadio
  };
};

export default useAudioPlayer;
