import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1,
  Heart, MoreHorizontal, ChevronLeft, ChevronRight, Home, Search, Library,
  Plus, Minus, Clock, Music2, Mic2, ListMusic, X, Share2, Download, Maximize2,
  BookOpen, Cross, Church, Star, Sun, Flame, List, Radio, Settings, Disc, Phone, Mail, Loader2,
  Globe, Headphones, Users, MapPin, Navigation, User, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Sample audio for demo (royalty-free)
const SAMPLE_AUDIO_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

// Helper function to get proper audio URL - handles CDN URLs, relative URLs, and file IDs
const getAudioUrl = (audioUrl) => {
  if (!audioUrl) return SAMPLE_AUDIO_URL;
  
  // If it's already a full CDN URL (https://), return as is
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
    return audioUrl;
  }
  
  // If it's a relative file URL (/api/files/{file_id}), add /stream for actual content
  if (audioUrl.startsWith('/api/files/') && !audioUrl.endsWith('/stream')) {
    return `${BACKEND_URL}${audioUrl}/stream`;
  }
  
  // If it's just a file ID, construct the streaming URL
  if (audioUrl && !audioUrl.includes('/')) {
    return `${BACKEND_URL}/api/files/${audioUrl}/stream`;
  }
  
  // Handle other relative paths
  if (audioUrl.startsWith('/')) {
    return `${BACKEND_URL}${audioUrl}`;
  }
  
  return audioUrl;
};

// Helper function to get proper image/thumbnail URL - handles CDN URLs
const getImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  
  // If it's already a full URL (https://), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If it starts with data:, it's a base64 image
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }
  
  // Handle /api/files/{file_id} format - add /stream suffix for proper streaming
  if (imageUrl.startsWith('/api/files/') && !imageUrl.endsWith('/stream')) {
    return `${BACKEND_URL}${imageUrl}/stream`;
  }
  
  // Handle relative paths
  if (imageUrl.startsWith('/')) {
    return `${BACKEND_URL}${imageUrl}`;
  }
  
  return imageUrl;
};

// Category icons mapping
const categoryIcons = {
  'prayers': BookOpen,
  'christmas': Star,
  'lent': Cross,
  'catechism': Church,
  'worship': Flame,
  'gospel': Sun,
  'hymns': Music2,
  'praise': Star,
  'default': Music2
};

// Format time helper
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Get thumbnail URL helper - handles both thumbnail and thumbnail_url fields
const getThumbnail = (item) => {
  if (!item) return null;
  // Prefer direct thumbnail URL, then thumbnail_url field, then thumbnail field
  const url = item.thumbnail_url || item.thumbnail;
  return getImageUrl(url);
};

