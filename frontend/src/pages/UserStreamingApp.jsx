import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1,
  Heart, MoreHorizontal, ChevronLeft, ChevronRight, Home, Search, Library,
  Plus, Clock, Music2, Mic2, ListMusic, X, ChevronDown, Share2, Download,
  Sparkles, BookOpen, Cross, Church, Star, Sun, Moon, Flame
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Audio Player Context
const useAudioPlayer = () => {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const audioRef = useRef(null);
  const sessionIdRef = useRef(null);

  const playSong = useCallback(async (song, album, songQueue = [], index = 0) => {
    setCurrentSong(song);
    setCurrentAlbum(album);
    setQueue(songQueue);
    setQueueIndex(index);
    setIsPlaying(true);

    try {
      const res = await axios.post(`${API}/listening/start`, { 
        song_id: song.song_id,
        user_id: localStorage.getItem('user_id') || 'anonymous'
      });
      sessionIdRef.current = res.data.session_id;
    } catch (e) {
      console.error("Failed to start session", e);
    }
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const nextSong = useCallback(async () => {
    if (sessionIdRef.current) {
      try {
        await axios.post(`${API}/listening/end`, { session_id: sessionIdRef.current });
      } catch (e) {
        // Silently ignore
      }
    }

    if (queue.length === 0) return;
    
    let nextIndex;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = (queueIndex + 1) % queue.length;
    }
    
    if (nextIndex === 0 && repeat === 'off' && !shuffle) {
      setIsPlaying(false);
      return;
    }
    
    const nextSongData = queue[nextIndex];
    playSong(nextSongData.song || nextSongData, nextSongData.album || currentAlbum, queue, nextIndex);
  }, [queue, queueIndex, shuffle, repeat, currentAlbum, playSong]);

  const prevSong = useCallback(async () => {
    if (progress > 3) {
      setProgress(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }

    if (sessionIdRef.current) {
      try {
        await axios.post(`${API}/listening/end`, { session_id: sessionIdRef.current });
      } catch (e) {
        // Silently ignore
      }
    }

    if (queue.length === 0) return;
    const prevIndex = queueIndex === 0 ? queue.length - 1 : queueIndex - 1;
    const prevSongData = queue[prevIndex];
    playSong(prevSongData.song || prevSongData, prevSongData.album || currentAlbum, queue, prevIndex);
  }, [queue, queueIndex, progress, currentAlbum, playSong]);

  const seekTo = useCallback((value) => {
    setProgress(value);
    if (audioRef.current) {
      audioRef.current.currentTime = value;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  }, []);

  return {
    currentSong, currentAlbum, queue, queueIndex, isPlaying, progress, duration, 
    volume, isMuted, shuffle, repeat, audioRef, playSong, togglePlay, nextSong, 
    prevSong, seekTo, setVolume, toggleMute, setShuffle, cycleRepeat, setDuration, setProgress, setIsPlaying
  };
};

// Format time
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  'praise': Sparkles,
  'default': Music2
};

// Quick Access Card Component
const QuickAccessCard = ({ item, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 bg-zinc-800/60 hover:bg-zinc-700/80 rounded-md overflow-hidden transition-all duration-200 group"
    data-testid={`quick-access-${item.category_id || item.name}`}
  >
    <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center flex-shrink-0">
      {item.thumbnail ? (
        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
      ) : (
        (() => {
          const IconComponent = categoryIcons[item.name?.toLowerCase()] || categoryIcons.default;
          return <IconComponent size={20} className="text-white" />;
        })()
      )}
    </div>
    <span className="font-medium text-sm text-white/90 group-hover:text-white pr-3 truncate">
      {item.name || item.title}
    </span>
  </button>
);

// Album Card - Regular Square
const AlbumCardSquare = ({ album, onPlay, onOpen, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-32',
    md: 'w-44',
    lg: 'w-52'
  };
  
  return (
    <button
      onClick={() => onOpen(album.album_id)}
      className={`${sizeClasses[size]} flex-shrink-0 bg-zinc-900/30 hover:bg-zinc-800/60 p-3 rounded-lg transition-all duration-300 group text-left`}
      data-testid={`album-card-${album.album_id}`}
    >
      <div className="aspect-square rounded-md bg-zinc-800 mb-3 overflow-hidden relative shadow-lg">
        {album.thumbnail ? (
          <img src={album.thumbnail} alt={album.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900 to-emerald-900">
            <Music2 size={size === 'lg' ? 48 : 32} className="text-white/50" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-xl">
          <Play size={18} fill="black" className="text-black ml-0.5" />
        </div>
      </div>
      <h3 className="font-semibold text-sm truncate text-white/90">{album.title}</h3>
      <p className="text-xs text-zinc-400 truncate mt-0.5">{album.artist_name || 'Various Artists'}</p>
    </button>
  );
};

// Album Card - Wide/Rectangular (for featured)
const AlbumCardWide = ({ album, onPlay, onOpen }) => (
  <button
    onClick={() => onOpen(album.album_id)}
    className="flex-shrink-0 w-72 bg-zinc-800/40 hover:bg-zinc-800/70 rounded-lg overflow-hidden transition-all duration-300 group"
    data-testid={`album-wide-${album.album_id}`}
  >
    <div className="relative h-36 overflow-hidden">
      {album.thumbnail ? (
        <img src={album.thumbnail} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900 to-emerald-900">
          <Music2 size={48} className="text-white/50" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      <div className="absolute bottom-3 left-3 right-3">
        <h3 className="font-bold text-white truncate">{album.title}</h3>
        <p className="text-xs text-zinc-300 truncate">{album.artist_name}</p>
      </div>
      <div className="absolute bottom-3 right-3 w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
        <Play size={16} fill="black" className="text-black ml-0.5" />
      </div>
    </div>
  </button>
);

// Album Card - Compact (for grids)
const AlbumCardCompact = ({ album, onOpen }) => (
  <button
    onClick={() => onOpen(album.album_id)}
    className="flex items-center gap-3 p-2 rounded-md hover:bg-zinc-800/50 transition-colors group w-full text-left"
    data-testid={`album-compact-${album.album_id}`}
  >
    <div className="w-12 h-12 rounded bg-zinc-800 flex-shrink-0 overflow-hidden">
      {album.thumbnail ? (
        <img src={album.thumbnail} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-800 to-emerald-800">
          <Music2 size={16} className="text-white/50" />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm text-white/90 truncate">{album.title}</p>
      <p className="text-xs text-zinc-500 truncate">{album.artist_name}</p>
    </div>
    <Play size={14} className="text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
  </button>
);

// Artist Card - Circular
const ArtistCard = ({ artist, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 p-3 group"
    data-testid={`artist-${artist.singer_id}`}
  >
    <div className="w-28 h-28 rounded-full bg-zinc-800 overflow-hidden shadow-lg group-hover:shadow-emerald-500/20 transition-shadow">
      {artist.photo ? (
        <img src={artist.photo} alt={artist.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
          <Mic2 size={36} className="text-zinc-500" />
        </div>
      )}
    </div>
    <p className="font-medium text-sm text-white/90 truncate max-w-28">{artist.name}</p>
    <p className="text-xs text-zinc-500">Artist</p>
  </button>
);

// Section Header with "See More"
const SectionHeader = ({ title, subtitle, onSeeMore }) => (
  <div className="flex items-end justify-between mb-4">
    <div>
      <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
      {subtitle && <p className="text-sm text-zinc-400 mt-0.5">{subtitle}</p>}
    </div>
    {onSeeMore && (
      <button 
        onClick={onSeeMore}
        className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
      >
        Show all
      </button>
    )}
  </div>
);

// Hero Section Component
const HeroSection = ({ burner, onClick }) => {
  if (!burner) return null;
  
  const bgStyle = burner.background_gradient 
    ? { background: burner.background_gradient }
    : { backgroundColor: burner.background_color || '#1a1a1a' };

  return (
    <div 
      className="relative w-full h-64 md:h-80 overflow-hidden"
      style={bgStyle}
      data-testid="hero-section"
    >
      {burner.image_url && (
        <img 
          src={burner.image_url} 
          alt="" 
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 drop-shadow-lg">
          {burner.headline || 'Discover Sacred Music'}
        </h1>
        <p className="text-base md:text-lg text-zinc-200 mb-6 max-w-2xl">
          {burner.subtitle || 'Stream thousands of Christian songs, hymns, and spiritual content'}
        </p>
        <button 
          onClick={onClick}
          className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full transition-all hover:scale-105 shadow-lg"
        >
          {burner.cta_text || 'Start Listening'}
        </button>
      </div>
    </div>
  );
};

// Category Filter Pills
const CategoryFilters = ({ categories, activeCategory, onSelect }) => (
  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" data-testid="category-filters">
    <button
      onClick={() => onSelect(null)}
      className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
        !activeCategory 
          ? 'bg-white text-black' 
          : 'bg-zinc-800 text-white hover:bg-zinc-700'
      }`}
    >
      All
    </button>
    {categories.map(cat => {
      const IconComponent = categoryIcons[cat.name?.toLowerCase()] || categoryIcons.default;
      return (
        <button
          key={cat.category_id}
          onClick={() => onSelect(cat)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 ${
            activeCategory?.category_id === cat.category_id 
              ? 'bg-emerald-500 text-black' 
              : 'bg-zinc-800 text-white hover:bg-zinc-700'
          }`}
        >
          <IconComponent size={14} />
          {cat.name}
        </button>
      );
    })}
  </div>
);

// Main User App Component
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

  const player = useAudioPlayer();
  const [authForm, setAuthForm] = useState({ email: '', phone: '', password: '', name: '' });

  // Fetch home data and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [homeRes, catRes] = await Promise.all([
          axios.get(`${API}/user/home`),
          axios.get(`${API}/user/browse/categories`)
        ]);
        setHomeData(homeRes.data);
        setCategories(catRes.data.categories || []);
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
        })
        .catch(() => {
          localStorage.removeItem('user_token');
          setToken(null);
        });
    }
  }, [token]);

  // Handle search
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
        console.error("Search failed", e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle category filter
  const handleCategorySelect = async (category) => {
    setActiveCategory(category);
    if (category) {
      try {
        const res = await axios.get(`${API}/user/browse/category/${category.category_id}`);
        setCategoryAlbums(res.data.albums || []);
      } catch (e) {
        setCategoryAlbums([]);
      }
    } else {
      setCategoryAlbums([]);
    }
  };

  // Fetch album details
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

  // Fetch library
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

  // Add to favorites
  const toggleFavorite = async (type, id) => {
    if (!token) {
      setShowAuth(true);
      return;
    }
    try {
      await axios.post(`${API}/user/favorites/add`, { type, id }, { headers: { Authorization: `Bearer ${token}` }});
      toast.success("Added to favorites");
    } catch (e) {
      toast.error("Failed to add to favorites");
    }
  };

  // Play song
  const handlePlaySong = (song, album, allSongs, index) => {
    player.playSong(song, album, allSongs, index);
  };

  // Play album
  const handlePlayAlbum = () => {
    if (selectedAlbumSongs.length > 0) {
      handlePlaySong(selectedAlbumSongs[0], selectedAlbum, selectedAlbumSongs, 0);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white" data-testid="user-streaming-app">
      {/* Sidebar - Desktop */}
      <aside className="fixed left-0 top-0 w-64 h-full bg-black p-6 hidden lg:flex flex-col z-40">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-emerald-500">♱</span> Spirit Songs
          </h1>
        </div>
        
        <nav className="space-y-1">
          <button 
            onClick={() => { setView('home'); setActiveCategory(null); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'home' && !activeCategory ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <Home size={20} /> Home
          </button>
          <button 
            onClick={() => setView('search')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'search' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <Search size={20} /> Search
          </button>
          <button 
            onClick={fetchLibrary}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'library' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            <Library size={20} /> Your Library
          </button>
        </nav>

        <div className="mt-6 pt-6 border-t border-zinc-800">
          <button className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-3 text-sm">
            <Plus size={16} /> Create Playlist
          </button>
          <button className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm">
            <Heart size={16} /> Liked Songs
          </button>
        </div>

        {/* User section */}
        <div className="mt-auto pt-4 border-t border-zinc-800">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold">
                {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                <button onClick={handleLogout} className="text-xs text-zinc-500 hover:text-white">Logout</button>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuth(true)}
              className="w-full py-2.5 bg-white text-black rounded-full font-semibold hover:scale-105 transition-transform text-sm"
            >
              Sign In
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${player.currentSong ? 'pb-28' : 'pb-16'} lg:pb-24 lg:ml-64`}>
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 bg-black/95 backdrop-blur-xl z-40 px-4 py-3 flex items-center justify-between border-b border-zinc-800/50">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-emerald-500">♱</span> Spirit Songs
          </h1>
          {user ? (
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold">
              {user.name?.charAt(0) || 'U'}
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} className="text-emerald-400 font-medium text-sm">Sign in</button>
          )}
        </header>

        {/* Content Area */}
        <div className={view === 'home' ? '' : 'p-4 lg:p-6'}>
          {/* Home View */}
          {view === 'home' && homeData && (
            <div className="space-y-8">
              {/* Full-width Hero Section */}
              <HeroSection 
                burner={homeData.burners?.[0]} 
                onClick={() => {}} 
              />

              <div className="px-4 lg:px-6 space-y-8">
                {/* Quick Access Grid */}
                {categories.length > 0 && (
                  <section>
                    <SectionHeader title="Good evening" />
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                      {categories.slice(0, 8).map(cat => (
                        <QuickAccessCard 
                          key={cat.category_id} 
                          item={cat} 
                          onClick={() => handleCategorySelect(cat)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Category Filters */}
                <section>
                  <CategoryFilters 
                    categories={categories}
                    activeCategory={activeCategory}
                    onSelect={handleCategorySelect}
                  />
                </section>

                {/* Filtered Category Albums */}
                {activeCategory && categoryAlbums.length > 0 && (
                  <section>
                    <SectionHeader 
                      title={activeCategory.name} 
                      subtitle={`${categoryAlbums.length} albums`}
                      onSeeMore={() => {}}
                    />
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {categoryAlbums.map(album => (
                        <AlbumCardSquare key={album.album_id} album={album} onOpen={openAlbum} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Dynamic Sections from Layout */}
                {!activeCategory && homeData.sections?.map((section, idx) => {
                  // Skip hero type sections (handled above)
                  if (section.type === 'hero') return null;

                  const items = section.items || [];
                  if (items.length === 0) return null;

                  return (
                    <section key={section.section_id || idx}>
                      <SectionHeader 
                        title={section.title} 
                        subtitle={section.description}
                        onSeeMore={items.length > 6 ? () => {} : null}
                      />

                      {/* Different layouts based on section type and position */}
                      {section.type === 'quick_access' && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                          {items.slice(0, 8).map((item, i) => (
                            <QuickAccessCard 
                              key={item.category_id || i} 
                              item={item} 
                              onClick={() => item.category_id && handleCategorySelect(item)}
                            />
                          ))}
                        </div>
                      )}

                      {section.type === 'featured_albums' && (
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0">
                          {items.slice(0, 10).map(album => (
                            <AlbumCardWide key={album.album_id} album={album} onOpen={openAlbum} />
                          ))}
                        </div>
                      )}

                      {section.type === 'trending' && (
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0">
                          {items.slice(0, 10).map(album => (
                            <AlbumCardSquare key={album.album_id} album={album} onOpen={openAlbum} size="md" />
                          ))}
                        </div>
                      )}

                      {(section.type === 'seasonal' || section.type === 'cta' || section.type === 'custom') && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          {items.slice(0, 10).map(album => (
                            <AlbumCardSquare key={album.album_id} album={album} onOpen={openAlbum} />
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}

                {/* Additional promotional burners */}
                {homeData.burners?.length > 1 && (
                  <section className="grid md:grid-cols-2 gap-4">
                    {homeData.burners.slice(1, 3).map((burner, idx) => (
                      <div 
                        key={burner.burner_id || idx}
                        className="relative rounded-xl p-6 overflow-hidden h-40"
                        style={{ 
                          background: burner.background_gradient || burner.background_color || 'linear-gradient(135deg, #1a1a1a, #2a2a2a)'
                        }}
                      >
                        <div className="relative z-10">
                          <h3 className="text-xl font-bold mb-1">{burner.headline}</h3>
                          <p className="text-sm text-zinc-300 mb-3">{burner.subtitle}</p>
                          <button className="px-4 py-1.5 bg-white text-black rounded-full text-sm font-semibold hover:scale-105 transition-transform">
                            {burner.cta_text || 'Explore'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                {/* Recently Played (if logged in) */}
                {user && library?.recently_played?.length > 0 && (
                  <section>
                    <SectionHeader 
                      title="Recently Played" 
                      onSeeMore={() => setView('library')}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {library.recently_played.slice(0, 6).map(({ song, album }) => (
                        <AlbumCardCompact key={song.song_id} album={{...song, thumbnail: album?.thumbnail, artist_name: album?.artist_name}} onOpen={() => handlePlaySong(song, album, [], 0)} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}

          {/* Search View */}
          {view === 'search' && (
            <div>
              <div className="max-w-xl mb-8">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="What do you want to listen to?"
                    className="pl-12 py-6 text-lg bg-zinc-800 border-0 rounded-full"
                    data-testid="search-input"
                  />
                </div>
              </div>

              {searchResults ? (
                <div className="space-y-8">
                  {searchResults.songs?.length > 0 && (
                    <section>
                      <SectionHeader title="Songs" onSeeMore={searchResults.songs.length > 5 ? () => {} : null} />
                      <div className="space-y-1">
                        {searchResults.songs.slice(0, 5).map((song, idx) => (
                          <button 
                            key={song.song_id}
                            onClick={() => handlePlaySong(song, { title: song.album_title, thumbnail: song.album_thumbnail }, searchResults.songs, idx)}
                            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                          >
                            <div className="w-12 h-12 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {song.album_thumbnail ? (
                                <img src={song.album_thumbnail} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Music2 size={20} className="text-zinc-600" />
                              )}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="font-medium truncate">{song.title}</p>
                              <p className="text-sm text-zinc-400 truncate">{song.artist_name}</p>
                            </div>
                            <Play size={18} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {searchResults.albums?.length > 0 && (
                    <section>
                      <SectionHeader title="Albums" onSeeMore={searchResults.albums.length > 5 ? () => {} : null} />
                      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                        {searchResults.albums.map(album => (
                          <AlbumCardSquare key={album.album_id} album={album} onOpen={openAlbum} />
                        ))}
                      </div>
                    </section>
                  )}

                  {searchResults.artists?.length > 0 && (
                    <section>
                      <SectionHeader title="Artists" onSeeMore={searchResults.artists.length > 5 ? () => {} : null} />
                      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
                        {searchResults.artists.map(artist => (
                          <ArtistCard key={artist.singer_id} artist={artist} onClick={() => {}} />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <div className="text-center text-zinc-500 py-20">
                  <Search size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Search for songs, albums, or artists</p>
                </div>
              )}
            </div>
          )}

          {/* Album View */}
          {view === 'album' && selectedAlbum && (
            <div>
              <button onClick={() => setView('home')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6">
                <ChevronLeft size={20} /> Back
              </button>

              <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-8">
                <div className="w-48 h-48 md:w-56 md:h-56 flex-shrink-0 mx-auto md:mx-0">
                  {selectedAlbum.thumbnail ? (
                    <img src={selectedAlbum.thumbnail} alt={selectedAlbum.title} className="w-full h-full object-cover rounded-lg shadow-2xl" />
                  ) : (
                    <div className="w-full h-full rounded-lg bg-gradient-to-br from-violet-900 to-emerald-900 flex items-center justify-center shadow-2xl">
                      <Music2 size={64} className="text-white/50" />
                    </div>
                  )}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Album</p>
                  <h1 className="text-3xl md:text-5xl font-bold mt-2 mb-4">{selectedAlbum.title}</h1>
                  <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-zinc-400">
                    <span className="font-semibold text-white">{selectedAlbum.artist_name}</span>
                    <span>•</span>
                    <span>{selectedAlbumSongs.length} songs</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <button 
                  onClick={handlePlayAlbum}
                  className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
                  data-testid="play-album-btn"
                >
                  <Play size={28} fill="black" className="text-black ml-1" />
                </button>
                <button 
                  onClick={() => toggleFavorite('album', selectedAlbum.album_id)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <Heart size={28} />
                </button>
                <button className="text-zinc-400 hover:text-white transition-colors">
                  <MoreHorizontal size={28} />
                </button>
              </div>

              {/* Song List */}
              <div className="space-y-1">
                <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-2 text-zinc-400 text-sm border-b border-zinc-800">
                  <span>#</span>
                  <span>Title</span>
                  <Clock size={16} />
                </div>
                {selectedAlbumSongs.map((song, index) => (
                  <button
                    key={song.song_id}
                    onClick={() => handlePlaySong(song, selectedAlbum, selectedAlbumSongs, index)}
                    className={`w-full grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-3 rounded-lg hover:bg-zinc-800/50 transition-colors group ${
                      player.currentSong?.song_id === song.song_id ? 'bg-zinc-800/50' : ''
                    }`}
                    data-testid={`song-row-${song.song_id}`}
                  >
                    <span className={`w-6 text-center ${player.currentSong?.song_id === song.song_id ? 'text-emerald-400' : 'text-zinc-400 group-hover:hidden'}`}>
                      {player.currentSong?.song_id === song.song_id && player.isPlaying ? (
                        <div className="flex items-end justify-center gap-0.5 h-4">
                          <div className="w-1 bg-emerald-400 animate-pulse" style={{height: '60%'}} />
                          <div className="w-1 bg-emerald-400 animate-pulse" style={{height: '100%', animationDelay: '0.2s'}} />
                          <div className="w-1 bg-emerald-400 animate-pulse" style={{height: '40%', animationDelay: '0.4s'}} />
                        </div>
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="hidden group-hover:block text-zinc-400 w-6 text-center">
                      <Play size={14} fill="white" />
                    </span>
                    <div className="text-left">
                      <p className={`font-medium ${player.currentSong?.song_id === song.song_id ? 'text-emerald-400' : ''}`}>
                        {song.title}
                      </p>
                    </div>
                    <span className="text-zinc-400 text-sm">{song.duration_formatted || '--:--'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Library View */}
          {view === 'library' && library && (
            <div className="space-y-8">
              <h1 className="text-2xl md:text-3xl font-bold">Your Library</h1>

              {library.recently_played?.length > 0 && (
                <section>
                  <SectionHeader title="Recently Played" />
                  <div className="space-y-1">
                    {library.recently_played.map(({ song, album }) => (
                      <button 
                        key={song.song_id}
                        onClick={() => handlePlaySong(song, album, library.recently_played.map(r => r.song), 0)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="w-12 h-12 rounded bg-zinc-800 flex-shrink-0 overflow-hidden">
                          {album?.thumbnail ? (
                            <img src={album.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Music2 size={20} className="text-zinc-600" /></div>
                          )}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium truncate">{song.title}</p>
                          <p className="text-sm text-zinc-400 truncate">{album?.artist_name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {library.favorites?.length > 0 && (
                <section>
                  <SectionHeader title="Liked Songs" />
                  <div className="space-y-1">
                    {library.favorites.filter(f => f.type === 'song').map(({ item, album }) => (
                      <button 
                        key={item.song_id}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="w-12 h-12 rounded bg-zinc-800 flex-shrink-0 overflow-hidden">
                          {album?.thumbnail ? (
                            <img src={album.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Music2 size={20} className="text-zinc-600" /></div>
                          )}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-medium truncate">{item.title}</p>
                          <p className="text-sm text-zinc-400 truncate">{album?.artist_name}</p>
                        </div>
                        <Heart size={16} className="text-emerald-400" fill="currentColor" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {library.playlists?.length > 0 && (
                <section>
                  <SectionHeader title="Your Playlists" />
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {library.playlists.map(playlist => (
                      <div key={playlist.playlist_id} className="bg-zinc-900/50 p-4 rounded-lg">
                        <div className="aspect-square rounded-lg bg-gradient-to-br from-violet-600 to-emerald-600 mb-3 flex items-center justify-center">
                          <ListMusic size={40} className="text-white/80" />
                        </div>
                        <h3 className="font-medium truncate">{playlist.name}</h3>
                        <p className="text-sm text-zinc-400">{playlist.songs?.length || 0} songs</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-zinc-800 z-50 safe-area-bottom" style={{ bottom: player.currentSong ? '72px' : '0' }}>
        <div className="flex justify-around py-2">
          <button onClick={() => { setView('home'); setActiveCategory(null); }} className={`flex flex-col items-center gap-0.5 py-1 px-4 ${view === 'home' ? 'text-white' : 'text-zinc-500'}`}>
            <Home size={22} />
            <span className="text-[10px]">Home</span>
          </button>
          <button onClick={() => setView('search')} className={`flex flex-col items-center gap-0.5 py-1 px-4 ${view === 'search' ? 'text-white' : 'text-zinc-500'}`}>
            <Search size={22} />
            <span className="text-[10px]">Search</span>
          </button>
          <button onClick={fetchLibrary} className={`flex flex-col items-center gap-0.5 py-1 px-4 ${view === 'library' ? 'text-white' : 'text-zinc-500'}`}>
            <Library size={22} />
            <span className="text-[10px]">Library</span>
          </button>
        </div>
      </nav>

      {/* Player Bar */}
      {player.currentSong && (
        <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/98 backdrop-blur-xl border-t border-zinc-800 z-50 lg:left-64">
          {/* Progress Bar - Top */}
          <div className="h-1 bg-zinc-800">
            <div 
              className="h-full bg-emerald-500 transition-all duration-200"
              style={{ width: `${(player.progress / (player.duration || 100)) * 100}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between p-2 md:p-3 gap-2 md:gap-4">
            {/* Current Song Info */}
            <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded bg-zinc-800 flex-shrink-0 overflow-hidden">
                {player.currentAlbum?.thumbnail ? (
                  <img src={player.currentAlbum.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Music2 size={20} className="text-zinc-600" /></div>
                )}
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className="font-medium text-sm truncate">{player.currentSong.title}</p>
                <p className="text-xs text-zinc-400 truncate">{player.currentAlbum?.artist_name}</p>
              </div>
              <button onClick={() => toggleFavorite('song', player.currentSong.song_id)} className="text-zinc-400 hover:text-white hidden sm:block">
                <Heart size={16} />
              </button>
            </div>

            {/* Player Controls */}
            <div className="flex flex-col items-center gap-1 flex-1">
              <div className="flex items-center gap-3 md:gap-4">
                <button onClick={() => player.setShuffle(!player.shuffle)} className={`hidden md:block ${player.shuffle ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'}`}>
                  <Shuffle size={16} />
                </button>
                <button onClick={player.prevSong} className="text-zinc-400 hover:text-white">
                  <SkipBack size={20} fill="currentColor" />
                </button>
                <button 
                  onClick={player.togglePlay}
                  className="w-9 h-9 md:w-10 md:h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                  data-testid="player-play-btn"
                >
                  {player.isPlaying ? <Pause size={18} className="text-black" /> : <Play size={18} fill="black" className="text-black ml-0.5" />}
                </button>
                <button onClick={player.nextSong} className="text-zinc-400 hover:text-white">
                  <SkipForward size={20} fill="currentColor" />
                </button>
                <button onClick={player.cycleRepeat} className={`hidden md:block ${player.repeat !== 'off' ? 'text-emerald-400' : 'text-zinc-400 hover:text-white'}`}>
                  {player.repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
                </button>
              </div>
              
              {/* Progress Bar - Desktop */}
              <div className="hidden md:flex items-center gap-2 w-full max-w-md">
                <span className="text-[10px] text-zinc-400 w-8 text-right">{formatTime(player.progress)}</span>
                <Slider
                  value={[player.progress]}
                  max={player.duration || 100}
                  step={1}
                  onValueChange={([v]) => player.seekTo(v)}
                  className="flex-1"
                />
                <span className="text-[10px] text-zinc-400 w-8">{formatTime(player.duration)}</span>
              </div>
            </div>

            {/* Volume */}
            <div className="hidden lg:flex items-center gap-2 flex-1 justify-end">
              <button onClick={player.toggleMute} className="text-zinc-400 hover:text-white">
                {player.isMuted || player.volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <Slider
                value={[player.isMuted ? 0 : player.volume]}
                max={100}
                step={1}
                onValueChange={([v]) => player.setVolume(v)}
                className="w-24"
              />
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl max-w-md w-full p-6 md:p-8 relative">
            <button onClick={() => setShowAuth(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
              <X size={24} />
            </button>

            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">{authMode === 'login' ? 'Welcome back' : 'Create account'}</h2>
              <p className="text-zinc-400 text-sm">Sign in to save your music and preferences</p>
            </div>

            <div className="space-y-3">
              {authMode === 'register' && (
                <Input
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  placeholder="Your name"
                  className="bg-zinc-800 border-zinc-700"
                />
              )}
              <Input
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                placeholder="Email address"
                type="email"
                className="bg-zinc-800 border-zinc-700"
              />
              <Input
                value={authForm.phone}
                onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                placeholder="Or phone number"
                className="bg-zinc-800 border-zinc-700"
              />
              <Input
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                placeholder="Password"
                type="password"
                className="bg-zinc-800 border-zinc-700"
              />

              <Button 
                onClick={authMode === 'login' ? handleLogin : handleRegister}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold py-5"
              >
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-700" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-zinc-900 px-2 text-zinc-500">or</span></div>
              </div>

              <Button variant="outline" className="w-full border-zinc-700 py-5">
                <img src="https://www.google.com/favicon.ico" alt="" className="w-4 h-4 mr-2" />
                Continue with Google
              </Button>
            </div>

            <p className="text-center text-sm text-zinc-400 mt-4">
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-emerald-400 hover:underline"
              >
                {authMode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Custom scrollbar hide */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}
