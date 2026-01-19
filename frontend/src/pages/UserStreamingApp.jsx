import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1,
  Heart, MoreHorizontal, ChevronLeft, ChevronRight, Home, Search, Library,
  Plus, Minus, Clock, Music2, Mic2, ListMusic, X, Share2, Download, Maximize2,
  BookOpen, Cross, Church, Star, Sun, Flame, List, Radio, Settings, Disc, Phone, Mail, Loader2,
  Globe
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

    let audioUrl = song.audio_url;
    if (audioUrl) {
      if (audioUrl.startsWith('/api/files/')) {
        audioUrl = `${BACKEND_URL}${audioUrl}`;
      }
    } else {
      audioUrl = SAMPLE_AUDIO_URL;
    }
    
    audioRef.current.src = audioUrl;
    
    try {
      await audioRef.current.play();
      const res = await axios.post(`${API}/listening/start`, { 
        song_id: song.song_id,
        user_id: localStorage.getItem('user_id') || 'anonymous'
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
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Unknown Track',
        artist: album?.artist_name || 'Gracefy',
        album: album?.title || 'Gracefy',
        artwork: album?.thumbnail ? [
          { src: album.thumbnail, sizes: '512x512', type: 'image/jpeg' }
        ] : []
      });
    }
  }, []);

  const playSong = useCallback(async (song, album, songQueue = [], index = 0) => {
    // End previous session
    if (sessionIdRef.current) {
      try {
        await axios.post(`${API}/listening/end`, { session_id: sessionIdRef.current });
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

    // Handle different audio URL formats
    let audioUrl = song.audio_url;
    if (audioUrl) {
      // If it's a relative streaming URL, prepend the backend URL
      if (audioUrl.startsWith('/api/files/')) {
        audioUrl = `${BACKEND_URL}${audioUrl}`;
      }
    } else {
      // Fallback to sample audio
      audioUrl = SAMPLE_AUDIO_URL;
    }
    
    audioRef.current.src = audioUrl;
    
    try {
      await audioRef.current.play();
      const res = await axios.post(`${API}/listening/start`, { 
        song_id: song.song_id,
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
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 bg-zinc-800/70 hover:bg-zinc-700/90 rounded overflow-hidden transition-all duration-200 h-14"
      data-testid={`quick-${item.id || item.category_id || item.album_id || item.type}`}
    >
      <div className={`w-14 h-14 bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}>
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <IconComponent size={22} className="text-white" fill={item.type === 'liked_songs' ? 'currentColor' : 'none'} />
        )}
      </div>
      <span className="font-semibold text-sm text-white pr-3 truncate">{item.name || item.title}</span>
    </button>
  );
};

// Album Card - Standard
const AlbumCard = ({ album, onPlay, onOpen, size = 'md' }) => {
  const sizeClasses = { sm: 'w-36', md: 'w-44', lg: 'w-52' };
  return (
    <button
      onClick={() => onOpen(album.album_id)}
      className={`${sizeClasses[size]} flex-shrink-0 p-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-800/60 transition-all duration-300 group text-left`}
      data-testid={`album-${album.album_id}`}
    >
      <div className="aspect-square rounded-md bg-zinc-800 mb-3 overflow-hidden relative shadow-lg">
        {album.thumbnail ? (
          <img src={album.thumbnail} alt={album.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-800 to-emerald-700">
            <Music2 size={size === 'lg' ? 48 : 36} className="text-white/40" />
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
const WideAlbumCard = ({ album, onOpen }) => (
  <button
    onClick={() => onOpen(album.album_id)}
    className="flex-shrink-0 w-80 h-44 rounded-lg overflow-hidden relative group"
    data-testid={`wide-${album.album_id}`}
  >
    {album.thumbnail ? (
      <img src={album.thumbnail} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    ) : (
      <div className="w-full h-full bg-gradient-to-br from-violet-800 to-emerald-700 flex items-center justify-center">
        <Music2 size={56} className="text-white/30" />
      </div>
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 p-4">
      <h3 className="font-bold text-lg text-white truncate">{album.title}</h3>
      <p className="text-sm text-zinc-300 truncate">{album.artist_name}</p>
    </div>
    <div className="absolute bottom-4 right-4 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl">
      <Play size={22} fill="black" className="text-black ml-0.5" />
    </div>
  </button>
);

// Compact List Item
const ListItem = ({ item, index, onPlay, isActive, isPlaying, onLike, onAddToPlaylist, onDownload, isLiked }) => (
  <div className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-zinc-800/60 transition-colors group">
    <button
      onClick={onPlay}
      className="flex items-center gap-3 flex-1 min-w-0"
    >
      <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 relative">
        {item.thumbnail || item.album?.thumbnail ? (
          <img src={item.thumbnail || item.album?.thumbnail} alt="" className="w-full h-full object-cover" />
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

// Section Header
const SectionHeader = ({ title, subtitle, onSeeMore }) => (
  <div className="flex items-end justify-between mb-4">
    <div>
      <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
      {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
    </div>
    {onSeeMore && (
      <button onClick={onSeeMore} className="text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider">
        Show all
      </button>
    )}
  </div>
);

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

  // Fetch books and snippets on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [booksRes, snippetsRes] = await Promise.all([
          axios.get(`${API}/bible/books?language=${language}`),
          axios.get(`${API}/bible/snippets?language=${language}`)
        ]);
        setBooks(booksRes.data.books || []);
        setSnippets(snippetsRes.data.snippets || []);
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
        .then(res => setChapters(res.data.chapters || []))
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
    try {
      const res = await axios.post(`${API}/bible/tts/verse`, {
        book_name: selectedBook.name,
        chapter: selectedChapter,
        verse: verse.verse,
        language: language,
        voice: "nova"
      });
      
      if (audioElement) audioElement.pause();
      const audio = new Audio(`data:audio/mp3;base64,${res.data.audio_base64}`);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      setAudioElement(audio);
      setPlayingAudio(`verse_${verse.verse}`);
    } catch (e) {
      toast.error("Failed to generate audio");
    } finally {
      setGeneratingAudio(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={40} className="animate-spin text-amber-500" />
      </div>
    );
  }

  // Show snippets if no book selected
  if (!selectedBook) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <BookOpen className="text-amber-500" />
          {t('bible.title', 'Biblia na Vitabu vya Dini')}
        </h1>

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
          {player.currentAlbum?.thumbnail ? (
            <img src={player.currentAlbum.thumbnail} alt="" className="w-full h-full object-cover" />
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
            {player.currentAlbum?.thumbnail ? (
              <img src={player.currentAlbum.thumbnail} alt="" className="w-full h-full object-cover" />
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
              <h2 className="text-2xl font-bold mb-1">{authMode === 'login' ? 'Welcome back' : 'Create account'}</h2>
              <p className="text-sm text-zinc-400">Sign in to save your music</p>
            </div>

            {/* Login Method Tabs */}
            {!otpStep && (
              <div className="flex gap-2 mb-4">
                <button 
                  onClick={() => setLoginMethod('email')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    loginMethod === 'email' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Mail size={16} />
                  Email
                </button>
                <button 
                  onClick={() => setLoginMethod('phone')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    loginMethod === 'phone' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Phone size={16} />
                  Phone OTP
                </button>
              </div>
            )}

            <div className="space-y-3">
              {/* Phone OTP Login */}
              {loginMethod === 'phone' ? (
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
          ) : (
            /* Email/Password Login */
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
          )}

          {loginMethod === 'email' && !otpStep && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-700" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-zinc-900 px-2 text-zinc-500">or</span></div>
              </div>

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

            {loginMethod === 'email' && !otpStep && (
              <p className="text-center text-sm text-zinc-400 mt-4">
                {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-emerald-400 hover:underline">
                  {authMode === 'login' ? 'Sign up' : 'Sign in'}
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
  
  // Bible audio state
  const [bibleAudioPlaying, setBibleAudioPlaying] = useState(null);
  const [bibleAudioElement, setBibleAudioElement] = useState(null);

  const player = useAudioPlayer();
  const [authForm, setAuthForm] = useState({ email: '', phone: '', password: '', name: '' });
  
  // i18n - Translation hook
  const { t, language, changeLanguage, availableLanguages, getGreeting } = useLanguage();

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
        const [homeRes, catRes, sectionsRes] = await Promise.all([
          axios.get(`${API}/user/home`),
          axios.get(`${API}/user/browse/categories`),
          axios.get(`${API}/layout/sections?active_only=true`)
        ]);
        setHomeData(homeRes.data);
        setCategories(catRes.data.categories || []);
        
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
  }, []);

  // Check auth
  useEffect(() => {
    if (token) {
      axios.get(`${API}/user/me`, { headers: { Authorization: `Bearer ${token}` }})
        .then(res => {
          setUser(res.data);
          localStorage.setItem('user_id', res.data.user_id);
          setFavorites(res.data.favorites || []);
        })
        .catch(() => {
          localStorage.removeItem('user_token');
          setToken(null);
        });
    }
  }, [token]);

  // Handle Google OAuth callback
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('session_id=')) {
      const sessionId = hash.split('session_id=')[1]?.split('&')[0];
      if (sessionId) {
        // Clear the hash from URL
        window.history.replaceState(null, '', window.location.pathname);
        
        // Process the session
        axios.post(`${API}/user/auth/google-callback`, { session_id: sessionId })
          .then(res => {
            setToken(res.data.token);
            setUser(res.data.user);
            localStorage.setItem('user_token', res.data.token);
            localStorage.setItem('user_id', res.data.user.user_id);
            toast.success(`Welcome, ${res.data.user.name}!`);
          })
          .catch(e => {
            console.error("Google auth error:", e);
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
    
    // For web, we'll open the audio URL in a new tab or trigger download
    if (song.audio_url) {
      const link = document.createElement('a');
      link.href = song.audio_url;
      link.download = `${song.title}.mp3`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started!");
    } else {
      toast.error("This song is not available for download");
    }
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
              {/* Hero Section - Full Width */}
              {homeData.burners?.[0] && (
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
                        <AlbumCard key={album.album_id} album={album} onOpen={openAlbum} />
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
                  
                  // If quick_access has albums (not categories), show it as album section
                  const isAlbumSection = section.content_type === 'albums' || 
                    (items[0] && (items[0].album_id || items[0].title));

                  // Alternate layouts for variety
                  const layoutType = idx % 4;

                  return (
                    <section key={section.section_id || idx}>
                      <SectionHeader 
                        title={section.title} 
                        subtitle={section.description}
                        onSeeMore={items.length > 5 ? () => {} : null}
                      />

                      {/* Quick Access Grid (for categories only) */}
                      {section.section_type === 'quick_access' && !isAlbumSection && (
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
                                <WideAlbumCard key={album.album_id} album={album} onOpen={openAlbum} />
                              ))}
                            </div>
                          )}

                          {/* Layout 1: Standard Cards (default) */}
                          {(layoutType === 1 || (layoutType === 0 && section.section_type !== 'featured_albums') || section.section_type === 'seasonal' || section.section_type === 'quick_access') && (
                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                              {items.slice(0, 10).map(album => (
                                <AlbumCard key={album.album_id} album={album} onOpen={openAlbum} />
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
                                <AlbumCard key={album.album_id} album={album} onOpen={openAlbum} size="sm" />
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
                          <AlbumCard key={album.album_id} album={album} onOpen={openAlbum} />
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
                  {selectedAlbum.thumbnail ? (
                    <img src={selectedAlbum.thumbnail} alt={selectedAlbum.title} className="w-full h-full object-cover rounded-lg shadow-2xl" />
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
              {(libraryTab === 'all' || libraryTab === 'liked') && library.favorites?.filter(f => f.type === 'song').length > 0 && (
                <section className="bg-gradient-to-br from-violet-900/30 to-fuchsia-900/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                        <Heart size={24} className="text-white" fill="currentColor" />
                      </div>
                      <div>
                        <h2 className="font-bold text-lg">{t('library.likedSongs', 'Liked Songs')}</h2>
                        <p className="text-sm text-zinc-400">{library.favorites.filter(f => f.type === 'song').length} {t('library.songs', 'songs')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const likedSongs = library.favorites.filter(f => f.type === 'song');
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
                    {library.favorites.filter(f => f.type === 'song').slice(0, libraryTab === 'liked' ? 50 : 5).map((fav, i) => (
                      <ListItem 
                        key={fav.item.song_id}
                        item={{...fav.item, album: fav.album}}
                        index={i}
                        onPlay={() => {
                          const songs = library.favorites.filter(f => f.type === 'song').map(f => f.item);
                          handlePlaySong(fav.item, fav.album, songs, i);
                        }}
                        isActive={player.currentSong?.song_id === fav.item.song_id}
                        isPlaying={player.isPlaying}
                        onLike={handleLikeSong}
                        onAddToPlaylist={handleAddToPlaylist}
                        onDownload={handleDownloadSong}
                        isLiked={true}
                      />
                    ))}
                  </div>
                  {libraryTab === 'all' && library.favorites.filter(f => f.type === 'song').length > 5 && (
                    <button 
                      onClick={() => setLibraryTab('liked')}
                      className="mt-3 text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                      View all {library.favorites.filter(f => f.type === 'song').length} songs →
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
                (libraryTab === 'liked' && library.favorites?.filter(f => f.type === 'song').length === 0) ||
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
          <button onClick={() => setView('bible')} className={`flex flex-col items-center gap-0.5 py-1 px-3 ${view === 'bible' ? 'text-amber-500' : 'text-zinc-500'}`}>
            <BookOpen size={20} />
            <span className="text-[10px]">{t('nav.bible', 'Biblia')}</span>
          </button>
          <button onClick={fetchLibrary} className={`flex flex-col items-center gap-0.5 py-1 px-3 ${view === 'library' ? 'text-white' : 'text-zinc-500'}`}>
            <Library size={20} />
            <span className="text-[10px]">{t('nav.library', 'Library')}</span>
          </button>
          <button onClick={() => setShowLanguageModal(true)} className={`flex flex-col items-center gap-0.5 py-1 px-3 text-zinc-500`}>
            <Globe size={20} />
            <span className="text-[10px]">{language.toUpperCase()}</span>
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

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