// ==================== AUDIO PLAYER HOOK ====================
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
  const [repeat, setRepeat] = useState('all'); // Default to 'all' for continuous playback
  const [isLoading, setIsLoading] = useState(false);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  
  const audioRef = useRef(new Audio());
  const sessionIdRef = useRef(null);
  const fetchingMoreRef = useRef(false);
  
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
  const playFromQueueInternal = useCallback(async (index, queueRef) => {
    const q = queueRef || queue;
    if (index < 0 || index >= q.length) return;
    const item = q[index];
    const song = item.song || item;
    const album = item.album || currentAlbum;
    
    setQueueIndex(index);
    setCurrentSong(song);
    setCurrentAlbum(album);
    setIsLoading(true);

    // Use helper to get proper audio URL (handles CDN, relative, and file IDs)
    const audioUrl = getAudioUrl(song.audio_url);
    
    audioRef.current.src = audioUrl;
    
    try {
      await audioRef.current.play();
      
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
  }, [queue, currentAlbum]);

  // Handle song end - with continuous playback
  useEffect(() => {
    const audio = audioRef.current;
    
    const handleSongEnd = async () => {
      // Track the ended session with duration (for play count)
      if (sessionIdRef.current) {
        try {
          await axios.post(`${API}/listening/end`, {
            session_id: sessionIdRef.current,
            duration_seconds: Math.floor(audio.duration || 0)
          });
        } catch (e) {
          console.log("Failed to track play end");
        }
      }
      
      if (repeat === 'one') {
        audio.currentTime = 0;
        audio.play();
        return;
      }

      let nextIndex = queueIndex + 1;
      
      if (shuffle) {
        nextIndex = Math.floor(Math.random() * queue.length);
      }

      // If we've reached the end of queue, fetch more or loop
      if (nextIndex >= queue.length) {
        // Try to fetch more songs from same category/artist
        if (!fetchingMoreRef.current && currentAlbum) {
          fetchingMoreRef.current = true;
          try {
            const categoryId = currentAlbum.category_id;
            const artistId = currentAlbum.artist_id;
            let moreSongs = [];
            
            // First try same category
            if (categoryId) {
              const catRes = await axios.get(`${API}/user/browse/category/${categoryId}`);
              const albums = catRes.data.albums || [];
              for (const album of albums) {
                if (album.album_id !== currentAlbum.album_id) {
                  const albumRes = await axios.get(`${API}/user/album/${album.album_id}`);
                  const songs = albumRes.data.songs || [];
                  moreSongs.push(...songs.map(s => ({ song: s, album })));
                  if (moreSongs.length >= 10) break;
                }
              }
            }
            
            // If not enough, try same artist
            if (moreSongs.length < 5 && artistId) {
              try {
                const artistAlbums = await axios.get(`${API}/albums?artist_id=${artistId}`);
                for (const album of artistAlbums.data.albums || []) {
                  if (album.album_id !== currentAlbum.album_id) {
                    const albumRes = await axios.get(`${API}/user/album/${album.album_id}`);
                    const songs = albumRes.data.songs || [];
                    moreSongs.push(...songs.map(s => ({ song: s, album })));
                    if (moreSongs.length >= 10) break;
                  }
                }
              } catch (e) {
                console.log("Error fetching artist albums");
              }
            }
            
            // If still not enough, get featured
            if (moreSongs.length < 5) {
              try {
                const homeRes = await axios.get(`${API}/user/home`);
                const featuredSection = homeRes.data.sections?.find(s => s.section_type === 'featured_albums');
                for (const album of featuredSection?.items || []) {
                  if (album.album_id !== currentAlbum?.album_id) {
                    const albumRes = await axios.get(`${API}/user/album/${album.album_id}`);
                    const songs = albumRes.data.songs || [];
                    moreSongs.push(...songs.map(s => ({ song: s, album })));
                    if (moreSongs.length >= 10) break;
                  }
                }
              } catch (e) {
                console.log("Error fetching featured");
              }
            }
            
            fetchingMoreRef.current = false;
            
            if (moreSongs.length > 0) {
              const newQueue = [...queue, ...moreSongs];
              setQueue(newQueue);
              // Play the next song (current queue.length is the first new song)
              playFromQueueInternal(queue.length, newQueue);
              return;
            }
          } catch (e) {
            console.error("Error fetching more songs:", e);
            fetchingMoreRef.current = false;
          }
        }
        
        // Loop back to beginning (continuous playback)
        nextIndex = 0;
      }
      
      if (queue.length > 0) {
        playFromQueueInternal(nextIndex, queue);
      }
    };
    
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Save position every 5 seconds
      if (currentSong && currentAlbum && Math.floor(audio.currentTime) % 5 === 0) {
        savePlaybackState(currentSong, currentAlbum, audio.currentTime);
      }
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const onEnded = () => handleSongEnd();
    const onError = () => {
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
  }, [currentSong, currentAlbum, queue, queueIndex, repeat, shuffle, savePlaybackState, playFromQueueInternal]);

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

  const nextSong = useCallback(() => {
    if (queue.length === 0) return;
    let nextIndex;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = (queueIndex + 1) % queue.length;
    }
    playFromQueue(nextIndex);
  }, [queue, queueIndex, shuffle, playFromQueue]);

  const prevSong = useCallback(() => {
    if (currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (queue.length === 0) return;
    const prevIndex = queueIndex === 0 ? queue.length - 1 : queueIndex - 1;
    playFromQueue(prevIndex);
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

  return {
    currentSong, currentAlbum, queue, queueIndex, isPlaying, currentTime, duration, 
    volume, isMuted, shuffle, repeat, isLoading, showFullPlayer, playSong, togglePlay, 
    nextSong, prevSong, seekTo, setVolume, setIsMuted, setShuffle, cycleRepeat, setShowFullPlayer,
    restorePlaybackState, savePlaybackState
  };
};

// ==================== COMPONENTS ====================

// Quick Access Card - Spotify-style compact tile
const QuickAccessCard = ({ item, onClick }) => {
  // Determine icon and gradient based on item type
  let IconComponent = categoryIcons[item.name?.toLowerCase()] || categoryIcons.default;
  let gradient = 'from-emerald-600 to-teal-700';
  
  // Special styling for user items
  if (item.type === 'liked_songs') {
    IconComponent = Heart;
    gradient = 'from-violet-500 via-purple-500 to-fuchsia-500';
  } else if (item.type === 'library') {
    IconComponent = Library;
    gradient = 'from-blue-600 to-cyan-600';
  } else if (item.type === 'downloads') {
    IconComponent = Download;
    gradient = 'from-emerald-600 to-green-600';
  } else if (item.type === 'playlists') {
    IconComponent = ListMusic;
    gradient = 'from-orange-500 to-amber-500';
  }
  
  const thumbUrl = getThumbnail(item);
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 bg-zinc-800/70 hover:bg-zinc-700/90 rounded overflow-hidden transition-all duration-200 h-14"
      data-testid={`quick-${item.id || item.category_id || item.album_id || item.type}`}
    >
      <div className={`w-14 h-14 bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <IconComponent size={22} className="text-white" fill={item.type === 'liked_songs' ? 'currentColor' : 'none'} />
        )}
      </div>
      <span className="font-semibold text-sm text-white pr-3 truncate">{item.name || item.title}</span>
    </button>
  );
};

// Album Card - Standard
const AlbumCard = ({ album, onPlay, onOpen, size = 'md', availableTags = [] }) => {
  const sizeClasses = { sm: 'w-36', md: 'w-44', lg: 'w-52' };
  const thumbUrl = getThumbnail(album);
  
  // Get first tag for display
  const firstTagId = album.tags?.[0];
  const tag = firstTagId ? availableTags.find(t => t.tag_id === firstTagId) : null;
  
  return (
    <button
      onClick={() => onOpen(album.album_id)}
      className={`${sizeClasses[size]} flex-shrink-0 p-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-800/60 transition-all duration-300 group text-left`}
      data-testid={`album-${album.album_id}`}
    >
      <div className="aspect-square rounded-md bg-zinc-800 mb-3 overflow-hidden relative shadow-lg">
        {thumbUrl ? (
          <img src={thumbUrl} alt={album.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-800 to-emerald-700">
            <Music2 size={size === 'lg' ? 48 : 36} className="text-white/40" />
          </div>
        )}
        {/* Tag Badge - Top Left */}
        {tag && (
          <div className="absolute top-2 left-2">
            <span 
              className="px-2 py-1 rounded-full text-[10px] font-bold uppercase text-white shadow-lg"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          </div>
        )}
        <div className="absolute bottom-2 right-2 w-11 h-11 bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0 transition-all duration-300 shadow-xl shadow-black/40">
          <Play size={20} fill="black" className="text-black ml-0.5" />
        </div>
      </div>
      <h3 className="font-semibold text-sm truncate">{album.title}</h3>
      <p className="text-xs text-zinc-400 truncate mt-0.5">{album.artist_name || 'Various Artists'}</p>
    </button>
  );
};

// Wide Album Card
const WideAlbumCard = ({ album, onOpen, availableTags = [] }) => {
  const thumbUrl = getThumbnail(album);
  
  // Get first tag for display
  const firstTagId = album.tags?.[0];
  const tag = firstTagId ? availableTags.find(t => t.tag_id === firstTagId) : null;
  
  return (
    <button
      onClick={() => onOpen(album.album_id)}
      className="flex-shrink-0 w-80 h-44 rounded-lg overflow-hidden relative group"
      data-testid={`wide-${album.album_id}`}
    >
      {thumbUrl ? (
        <img src={thumbUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-violet-800 to-emerald-700 flex items-center justify-center">
          <Music2 size={56} className="text-white/30" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      {/* Tag Badge - Top Left */}
      {tag && (
        <div className="absolute top-3 left-3 z-10">
          <span 
            className="px-2.5 py-1 rounded-full text-xs font-bold uppercase text-white shadow-lg"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
          </span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="font-bold text-lg text-white truncate">{album.title}</h3>
        <p className="text-sm text-zinc-300 truncate">{album.artist_name}</p>
      </div>
      <div className="absolute bottom-4 right-4 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl">
        <Play size={22} fill="black" className="text-black ml-0.5" />
      </div>
    </button>
  );
};

// Compact List Item
const ListItem = ({ item, index, onPlay, isActive, isPlaying, onLike, onAddToPlaylist, onDownload, isLiked }) => {
  const thumbUrl = getThumbnail(item) || getThumbnail(item.album);
  return (
    <div className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-zinc-800/60 transition-colors group">
      <button
        onClick={onPlay}
        className="flex items-center gap-3 flex-1 min-w-0"
      >
        <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 relative">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
              <Music2 size={16} className="text-zinc-500" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className={`font-medium text-sm truncate ${isActive ? 'text-emerald-400' : ''}`}>{item.title}</p>
          <p className="text-xs text-zinc-500 truncate">{item.artist_name || item.album?.artist_name}</p>
        </div>
      </button>
      
      {/* Song actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onLike && (
          <button 
            onClick={(e) => { e.stopPropagation(); onLike(item); }}
            className="p-2 hover:bg-zinc-700 rounded-full"
            title={isLiked ? "Remove from Liked Songs" : "Add to Liked Songs"}
          >
            <Heart size={18} className={isLiked ? "text-emerald-400 fill-emerald-400" : "text-zinc-400"} />
          </button>
        )}
        {onAddToPlaylist && (
          <button 
            onClick={(e) => { e.stopPropagation(); onAddToPlaylist(item); }}
            className="p-2 hover:bg-zinc-700 rounded-full"
            title="Add to Playlist"
          >
            <Plus size={18} className="text-zinc-400" />
          </button>
        )}
        {onDownload && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDownload(item); }}
            className="p-2 hover:bg-zinc-700 rounded-full"
            title="Download"
          >
            <Download size={18} className="text-zinc-400" />
          </button>
        )}
      </div>
      
      {isActive && isPlaying && (
        <div className="flex items-end gap-0.5 h-4 mr-2">
          <div className="w-1 bg-emerald-400 animate-pulse" style={{height: '40%'}} />
          <div className="w-1 bg-emerald-400 animate-pulse" style={{height: '100%', animationDelay: '0.15s'}} />
          <div className="w-1 bg-emerald-400 animate-pulse" style={{height: '60%', animationDelay: '0.3s'}} />
        </div>
      )}
    </div>
  );
};

// Artist Card (Circular)
const ArtistCard = ({ artist }) => (
  <div className="flex flex-col items-center gap-2 p-2 flex-shrink-0">
    <div className="w-32 h-32 rounded-full bg-zinc-800 overflow-hidden shadow-lg">
      {artist.photo ? (
        <img src={artist.photo} alt={artist.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
          <Mic2 size={40} className="text-zinc-500" />
        </div>
      )}
    </div>
    <p className="font-medium text-sm truncate max-w-32 text-center">{artist.name}</p>
    <p className="text-xs text-zinc-500">Artist</p>
  </div>
);

// Church Card
const ChurchCard = ({ church, onClick }) => (
  <button
    onClick={onClick}
    className="w-44 flex-shrink-0 p-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-800/60 transition-all duration-300 group text-left"
    data-testid={`church-${church.church_id}`}
  >
    <div className="aspect-square rounded-lg bg-gradient-to-br from-emerald-800 to-teal-900 mb-3 overflow-hidden relative shadow-lg flex items-center justify-center">
      {church.thumbnail ? (
        <img src={church.thumbnail} alt={church.name} className="w-full h-full object-cover" />
      ) : (
        <Church size={48} className="text-emerald-400/60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute bottom-2 left-2 right-2">
        <span className="text-xs bg-emerald-500/80 text-white px-2 py-0.5 rounded-full">
          {church.denomination || 'Kanisa'}
        </span>
      </div>
    </div>
    <h3 className="font-semibold text-sm truncate text-white">{church.name}</h3>
    <p className="text-xs text-zinc-400 truncate mt-0.5">{church.location}</p>
    {church.priest_name && (
      <p className="text-xs text-zinc-500 truncate mt-0.5">{church.leader_title || 'Fr.'} {church.priest_name}</p>
    )}
  </button>
);

// Church Detail Modal
const ChurchDetailModal = ({ church, onClose, choirs = [] }) => {
  if (!church) return null;
  
  return (
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto" data-testid="church-detail-modal">
      <div className="min-h-screen p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-700">
            <X size={24} />
          </button>
          <h2 className="text-lg font-bold">Kanisa</h2>
          <div className="w-10" />
        </div>
        
        {/* Church Image */}
        <div className="relative h-48 rounded-xl overflow-hidden mb-6">
          {church.thumbnail ? (
            <img src={church.thumbnail} alt={church.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-800 to-teal-900 flex items-center justify-center">
              <Church size={64} className="text-emerald-400/60" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-2xl font-bold text-white">{church.name}</h1>
            <p className="text-emerald-400">{church.denomination || 'Kanisa'}</p>
          </div>
        </div>
        
        {/* Church Info */}
        <div className="space-y-4 mb-6">
          {/* Location & Direction */}
          <div className="bg-zinc-900/60 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <MapPin className="text-emerald-400 mt-1" size={20} />
              <div className="flex-1">
                <p className="text-white font-medium">{church.location}</p>
                {church.address && <p className="text-zinc-400 text-sm">{church.address}</p>}
              </div>
            </div>
            {church.direction && (
              <a 
                href={church.direction} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg w-full justify-center transition-colors"
              >
                <Navigation size={18} />
                <span>Pata Njia (Directions)</span>
              </a>
            )}
          </div>
          
          {/* Leader Info */}
          {church.priest_name && (
            <div className="bg-zinc-900/60 rounded-xl p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-600/20 flex items-center justify-center">
                <User size={24} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">{church.leader_title || 'Kiongozi'}</p>
                <p className="text-white font-medium">{church.priest_name}</p>
              </div>
            </div>
          )}
          
          {/* Contact */}
          {church.phone && (
            <a href={`tel:${church.phone}`} className="bg-zinc-900/60 rounded-xl p-4 flex items-center gap-3 hover:bg-zinc-800/60">
              <Phone size={20} className="text-emerald-400" />
              <span className="text-white">{church.phone}</span>
            </a>
          )}
          
          {/* Bio */}
          {church.bio && (
            <div className="bg-zinc-900/60 rounded-xl p-4">
              <h3 className="text-emerald-400 font-medium mb-2">Kuhusu</h3>
              <p className="text-zinc-300 text-sm leading-relaxed">{church.bio}</p>
            </div>
          )}
        </div>
        
        {/* Prayer Schedule */}
        {church.prayer_schedule && church.prayer_schedule.length > 0 && (
          <div className="bg-zinc-900/60 rounded-xl p-4 mb-6">
            <h3 className="text-emerald-400 font-medium mb-3 flex items-center gap-2">
              <Clock size={18} />
              Ratiba ya Ibada
            </h3>
            <div className="space-y-2">
              {church.prayer_schedule.map((schedule, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                  <div>
                    <p className="text-white font-medium">{schedule.day}</p>
                    <p className="text-zinc-400 text-sm">{schedule.service}</p>
                  </div>
                  <span className="text-emerald-400 text-sm">{schedule.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Announcements */}
        {church.announcements && church.announcements.length > 0 && (
          <div className="bg-zinc-900/60 rounded-xl p-4 mb-6">
            <h3 className="text-amber-400 font-medium mb-3 flex items-center gap-2">
              <Bell size={18} />
              Matangazo
            </h3>
            <div className="space-y-3">
              {church.announcements.map((ann, idx) => (
                <div key={idx} className="p-3 bg-zinc-800/50 rounded-lg">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-white font-medium">{ann.title}</h4>
                    <span className="text-xs text-zinc-500">{ann.date}</span>
                  </div>
                  <p className="text-zinc-400 text-sm">{ann.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Choirs */}
        {choirs && choirs.length > 0 && (
          <div className="mb-6">
            <h3 className="text-violet-400 font-medium mb-3 flex items-center gap-2">
              <Users size={18} />
              Kwaya za Kanisa Hili
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {choirs.map(choir => (
                <div key={choir.choir_id} className="flex-shrink-0 w-32 text-center">
                  <div className="w-20 h-20 rounded-full bg-violet-600/20 mx-auto mb-2 overflow-hidden">
                    {choir.profile_image ? (
                      <img src={choir.profile_image} alt={choir.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Users size={32} className="text-violet-400/60" />
                      </div>
                    )}
                  </div>
                  <p className="text-white text-sm font-medium truncate">{choir.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Download App Popup
const DownloadAppPopup = ({ show, onClose, language = 'sw' }) => {
  const [downloadInfo, setDownloadInfo] = useState(null);
  
  useEffect(() => {
    if (show) {
      axios.get(`${API}/app/download-info`)
        .then(res => setDownloadInfo(res.data))
        .catch(() => setDownloadInfo({
          message_sw: "Kupakua nyimbo unazotaka na kuzifurahia bila mtandao, pakua app ya Gracefy!",
          message_en: "Download songs you want and enjoy them offline, download the Gracefy app!",
          button_text_sw: "Bonyeza hapa kupakua",
          button_text_en: "Click here to download",
          direct_apk_url: "https://expo.dev/artifacts/eas/nLuShV8eraRvjp1zmFyEbf.apk"
        }));
    }
  }, [show]);
  
  if (!show || !downloadInfo) return null;
  
  const message = language === 'sw' ? downloadInfo.message_sw : downloadInfo.message_en;
  const buttonText = language === 'sw' ? downloadInfo.button_text_sw : downloadInfo.button_text_en;
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" data-testid="download-popup">
      <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full relative animate-in fade-in zoom-in duration-300">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-zinc-800"
        >
          <X size={20} />
        </button>
        
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Download size={32} className="text-white" />
          </div>
          
          <h3 className="text-xl font-bold text-white mb-2">Gracefy App</h3>
          <p className="text-zinc-400 mb-6">{message}</p>
          
          <a 
            href={downloadInfo.direct_apk_url || downloadInfo.android_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all"
          >
            {buttonText}
          </a>
          
          <button 
            onClick={onClose}
            className="mt-3 text-zinc-500 hover:text-zinc-300 text-sm"
          >
            Baadaye
          </button>
        </div>
      </div>
    </div>
  );
};

// Choir/Artist Card
const ChoirCard = ({ choir, onClick }) => (
  <button
    onClick={onClick}
    className="w-40 flex-shrink-0 p-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-800/60 transition-all duration-300 group text-left"
    data-testid={`choir-${choir.choir_id}`}
  >
    <div className="aspect-square rounded-full bg-gradient-to-br from-violet-800 to-purple-900 mb-3 overflow-hidden relative shadow-lg mx-auto">
      {choir.profile_image ? (
        <img src={choir.profile_image} alt={choir.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Users size={40} className="text-violet-400/60" />
        </div>
      )}
    </div>
    <h3 className="font-semibold text-sm truncate text-white text-center">{choir.name}</h3>
    <p className="text-xs text-zinc-400 truncate mt-0.5 text-center">{choir.church_affiliation || 'Artist'}</p>
  </button>
);

// Dynamic Hero Section - Album Carousel
const DynamicHeroSection = ({ hero, onAlbumClick, getThumbnail }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = hero?.items || [];
  
  // Auto-rotate effect
  useEffect(() => {
    if (!hero?.auto_rotate || items.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % items.length);
    }, hero.rotation_interval || 5000);
    
    return () => clearInterval(interval);
  }, [hero?.auto_rotate, hero?.rotation_interval, items.length]);
  
  if (items.length === 0) return null;
  
  const currentItem = items[currentIndex];
  const thumbUrl = getThumbnail(currentItem);
  
  return (
    <div 
      className="relative w-full h-64 md:h-80 overflow-hidden"
      data-testid="hero-section-dynamic"
    >
      {/* Background Image with blur */}
      {thumbUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${thumbUrl})`,
            filter: 'blur(20px)',
            transform: 'scale(1.1)'
          }}
        />
      )}
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/80" />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-black/40" />
      
      {/* Content */}
      <div className="relative h-full flex items-center justify-center px-6 lg:px-12">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 max-w-4xl">
          {/* Album Art */}
          <button 
            onClick={() => onAlbumClick(currentItem.album_id)}
            className="w-40 h-40 md:w-52 md:h-52 rounded-lg overflow-hidden shadow-2xl flex-shrink-0 hover:scale-105 transition-transform duration-300"
          >
            {thumbUrl ? (
              <img src={thumbUrl} alt={currentItem.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-violet-800 to-emerald-700 flex items-center justify-center">
                <Music2 size={64} className="text-white/40" />
              </div>
            )}
          </button>
          
          {/* Album Info */}
          <div className="text-center md:text-left">
            <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider mb-1">Featured Album</p>
            <h2 className="text-2xl md:text-4xl font-bold mb-2 text-white">{currentItem.title}</h2>
            <p className="text-sm md:text-base text-zinc-300 mb-1">{currentItem.artist_name}</p>
            {currentItem.description && (
              <p className="text-xs text-zinc-400 mb-4 line-clamp-2 max-w-md">{currentItem.description}</p>
            )}
            <button 
              onClick={() => onAlbumClick(currentItem.album_id)}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full text-sm inline-flex items-center gap-2"
            >
              <Play size={16} fill="currentColor" />
              Play Now
            </button>
          </div>
        </div>
      </div>
      
      {/* Navigation Dots */}
      {hero?.show_navigation && items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                idx === currentIndex 
                  ? 'bg-emerald-400 w-6' 
                  : 'bg-zinc-500 hover:bg-zinc-400'
              }`}
            />
          ))}
        </div>
      )}
      
      {/* Arrow Navigation */}
      {items.length > 1 && (
        <>
          <button 
            onClick={() => setCurrentIndex((currentIndex - 1 + items.length) % items.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onClick={() => setCurrentIndex((currentIndex + 1) % items.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}
    </div>
  );
};

// Section Header
const SectionHeader = ({ title, subtitle, onSeeMore }) => (
  <div className="flex items-end justify-between mb-4">
    <div>
      <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
      {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
    {onSeeMore && (
      <button onClick={onSeeMore} className="text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider">
        Ona Zote
      </button>
    )}
  </div>
);

// Bible Devotional Cards Section - Beautiful horizontal scroll
const BibleDevotionalSection = ({ language, t, onPlaySnippet }) => {
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);

  useEffect(() => {
    const fetchSnippets = async () => {
      try {
        const res = await axios.get(`${API}/bible/featured-snippets?language=${language}&limit=10`);
        setSnippets(res.data.snippets || []);
      } catch (e) {
        console.error("Error fetching Bible snippets:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSnippets();
  }, [language]);

  const handlePlay = async (snippet) => {
    if (playingId === snippet.snippet_id) {
      setPlayingId(null);
      if (onPlaySnippet) onPlaySnippet({ ...snippet, stop: true });
      return;
    }
    setPlayingId(snippet.snippet_id);
    if (onPlaySnippet) onPlaySnippet(snippet);
  };

  if (loading || snippets.length === 0) return null;

  return (
    <section className="relative" data-testid="bible-devotional-section">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{t('bible.devotionals', 'Biblia na Masomo')}</h2>
            <p className="text-xs text-zinc-400">{t('bible.listenToWord', 'Sikiliza Neno la Mungu')}</p>
          </div>
        </div>
      </div>

      {/* Horizontal Scroll Cards - Wider Design */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
        {/* Main Bible Card - Opens Bible Reader */}
        <div 
          className="flex-shrink-0 w-72 md:w-80 group cursor-pointer"
          onClick={() => window.dispatchEvent(new CustomEvent('openBibleReader'))}
          data-testid="bible-main-card"
        >
          <div className="relative h-44 rounded-2xl overflow-hidden bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900 shadow-xl shadow-amber-900/30 group-hover:shadow-amber-500/30 transition-all duration-300 group-hover:scale-[1.02]">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-amber-400 blur-3xl" />
            </div>
            
            {/* Content Layout */}
            <div className="relative h-full p-5 flex flex-col justify-between">
              {/* Top: Icon and Title */}
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <BookOpen size={28} className="text-amber-300" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">Biblia</h3>
                  <p className="text-sm text-amber-200 mt-0.5">Agano Jipya • Kiswahili</p>
                </div>
              </div>
              
              {/* Bottom: Action Button */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-amber-100/70 italic">Soma na Sikiliza Neno la Mungu</p>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full">
                  <Headphones size={16} className="text-white" />
                  <span className="text-sm font-medium text-white">Fungua</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Devotional Snippet Cards - Wider Horizontal */}
        {snippets.map((snippet, idx) => (
          <div 
            key={snippet.snippet_id}
            className="flex-shrink-0 w-72 md:w-80 group cursor-pointer"
            onClick={() => handlePlay(snippet)}
            data-testid={`bible-card-${snippet.snippet_id}`}
          >
            <div className={`relative h-44 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 group-hover:scale-[1.02] ${
              idx % 4 === 0 ? 'bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900 shadow-violet-900/30 group-hover:shadow-violet-500/30' :
              idx % 4 === 1 ? 'bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900 shadow-emerald-900/30 group-hover:shadow-emerald-500/30' :
              idx % 4 === 2 ? 'bg-gradient-to-br from-rose-900 via-pink-800 to-red-900 shadow-rose-900/30 group-hover:shadow-rose-500/30' :
              'bg-gradient-to-br from-blue-900 via-indigo-800 to-slate-900 shadow-blue-900/30 group-hover:shadow-blue-500/30'
            }`}>
              {/* Background Blur */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white blur-3xl" />
              </div>

              {/* Content Layout */}
              <div className="relative h-full p-5 flex flex-col justify-between">
                {/* Top: Badge and Reference */}
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {snippet.is_featured && (
                        <span className="px-2 py-0.5 bg-amber-500/90 rounded-full text-[10px] font-bold text-black uppercase">
                          Featured
                        </span>
                      )}
                      <span className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
                        {snippet.heading || snippet.card_type?.replace('_', ' ') || 'Somo'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Reference */}
                  <h3 className="text-lg font-bold text-white leading-tight">
                    {snippet.reference}
                  </h3>
                  
                  {/* Subtitle - Can show more text now */}
                  <p className="text-sm text-zinc-300 italic mt-1 line-clamp-2">
                    {snippet.subtitle || snippet.description || snippet.title}
                  </p>
                </div>
                
                {/* Bottom: Play Button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Volume2 size={14} />
                    <span className="text-xs">~{Math.round(snippet.duration_estimate || 30)}s</span>
                    {snippet.voice_gender && (
                      <span className="text-xs">• {snippet.voice_gender === 'male' ? '♂' : '♀'}</span>
                    )}
                  </div>
                  
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                    playingId === snippet.snippet_id 
                      ? 'bg-white text-black' 
                      : 'bg-white/20 text-white group-hover:bg-white/30'
                  }`}>
                    {playingId === snippet.snippet_id ? (
                      <>
                        <Pause size={16} className="animate-pulse" />
                        <span className="text-sm font-medium">Simamisha</span>
                      </>
                    ) : (
                      <>
                        <Headphones size={16} />
                        <span className="text-sm font-medium">Sikiliza Sasa</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// Radio View Component - Live Christian Radio Streaming
const RadioView = ({ t, onBack }) => {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingStation, setPlayingStation] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [playStartTime, setPlayStartTime] = useState(null);

  useEffect(() => {
    fetchStations();
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
    };
  }, []);

  const fetchStations = async () => {
    try {
      const response = await axios.get(`${API}/radio/stations`);
      setStations(response.data.stations || []);
    } catch (error) {
      console.error("Error fetching radio stations:", error);
      toast.error("Failed to load radio stations");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayStation = async (station) => {
    try {
      // If same station, toggle play/pause
      if (playingStation?.station_id === station.station_id) {
        if (isPlaying) {
          audioElement?.pause();
          setIsPlaying(false);
          // Track stop
          if (sessionId && playStartTime) {
            const duration = Math.floor((Date.now() - playStartTime) / 1000);
            try {
              await axios.post(`${API}/radio/stop`, { session_id: sessionId, duration_seconds: duration });
            } catch (e) {}
          }
        } else {
          audioElement?.play();
          setIsPlaying(true);
          setPlayStartTime(Date.now());
        }
        return;
      }

      // Stop current station
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        if (sessionId && playStartTime) {
          const duration = Math.floor((Date.now() - playStartTime) / 1000);
          try {
            await axios.post(`${API}/radio/stop`, { session_id: sessionId, duration_seconds: duration });
          } catch (e) {}
        }
      }

      setPlayingStation(station);
      toast.info(`Loading ${station.name}...`);

      // Track play
      try {
        const trackResponse = await axios.post(`${API}/radio/play`, {
          station_id: station.station_id,
          platform: 'web'
        });
        setSessionId(trackResponse.data?.session_id);
      } catch (e) {}

      // Create and play audio
      const audio = new Audio(station.url_resolved);
      audio.onplay = () => setIsPlaying(true);
      audio.onpause = () => setIsPlaying(false);
      audio.onerror = () => {
        toast.error("Failed to play station");
        setIsPlaying(false);
      };
      
      await audio.play();
      setAudioElement(audio);
      setPlayStartTime(Date.now());
      toast.success(`Now playing: ${station.name}`);
    } catch (error) {
      console.error("Error playing station:", error);
      toast.error("Failed to play station");
    }
  };

  const handleStopAll = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
      setAudioElement(null);
    }
    if (sessionId && playStartTime) {
      const duration = Math.floor((Date.now() - playStartTime) / 1000);
      axios.post(`${API}/radio/stop`, { session_id: sessionId, duration_seconds: duration }).catch(() => {});
    }
    setPlayingStation(null);
    setIsPlaying(false);
    setSessionId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const featuredStations = stations.filter(s => s.is_featured);
  const allStations = stations;

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radio className="w-7 h-7 text-violet-500" />
              {t('radio.title', 'Redio za Kikristo')}
            </h1>
            <p className="text-zinc-400 text-sm">{t('radio.subtitle', 'Sikiliza mubashara')}</p>
          </div>
        </div>
        {playingStation && (
          <button 
            onClick={handleStopAll}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 flex items-center gap-2"
          >
            <X size={16} /> Stop
          </button>
        )}
      </div>

      {/* Now Playing Banner */}
      {playingStation && isPlaying && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600">
          <div className="flex items-center gap-4">
            <div className="flex gap-1 items-end h-6">
              {[1,2,3,4].map((i) => (
                <div key={i} className="w-1 bg-white rounded-full animate-pulse" style={{ height: `${8 + Math.random() * 16}px`, animationDelay: `${i * 100}ms` }} />
              ))}
            </div>
            <div className="flex-1">
              <p className="text-xs text-white/70 uppercase tracking-wider font-medium">Playing Now</p>
              <p className="font-semibold">{playingStation.name}</p>
            </div>
            <button 
              onClick={() => handlePlayStation(playingStation)}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
            >
              <Pause size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Featured Stations */}
      {featuredStations.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold">{t('radio.featured', 'Redio Maarufu')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {featuredStations.map(station => (
              <StationCard 
                key={station.station_id}
                station={station}
                isActive={playingStation?.station_id === station.station_id && isPlaying}
                onPlay={() => handlePlayStation(station)}
              />
            ))}
          </div>
        </section>
      )}

      {/* All Stations */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Radio className="w-5 h-5 text-violet-500" />
          <h2 className="text-lg font-bold">{t('radio.all', 'Redio Zote')}</h2>
          <span className="text-zinc-500 text-sm">({allStations.length})</span>
        </div>
        {allStations.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No radio stations available</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allStations.map(station => (
              <StationCard 
                key={station.station_id}
                station={station}
                isActive={playingStation?.station_id === station.station_id && isPlaying}
                onPlay={() => handlePlayStation(station)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// Station Card Component
const StationCard = ({ station, isActive, onPlay }) => {
  return (
    <div 
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
        isActive 
          ? 'bg-violet-500/10 border-violet-500/30' 
          : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800'
      }`}
      onClick={onPlay}
      data-testid={`station-card-${station.station_id}`}
    >
      {/* Logo */}
      <div className={`w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 relative ${isActive ? 'ring-2 ring-violet-500' : ''}`}>
        {station.favicon ? (
          <img src={station.favicon} alt={station.name} className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
            <Radio className="w-6 h-6 text-white" />
          </div>
        )}
        {isActive && (
          <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate">{station.name}</h3>
          {station.is_featured && (
            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">★</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" /> {station.country}
          </span>
          <span>{station.language}</span>
        </div>
      </div>

      {/* Play Button */}
      <button 
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
          isActive 
            ? 'bg-violet-500 text-white' 
            : 'bg-zinc-700 text-white hover:bg-zinc-600'
        }`}
      >
        {isActive ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
      </button>
    </div>
  );
};

// Bible View Component
const BibleView = ({ language, t, onBack }) => {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [audioElement, setAudioElement] = useState(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  
  // Voice settings
  const [selectedVoice, setSelectedVoice] = useState("sw-KE-Zuri-Female");
  const [availableVoices, setAvailableVoices] = useState([]);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // Speed control: 0.5x to 2x
  
  // Custom verse range reader
  const [showRangeReader, setShowRangeReader] = useState(false);
  const [rangeBook, setRangeBook] = useState('');
  const [rangeChapter, setRangeChapter] = useState(1);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(5);
  const [rangeChapters, setRangeChapters] = useState([]);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeResult, setRangeResult] = useState(null);

  // Fetch books, snippets, and voice settings on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [booksRes, snippetsRes, voicesRes] = await Promise.all([
          axios.get(`${API}/bible/books?language=${language}`),
          axios.get(`${API}/bible/snippets?language=${language}`),
          axios.get(`${API}/bible/tts/voices`)
        ]);
        setBooks(booksRes.data.books || []);
        setSnippets(snippetsRes.data.snippets || []);
        
        // Set voice options and default
        const voices = voicesRes.data.voices || [];
        setAvailableVoices(voices);
        
        // Use admin-configured default voice
        const defaultVoice = voicesRes.data.default_voice_female || voicesRes.data.default || "sw-KE-Zuri-Female";
        setSelectedVoice(defaultVoice);
      } catch (e) {
        console.error("Error fetching Bible data:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [language]);

  // Fetch chapters when book selected
  useEffect(() => {
    if (selectedBook) {
      axios.get(`${API}/bible/books/${selectedBook.name}/chapters?language=${language}`)
        .then(res => {
          // API returns chapter count as number, convert to array [1, 2, 3, ...]
          const chaptersData = res.data.chapters;
          if (typeof chaptersData === 'number') {
            setChapters(Array.from({ length: chaptersData }, (_, i) => i + 1));
          } else if (Array.isArray(chaptersData)) {
            setChapters(chaptersData);
          } else {
            setChapters([]);
          }
        })
        .catch(() => setChapters([]));
    }
  }, [selectedBook, language]);

  // Fetch verses when chapter selected
  useEffect(() => {
    if (selectedBook && selectedChapter) {
      axios.get(`${API}/bible/books/${selectedBook.name}/chapters/${selectedChapter}?language=${language}`)
        .then(res => setVerses(res.data.verses || []))
        .catch(() => setVerses([]));
    }
  }, [selectedBook, selectedChapter, language]);

  // Play snippet audio
  const handlePlaySnippet = async (snippet) => {
    if (playingAudio === snippet.snippet_id) {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      setPlayingAudio(null);
      return;
    }

    try {
      const res = await axios.get(`${API}/bible/snippets/${snippet.snippet_id}`);
      if (audioElement) audioElement.pause();
      
      const audio = new Audio(`data:audio/mp3;base64,${res.data.audio_base64}`);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setAudioElement(audio);
      setPlayingAudio(snippet.snippet_id);
    } catch (e) {
      toast.error("Failed to play audio");
    }
  };

  // Generate audio for a verse
  const handleReadVerse = async (verse) => {
    setGeneratingAudio(true);
    console.log("Generating TTS with voice:", selectedVoice, "speed:", playbackSpeed);
    try {
      const res = await axios.post(`${API}/bible/tts/verse`, {
        book_name: selectedBook.name,
        chapter: selectedChapter,
        verse: verse.verse,
        language: language,
        voice: selectedVoice,
        speed: playbackSpeed
      });
      
      if (audioElement) audioElement.pause();
      const audio = new Audio(`data:audio/mp3;base64,${res.data.audio_base64}`);
      audio.playbackRate = playbackSpeed; // Apply speed to playback as well
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setAudioElement(audio);
      setPlayingAudio(`verse_${verse.verse}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to generate audio");
    } finally {
      setGeneratingAudio(false);
    }
  };

  // Fetch chapters for range reader when book changes
  useEffect(() => {
    if (rangeBook) {
      axios.get(`${API}/bible/books/${rangeBook}/chapters?language=${language}`)
        .then(res => setRangeChapters(res.data.chapters || []))
        .catch(() => setRangeChapters([]));
    }
  }, [rangeBook, language]);

  // Generate audio for custom verse range
  const handleReadRange = async () => {
    if (!rangeBook || !rangeChapter || !rangeStart || !rangeEnd) {
      toast.error("Please fill all fields");
      return;
    }
    
    setRangeLoading(true);
    try {
      const res = await axios.post(`${API}/bible/tts/passage-range`, {
        book_name: rangeBook,
        chapter: rangeChapter,
        start_verse: rangeStart,
        end_verse: rangeEnd,
        language: language,
        voice: selectedVoice,
        speed: playbackSpeed
      });
      
      setRangeResult(res.data);
      
      if (audioElement) audioElement.pause();
      const audio = new Audio(`data:audio/mp3;base64,${res.data.audio_base64}`);
      audio.playbackRate = playbackSpeed;
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setAudioElement(audio);
      setPlayingAudio(`range_${rangeBook}_${rangeChapter}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to generate audio");
    } finally {
      setRangeLoading(false);
    }
  };

  // Update playback speed of currently playing audio
  useEffect(() => {
    if (audioElement) {
      audioElement.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, audioElement]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={40} className="animate-spin text-amber-500" />
      </div>
    );
  }

  // Show snippets if no book selected
  if (!selectedBook && !showRangeReader) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <BookOpen className="text-amber-500" />
            {t('bible.title', 'Biblia na Vitabu vya Dini')}
          </h1>
          
          {/* Voice and Speed Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Voice Selector */}
            {availableVoices.length > 0 && (
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-zinc-400" />
                <select
                  value={selectedVoice}
                  onChange={(e) => {
                    const newVoice = e.target.value;
                    setSelectedVoice(newVoice);
                    const voiceName = availableVoices.find(v => v.id === newVoice)?.name || newVoice;
                    toast.success(`Voice changed to ${voiceName}`);
                  }}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  data-testid="voice-selector"
                >
                  <optgroup label="Kike (Female)">
                    {availableVoices.filter(v => v.gender === 'female').map(voice => (
                      <option key={voice.id} value={voice.id}>{voice.name} - {voice.description}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Kiume (Male)">
                    {availableVoices.filter(v => v.gender === 'male').map(voice => (
                      <option key={voice.id} value={voice.id}>{voice.name} - {voice.description}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}
            
            {/* Speed Control */}
            <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5">
              <span className="text-xs text-zinc-400">Kasi:</span>
              <select
                value={playbackSpeed}
                onChange={(e) => {
                  const newSpeed = parseFloat(e.target.value);
                  setPlaybackSpeed(newSpeed);
                  toast.success(`Speed: ${newSpeed}x`);
                }}
                className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
                data-testid="speed-selector"
              >
                <option value="0.5">0.5x</option>
                <option value="0.75">0.75x</option>
                <option value="1">1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
                <option value="1.75">1.75x</option>
                <option value="2">2x</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowRangeReader(true)}
            className="flex-1 p-4 bg-gradient-to-br from-amber-600 to-orange-700 rounded-xl flex items-center gap-3 hover:from-amber-500 hover:to-orange-600 transition-all"
            data-testid="open-range-reader"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Mic2 size={20} className="text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-white">{t('bible.readRange', 'Soma Mistari')}</p>
              <p className="text-xs text-amber-100">{t('bible.enterRange', 'Chagua mistari kusoma')}</p>
            </div>
          </button>
        </div>

        {/* Featured Snippets */}
        {snippets.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">{t('bible.featuredSnippets', 'Vifungu Maarufu')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {snippets.slice(0, 4).map(snippet => (
                <div 
                  key={snippet.snippet_id}
                  className="bg-gradient-to-br from-amber-900/30 to-zinc-900 rounded-xl p-4 border border-amber-500/20"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{snippet.title}</h3>
                      <p className="text-xs text-amber-400">{snippet.reference}</p>
                      {snippet.description && (
                        <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{snippet.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handlePlaySnippet(snippet)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        playingAudio === snippet.snippet_id 
                          ? 'bg-amber-500 text-black' 
                          : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/40'
                      }`}
                    >
                      {playingAudio === snippet.snippet_id ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Book List */}
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('bible.selectBook', 'Chagua Kitabu')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {books.map(book => (
              <button
                key={book.book_id}
                onClick={() => setSelectedBook(book)}
                className="p-3 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-lg text-left transition-colors"
              >
                <p className="font-medium text-white text-sm">{book.name}</p>
                <p className="text-xs text-zinc-500">{book.testament === 'old' ? 'Agano la Kale' : 'Agano Jipya'}</p>
              </button>
            ))}
          </div>
          {books.length === 0 && (
            <p className="text-center text-zinc-500 py-8">
              {t('bible.noData', 'Bible data not available. Please contact admin.')}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Verse Range Reader View
  if (showRangeReader) {
    return (
      <div className="space-y-6 p-4">
        <button 
          onClick={() => { setShowRangeReader(false); setRangeResult(null); }}
          className="flex items-center gap-2 text-zinc-400 hover:text-white"
        >
          <ChevronLeft size={20} /> {t('action.back', 'Rudi')}
        </button>
        
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
            <Mic2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t('bible.readRange', 'Soma Mistari')}</h1>
          <p className="text-zinc-400 text-sm">{t('bible.enterRangeDesc', 'Chagua kitabu, sura na mistari kusoma')}</p>
        </div>

        {/* Range Selection Form */}
        <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800 space-y-4">
          {/* Book Selection */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">{t('bible.book', 'Kitabu')}</label>
            <select
              value={rangeBook}
              onChange={(e) => { setRangeBook(e.target.value); setRangeChapter(1); }}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:border-amber-500 outline-none"
            >
              <option value="">{t('bible.selectBook', 'Chagua Kitabu')}</option>
              {books.map(book => (
                <option key={book.book_id} value={book.name}>{book.name}</option>
              ))}
            </select>
          </div>

          {/* Chapter Selection */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">{t('bible.chapter', 'Sura')}</label>
            <select
              value={rangeChapter}
              onChange={(e) => setRangeChapter(parseInt(e.target.value))}
              disabled={!rangeBook}
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:border-amber-500 outline-none disabled:opacity-50"
            >
              {rangeChapters.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>

          {/* Verse Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">{t('bible.startVerse', 'Mstari wa Kuanzia')}</label>
              <input
                type="number"
                min={1}
                value={rangeStart}
                onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:border-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">{t('bible.endVerse', 'Mstari wa Mwisho')}</label>
              <input
                type="number"
                min={rangeStart}
                value={rangeEnd}
                onChange={(e) => setRangeEnd(parseInt(e.target.value) || rangeStart)}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* Reference Preview */}
          {rangeBook && (
            <div className="text-center py-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
              <p className="text-amber-400 font-medium">{rangeBook} {rangeChapter}:{rangeStart}-{rangeEnd}</p>
            </div>
          )}

          {/* Read Button */}
          <button
            onClick={handleReadRange}
            disabled={!rangeBook || rangeLoading}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {rangeLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {t('bible.generating', 'Inatengeneza sauti...')}
              </>
            ) : playingAudio === `range_${rangeBook}_${rangeChapter}` ? (
              <>
                <Pause size={20} />
                {t('bible.stop', 'Simamisha')}
              </>
            ) : (
              <>
                <Volume2 size={20} />
                {t('bible.listenNow', 'Sikiliza Sasa')}
              </>
            )}
          </button>
        </div>

        {/* Result - Shows verses being read */}
        {rangeResult && (
          <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">{rangeResult.reference}</h3>
              <span className="text-xs text-zinc-500">{rangeResult.verse_count} {t('bible.verses', 'mistari')}</span>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {rangeResult.verses?.map(verse => (
                <div key={verse.verse_id} className="flex gap-3">
                  <span className="text-amber-500 font-bold text-sm w-6 flex-shrink-0">{verse.verse}</span>
                  <p className="text-zinc-300 text-sm leading-relaxed">{verse.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show chapters if book selected but no chapter
  if (!selectedChapter) {
    return (
      <div className="space-y-6 p-4">
        <button 
          onClick={() => setSelectedBook(null)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white"
        >
          <ChevronLeft size={20} /> {t('action.back', 'Rudi')}
        </button>
        
        <h1 className="text-2xl font-bold">{selectedBook.name}</h1>
        
        <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2">
          {chapters.map(ch => (
            <button
              key={ch}
              onClick={() => setSelectedChapter(ch)}
              className="aspect-square flex items-center justify-center bg-zinc-800 hover:bg-amber-600 rounded-lg font-medium transition-colors"
            >
              {ch}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Show verses
  return (
    <div className="space-y-4 p-4">
      <button 
        onClick={() => setSelectedChapter(null)}
        className="flex items-center gap-2 text-zinc-400 hover:text-white"
      >
        <ChevronLeft size={20} /> {t('action.back', 'Rudi')}
      </button>
      
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{selectedBook.name} {selectedChapter}</h1>
        <span className="text-xs text-zinc-500">{verses.length} {t('bible.verses', 'mistari')}</span>
      </div>
      
      <div className="space-y-3 pb-20">
        {verses.map(verse => (
          <div 
            key={verse.verse_id}
            className="flex gap-3 p-3 bg-zinc-900/50 rounded-lg hover:bg-zinc-800/50 transition-colors"
          >
            <span className="text-amber-500 font-bold text-sm w-8 flex-shrink-0">{verse.verse}</span>
            <p className="text-zinc-200 text-sm leading-relaxed flex-1">{verse.text}</p>
            <button
              onClick={() => handleReadVerse(verse)}
              disabled={generatingAudio}
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                playingAudio === `verse_${verse.verse}`
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-700 text-zinc-400 hover:bg-amber-500/20 hover:text-amber-400'
              }`}
            >
              {generatingAudio && playingAudio === `verse_${verse.verse}` ? (
                <Loader2 size={14} className="animate-spin" />
              ) : playingAudio === `verse_${verse.verse}` ? (
                <Pause size={14} />
              ) : (
                <Volume2 size={14} />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Full-Screen Player Modal
const FullPlayer = ({ player, onClose, onFavorite, isFavorite }) => {
  if (!player.currentSong) return null;
  
  return (
    <div className="fixed inset-0 bg-gradient-to-b from-zinc-800 to-black z-[70] flex flex-col" data-testid="full-player">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button onClick={onClose} className="p-2">
          <ChevronLeft size={28} />
        </button>
        <div className="text-center">
          <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Playing from Playlist</p>
          <p className="text-xs font-medium">{player.currentAlbum?.title || 'Unknown Album'}</p>
        </div>
        <button className="p-2">
          <MoreHorizontal size={24} />
        </button>
      </div>

      {/* Album Art */}
      <div className="flex-1 flex items-center justify-center px-8 py-4">
        <div className="w-full max-w-sm aspect-square rounded-lg overflow-hidden shadow-2xl">
          {getThumbnail(player.currentAlbum) ? (
            <img src={getThumbnail(player.currentAlbum)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-800 to-emerald-700 flex items-center justify-center">
              <Music2 size={100} className="text-white/30" />
            </div>
          )}
        </div>
      </div>

      {/* Song Info & Actions */}
      <div className="px-8 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{player.currentSong.title}</h2>
            <p className="text-sm text-zinc-400 truncate">{player.currentAlbum?.artist_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onFavorite} className={isFavorite ? 'text-emerald-400' : 'text-zinc-400'}>
              <Heart size={24} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-8 mb-4">
        <Slider
          value={[player.currentTime]}
          max={player.duration || 100}
          step={0.1}
          onValueChange={([v]) => player.seekTo(v)}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-zinc-400 mt-1">
          <span>{formatTime(player.currentTime)}</span>
          <span>{formatTime(player.duration)}</span>
        </div>
      </div>

      {/* Main Controls */}
      <div className="flex items-center justify-between px-8 mb-8">
        <button 
          onClick={() => player.setShuffle(!player.shuffle)} 
          className={`relative ${player.shuffle ? 'text-emerald-400' : 'text-zinc-400'}`}
          title={player.shuffle ? 'Shuffle on' : 'Shuffle off'}
        >
          <Shuffle size={22} />
          {player.shuffle && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />}
        </button>
        <button onClick={player.prevSong} className="text-white">
          <SkipBack size={32} fill="white" />
        </button>
        <button 
          onClick={player.togglePlay}
          className="w-16 h-16 bg-white rounded-full flex items-center justify-center"
          disabled={player.isLoading}
        >
          {player.isLoading ? (
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : player.isPlaying ? (
            <Pause size={28} className="text-black" />
          ) : (
            <Play size={28} fill="black" className="text-black ml-1" />
          )}
        </button>
        <button onClick={player.nextSong} className="text-white">
          <SkipForward size={32} fill="white" />
        </button>
        <button 
          onClick={player.cycleRepeat} 
          className={`relative ${player.repeat !== 'off' ? 'text-emerald-400' : 'text-zinc-400'}`}
          title={player.repeat === 'off' ? 'Repeat off' : player.repeat === 'all' ? 'Repeat all' : 'Repeat one'}
        >
          {player.repeat === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
          {player.repeat !== 'off' && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-emerald-400" />}
        </button>
      </div>

      {/* Repeat Mode Indicator */}
      {player.repeat !== 'off' && (
        <div className="flex justify-center mb-4">
          <span className="text-xs text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full">
            {player.repeat === 'all' ? '🔁 Repeat All' : '🔂 Repeat One'}
          </span>
        </div>
      )}

      {/* Bottom Actions */}
      <div className="flex items-center justify-between px-8 pb-8">
        <button className="text-zinc-400">
          <Radio size={20} />
        </button>
        <button className="text-zinc-400">
          <Share2 size={20} />
        </button>
        <button className="text-zinc-400">
          <List size={20} />
        </button>
      </div>
    </div>
  );
};

// Mini Player Bar
const MiniPlayer = ({ player, onExpand, onFavorite, isFavorite }) => {
  if (!player.currentSong) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-50 bg-zinc-900/98 backdrop-blur-xl border-t border-zinc-800">
      {/* Progress line */}
      <div className="h-1 bg-zinc-800">
        <div 
          className="h-full bg-emerald-500"
          style={{ width: `${(player.currentTime / (player.duration || 1)) * 100}%` }}
        />
      </div>
      
      <div className="flex items-center p-2 lg:p-3 gap-3">
        {/* Song Info */}
        <button onClick={onExpand} className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 lg:w-14 lg:h-14 rounded overflow-hidden flex-shrink-0">
            {getThumbnail(player.currentAlbum) ? (
              <img src={getThumbnail(player.currentAlbum)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-zinc-700 flex items-center justify-center">
                <Music2 size={20} className="text-zinc-500" />
              </div>
            )}
          </div>
          <div className="min-w-0 text-left">
            <p className="font-medium text-sm truncate">{player.currentSong.title}</p>
            <p className="text-xs text-zinc-400 truncate">{player.currentAlbum?.artist_name}</p>
          </div>
        </button>

        {/* Quick Actions */}
        <button onClick={onFavorite} className={`hidden sm:block ${isFavorite ? 'text-emerald-400' : 'text-zinc-400'}`}>
          <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button onClick={player.prevSong} className="hidden md:block text-zinc-400 hover:text-white p-1">
            <SkipBack size={22} fill="currentColor" />
          </button>
          <button 
            onClick={player.togglePlay}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center"
            disabled={player.isLoading}
          >
            {player.isLoading ? (
              <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : player.isPlaying ? (
              <Pause size={18} className="text-black" />
            ) : (
              <Play size={18} fill="black" className="text-black ml-0.5" />
            )}
          </button>
          <button onClick={player.nextSong} className="hidden md:block text-zinc-400 hover:text-white p-1">
            <SkipForward size={22} fill="currentColor" />
          </button>
        </div>

        {/* Volume - Desktop */}
        <div className="hidden lg:flex items-center gap-2 ml-4">
          <button onClick={() => player.setIsMuted(!player.isMuted)} className="text-zinc-400 hover:text-white">
            {player.isMuted || player.volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <Slider
            value={[player.isMuted ? 0 : player.volume]}
            max={100}
            step={1}
            onValueChange={([v]) => { player.setVolume(v); player.setIsMuted(false); }}
            className="w-24"
          />
        </div>

        {/* Expand Button */}
        <button onClick={onExpand} className="text-zinc-400 hover:text-white p-1 lg:hidden">
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  );
};

// Auth Modal with Phone OTP support
const AuthModal = ({ showAuth, setShowAuth, authMode, setAuthMode, authForm, setAuthForm, handleLogin, handleRegister, setToken, setUser }) => {
  const [loginMethod, setLoginMethod] = useState('email'); // email, phone
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [devOtp, setDevOtp] = useState(''); // For development display
  
  // Auth methods from admin settings
  const [authMethods, setAuthMethods] = useState({
    email_password: true,
    google: true,
    phone: false,
    guest: true,
    registration_enabled: true
  });
  
  // Fetch auth methods when modal opens
  useEffect(() => {
    if (showAuth) {
      const fetchAuthMethods = async () => {
        try {
          const res = await axios.get(`${API}/auth/available-methods`);
          if (res.data) {
            setAuthMethods(res.data);
            // Set default login method based on availability
            if (!res.data.email_password && res.data.phone) {
              setLoginMethod('phone');
            } else if (!res.data.email_password && res.data.google) {
              setLoginMethod('google');
            }
          }
        } catch (e) {
          console.log('Failed to fetch auth methods');
        }
      };
      fetchAuthMethods();
    }
  }, [showAuth]);
  
  // Forgot Password State
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: enter email/phone, 2: enter OTP, 3: new password
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotDevOtp, setForgotDevOtp] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!authForm.phone || authForm.phone.length < 9) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setSendingOtp(true);
    try {
      const res = await axios.post(`${API}/auth/send-otp`, { phone: authForm.phone });
      toast.success("OTP sent to your phone!");
      setOtpStep(true);
      // For development - show the OTP (remove in production)
      if (res.data.otp_dev) {
        setDevOtp(res.data.otp_dev);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await axios.post(`${API}/auth/verify-otp`, { phone: authForm.phone, otp });
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('user_token', res.data.token);
      localStorage.setItem('user_id', res.data.user.user_id);
      setShowAuth(false);
      toast.success("Welcome to Gracefy!");
      // Reset state
      setOtpStep(false);
      setOtp('');
      setDevOtp('');
    } catch (e) {
      toast.error(e.response?.data?.detail || "Invalid OTP");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Forgot Password Handlers
  const handleSendResetOtp = async () => {
    if (!forgotIdentifier) {
      toast.error("Please enter your email or phone");
      return;
    }
    setForgotLoading(true);
    try {
      const isPhone = forgotIdentifier.startsWith('+') || /^\d+$/.test(forgotIdentifier);
      const payload = isPhone ? { phone: forgotIdentifier } : { email: forgotIdentifier };
      const res = await axios.post(`${API}/auth/forgot-password/send`, payload);
      toast.success(res.data.message);
      setForgotStep(2);
      if (res.data.otp_dev) {
        setForgotDevOtp(res.data.otp_dev);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to send reset code");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (!forgotOtp || forgotOtp.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }
    setForgotLoading(true);
    try {
      const res = await axios.post(`${API}/auth/forgot-password/verify`, {
        identifier: forgotIdentifier,
        otp: forgotOtp
      });
      toast.success("Code verified!");
      setResetToken(res.data.reset_token);
      setForgotStep(3);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Invalid or expired code");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setForgotLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password/reset`, {
        reset_token: resetToken,
        new_password: newPassword
      });
      toast.success("Password reset successfully! Please sign in.");
      resetForgotPassword();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to reset password");
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setForgotPasswordMode(false);
    setForgotStep(1);
    setForgotIdentifier('');
    setForgotOtp('');
    setResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
    setForgotDevOtp('');
  };

  const resetModal = () => {
    setOtpStep(false);
    setOtp('');
    setDevOtp('');
    setLoginMethod('email');
    resetForgotPassword();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl max-w-md w-full p-6 relative">
        <button onClick={() => { setShowAuth(false); resetModal(); }} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
          <X size={24} />
        </button>

        {/* Forgot Password Mode */}
        {forgotPasswordMode ? (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-1">Reset Password</h2>
              <p className="text-sm text-zinc-400">
                {forgotStep === 1 && "Enter your email or phone to receive a reset code"}
                {forgotStep === 2 && "Enter the 6-digit code we sent you"}
                {forgotStep === 3 && "Create your new password"}
              </p>
            </div>

            <div className="space-y-3">
              {forgotStep === 1 && (
                <>
                  <Input 
                    value={forgotIdentifier} 
                    onChange={(e) => setForgotIdentifier(e.target.value)} 
                    placeholder="Email or phone number" 
                    className="bg-zinc-800 border-zinc-700"
                    data-testid="forgot-identifier-input"
                  />
                  <Button 
                    onClick={handleSendResetOtp} 
                    disabled={forgotLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-5"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 size={18} className="mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Code'
                    )}
                  </Button>
                </>
              )}

              {forgotStep === 2 && (
                <>
                  <p className="text-sm text-zinc-400 text-center">Code sent to {forgotIdentifier}</p>
                  
                  {forgotDevOtp && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-amber-500 mb-1">Development Mode - Code:</p>
                      <p className="text-2xl font-mono font-bold text-amber-400 tracking-widest">{forgotDevOtp}</p>
                    </div>
                  )}
                  
                  <Input 
                    value={forgotOtp} 
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                    placeholder="Enter 6-digit code"
                    className="bg-zinc-800 border-zinc-700 text-center text-xl tracking-widest"
                    maxLength={6}
                    data-testid="forgot-otp-input"
                  />
                  <Button 
                    onClick={handleVerifyResetOtp} 
                    disabled={forgotLoading || forgotOtp.length !== 6}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-5"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 size={18} className="mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify Code'
                    )}
                  </Button>
                </>
              )}

              {forgotStep === 3 && (
                <>
                  <Input 
                    type="password"
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder="New password (min 6 characters)" 
                    className="bg-zinc-800 border-zinc-700"
                    data-testid="new-password-input"
                  />
                  <Input 
                    type="password"
                    value={confirmNewPassword} 
                    onChange={(e) => setConfirmNewPassword(e.target.value)} 
                    placeholder="Confirm new password" 
                    className="bg-zinc-800 border-zinc-700"
                    data-testid="confirm-new-password-input"
                  />
                  <Button 
                    onClick={handleResetPassword} 
                    disabled={forgotLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-5"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 size={18} className="mr-2 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      'Reset Password'
                    )}
                  </Button>
                </>
              )}

              <button 
                onClick={resetForgotPassword}
                className="w-full text-sm text-zinc-400 hover:text-white py-2"
              >
                Back to Sign In
              </button>
            </div>
          </>
        ) : (
          /* Normal Login/Register Mode */
          <>
            <div className="text-center mb-6">
              <img 
                src="/gracefy-logo-dark.png" 
                alt="Gracefy" 
                className="w-16 h-16 mx-auto mb-3 object-contain"
              />
              <h2 className="text-2xl font-bold mb-1">{authMode === 'login' ? 'Welcome back' : 'Create account'}</h2>
              <p className="text-sm text-zinc-400">Sign in to save your music</p>
            </div>

            {/* Login Method Tabs - Only show if multiple methods available */}
            {!otpStep && (authMethods.email_password && authMethods.phone) && (
              <div className="flex gap-2 mb-4">
                {authMethods.email_password && (
                  <button 
                    onClick={() => setLoginMethod('email')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      loginMethod === 'email' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Mail size={16} />
                    Email
                  </button>
                )}
                {authMethods.phone && (
                  <button 
                    onClick={() => setLoginMethod('phone')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                      loginMethod === 'phone' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Phone size={16} />
                    Phone OTP
                  </button>
                )}
              </div>
            )}

            <div className="space-y-3">
              {/* Phone OTP Login - Only show if phone auth is enabled */}
              {authMethods.phone && loginMethod === 'phone' ? (
                <>
                  {!otpStep ? (
                    <>
                      <Input 
                        value={authForm.phone} 
                        onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} 
                        placeholder="Phone number (e.g., +255...)" 
                        className="bg-zinc-800 border-zinc-700"
                        data-testid="phone-input"
                      />
                      <Button 
                        onClick={handleSendOtp} 
                    disabled={sendingOtp}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-5"
                    data-testid="send-otp-btn"
                  >
                    {sendingOtp ? (
                      <>
                        <Loader2 size={18} className="mr-2 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      'Send OTP'
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-zinc-400 text-center">Enter the 6-digit code sent to {authForm.phone}</p>
                  
                  {/* Dev OTP Display (REMOVE IN PRODUCTION) */}
                  {devOtp && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-amber-500 mb-1">Development Mode - OTP:</p>
                      <p className="text-2xl font-mono font-bold text-amber-400 tracking-widest">{devOtp}</p>
                    </div>
                  )}
                  
                  <Input 
                    value={otp} 
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                    placeholder="Enter 6-digit OTP"
                    className="bg-zinc-800 border-zinc-700 text-center text-xl tracking-widest"
                    maxLength={6}
                    data-testid="otp-input"
                  />
                  <Button 
                    onClick={handleVerifyOtp} 
                    disabled={verifyingOtp || otp.length !== 6}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-5"
                    data-testid="verify-otp-btn"
                  >
                    {verifyingOtp ? (
                      <>
                        <Loader2 size={18} className="mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify & Sign In'
                    )}
                  </Button>
                  <button 
                    onClick={() => { setOtpStep(false); setOtp(''); setDevOtp(''); }}
                    className="w-full text-sm text-zinc-400 hover:text-white py-2"
                  >
                    Use different number
                  </button>
                </>
              )}
            </>
          ) : authMethods.email_password ? (
            /* Email/Password Login - Only show if email auth is enabled */
            <>
              {authMode === 'register' && (
                <Input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Your name" className="bg-zinc-800 border-zinc-700" />
              )}
              <Input value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="Email address" type="email" className="bg-zinc-800 border-zinc-700" />
              <Input value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="Password" type="password" className="bg-zinc-800 border-zinc-700" />

              {authMode === 'login' && (
                <button 
                  onClick={() => setForgotPasswordMode(true)}
                  className="text-sm text-emerald-400 hover:underline text-right w-full"
                  data-testid="forgot-password-link"
                >
                  Forgot password?
                </button>
              )}

              <Button onClick={authMode === 'login' ? handleLogin : handleRegister} className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-5">
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>
            </>
          ) : (
            /* No email auth - show only Google if enabled */
            <>
              {!authMethods.email_password && !authMethods.phone && (
                <p className="text-center text-zinc-400 text-sm">
                  Use the options below to sign in
                </p>
              )}
            </>
          )}

          {/* Google Login - Only show if enabled and not in OTP step */}
          {authMethods.google && !otpStep && (
            <>
              {(authMethods.email_password || authMethods.phone) && (
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-700" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-zinc-900 px-2 text-zinc-500">or</span></div>
                </div>
              )}

              <Button 
                variant="outline" 
                className="w-full border-zinc-700 py-5"
                onClick={() => {
                  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
                  const redirectUrl = window.location.origin + '/app';
                  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
                }}
                data-testid="google-login-btn"
              >
                <img src="https://www.google.com/favicon.ico" alt="" className="w-4 h-4 mr-2" />
                Continue with Google
              </Button>
            </>
          )}
            </div>

            {/* Toggle signup/signin - Only show if registration is enabled */}
            {authMethods.email_password && !otpStep && (
              <p className="text-center text-sm text-zinc-400 mt-4">
                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button 
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} 
                  className="text-emerald-400 hover:underline"
                  disabled={!authMethods.registration_enabled && authMode === 'login'}
                >
                  {authMode === 'login' ? (authMethods.registration_enabled ? 'Sign up' : 'Registration disabled') : 'Sign in'}
                </button>
              </p>
            )}

            {/* Choir Registration Link */}
            <div className="text-center mt-4 pt-4 border-t border-zinc-800">
              <p className="text-xs text-zinc-500">
                Are you a choir or artist?{' '}
                <a href="/choir-register" className="text-violet-400 hover:underline">
                  Register here
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ==================== MAIN APP ====================
export default function UserStreamingApp() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('user_token'));
  const [view, setView] = useState('home');
  const [homeData, setHomeData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [selectedAlbumSongs, setSelectedAlbumSongs] = useState([]);
  const [library, setLibrary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [categoryAlbums, setCategoryAlbums] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [quickAccessItems, setQuickAccessItems] = useState([]);
  const [libraryTab, setLibraryTab] = useState('all');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  
  // Billing/Monetization state
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  
  // Geo-content state
  const [userCountry, setUserCountry] = useState('GLOBAL');
  const [geoEnabled, setGeoEnabled] = useState(true);
  
  // Bible audio state
  const [bibleAudioPlaying, setBibleAudioPlaying] = useState(null);
  const [bibleAudioElement, setBibleAudioElement] = useState(null);

  // Teaching state
  const [selectedTeaching, setSelectedTeaching] = useState(null);
  const [teachingTopics, setTeachingTopics] = useState([]);
  const [teachingLoading, setTeachingLoading] = useState(false);

  // Church detail modal
  const [selectedChurch, setSelectedChurch] = useState(null);
  const [churchChoirs, setChurchChoirs] = useState([]);
  
  // Download app popup
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  
  // Radio stations state for home view
  const [homeRadioStations, setHomeRadioStations] = useState([]);
  
  // Home radio playing state
  const [homeRadioPlaying, setHomeRadioPlaying] = useState(null);
  const [homeRadioAudio, setHomeRadioAudio] = useState(null);

  const player = useAudioPlayer();
  const [authForm, setAuthForm] = useState({ email: '', phone: '', password: '', name: '' });
  
  // i18n - Translation hook
  const { t, language, changeLanguage, availableLanguages, getGreeting } = useLanguage();

  // Listen for Bible reader open event
  useEffect(() => {
    const handleOpenBibleReader = () => setView('bible');
    window.addEventListener('openBibleReader', handleOpenBibleReader);
    return () => window.removeEventListener('openBibleReader', handleOpenBibleReader);
  }, []);

  // Restore playback on page load
  useEffect(() => {
    const restorePlayback = async () => {
      const saved = player.restorePlaybackState();
      if (saved && saved.song && saved.album) {
        // Resume from last position (within 24 hours)
        const ageMs = Date.now() - (saved.timestamp || 0);
        if (ageMs < 24 * 60 * 60 * 1000) {
          try {
            // Fetch fresh album data
            const albumRes = await axios.get(`${API}/user/album/${saved.album.album_id}`);
            const songs = albumRes.data.songs || [];
            const songQueue = songs.map(s => ({ song: s, album: albumRes.data.album }));
            const songIndex = songs.findIndex(s => s.song_id === saved.song.song_id);
            if (songIndex >= 0) {
              // Don't auto-play, just set up the player
              player.playSong(saved.song, saved.album, songQueue, songIndex);
              // Seek to saved position after a brief delay
              setTimeout(() => {
                player.seekTo(saved.time || 0);
              }, 500);
            }
          } catch (e) {
            console.log("Could not restore playback:", e);
          }
        }
      }
    };
    // Only restore once data is loaded
    if (!loading && homeData) {
      restorePlayback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, homeData]);

  // Get greeting using the language context
  const greeting = getGreeting();

  // Fetch home data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // First, fetch billing status and detect user country
        const [billingRes, geoRes] = await Promise.all([
          axios.get(`${API}/billing-status`).catch(() => ({ data: { billing_enabled: false } })),
          axios.get(`${API}/geo/detect-country`).catch(() => ({ data: { country_code: 'GLOBAL' } }))
        ]);
        
        // Set billing state - if billing is disabled, everyone is premium
        const billingStatus = billingRes.data?.billing_enabled ?? false;
        setBillingEnabled(billingStatus);
        if (!billingStatus) {
          setIsPremium(true); // When billing is OFF, everyone is premium
        }
        
        // Set geo state
        const detectedCountry = geoRes.data?.country_code || 'GLOBAL';
        setUserCountry(detectedCountry);
        
        // Use geo-filtered home endpoint if geo content exists
        const useGeoFiltering = geoEnabled && detectedCountry && detectedCountry !== 'GLOBAL';
        const homeEndpoint = useGeoFiltering 
          ? `${API}/user/home/geo?country=${detectedCountry}&platform=web` 
          : `${API}/user/home?platform=web`;
        
        const [homeRes, catRes, sectionsRes, tagsRes, radioRes] = await Promise.all([
          axios.get(homeEndpoint),
          axios.get(`${API}/user/browse/categories`),
          axios.get(`${API}/layout/sections?active_only=true`),
          axios.get(`${API}/admin/tags`).catch(() => ({ data: { tags: [] } })),
          axios.get(`${API}/radio/stations`).catch(() => ({ data: { stations: [] } }))
        ]);
        setHomeData(homeRes.data);
        setCategories(catRes.data.categories || []);
        setAvailableTags(tagsRes.data?.tags || []);
        setHomeRadioStations(radioRes.data.stations?.slice(0, 6) || []);
        
        // Get quick access section items
        const quickSection = sectionsRes.data.sections?.find(s => s.section_type === 'quick_access');
        if (quickSection?.content_ids?.length > 0) {
          // Fetch the specific items
          const items = quickSection.content_type === 'categories' 
            ? catRes.data.categories?.filter(c => quickSection.content_ids.includes(c.category_id))
            : [];
          setQuickAccessItems(items);
        } else {
          // Default to first 6 categories
          setQuickAccessItems(catRes.data.categories?.slice(0, 6) || []);
        }
      } catch (e) {
        console.error("Failed to fetch data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [geoEnabled]);

  // Check auth
  useEffect(() => {
    if (token) {
      axios.get(`${API}/user/me`, { headers: { Authorization: `Bearer ${token}` }})
        .then(res => {
          setUser(res.data);
          localStorage.setItem('user_id', res.data.user_id);
          setFavorites(res.data.favorites || []);
          
          // Only check subscription if billing is enabled
          if (billingEnabled && res.data.user_id) {
            axios.get(`${API}/user/subscription-status?user_id=${res.data.user_id}`)
              .then(subRes => {
                // If billing is disabled at backend level, user is premium
                if (subRes.data?.billing_enabled === false) {
                  setIsPremium(true);
                  setBillingEnabled(false);
                } else {
                  setIsPremium(subRes.data?.is_premium || false);
                }
              })
              .catch(() => setIsPremium(false));
          } else if (!billingEnabled) {
            // Billing is disabled, everyone is premium
            setIsPremium(true);
          }
        })
        .catch(() => {
          localStorage.removeItem('user_token');
          setToken(null);
        });
    }
  }, [token, billingEnabled]);

  // Handle Google OAuth callback
  useEffect(() => {
    const hash = window.location.hash;
    console.log('Checking OAuth hash:', hash);
    
    if (hash && hash.includes('session_id=')) {
      const sessionId = hash.split('session_id=')[1]?.split('&')[0];
      console.log('Found session_id:', sessionId);
      
      if (sessionId) {
        // Clear the hash from URL first
        window.history.replaceState(null, '', window.location.pathname);
        
        // Process the session
        axios.post(`${API}/user/auth/google-callback`, { session_id: sessionId }, { withCredentials: true })
          .then(res => {
            console.log('Google auth success:', res.data);
            setToken(res.data.token);
            setUser(res.data.user);
            localStorage.setItem('user_token', res.data.token);
            localStorage.setItem('user_id', res.data.user.user_id);
            setShowAuth(false);
            toast.success(`Welcome, ${res.data.user.name}!`);
          })
          .catch(e => {
            console.error("Google auth error:", e.response?.data || e.message);
            toast.error("Google sign-in failed. Please try again.");
          });
      }
    }
  }, []);

  // Search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/user/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(res.data);
      } catch (e) {
        console.log("Search error");
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Play radio directly from home page
  const handlePlayRadioFromHome = async (station) => {
    try {
      // Stop regular music playback if playing
      if (player.isPlaying) {
        player.pause();
      }
      
      // If same station, toggle play/pause
      if (homeRadioPlaying?.station_id === station.station_id) {
        if (homeRadioAudio) {
          homeRadioAudio.pause();
          homeRadioAudio.src = '';
          setHomeRadioAudio(null);
        }
        setHomeRadioPlaying(null);
        return;
      }
      
      // Stop current radio if playing
      if (homeRadioAudio) {
        homeRadioAudio.pause();
        homeRadioAudio.src = '';
      }
      
      toast.info(`Loading ${station.name}...`);
      
      // Track play
      try {
        await axios.post(`${API}/radio/play`, {
          station_id: station.station_id,
          platform: 'web'
        });
      } catch (e) {}
      
      // Create and play audio
      const audio = new Audio(station.url_resolved || station.url);
      audio.onplay = () => setHomeRadioPlaying(station);
      audio.onpause = () => {};
      audio.onerror = () => {
        toast.error("Failed to play station");
        setHomeRadioPlaying(null);
        setHomeRadioAudio(null);
      };
      
      await audio.play();
      setHomeRadioAudio(audio);
      setHomeRadioPlaying(station);
      toast.success(`Now playing: ${station.name}`);
    } catch (error) {
      console.error("Error playing radio:", error);
      toast.error("Failed to play station");
    }
  };

  // Category filter
  const handleCategorySelect = async (category) => {
    setActiveCategory(category);
    if (category) {
      try {
        const res = await axios.get(`${API}/user/browse/category/${category.category_id}`);
        setCategoryAlbums(res.data.albums || []);
      } catch (e) {
        setCategoryAlbums([]);
      }
    }
  };

  const openAlbum = async (albumId) => {
    try {
      const res = await axios.get(`${API}/user/album/${albumId}`);
      setSelectedAlbum(res.data.album);
      setSelectedAlbumSongs(res.data.songs);
      setView('album');
    } catch (e) {
      toast.error("Failed to load album");
    }
  };

  const openSpecialMix = async (mix) => {
    try {
      // Fetch the special mix songs from the API
      const res = await axios.get(`${API}/special-mixes/${mix.mix_id}/songs`);
      const mixSongs = res.data.songs || [];
      
      // Create a virtual album from the mix
      setSelectedAlbum({
        album_id: mix.mix_id,
        title: mix.title,
        thumbnail: mix.thumbnail,
        description: mix.description,
        is_special_mix: true
      });
      setSelectedAlbumSongs(mixSongs);
      setView('album');
    } catch (e) {
      console.error('Failed to load special mix:', e);
      toast.error("Imeshindikana kupakia mix");
    }
  };

  // Open teaching detail view
  const openTeachingDetail = async (teaching) => {
    try {
      setTeachingLoading(true);
      setSelectedTeaching(teaching);
      setView('teaching');
      
      // Fetch teaching details with topics and lessons
      const res = await axios.get(`${API}/teachings/${teaching.teaching_id}`);
      setSelectedTeaching(res.data);
      setTeachingTopics(res.data.topics || []);
    } catch (e) {
      console.error('Failed to load teaching:', e);
      toast.error("Imeshindikana kupakia mafundisho");
    } finally {
      setTeachingLoading(false);
    }
  };

  // Play teaching lesson audio
  const playTeachingLesson = (lesson, teaching) => {
    if (!lesson.audio_url) {
      toast.error("Hakuna sauti kwa somo hili");
      return;
    }
    
    // Create a virtual song from the lesson
    const audioUrl = lesson.audio_url.startsWith('http') 
      ? lesson.audio_url 
      : `${BACKEND_URL}${lesson.audio_url}${lesson.audio_url.includes('/stream') ? '' : '/stream'}`;
    
    const virtualSong = {
      song_id: lesson.lesson_id,
      title: lesson.title_sw || lesson.title,
      artist: teaching.leader_name || 'Kiongozi',
      audio_url: audioUrl,
      thumbnail: teaching.thumbnail,
      duration: lesson.duration || 0,
      is_teaching: true
    };
    
    // Use the player from the hook to play the lesson
    player.playSong(virtualSong, {
      title: teaching.name || teaching.title_sw,
      thumbnail: teaching.thumbnail
    }, [{ song: virtualSong, album: teaching }], 0);
  };

  // Play all lessons in a teaching
  const playAllTeachingLessons = (teaching, topics) => {
    const allLessons = [];
    
    // Collect all lessons from all topics
    topics.forEach(topic => {
      (topic.lessons || []).forEach(lesson => {
        if (lesson.audio_url) {
          const audioUrl = lesson.audio_url.startsWith('http') 
            ? lesson.audio_url 
            : `${BACKEND_URL}${lesson.audio_url}${lesson.audio_url.includes('/stream') ? '' : '/stream'}`;
          
          allLessons.push({
            song: {
              song_id: lesson.lesson_id,
              title: lesson.title_sw || lesson.title,
              artist: teaching.leader_name || 'Kiongozi',
              audio_url: audioUrl,
              thumbnail: teaching.thumbnail,
              duration: lesson.duration || 0,
              is_teaching: true
            },
            album: teaching
          });
        }
      });
    });
    
    if (allLessons.length === 0) {
      toast.error("Hakuna masomo yenye sauti");
      return;
    }
    
    // Play the first lesson and queue the rest
    player.playSong(
      allLessons[0].song,
      { title: teaching.name || teaching.title_sw, thumbnail: teaching.thumbnail },
      allLessons,
      0
    );
    toast.success(`Inacheza masomo ${allLessons.length}`);
  };

  // Shuffle and play all lessons
  const shuffleTeachingLessons = (teaching, topics) => {
    const allLessons = [];
    
    // Collect all lessons from all topics
    topics.forEach(topic => {
      (topic.lessons || []).forEach(lesson => {
        if (lesson.audio_url) {
          const audioUrl = lesson.audio_url.startsWith('http') 
            ? lesson.audio_url 
            : `${BACKEND_URL}${lesson.audio_url}${lesson.audio_url.includes('/stream') ? '' : '/stream'}`;
          
          allLessons.push({
            song: {
              song_id: lesson.lesson_id,
              title: lesson.title_sw || lesson.title,
              artist: teaching.leader_name || 'Kiongozi',
              audio_url: audioUrl,
              thumbnail: teaching.thumbnail,
              duration: lesson.duration || 0,
              is_teaching: true
            },
            album: teaching
          });
        }
      });
    });
    
    if (allLessons.length === 0) {
      toast.error("Hakuna masomo yenye sauti");
      return;
    }
    
    // Shuffle the lessons
    const shuffled = [...allLessons].sort(() => Math.random() - 0.5);
    
    // Play the first shuffled lesson
    player.playSong(
      shuffled[0].song,
      { title: teaching.name || teaching.title_sw, thumbnail: teaching.thumbnail },
      shuffled,
      0
    );
    toast.success(`Inacheza masomo ${shuffled.length} kwa nasibu`);
  };

  // Open church detail modal
  const openChurchDetail = async (church) => {
    setSelectedChurch(church);
    
    // Try to fetch choirs associated with this church
    try {
      const res = await axios.get(`${API}/choirs?church_id=${church.church_id}`);
      setChurchChoirs(res.data?.choirs || []);
    } catch (e) {
      setChurchChoirs([]);
    }
  };
  
  // Handle download button click - show popup
  const handleDownloadClick = () => {
    setShowDownloadPopup(true);
  };

  const fetchLibrary = async () => {
    if (!token) {
      setShowAuth(true);
      return;
    }
    try {
      const res = await axios.get(`${API}/user/library`, { headers: { Authorization: `Bearer ${token}` }});
      setLibrary(res.data);
      setView('library');
    } catch (e) {
      toast.error("Failed to load library");
    }
  };

  // Bible audio handler
  const handlePlayBibleSnippet = async (snippet) => {
    if (bibleAudioPlaying === snippet.snippet_id) {
      // Stop playing
      if (bibleAudioElement) {
        bibleAudioElement.pause();
        bibleAudioElement.currentTime = 0;
      }
      setBibleAudioPlaying(null);
      return;
    }
    
    try {
      const res = await axios.get(`${API}/bible/snippets/${snippet.snippet_id}`);
      if (bibleAudioElement) bibleAudioElement.pause();
      
      const audio = new Audio(`data:audio/mp3;base64,${res.data.audio_base64}`);
      audio.onended = () => setBibleAudioPlaying(null);
      audio.play();
      setBibleAudioElement(audio);
      setBibleAudioPlaying(snippet.snippet_id);
    } catch (e) {
      toast.error("Failed to play audio");
    }
  };

  // Auth handlers
  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API}/user/login`, {
        email: authForm.email || undefined,
        phone: authForm.phone || undefined,
        password: authForm.password
      });
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('user_token', res.data.token);
      localStorage.setItem('user_id', res.data.user.user_id);
      setShowAuth(false);
      toast.success("Welcome back!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Login failed");
    }
  };

  const handleRegister = async () => {
    try {
      const res = await axios.post(`${API}/user/register`, {
        email: authForm.email || undefined,
        phone: authForm.phone || undefined,
        password: authForm.password,
        name: authForm.name
      });
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('user_token', res.data.token);
      localStorage.setItem('user_id', res.data.user.user_id);
      setShowAuth(false);
      toast.success("Account created!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Registration failed");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_id');
    setToken(null);
    setUser(null);
    setLibrary(null);
  };

  const toggleFavorite = async (type, id) => {
    if (!token) {
      setShowAuth(true);
      return;
    }
    const isFav = favorites.some(f => f.id === id);
    try {
      if (isFav) {
        await axios.post(`${API}/user/favorites/remove`, { id }, { headers: { Authorization: `Bearer ${token}` }});
        setFavorites(prev => prev.filter(f => f.id !== id));
        toast.success("Removed from favorites");
      } else {
        await axios.post(`${API}/user/favorites/add`, { type, id }, { headers: { Authorization: `Bearer ${token}` }});
        setFavorites(prev => [...prev, { type, id }]);
        toast.success("Added to favorites");
      }
    } catch (e) {
      toast.error("Failed to update favorites");
    }
  };

  const isFavorite = (id) => favorites.some(f => f.id === id);

  // Handler for Like (song)
  const handleLikeSong = (song) => {
    toggleFavorite('song', song.song_id);
  };

  // Handler for Add to Playlist
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState(null);
  const [userPlaylists, setUserPlaylists] = useState([]);
  
  const handleAddToPlaylist = async (song) => {
    if (!token) {
      setShowAuth(true);
      return;
    }
    setSelectedSongForPlaylist(song);
    // Fetch user's playlists
    try {
      const res = await axios.get(`${API}/user/library`, { headers: { Authorization: `Bearer ${token}` }});
      setUserPlaylists(res.data.playlists || []);
    } catch (e) {
      console.log("Could not fetch playlists");
    }
    setShowPlaylistModal(true);
  };

  const addSongToPlaylist = async (playlistId) => {
    try {
      await axios.post(`${API}/user/playlist/${playlistId}/add`, 
        { song_id: selectedSongForPlaylist.song_id },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      toast.success("Added to playlist!");
      setShowPlaylistModal(false);
    } catch (e) {
      toast.error("Failed to add to playlist");
    }
  };

  const createNewPlaylist = async (name) => {
    try {
      const res = await axios.post(`${API}/user/playlist/create`,
        { name, description: "" },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      if (selectedSongForPlaylist) {
        await addSongToPlaylist(res.data.playlist_id);
      } else {
        toast.success("Playlist created!");
        setShowPlaylistModal(false);
      }
    } catch (e) {
      toast.error("Failed to create playlist");
    }
  };

  // Handler for Download
  const handleDownloadSong = async (song) => {
    if (!token) {
      setShowAuth(true);
      return;
    }
    
    // On web, show download app popup instead of direct download
    // Direct download only works on the mobile app for offline playback
    setShowDownloadPopup(true);
  };

  // Handler for Share
  const handleShareSong = async (song, album) => {
    const shareText = `🎵 Listen to "${song.title}" by ${album?.artist_name || 'Gracefy'} on Gracefy!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: song.title,
          text: shareText,
          url: window.location.href
        });
      } catch (e) {
        // User cancelled or error
      }
    } else {
      // Fallback - copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success("Link copied to clipboard!");
      } catch (e) {
        toast.error("Failed to share");
      }
    }
  };

  const handlePlaySong = (song, album, allSongs, index) => {
    const queue = allSongs.map(s => ({ song: s, album }));
    player.playSong(song, album, queue, index);
  };

  const handlePlayAlbum = () => {
    if (selectedAlbumSongs.length > 0) {
      handlePlaySong(selectedAlbumSongs[0], selectedAlbum, selectedAlbumSongs, 0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white" data-testid="user-streaming-app">
      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 w-64 h-full bg-black p-6 hidden lg:flex flex-col z-40">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-emerald-500">♱</span> Gracefy
          </h1>
        </div>
        
        <nav className="space-y-1">
          <button 
            onClick={() => { setView('home'); setActiveCategory(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'home' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <Home size={22} /> {t('nav.home', 'Home')}
          </button>
          <button 
            onClick={() => setView('search')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'search' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <Search size={22} /> {t('nav.search', 'Search')}
          </button>
          <button 
            onClick={fetchLibrary}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'library' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <Library size={22} /> {t('library.yourLibrary', 'Your Library')}
          </button>
          <button 
            onClick={() => setView('bible')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'bible' ? 'bg-amber-600 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <BookOpen size={22} /> {t('nav.bible', 'Biblia')}
          </button>
          <button 
            onClick={() => setView('radio')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'radio' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'}`}
            data-testid="radio-nav-btn"
          >
            <Radio size={22} /> {t('nav.radio', 'Redio')}
          </button>
        </nav>

        <div className="mt-6 pt-6 border-t border-zinc-800 space-y-2">
          <button className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors text-sm w-full">
            <Plus size={18} /> {t('action.createPlaylist', 'Create Playlist')}
          </button>
          <button className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors text-sm w-full">
            <Heart size={18} /> {t('library.likedSongs', 'Liked Songs')}
          </button>
        </div>

        {/* Language Selector */}
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <button 
            onClick={() => setShowLanguageModal(true)}
            className="flex items-center gap-3 text-zinc-400 hover:text-white transition-colors text-sm w-full"
          >
            <Globe size={18} /> {t('settings.language', 'Language')}: {language === 'sw' ? 'Kiswahili' : 'English'}
          </button>
        </div>

        {/* App Store Links */}
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-500 mb-3">{t('download.getApp', 'Get the App')}</p>
          <div className="flex gap-2">
            <a 
              href="https://apps.apple.com/app/gracefy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors group"
            >
              <svg className="w-5 h-5 text-zinc-400 group-hover:text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <span className="text-xs text-zinc-400 group-hover:text-white">iOS</span>
            </a>
            <a 
              href="https://play.google.com/store/apps/details?id=com.gracefy.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors group"
            >
              <svg className="w-5 h-5 text-zinc-400 group-hover:text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35zm13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27zm3.35-4.31c.34.27.59.69.59 1.19s-.22.9-.57 1.18l-2.29 1.32-2.5-2.5 2.5-2.5 2.27 1.31zM6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/>
              </svg>
              <span className="text-xs text-zinc-400 group-hover:text-white">Android</span>
            </a>
          </div>
        </div>

        {/* User */}
        <div className="mt-auto pt-4 border-t border-zinc-800">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold">
                {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                <button onClick={handleLogout} className="text-xs text-zinc-500 hover:text-white">{t('auth.logout', 'Logout')}</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuth(true)}
              className="w-full py-2.5 bg-white text-black rounded-full font-semibold hover:scale-105 transition-transform text-sm"
            >
              {t('auth.login', 'Sign In')}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${player.currentSong ? 'pb-28' : 'pb-16'} lg:pb-24 lg:ml-64`}>
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 bg-black/95 backdrop-blur-xl z-40 px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-emerald-500">♱</span> Gracefy
          </h1>
          {user ? (
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold">
              {user.name?.charAt(0) || 'U'}
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} className="text-emerald-400 font-medium text-sm">Sign in</button>
          )}
        </header>

        <div className={view === 'home' ? '' : 'p-4 lg:p-6'}>
          {/* HOME VIEW */}
          {view === 'home' && homeData && (
            <div>
              {/* Hero Section - Dynamic Albums Carousel or Static Burner */}
              {homeData.hero?.hero_type === 'dynamic_content' && homeData.hero?.items?.length > 0 ? (
                <DynamicHeroSection 
                  hero={homeData.hero} 
                  onAlbumClick={openAlbum}
                  getThumbnail={getThumbnail}
                />
              ) : homeData.burners?.[0] && (
                <div 
                  className="relative w-full h-56 md:h-72 overflow-hidden"
                  style={{ background: homeData.burners[0].background_gradient || homeData.burners[0].background_color || 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)' }}
                  data-testid="hero-section"
                >
                  {homeData.burners[0].image_url && (
                    <img src={homeData.burners[0].image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                    <h2 className="text-2xl md:text-4xl font-bold mb-2">{homeData.burners[0].headline || 'Discover Sacred Music'}</h2>
                    <p className="text-sm md:text-base text-zinc-300 mb-4 max-w-xl">{homeData.burners[0].subtitle}</p>
                    <button className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full text-sm">
                      {homeData.burners[0].cta_text || 'Start Listening'}
                    </button>
                  </div>
                </div>
              )}

              <div className="px-4 lg:px-6 pt-6 space-y-8">
                {/* Quick Access Grid - 8 tiles, no header, user items first */}
                <section>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {/* User items first */}
                    <QuickAccessCard 
                      item={{ type: 'liked_songs', name: t('library.likedSongs', 'Liked Songs') }} 
                      onClick={() => { setView('library'); setLibraryTab && setLibraryTab('liked'); }}
                    />
                    <QuickAccessCard 
                      item={{ type: 'playlists', name: t('library.playlists', 'Playlists') }} 
                      onClick={() => { setView('library'); setLibraryTab && setLibraryTab('playlists'); }}
                    />
                    <QuickAccessCard 
                      item={{ type: 'downloads', name: t('library.downloads', 'Downloads') }} 
                      onClick={() => { setView('library'); setLibraryTab && setLibraryTab('downloads'); }}
                    />
                    <QuickAccessCard 
                      item={{ type: 'library', name: t('library.yourLibrary', 'My Library') }} 
                      onClick={() => setView('library')}
                    />
                    {/* Admin configured items (up to 4 more) */}
                    {quickAccessItems.slice(0, 4).map((item, i) => (
                      <QuickAccessCard 
                        key={item.category_id || item.album_id || i} 
                        item={item} 
                        onClick={() => item.category_id ? handleCategorySelect(item) : openAlbum(item.album_id)}
                      />
                    ))}
                  </div>
                </section>

                {/* Bible Devotional Cards - Horizontal Scroll */}
                <BibleDevotionalSection language={language} t={t} onPlaySnippet={handlePlayBibleSnippet} />

                {/* Radio Stations - Single Row */}
                {homeRadioStations.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Radio className="w-5 h-5 text-violet-500" />
                        <h2 className="text-lg font-bold">{t('radio.title', 'Redio za Kikristo')}</h2>
                      </div>
                      <button 
                        onClick={() => setView('radio')} 
                        className="text-sm text-violet-400 hover:text-violet-300"
                      >
                        {t('common.seeAll', 'Angalia Zote')}
                      </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                      {homeRadioStations.map(station => (
                        <div
                          key={station.station_id}
                          onClick={() => handlePlayRadioFromHome(station)}
                          className="flex-shrink-0 w-36 bg-zinc-900/60 rounded-lg p-3 cursor-pointer hover:bg-zinc-800/60 transition-colors group"
                        >
                          <div className="w-full aspect-square rounded-lg overflow-hidden mb-2 bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center relative">
                            {station.favicon ? (
                              <img 
                                src={station.favicon} 
                                alt={station.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <Radio className="w-10 h-10 text-white/60" />
                            )}
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center">
                                {homeRadioPlaying?.station_id === station.station_id ? (
                                  <Pause className="w-5 h-5 text-white fill-white" />
                                ) : (
                                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                )}
                              </div>
                            </div>
                          </div>
                          <h3 className="font-medium text-sm truncate text-center">{station.name}</h3>
                          <p className="text-xs text-zinc-400 truncate text-center">{station.country || 'Live'}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Category Filter Pills */}
                {!activeCategory && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium whitespace-nowrap">
                      {language === 'sw' ? 'Zote' : 'All'}
                    </button>
                    {categories.slice(0, 8).map(cat => (
                      <button
                        key={cat.category_id}
                        onClick={() => handleCategorySelect(cat)}
                        className="px-4 py-2 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 text-sm font-medium whitespace-nowrap"
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Filtered Category View */}
                {activeCategory && (
                  <section>
                    <div className="flex items-center gap-3 mb-4">
                      <button onClick={() => setActiveCategory(null)} className="text-zinc-400 hover:text-white">
                        <ChevronLeft size={24} />
                      </button>
                      <h2 className="text-xl font-bold">{activeCategory.name}</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {categoryAlbums.map(album => (
                        <AlbumCard key={album.album_id} album={album} onOpen={openAlbum} availableTags={availableTags} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Dynamic Sections */}
                {!activeCategory && homeData.sections?.map((section, idx) => {
                  // Skip hero (handled above) but show quick_access if it has album items
                  if (section.section_type === 'hero') return null;
                  
                  const items = section.items || [];
                  if (items.length === 0) return null;
                  
                  // Determine content type from items
                  const isTeachingsSection = section.content_type === 'teachings' || 
                    section.section_type === 'teachings' ||
                    (items[0] && items[0].teaching_id);
                  const isChurchSection = section.content_type === 'churches' || 
                    section.section_type === 'churches' ||
                    (items[0] && items[0].church_id);
                  const isChoirSection = section.content_type === 'choirs' || 
                    section.section_type === 'choirs' ||
                    (items[0] && items[0].choir_id);
                  const isSpecialMixSection = section.content_type === 'special_mixes' || 
                    section.section_type === 'special_mixes' ||
                    (items[0] && items[0].mix_id);
                  const isAlbumSection = section.content_type === 'albums' || 
                    (items[0] && (items[0].album_id || items[0].title) && !isChurchSection && !isChoirSection && !isSpecialMixSection && !isTeachingsSection);

                  // Alternate layouts for variety
                  const layoutType = idx % 4;

                  return (
                    <section key={section.section_id || idx}>
                      <SectionHeader 
                        title={section.title} 
                        subtitle={section.description}
                        onSeeMore={items.length > 5 ? () => {
                          window.location.href = `/app/see-all/${section.section_id}?title=${encodeURIComponent(section.title || section.name || '')}`;
                        } : null}
                      />

                      {/* Special Mixes Section */}
                      {isSpecialMixSection && (
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                          {items.slice(0, 10).map(mix => (
                            <div
                              key={mix.mix_id}
                              className="flex-shrink-0 w-40 cursor-pointer group"
                              onClick={() => openSpecialMix && openSpecialMix(mix)}
                            >
                              <div className="relative aspect-square rounded-xl overflow-hidden mb-2 bg-gradient-to-br from-purple-600 to-pink-500">
                                {mix.thumbnail ? (
                                  <img 
                                    src={mix.thumbnail} 
                                    alt={mix.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Music2 className="w-12 h-12 text-white/60" />
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                                <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                </div>
                              </div>
                              <h3 className="font-medium text-sm truncate">{mix.title}</h3>
                              <p className="text-xs text-zinc-400">{mix.song_count || mix.songs?.length || 0} nyimbo</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Teachings / Mafundisho Section */}
                      {(section.content_type === 'teachings' || section.section_type === 'teachings') && (
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                          {items.slice(0, 10).map(teaching => {
                            // Fix thumbnail URL - append /stream for file endpoints
                            const thumbnailUrl = teaching.thumbnail 
                              ? (teaching.thumbnail.startsWith('http') 
                                ? teaching.thumbnail 
                                : `${process.env.REACT_APP_BACKEND_URL}${teaching.thumbnail}${teaching.thumbnail.includes('/stream') ? '' : '/stream'}`)
                              : null;
                            
                            return (
                              <div
                                key={teaching.teaching_id}
                                data-testid={`teaching-card-${teaching.teaching_id}`}
                                className="flex-shrink-0 w-72 md:w-80 bg-zinc-900/80 rounded-xl overflow-hidden cursor-pointer group hover:bg-zinc-800/80 transition-colors"
                                onClick={() => openTeachingDetail(teaching)}
                              >
                                <div className="flex">
                                  {/* Thumbnail with title overlay */}
                                  <div className="relative w-28 h-28 md:w-32 md:h-32 flex-shrink-0">
                                    {thumbnailUrl ? (
                                      <img 
                                        src={thumbnailUrl}
                                        alt={teaching.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.target.style.display = 'none';
                                          e.target.nextSibling.style.display = 'flex';
                                        }}
                                      />
                                    ) : null}
                                    <div className={`w-full h-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center ${thumbnailUrl ? 'hidden' : ''}`}>
                                      <BookOpen className="w-10 h-10 text-white/60" />
                                    </div>
                                    {/* Title overlay at bottom of image */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                                      <p className="text-white text-xs font-medium truncate">{teaching.name}</p>
                                    </div>
                                  </div>
                                  
                                  {/* Content side */}
                                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                    <div>
                                      <p className="text-zinc-400 text-xs mb-1">Mafundisho</p>
                                      <h3 className="font-semibold text-white text-sm md:text-base truncate">{teaching.name}</h3>
                                      <p className="text-zinc-400 text-xs mt-1 line-clamp-2">
                                        Na {teaching.leader_name || 'Kiongozi'}
                                      </p>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-2">
                                      <div className="flex items-center gap-2 text-zinc-500">
                                        <span className="text-xs">{teaching.topic_count || 0} mada</span>
                                        <span className="text-xs">•</span>
                                        <span className="text-xs">{teaching.lesson_count || 0} sehemu</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button 
                                          className="w-8 h-8 rounded-full border border-zinc-600 flex items-center justify-center hover:border-white transition-colors"
                                          onClick={(e) => { e.stopPropagation(); }}
                                        >
                                          <Plus className="w-4 h-4 text-zinc-400" />
                                        </button>
                                        <button 
                                          className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform"
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            openTeachingDetail(teaching);
                                          }}
                                        >
                                          <Play className="w-4 h-4 text-black fill-black ml-0.5" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Churches Section */}
                      {isChurchSection && (
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                          {items.slice(0, 10).map(church => (
                            <ChurchCard 
                              key={church.church_id} 
                              church={church} 
                              onClick={() => openChurchDetail(church)}
                            />
                          ))}
                        </div>
                      )}

                      {/* Choirs/Artists Section */}
                      {isChoirSection && (
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                          {items.slice(0, 10).map(choir => (
                            <ChoirCard 
                              key={choir.choir_id} 
                              choir={choir} 
                              onClick={() => {
                                // Navigate to choir detail if available
                                console.log('Choir clicked:', choir.choir_id);
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Quick Access Grid (for categories only) */}
                      {section.section_type === 'quick_access' && !isAlbumSection && !isChurchSection && !isChoirSection && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {items.slice(0, 6).map(item => (
                            <QuickAccessCard 
                              key={item.category_id || item.name} 
                              item={item} 
                              onClick={() => handleCategorySelect(item)}
                            />
                          ))}
                        </div>
                      )}

                      {/* Album Sections */}
                      {isAlbumSection && (
                        <>
                          {/* Layout 0: Wide Cards (Carousel) */}
                          {layoutType === 0 && section.section_type === 'featured_albums' && (
                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                              {items.slice(0, 5).map(album => (
                                <WideAlbumCard key={album.album_id} album={album} onOpen={openAlbum} availableTags={availableTags} />
                              ))}
                            </div>
                          )}

                          {/* Layout 1: Standard Cards (default) */}
                          {(layoutType === 1 || (layoutType === 0 && section.section_type !== 'featured_albums') || section.section_type === 'seasonal' || section.section_type === 'quick_access') && (
                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                              {items.slice(0, 10).map(album => (
                                <AlbumCard key={album.album_id} album={album} onOpen={openAlbum} availableTags={availableTags} />
                              ))}
                            </div>
                          )}

                          {/* Layout 2: Compact List */}
                          {layoutType === 2 && section.section_type !== 'seasonal' && section.section_type !== 'quick_access' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                              {items.slice(0, 6).map((album, i) => (
                                <ListItem 
                                  key={album.album_id} 
                                  item={{...album, thumbnail: album.thumbnail}}
                                  index={i}
                                  onPlay={() => openAlbum(album.album_id)}
                                  isActive={false}
                                  isPlaying={false}
                                />
                              ))}
                            </div>
                          )}

                          {/* Layout 3: Grid */}
                          {layoutType === 3 && section.section_type !== 'seasonal' && section.section_type !== 'quick_access' && (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                              {items.slice(0, 10).map(album => (
                                <AlbumCard key={album.album_id} album={album} onOpen={openAlbum} size="sm" availableTags={availableTags} />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  );
                })}

                {/* Additional Burners */}
                {homeData.burners?.length > 1 && (
                  <section className="grid md:grid-cols-2 gap-4">
                    {homeData.burners.slice(1, 3).map((burner, idx) => (
                      <div 
                        key={burner.burner_id || idx}
                        className="relative rounded-xl p-5 overflow-hidden h-36"
                        style={{ background: burner.background_gradient || burner.background_color || 'linear-gradient(135deg, #1e1b4b, #312e81)' }}
                      >
                        <h3 className="text-lg font-bold mb-1">{burner.headline}</h3>
                        <p className="text-sm text-zinc-300 mb-3">{burner.subtitle}</p>
                        <button className="px-4 py-1.5 bg-white text-black rounded-full text-xs font-bold">
                          {burner.cta_text || 'Explore'}
                        </button>
                      </div>
                    ))}
                  </section>
                )}
              </div>
            </div>
          )}

          {/* SEARCH VIEW */}
          {view === 'search' && (
            <div>
              <div className="max-w-xl mb-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="What do you want to listen to?"
                    className="pl-12 py-5 text-base bg-zinc-800 border-0 rounded-full"
                    data-testid="search-input"
                  />
                </div>
              </div>

              {searchResults ? (
                <div className="space-y-6">
                  {searchResults.songs?.length > 0 && (
                    <section>
                      <SectionHeader title="Songs" onSeeMore={searchResults.songs.length > 5 ? () => {} : null} />
                      <div className="space-y-1">
                        {searchResults.songs.slice(0, 5).map((song, idx) => (
                          <ListItem 
                            key={song.song_id}
                            item={{...song, album: { thumbnail: song.album_thumbnail, artist_name: song.artist_name }}}
                            index={idx}
                            onPlay={() => handlePlaySong(song, { thumbnail: song.album_thumbnail, artist_name: song.artist_name }, searchResults.songs, idx)}
                            isActive={player.currentSong?.song_id === song.song_id}
                            isPlaying={player.isPlaying}
                            onLike={handleLikeSong}
                            onAddToPlaylist={handleAddToPlaylist}
                            onDownload={handleDownloadSong}
                            isLiked={isFavorite(song.song_id)}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {searchResults.albums?.length > 0 && (
                    <section>
                      <SectionHeader title={t('library.albums', 'Albums')} />
                      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                        {searchResults.albums.map(album => (
                          <AlbumCard key={album.album_id} album={album} onOpen={openAlbum} availableTags={availableTags} />
                        ))}
                      </div>
                    </section>
                  )}

                  {searchResults.artists?.length > 0 && (
                    <section>
                      <SectionHeader title={t('library.artists', 'Artists')} />
                      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                        {searchResults.artists.map(artist => (
                          <ArtistCard key={artist.singer_id} artist={artist} />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Search size={48} className="mx-auto mb-4 text-zinc-600" />
                  <p className="text-zinc-500">{t('search.placeholder', 'Search for songs, albums, or artists')}</p>
                </div>
              )}
            </div>
          )}

          {/* ALBUM VIEW */}
          {view === 'album' && selectedAlbum && (
            <div>
              <button onClick={() => setView('home')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6">
                <ChevronLeft size={20} /> {t('common.back', 'Back')}
              </button>

              <div className="flex flex-col md:flex-row gap-6 mb-8">
                <div className="w-48 h-48 md:w-52 md:h-52 flex-shrink-0 mx-auto md:mx-0">
                  {getThumbnail(selectedAlbum) ? (
                    <img src={getThumbnail(selectedAlbum)} alt={selectedAlbum.title} className="w-full h-full object-cover rounded-lg shadow-2xl" />
                  ) : (
                    <div className="w-full h-full rounded-lg bg-gradient-to-br from-violet-800 to-emerald-700 flex items-center justify-center shadow-2xl">
                      <Music2 size={64} className="text-white/40" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <p className="text-xs text-zinc-400 uppercase tracking-wider">Album</p>
                  <h1 className="text-3xl md:text-5xl font-bold mt-1 mb-3">{selectedAlbum.title}</h1>
                  <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-zinc-400">
                    <span className="font-semibold text-white">{selectedAlbum.artist_name}</span>
                    <span>•</span>
                    <span>{selectedAlbumSongs.length} songs</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <button 
                  onClick={handlePlayAlbum}
                  className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-xl"
                  data-testid="play-album-btn"
                >
                  <Play size={26} fill="black" className="text-black ml-1" />
                </button>
                <button onClick={() => toggleFavorite('album', selectedAlbum.album_id)} className={isFavorite(selectedAlbum.album_id) ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'}>
                  <Heart size={28} fill={isFavorite(selectedAlbum.album_id) ? 'currentColor' : 'none'} />
                </button>
                <button className="text-zinc-400 hover:text-white">
                  <MoreHorizontal size={28} />
                </button>
              </div>

              <div className="space-y-1">
                {selectedAlbumSongs.map((song, index) => (
                  <ListItem 
                    key={song.song_id}
                    item={{...song, album: selectedAlbum}}
                    index={index}
                    onPlay={() => handlePlaySong(song, selectedAlbum, selectedAlbumSongs, index)}
                    isActive={player.currentSong?.song_id === song.song_id}
                    isPlaying={player.isPlaying}
                    onLike={handleLikeSong}
                    onAddToPlaylist={handleAddToPlaylist}
                    onDownload={handleDownloadSong}
                    isLiked={isFavorite(song.song_id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* LIBRARY VIEW */}
          {view === 'library' && library && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">{t('library.yourLibrary', 'Your Library')}</h1>
              </div>

              {/* Library Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                <button
                  onClick={() => setLibraryTab('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    libraryTab === 'all' ? 'bg-white text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'
                  }`}
                >
                  {t('home.all', 'All')}
                </button>
                <button
                  onClick={() => setLibraryTab('liked')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                    libraryTab === 'liked' ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white' : 'bg-zinc-800 text-white hover:bg-zinc-700'
                  }`}
                >
                  <Heart size={16} fill={libraryTab === 'liked' ? 'currentColor' : 'none'} /> {t('library.likedSongs', 'Liked Songs')}
                </button>
                <button
                  onClick={() => setLibraryTab('playlists')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                    libraryTab === 'playlists' ? 'bg-white text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'
                  }`}
                >
                  <ListMusic size={16} /> {t('library.playlists', 'Playlists')}
                </button>
                <button
                  onClick={() => setLibraryTab('downloads')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
                    libraryTab === 'downloads' ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-white hover:bg-zinc-700'
                  }`}
                >
                  <Download size={16} /> {t('library.downloads', 'Downloads')}
                </button>
              </div>

              {/* Liked Songs Section */}
              {(libraryTab === 'all' || libraryTab === 'liked') && library.favorites?.filter(f => f.type === 'song' && f.item).length > 0 && (
                <section className="bg-gradient-to-br from-violet-900/30 to-fuchsia-900/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                        <Heart size={24} className="text-white" fill="currentColor" />
                      </div>
                      <div>
                        <h2 className="font-bold text-lg">{t('library.likedSongs', 'Liked Songs')}</h2>
                        <p className="text-sm text-zinc-400">{library.favorites?.filter(f => f.type === 'song' && f.item).length || 0} {t('library.songs', 'songs')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const likedSongs = library.favorites?.filter(f => f.type === 'song' && f.item) || [];
                        if (likedSongs.length > 0) {
                          const songs = likedSongs.map(f => f.item);
                          handlePlaySong(songs[0], likedSongs[0].album, songs, 0);
                        }
                      }}
                      className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-400 hover:scale-105 transition-all flex items-center justify-center shadow-lg"
                      data-testid="play-all-liked"
                    >
                      <Play size={24} className="text-black ml-1" fill="currentColor" />
                    </button>
                  </div>
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {library.favorites.filter(f => f.type === 'song' && f.item).slice(0, libraryTab === 'liked' ? 50 : 5).map((fav, i) => (
                      <ListItem 
                        key={fav.item.song_id || `fav-${i}`}
                        item={{...fav.item, album: fav.album}}
                        index={i}
                        onPlay={() => {
                          const songs = library.favorites.filter(f => f.type === 'song' && f.item).map(f => f.item);
                          handlePlaySong(fav.item, fav.album, songs, i);
                        }}
                        isActive={player.currentSong?.song_id === fav.item?.song_id}
                        isPlaying={player.isPlaying}
                        onLike={handleLikeSong}
                        onAddToPlaylist={handleAddToPlaylist}
                        onDownload={handleDownloadSong}
                        isLiked={true}
                      />
                    ))}
                  </div>
                  {libraryTab === 'all' && library.favorites.filter(f => f.type === 'song' && f.item).length > 5 && (
                    <button 
                      onClick={() => setLibraryTab('liked')}
                      className="mt-3 text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                      View all {library.favorites?.filter(f => f.type === 'song' && f.item).length || 0} songs →
                    </button>
                  )}
                </section>
              )}

              {/* Playlists Section */}
              {(libraryTab === 'all' || libraryTab === 'playlists') && library.playlists?.length > 0 && (
                <section>
                  <SectionHeader title="Your Playlists" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {library.playlists.map(playlist => (
                      <button 
                        key={playlist.playlist_id} 
                        className="p-3 bg-zinc-900/40 hover:bg-zinc-800/60 rounded-lg text-left transition-all group"
                        onClick={async () => {
                          // Fetch playlist songs and play
                          try {
                            const res = await axios.get(`${API}/user/playlist/${playlist.playlist_id}`, {
                              headers: { Authorization: `Bearer ${token}` }
                            });
                            if (res.data.songs?.length > 0) {
                              const songs = res.data.songs.map(s => s.song);
                              handlePlaySong(songs[0], res.data.songs[0].album, songs, 0);
                            } else {
                              toast.info('This playlist is empty');
                            }
                          } catch (e) {
                            toast.error('Could not load playlist');
                          }
                        }}
                      >
                        <div className="aspect-square rounded bg-gradient-to-br from-violet-600 to-emerald-600 mb-3 flex items-center justify-center relative overflow-hidden">
                          <ListMusic size={40} className="text-white/70" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play size={32} className="text-white" fill="currentColor" />
                          </div>
                        </div>
                        <h3 className="font-semibold text-sm truncate">{playlist.name}</h3>
                        <p className="text-xs text-zinc-500">{playlist.songs?.length || 0} songs</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Downloads Section (placeholder - actual downloads are device-specific) */}
              {(libraryTab === 'all' || libraryTab === 'downloads') && (
                <section className="bg-gradient-to-br from-emerald-900/20 to-teal-900/10 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                      <Download size={24} className="text-white" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg">Downloads</h2>
                      <p className="text-sm text-zinc-400">Available offline</p>
                    </div>
                  </div>
                  <div className="text-center py-8 text-zinc-500">
                    <Download size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Downloads are available in the mobile app</p>
                    <p className="text-xs mt-2">Download songs for offline listening on your device</p>
                  </div>
                </section>
              )}

              {/* Recently Played */}
              {libraryTab === 'all' && library.recently_played?.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <SectionHeader title="Recently Played" />
                    {library.recently_played.length > 0 && (
                      <button
                        onClick={() => {
                          const songs = library.recently_played.map(r => r.song);
                          handlePlaySong(songs[0], library.recently_played[0].album, songs, 0);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors"
                        data-testid="play-all-recent"
                      >
                        <Play size={14} fill="currentColor" /> Play All
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {library.recently_played.slice(0, 10).map(({ song, album }, i) => (
                      <ListItem 
                        key={song.song_id}
                        item={{...song, album}}
                        index={i}
                        onPlay={() => handlePlaySong(song, album, library.recently_played.map(r => r.song), i)}
                        isActive={player.currentSong?.song_id === song.song_id}
                        isPlaying={player.isPlaying}
                        onLike={handleLikeSong}
                        onAddToPlaylist={handleAddToPlaylist}
                        onDownload={handleDownloadSong}
                        isLiked={isFavorite(song.song_id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty State */}
              {libraryTab !== 'all' && (
                (libraryTab === 'liked' && library.favorites?.filter(f => f.type === 'song' && f.item).length === 0) ||
                (libraryTab === 'playlists' && library.playlists?.length === 0)
              ) && (
                <div className="text-center py-16">
                  {libraryTab === 'liked' && (
                    <>
                      <Heart size={64} className="mx-auto mb-4 text-zinc-700" />
                      <h3 className="text-xl font-semibold mb-2">{t('empty.noLikedSongs', 'No Liked Songs Yet')}</h3>
                      <p className="text-zinc-500">{t('empty.tapHeartToAdd', 'Tap the heart icon on any song to add it to your liked songs')}</p>
                    </>
                  )}
                  {libraryTab === 'playlists' && (
                    <>
                      <ListMusic size={64} className="mx-auto mb-4 text-zinc-700" />
                      <h3 className="text-xl font-semibold mb-2">{t('empty.noPlaylists', 'No Playlists Yet')}</h3>
                      <p className="text-zinc-500">{t('empty.createPlaylistsToOrganize', 'Create a playlist to organize your favorite music')}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BIBLE VIEW */}
          {view === 'bible' && (
            <BibleView 
              language={language} 
              t={t}
              onBack={() => setView('home')}
            />
          )}

          {/* RADIO VIEW */}
          {view === 'radio' && (
            <RadioView 
              t={t}
              onBack={() => setView('home')}
            />
          )}

          {/* TEACHING DETAIL VIEW */}
          {view === 'teaching' && selectedTeaching && (
            <div className="pb-32">
              {/* Header with back button */}
              <div className="flex items-center gap-4 mb-6">
                <button 
                  onClick={() => { setView('home'); setSelectedTeaching(null); }}
                  className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
                <h1 className="text-xl font-bold">{selectedTeaching.name || selectedTeaching.title_sw}</h1>
              </div>

              {/* Teaching info card */}
              <div className="bg-gradient-to-b from-amber-900/30 to-zinc-900 rounded-xl p-6 mb-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Thumbnail */}
                  <div className="w-48 h-48 md:w-56 md:h-56 flex-shrink-0 rounded-xl overflow-hidden shadow-2xl mx-auto md:mx-0">
                    {selectedTeaching.thumbnail ? (
                      <img 
                        src={getImageUrl(selectedTeaching.thumbnail)}
                        alt={selectedTeaching.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center">
                        <BookOpen className="w-20 h-20 text-white/60" />
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 flex flex-col justify-end text-center md:text-left">
                    <p className="text-amber-400 text-sm font-medium mb-2">MAFUNDISHO</p>
                    <h2 className="text-2xl md:text-4xl font-bold mb-3">{selectedTeaching.name || selectedTeaching.title_sw}</h2>
                    <p className="text-zinc-300 mb-2">Na {selectedTeaching.leader_name || 'Kiongozi'}</p>
                    <div className="flex items-center justify-center md:justify-start gap-4 text-zinc-400 text-sm">
                      <span>{selectedTeaching.topic_count || teachingTopics.length} mada</span>
                      <span>•</span>
                      <span>{selectedTeaching.lesson_count || 0} sehemu</span>
                    </div>
                    {selectedTeaching.description && (
                      <p className="text-zinc-400 mt-4 text-sm">{selectedTeaching.description}</p>
                    )}
                    
                    {/* Action buttons */}
                    <div className="flex items-center justify-center md:justify-start gap-3 mt-6">
                      {/* Play All button */}
                      <button 
                        onClick={() => playAllTeachingLessons(selectedTeaching, teachingTopics)}
                        className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-full transition-colors"
                        data-testid="teaching-play-all-btn"
                      >
                        <Play size={20} className="fill-black" />
                        Cheza Zote
                      </button>
                      
                      {/* Shuffle button */}
                      <button 
                        onClick={() => shuffleTeachingLessons(selectedTeaching, teachingTopics)}
                        className="w-12 h-12 rounded-full border border-zinc-600 flex items-center justify-center hover:border-white transition-colors"
                        title="Shuffle"
                        data-testid="teaching-shuffle-btn"
                      >
                        <Shuffle size={20} className="text-zinc-400" />
                      </button>
                      
                      {/* Add to playlist */}
                      <button 
                        onClick={() => {
                          toast.success("Imeongezwa kwenye orodha");
                        }}
                        className="w-12 h-12 rounded-full border border-zinc-600 flex items-center justify-center hover:border-white transition-colors"
                        title="Ongeza kwenye playlist"
                        data-testid="teaching-add-playlist-btn"
                      >
                        <Plus size={20} className="text-zinc-400" />
                      </button>
                      
                      {/* Share button */}
                      <button 
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: selectedTeaching.name || selectedTeaching.title_sw,
                              text: `Sikiliza mafundisho: ${selectedTeaching.name} na ${selectedTeaching.leader_name}`,
                              url: window.location.href
                            });
                          } else {
                            navigator.clipboard.writeText(window.location.href);
                            toast.success("Link imenakiliwa!");
                          }
                        }}
                        className="w-12 h-12 rounded-full border border-zinc-600 flex items-center justify-center hover:border-white transition-colors"
                        title="Shiriki"
                        data-testid="teaching-share-btn"
                      >
                        <Share2 size={20} className="text-zinc-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Topics and Lessons */}
              {teachingLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                </div>
              ) : (
                <div className="space-y-6">
                  {teachingTopics.map((topic, topicIndex) => (
                    <div key={topic.topic_id} className="bg-zinc-900/50 rounded-xl overflow-hidden">
                      {/* Topic header */}
                      <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700">
                        <h3 className="font-semibold text-amber-400">
                          Mada {topicIndex + 1}: {topic.title_sw || topic.title}
                        </h3>
                        {topic.description && (
                          <p className="text-zinc-400 text-sm mt-1">{topic.description}</p>
                        )}
                      </div>
                      
                      {/* Lessons */}
                      <div className="divide-y divide-zinc-800">
                        {(topic.lessons || []).map((lesson, lessonIndex) => {
                          const isCurrentlyPlaying = player.currentSong?.song_id === lesson.lesson_id && player.isPlaying;
                          const isCurrentLesson = player.currentSong?.song_id === lesson.lesson_id;
                          
                          return (
                          <div
                            key={lesson.lesson_id}
                            className={`flex items-center gap-4 px-4 py-3 transition-colors cursor-pointer group ${
                              isCurrentLesson 
                                ? 'bg-amber-500/10 border-l-2 border-amber-500' 
                                : 'hover:bg-zinc-800/50'
                            }`}
                            onClick={() => playTeachingLesson(lesson, selectedTeaching)}
                          >
                            {/* Number/Play icon or Dancing bars */}
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                              isCurrentLesson 
                                ? 'bg-amber-600 text-white' 
                                : 'bg-zinc-800 text-zinc-400 group-hover:bg-amber-600 group-hover:text-white'
                            }`}>
                              {isCurrentlyPlaying ? (
                                /* Dancing bars animation */
                                <div className="flex items-end gap-0.5 h-4">
                                  <span className="w-1 bg-white animate-pulse" style={{ height: '60%', animationDelay: '0ms', animationDuration: '400ms' }}></span>
                                  <span className="w-1 bg-white animate-pulse" style={{ height: '100%', animationDelay: '150ms', animationDuration: '400ms' }}></span>
                                  <span className="w-1 bg-white animate-pulse" style={{ height: '40%', animationDelay: '300ms', animationDuration: '400ms' }}></span>
                                </div>
                              ) : isCurrentLesson ? (
                                <Pause size={14} />
                              ) : lesson.audio_url ? (
                                <Play size={14} className="ml-0.5" />
                              ) : (
                                <span className="text-sm">{lessonIndex + 1}</span>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium truncate ${isCurrentLesson ? 'text-amber-400' : 'text-white'}`}>
                                {lesson.title_sw || lesson.title || `Sehemu ya ${lessonIndex + 1}`}
                              </p>
                              {lesson.description && (
                                <p className="text-zinc-400 text-sm truncate">{lesson.description}</p>
                              )}
                            </div>
                            
                            {/* Playing indicator text */}
                            {isCurrentlyPlaying && (
                              <span className="text-amber-400 text-xs font-medium">Inacheza</span>
                            )}
                            
                            {lesson.duration && !isCurrentlyPlaying && (
                              <span className="text-zinc-500 text-sm">{formatTime(lesson.duration)}</span>
                            )}
                            {!lesson.audio_url && (
                              <span className="text-zinc-600 text-xs">Hakuna sauti</span>
                            )}
                          </div>
                        )})}
                        {(!topic.lessons || topic.lessons.length === 0) && (
                          <p className="text-zinc-500 text-sm px-4 py-3">Hakuna sehemu bado</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {teachingTopics.length === 0 && (
                    <div className="text-center py-12">
                      <BookOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                      <p className="text-zinc-400">Hakuna mada bado kwa mafundisho haya</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-zinc-800 z-50" style={{ bottom: player.currentSong ? '72px' : '0' }}>
        <div className="flex justify-around py-2">
          <button onClick={() => { setView('home'); setActiveCategory(null); }} className={`flex flex-col items-center gap-0.5 py-1 px-3 ${view === 'home' ? 'text-white' : 'text-zinc-500'}`}>
            <Home size={20} />
            <span className="text-[10px]">{t('nav.home', 'Home')}</span>
          </button>
          <button onClick={() => setView('search')} className={`flex flex-col items-center gap-0.5 py-1 px-3 ${view === 'search' ? 'text-white' : 'text-zinc-500'}`}>
            <Search size={20} />
            <span className="text-[10px]">{t('nav.search', 'Search')}</span>
          </button>
          <button onClick={() => setView('radio')} className={`flex flex-col items-center gap-0.5 py-1 px-3 ${view === 'radio' ? 'text-violet-500' : 'text-zinc-500'}`} data-testid="mobile-radio-nav">
            <Radio size={20} />
            <span className="text-[10px]">{t('nav.radio', 'Redio')}</span>
          </button>
          <button onClick={fetchLibrary} className={`flex flex-col items-center gap-0.5 py-1 px-3 ${view === 'library' ? 'text-white' : 'text-zinc-500'}`}>
            <Library size={20} />
            <span className="text-[10px]">{t('nav.library', 'Library')}</span>
          </button>
        </div>
      </nav>

      {/* Language Selection Modal */}
      {showLanguageModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{t('settings.changeLanguage', 'Change Language')}</h3>
              <button onClick={() => setShowLanguageModal(false)} className="text-zinc-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-2">
              {availableLanguages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => {
                    changeLanguage(lang.code);
                    setShowLanguageModal(false);
                    toast.success(lang.code === 'sw' ? 'Lugha imebadilishwa' : 'Language changed');
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition ${
                    language === lang.code 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <span className="font-medium">{lang.nativeName}</span>
                  {language === lang.code && <span className="text-sm">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mini Player */}
      <MiniPlayer 
        player={player} 
        onExpand={() => player.setShowFullPlayer(true)}
        onFavorite={() => player.currentSong && toggleFavorite('song', player.currentSong.song_id)}
        isFavorite={player.currentSong && isFavorite(player.currentSong.song_id)}
      />

      {/* Full Screen Player */}
      {player.showFullPlayer && (
        <FullPlayer 
          player={player}
          onClose={() => player.setShowFullPlayer(false)}
          onFavorite={() => player.currentSong && toggleFavorite('song', player.currentSong.song_id)}
          isFavorite={player.currentSong && isFavorite(player.currentSong.song_id)}
        />
      )}

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal 
          showAuth={showAuth}
          setShowAuth={setShowAuth}
          authMode={authMode}
          setAuthMode={setAuthMode}
          authForm={authForm}
          setAuthForm={setAuthForm}
          handleLogin={handleLogin}
          handleRegister={handleRegister}
          setToken={setToken}
          setUser={setUser}
        />
      )}

      {/* Playlist Modal */}
      {showPlaylistModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowPlaylistModal(false)}>
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Add to Playlist</h3>
            
            {userPlaylists.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userPlaylists.map(playlist => (
                  <button
                    key={playlist.playlist_id}
                    onClick={() => addSongToPlaylist(playlist.playlist_id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800 transition-colors text-left"
                  >
                    <div className="w-12 h-12 rounded bg-gradient-to-br from-violet-600 to-emerald-600 flex items-center justify-center">
                      <ListMusic size={20} className="text-white/70" />
                    </div>
                    <div>
                      <p className="font-medium">{playlist.name}</p>
                      <p className="text-xs text-zinc-500">{playlist.songs?.length || 0} songs</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-4">No playlists yet</p>
            )}
            
            <button
              onClick={() => {
                const name = prompt("Enter playlist name:");
                if (name) createNewPlaylist(name);
              }}
              className="w-full mt-4 flex items-center justify-center gap-2 p-3 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <Plus size={20} />
              <span>Create New Playlist</span>
            </button>
            
            <button
              onClick={() => setShowPlaylistModal(false)}
              className="w-full mt-2 p-3 text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Church Detail Modal */}
      {selectedChurch && (
        <ChurchDetailModal 
          church={selectedChurch} 
          onClose={() => setSelectedChurch(null)}
          choirs={churchChoirs}
        />
      )}
      
      {/* Download App Popup */}
      <DownloadAppPopup 
        show={showDownloadPopup} 
        onClose={() => setShowDownloadPopup(false)} 
        language={language}
      />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
