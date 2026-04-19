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
  const failedSongsRef = useRef(new Set()); // Track songs that failed to play
  const retryCountRef = useRef({}); // Track retry attempts for songs with network errors
  const isTransitioningRef = useRef(false); // Kept for future use
  const pendingPlayRef = useRef(false); // Flag for pending play when screen is locked
  const earlyTransitionFiredRef = useRef(false); // Prevent double-fire of song end
  
  // Audio ads state
  const [songsPlayedCount, setSongsPlayedCount] = useState(0);
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [currentAd, setCurrentAd] = useState(null);
  const [adSettings, setAdSettings] = useState(null);
  const lastAdTimeRef = useRef(null);
  const songsPlayedCountRef = useRef(0);
  
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
   * UPDATED: Prioritize MP3 for reliability, use HLS only as fallback
   * This prevents "format not supported" errors on problematic HLS streams
   */
  const setupAudioSource = useCallback((song, onReady) => {
    const audio = audioRef.current;
    const hlsUrl = song.hls_url;
    const mp3Url = getAudioUrl(song.audio_url);
    
    // Cleanup any existing HLS instance
    cleanupHls();
    
    // PRIORITIZE MP3 for reliability - works on all browsers
    // Only use HLS if no MP3 available
    if (mp3Url && mp3Url !== SAMPLE_AUDIO_URL) {
      console.log('[Player] Using MP3 (reliable):', mp3Url);
      audio.src = mp3Url;
      if (onReady) onReady();
      return { hlsUrl, mp3Url };
    }
    
    // Fallback to HLS if no MP3 available
    if (hlsUrl && Hls.isSupported()) {
      console.log('[Player] Using HLS (no MP3 available):', hlsUrl);
      
      const hls = new Hls({
        autoStartLoad: true,
        startLevel: -1,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        fragLoadingMaxRetry: 2,
        manifestLoadingMaxRetry: 2,
      });
      
      hlsRef.current = hls;
      
      hls.loadSource(hlsUrl);
      hls.attachMedia(audio);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[Player] HLS manifest loaded');
        if (onReady) onReady();
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('[Player] HLS error:', data.type, data.details);
        if (data.fatal) {
          console.log('[Player] HLS fatal error, no fallback available');
          cleanupHls();
          // Trigger error so it auto-skips to next
          const errorEvent = new Event('error');
          audio.dispatchEvent(errorEvent);
        }
      });
      
    } else if (hlsUrl && audio.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      console.log('[Player] Using native HLS (Safari):', hlsUrl);
      audio.src = hlsUrl;
      if (onReady) onReady();
      
    } else {
      // No valid audio source
      console.error('[Player] No valid audio source for song:', song.title);
      if (onReady) onReady(); // Let it fail and auto-skip
    }
    
    return { hlsUrl, mp3Url };
  }, [cleanupHls]);
  
  // Cleanup HLS on unmount
  useEffect(() => {
    return () => {
      cleanupHls();
    };
  }, [cleanupHls]);

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
        
        // Filter out songs already in queue AND songs that previously failed
        const newSongs = res.data.songs.filter(song => 
          !currentSongIds.has(song.song_id) && 
          !failedSongsRef.current.has(song.song_id)
        );
        
        if (newSongs.length > 0) {
          console.log(`[Player] Adding ${newSongs.length} recommended songs (filtered ${res.data.songs.length - newSongs.length} existing/failed)`);
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
          console.log('[Player] All recommended songs already in queue or previously failed');
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

  // Stall detection and recovery
  const stallCountRef = useRef(0);
  const lastProgressTimeRef = useRef(0);
  
  useEffect(() => {
    const audio = audioRef.current;
    
    // Handle stall/waiting events
    const handleWaiting = () => {
      console.log('[Player] Buffering/waiting...');
      stallCountRef.current++;
      
      // If stuck for too long (5+ stalls in short time), try recovery
      if (stallCountRef.current >= 5 && hlsRef.current) {
        console.log('[Player] Multiple stalls detected, attempting HLS recovery');
        stallCountRef.current = 0;
        try {
          hlsRef.current.recoverMediaError();
        } catch (e) {
          console.log('[Player] HLS recovery failed:', e);
        }
      }
    };
    
    const handlePlaying = () => {
      // Reset stall count when playback resumes
      stallCountRef.current = 0;
    };
    
    const handleStalled = () => {
      console.log('[Player] Playback stalled, attempting recovery...');
      // Try to resume playback
      setTimeout(() => {
        if (audio.paused && isPlaying) {
          audio.play().catch(() => {});
        }
      }, 1000);
    };
    
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('stalled', handleStalled);
    
    return () => {
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('stalled', handleStalled);
    };
  }, [isPlaying]);

  // Play a song from the queue by index
  // Simple preloading for faster next-song transitions
  const preloadNextSong = useCallback((currentIndex, currentQueue) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < currentQueue.length) {
      const nextItem = currentQueue[nextIndex];
      const nextSong = nextItem.song || nextItem;
      
      // Preload MP3 URL (more reliable than HLS)
      const preloadUrl = nextSong?.audio_url ? getAudioUrl(nextSong.audio_url) : null;
      
      if (preloadUrl) {
        const preloadAudio = new Audio();
        preloadAudio.preload = 'metadata';
        preloadAudio.src = preloadUrl;
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
    
    // Reset early transition flag for the new song
    earlyTransitionFiredRef.current = false;
    
    // IMPORTANT: Stop current audio before playing new one
    // Just change source directly - no explicit pause needed
    // This avoids the browser revoking audio focus during transitions
    try {
      audioRef.current.currentTime = 0;
    } catch (e) {
      console.log('[Player] Error resetting current audio:', e);
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

    // Validate audio URL before attempting to play
    const audioUrl = getAudioUrl(song.audio_url);
    if (!audioUrl) {
      console.error('[Player] Missing audio URL for song:', song.title, song.song_id);
      toast.error(`"${song.title}" - Audio not available. Skipping...`);
      setIsLoading(false);
      
      // Auto-skip to next song if audio is missing
      const nextIndex = index + 1;
      if (nextIndex < q.length) {
        setTimeout(() => {
          playFromQueueInternalRef.current(nextIndex, q);
        }, 500);
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
            pendingPlayRef.current = false;
            // Preload next song after current starts playing
            preloadNextSong(index, q);
          }).catch(error => {
            console.log('[Player] Autoplay blocked:', error.name, error.message);
            if (error.name === 'NotAllowedError') {
              // Browser blocked autoplay - likely screen is locked
              // Store pending play so visibilitychange can resume
              pendingPlayRef.current = true;
              console.log('[Player] Pending play set - will resume when page becomes visible');
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
        isTransitioningRef.current = false;
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
      if (sessionIdRef.current) {
        axios.post(`${API}/listening/end`, {
          session_id: sessionIdRef.current,
          duration_seconds: Math.floor(audio.duration || 0)
        }).catch(e => console.log("Failed to track play end"));
      }
      
      // Check if auto-play is blocked (screen lock payment feature)
      // This MUST come before ad check - billing block takes priority
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
      
      // Increment songs played count for ad tracking
      songsPlayedCountRef.current += 1;
      
      // Check if we should play an ad before the next song (non-blocking)
      // Fire and forget - don't block song transitions
      const adSongsPlayed = songsPlayedCountRef.current;
      axios.get(`${API}/advertising/next-ad`, {
        params: {
          user_id: localStorage.getItem('user_id') || '',
          platform: 'web',
          songs_played: adSongsPlayed,
          last_ad_time: lastAdTimeRef.current || ''
        },
        timeout: 2000 // 2 second timeout - don't block playback
      }).then(adRes => {
        if (adRes.data?.should_play_ad && adRes.data?.ad) {
          console.log('[Player] Ad triggered:', adRes.data.ad.title);
          // Pause current playback for ad
          audioRef.current.pause();
          setCurrentAd(adRes.data.ad);
          setAdSettings(adRes.data.settings);
          setShowAdOverlay(true);
          lastAdTimeRef.current = new Date().toISOString();
        }
      }).catch(() => {}); // Silently ignore ad check failures
      
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
          
          // Recommendations failed or returned empty - loop back to start as fallback
          console.log('[Player] No recommendations available - looping to start');
          playFromQueueInternalRef.current(0, currentQueue);
          return;
        }
      }
      
      // If repeat is off and no continuous play, still loop the queue for better UX
      if (currentQueue.length > 0) {
        console.log('[Player] End of queue with repeat off - looping to start for better UX');
        playFromQueueInternalRef.current(0, currentQueue);
        return;
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
      
      // EARLY TRANSITION: When within 0.3s of the end, trigger next song
      // while audio session is still "playing" - prevents lock screen blocking
      if (audio.duration > 0 && audio.duration - audio.currentTime < 0.3 && audio.duration - audio.currentTime > 0 && !earlyTransitionFiredRef.current) {
        earlyTransitionFiredRef.current = true;
        console.log('[Player] Early transition triggered (0.3s before end)');
        handleSongEnd();
      }
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const onEnded = () => {
      // Skip if early transition already handled this
      if (earlyTransitionFiredRef.current) {
        console.log('[Player] Ended event - already handled by early transition');
        return;
      }
      console.log('[Player] Audio ended event fired!');
      handleSongEnd();
    };
    
    const MAX_RETRIES = 2;
    
    const onError = (e) => {
      const audio = audioRef.current;
      const error = audio.error;
      const currentSong = currentSongRef.current;
      let errorMessage = 'Unknown error';
      let shouldRetry = false;
      
      if (error) {
        switch (error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Playback aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error - retrying...';
            shouldRetry = true;
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Audio file is corrupted';
            shouldRetry = true; // Try once more - might be a partial download
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            // Could be temporary CDN issue or actual format problem
            errorMessage = 'Audio temporarily unavailable';
            shouldRetry = true; // Try once - CDN might have hiccupped
            break;
        }
      }
      
      const songId = currentSong?.song_id;
      const retryCount = songId ? (retryCountRef.current[songId] || 0) : MAX_RETRIES;
      
      console.error('[Player] Audio error:', errorMessage, {
        src: audio.src?.substring(0, 100),
        networkState: audio.networkState,
        readyState: audio.readyState,
        errorCode: error?.code,
        song: currentSong?.title,
        retryCount
      });
      
      // Retry on network errors (up to MAX_RETRIES times)
      if (shouldRetry && songId && retryCount < MAX_RETRIES) {
        retryCountRef.current[songId] = retryCount + 1;
        console.log(`[Player] Retrying song (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
        
        // Small delay before retry
        setTimeout(() => {
          if (audio.src) {
            audio.load();
            audio.play().catch(e => console.error('[Player] Retry play failed:', e));
          }
        }, 1000);
        return; // Don't skip yet, wait for retry
      }
      
      // Track failed song to avoid re-adding it to queue
      if (songId) {
        failedSongsRef.current.add(songId);
        delete retryCountRef.current[songId]; // Clean up retry count
        console.error('[Player] Added to failed songs:', songId, 'Total failed:', failedSongsRef.current.size);
      }
      
      // Show toast notification for the error
      if (currentSong) {
        toast.error(`"${currentSong.title}" - ${errorMessage}`, { duration: 3000 });
      }
      
      setIsLoading(false);
      
      // Remove failed song from queue and auto-skip
      setTimeout(() => {
        const currentQueue = queueRef.current;
        const currentQueueIndex = queueIndexRef.current;
        
        // Filter out the failed song from the queue
        const newQueue = currentQueue.filter((_, idx) => idx !== currentQueueIndex);
        if (newQueue.length !== currentQueue.length) {
          setQueue(newQueue);
          queueRef.current = newQueue;
        }
        
        // Play next song (now at same index since we removed current)
        if (currentQueueIndex < newQueue.length) {
          console.log('[Player] Playing next song after removing failed track');
          playFromQueueInternalRef.current(currentQueueIndex, newQueue);
        } else if (newQueue.length > 0) {
          // Loop back to start if we were at the end
          console.log('[Player] Looping back to start after removing failed track');
          playFromQueueInternalRef.current(0, newQueue);
        } else {
          console.log('[Player] No more songs in queue');
        }
      }, 300);
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
  
  // Visibility change listener - resume pending playback when screen is unlocked
  // Only resumes if there's a pending play AND billing lock is not active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && pendingPlayRef.current && !blockAutoPlayNextRef.current) {
        console.log('[Player] Page visible again - resuming pending playback');
        pendingPlayRef.current = false;
        audioRef.current.play().then(() => {
          console.log('[Player] Resumed playback after visibility change');
        }).catch(e => {
          console.log('[Player] Resume failed:', e.name);
        });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    earlyTransitionFiredRef.current = false;
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
  
  // Ad complete/skip handler - resumes music playback
  const handleAdComplete = useCallback(() => {
    console.log('[Player] Ad complete - resuming music');
    setShowAdOverlay(false);
    setCurrentAd(null);
    // Resume the song that was playing when ad interrupted
    audioRef.current.play().catch(e => console.log('[Player] Resume after ad failed:', e));
  }, []);
  
  const handleAdSkip = useCallback(() => {
    console.log('[Player] Ad skipped - resuming music');
    setShowAdOverlay(false);
    setCurrentAd(null);
    // Resume the song that was playing when ad interrupted
    audioRef.current.play().catch(e => console.log('[Player] Resume after ad skip failed:', e));
  }, []);
  
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
    isRadioMode, currentRadioStation, playRadio, stopRadio,
    // Audio Ads
    showAdOverlay, currentAd, adSettings, handleAdComplete, handleAdSkip
  };
};

export default useAudioPlayer;
