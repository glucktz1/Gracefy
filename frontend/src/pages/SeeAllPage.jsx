import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Music, Building, Users, BookOpen, Play, Pause, Grid, List } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

const SeeAllPage = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [section, setSection] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  
  const title = searchParams.get('title') || 'Orodha';
  const limit = 50;

  const fetchSectionContent = useCallback(async (pageNum = 1, search = '') => {
    try {
      setLoading(pageNum === 1);
      const response = await axios.get(`${API}/user/section/${sectionId}`, {
        params: {
          page: pageNum,
          limit,
          search: search || undefined
        }
      });
      
      const data = response.data;
      setSection(data.section);
      setTotal(data.total);
      setHasMore(data.has_more);
      
      if (pageNum === 1) {
        setItems(data.items || []);
      } else {
        setItems(prev => [...prev, ...(data.items || [])]);
      }
    } catch (error) {
      console.error('Error fetching section content:', error);
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    fetchSectionContent(1, searchQuery);
  }, [sectionId]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    setPage(1);
    fetchSectionContent(1, searchQuery);
  }, [searchQuery, fetchSectionContent]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchSectionContent(nextPage, searchQuery);
  };

  const handleItemClick = (item) => {
    const type = item.entity_type || section?.content_type;
    
    switch (type) {
      case 'album':
        // Navigate to album in the streaming app
        navigate(`/app?album=${item.album_id}`);
        break;
      case 'choir':
        navigate(`/app?choir=${item.singer_id}`);
        break;
      case 'church':
        navigate(`/app?church=${item.church_id}`);
        break;
      case 'teaching':
        navigate(`/app?teaching=${item.teaching_id}`);
        break;
      case 'special_mix':
        navigate(`/app?mix=${item.mix_id}`);
        break;
      default:
        if (item.album_id) {
          navigate(`/app?album=${item.album_id}`);
        }
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'albums': return <Music className="w-5 h-5" />;
      case 'choirs': return <Users className="w-5 h-5" />;
      case 'churches': return <Building className="w-5 h-5" />;
      case 'teachings': return <BookOpen className="w-5 h-5" />;
      default: return <Music className="w-5 h-5" />;
    }
  };

  const renderAlbumItem = (item) => (
    <div
      key={item.album_id}
      className="group cursor-pointer"
      onClick={() => handleItemClick(item)}
      data-testid={`album-item-${item.album_id}`}
    >
      <div className="relative aspect-square rounded-lg overflow-hidden bg-zinc-800 mb-2">
        <img
          src={item.thumbnail || '/placeholder-album.png'}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { e.target.src = '/placeholder-album.png'; }}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white ml-1" />
          </div>
        </div>
        {item.tags && item.tags.length > 0 && (
          <div className="absolute top-2 left-2">
            <span className="px-2 py-0.5 bg-purple-600/80 text-white text-xs rounded-full uppercase font-bold">
              {item.tags[0]?.name || item.tags[0]}
            </span>
          </div>
        )}
      </div>
      <h3 className="font-semibold text-white text-sm truncate">{item.title || item.name}</h3>
      <p className="text-zinc-400 text-xs truncate">{item.artist_name || 'Unknown Artist'}</p>
    </div>
  );

  const renderChoirItem = (item) => (
    <div
      key={item.singer_id}
      className="group cursor-pointer flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors"
      onClick={() => handleItemClick(item)}
      data-testid={`choir-item-${item.singer_id}`}
    >
      <div className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
        <img
          src={item.thumbnail || '/placeholder-choir.png'}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = '/placeholder-choir.png'; }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white truncate">{item.name}</h3>
        <p className="text-zinc-400 text-sm">{item.followers_count || 0} wafuasi</p>
      </div>
    </div>
  );

  const renderChurchItem = (item) => (
    <div
      key={item.church_id}
      className="group cursor-pointer flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors"
      onClick={() => handleItemClick(item)}
      data-testid={`church-item-${item.church_id}`}
    >
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
        <img
          src={item.thumbnail || '/placeholder-church.png'}
          alt={item.name}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = '/placeholder-church.png'; }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white truncate">{item.name}</h3>
        <p className="text-zinc-400 text-sm truncate">{item.location || 'Tanzania'}</p>
      </div>
    </div>
  );

  const renderTeachingItem = (item) => (
    <div
      key={item.teaching_id}
      className="group cursor-pointer flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors"
      onClick={() => handleItemClick(item)}
      data-testid={`teaching-item-${item.teaching_id}`}
    >
      <div className="w-20 h-20 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
        <img
          src={item.thumbnail || '/placeholder-teaching.png'}
          alt={item.title}
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = '/placeholder-teaching.png'; }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-white truncate">{item.title || item.title_sw}</h3>
        <p className="text-purple-400 text-sm">na {item.leader_name || 'Unknown'}</p>
        <p className="text-zinc-500 text-xs mt-1">
          {item.topic_count || 0} mada • {item.lesson_count || 0} masomo
        </p>
      </div>
    </div>
  );

  const renderItem = (item) => {
    const type = item.entity_type || section?.content_type;
    
    switch (type) {
      case 'choir':
      case 'choirs':
        return renderChoirItem(item);
      case 'church':
      case 'churches':
        return renderChurchItem(item);
      case 'teaching':
      case 'teachings':
        return renderTeachingItem(item);
      default:
        return renderAlbumItem(item);
    }
  };

  const isGridLayout = () => {
    const type = section?.content_type;
    return type === 'albums' || type === 'special_mixes' || !type;
  };

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-lg border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
              data-testid="back-button"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">{title || section?.title || section?.name || 'Orodha'}</h1>
              <p className="text-zinc-400 text-sm">{total} matokeo</p>
            </div>
            {isGridLayout() && (
              <div className="flex gap-1 bg-zinc-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-white'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Tafuta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
              data-testid="search-input"
            />
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {items.length === 0 ? (
          <div className="text-center py-20">
            {getIcon(section?.content_type)}
            <p className="text-zinc-400 mt-4">Hakuna matokeo</p>
          </div>
        ) : (
          <>
            {isGridLayout() && viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {items.map(renderItem)}
              </div>
            ) : (
              <div className="space-y-1">
                {items.map(renderItem)}
              </div>
            )}
            
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-medium transition-colors disabled:opacity-50"
                  data-testid="load-more-button"
                >
                  {loading ? 'Inapakia...' : 'Pakia Zaidi'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SeeAllPage;
