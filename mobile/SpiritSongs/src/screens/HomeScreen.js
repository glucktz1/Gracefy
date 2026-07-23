import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  ImageBackground,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { homeAPI, contentAPI, libraryAPI, bibleAPI, churchAPI, leaderContentAPI, getImageUrl, radioAPI, geoAPI, nenoLaLeoAPI } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useGeo } from '../context/GeoContext';
import { useBilling } from '../context/BillingContext';
import AddToPlaylistModal from '../components/AddToPlaylistModal';
import { FullScreenLoader } from '../components/GracefyLoader';
import LiveListenerBadge from '../components/LiveListenerBadge';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.md * 3) / 2;
const HERO_WIDTH = width - SPACING.md * 2;

// Fisher–Yates shuffle: returns a new shuffled array so users see variety each open
const shuffleArray = (arr) => {
  if (!Array.isArray(arr) || arr.length <= 1) return arr ?? [];
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const HomeScreen = ({ navigation }) => {
  // NOTE: `loading` starts FALSE so the FlatList shell renders on the very
  // first frame (no full-screen spinner). We hydrate from AsyncStorage cache
  // synchronously-ish in the mount effect below, then refresh in background.
  // This mirrors Spotify's "instant open" behavior.
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');
  
  // Layout Manager Data
  const [layoutSections, setLayoutSections] = useState([]);
  const [heroContent, setHeroContent] = useState({ items: [] });
  const [quickAccessConfig, setQuickAccessConfig] = useState([]);
  // Categories with song counts — used to enrich the Quick Access tiles with
  // the "X nyimbo" badge that matches the web UI exactly.
  const [songCategoriesWithCounts, setSongCategoriesWithCounts] = useState([]);
  
  // Category Filters
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  
  // Content Data
  const [specialMixes, setSpecialMixes] = useState([]);
  const [recentAlbums, setRecentAlbums] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [likedSongsCount, setLikedSongsCount] = useState(0);
  const [bibleSnippets, setBibleSnippets] = useState([]);
  const [churches, setChurches] = useState([]);
  const [mafundishoContent, setMafundishoContent] = useState([]);
  const [nenoLaLeo, setNenoLaLeo] = useState([]);
  
  // Additional sections from Layout Manager
  const [lentSongs, setLentSongs] = useState([]);
  const [christmasSongs, setChristmasSongs] = useState([]);
  const [mostListenedAlbums, setMostListenedAlbums] = useState([]);
  const [hotNewReleases, setHotNewReleases] = useState([]);
  
  // Radio Stations
  const [radioStations, setRadioStations] = useState([]);
  
  // Album Tags
  const [availableTags, setAvailableTags] = useState([]);
  
  // Hero Carousel State
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const heroScrollRef = useRef(null);
  const heroIntervalRef = useRef(null);
  
  // Add to playlist modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);

  // Call hooks unconditionally - they have built-in fallbacks
  const playerContext = usePlayer();
  const authContext = useAuth();
  const geoContext = useGeo();
  const billingContext = useBilling();
  
  // Extract values with safe fallbacks
  const playTrack = playerContext?.playTrack ?? (() => {});
  const playRadio = playerContext?.playRadio ?? (() => {});
  const currentTrack = playerContext?.currentTrack ?? null;
  const isPlaying = playerContext?.isPlaying ?? false;
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  const user = authContext?.user ?? null;
  
  // Geo context values
  const userCountry = geoContext?.userCountry ?? 'GLOBAL';
  const geoEnabled = geoContext?.geoEnabled ?? false;
  
  // Billing context values
  const billingEnabled = billingContext?.billingEnabled ?? false;

  useEffect(() => {
    updateGreeting();
    // Hydrate from disk FIRST for an instant paint, then hit network in
    // the background. Users on cold app opens see cached home in < 100ms.
    hydrateFromCache().finally(() => loadData());
    return () => {
      if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
    };
  }, []);

  // Auto-rotate hero carousel
  useEffect(() => {
    if (heroContent?.items?.length > 1) {
      heroIntervalRef.current = setInterval(() => {
        setCurrentHeroIndex(prev => {
          const nextIndex = (prev + 1) % heroContent.items.length;
          heroScrollRef.current?.scrollTo({ x: nextIndex * HERO_WIDTH, animated: true });
          return nextIndex;
        });
      }, heroContent.rotation_interval || 5000);
    }
    return () => {
      if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
    };
  }, [heroContent]);

  const updateGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Habari ya asubuhi');
    else if (hour < 18) setGreeting('Habari ya mchana');
    else setGreeting('Habari ya jioni');
  };

  // Persistent cache key for the home payload — used to hydrate the UI
  // instantly on subsequent app opens (stale-while-revalidate).
  const HOME_CACHE_KEY = 'gracefy:home:v1';

  // Hydrate from AsyncStorage on mount BEFORE the network call. If we have
  // a cached payload, the FlatList paints in one frame; the background
  // refetch then updates state silently once the network finishes.
  const hydrateFromCache = async () => {
    try {
      const raw = await AsyncStorage.getItem(HOME_CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (cached?.recentAlbums?.length) setRecentAlbums(cached.recentAlbums);
      if (cached?.specialMixes?.length) setSpecialMixes(cached.specialMixes);
      if (cached?.churches?.length) setChurches(cached.churches);
      if (cached?.mafundishoContent?.length) setMafundishoContent(cached.mafundishoContent);
      if (cached?.heroContent) setHeroContent(cached.heroContent);
      if (cached?.layoutSections?.length) setLayoutSections(cached.layoutSections);
      if (cached?.songCategoriesWithCounts?.length) setSongCategoriesWithCounts(cached.songCategoriesWithCounts);
    } catch (e) {
      // Silent — cache is a best-effort optimization.
    }
  };

  const persistToCache = async (payload) => {
    try {
      await AsyncStorage.setItem(HOME_CACHE_KEY, JSON.stringify(payload));
    } catch (e) { /* silent */ }
  };

  const loadData = async () => {
    try {
      // Skip full-screen spinner on subsequent opens — cache-first strategy
      // + FlatList shell paint together give a Spotify-instant feel. The
      // spinner only appears when there is truly nothing to display.
      // setLoading(true);  // removed

      // Use geo-filtered home endpoint if geo is enabled
      const useGeoFiltering = geoEnabled && userCountry && userCountry !== 'GLOBAL';

      // Retry-with-backoff wrapper for the CRITICAL home endpoint. On bad
      // networks (2G/edge/roaming) a single request may time out — one quick
      // retry after 1.5s catches transient DNS/TLS blips without adding
      // perceptible latency to the happy path. Returns null on total failure
      // so we can DETECT failure downstream and preserve hydrated cache.
      const fetchHomeWithRetry = async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const r = await homeAPI.getAppHome();
            if (r?.data?.sections?.length || r?.data?.hero?.items?.length) return r;
            // Empty payload — treat as failure so we don't clobber cache
          } catch (e) {
            console.log(`[HomeScreen] getAppHome attempt ${attempt + 1} failed:`, e.message);
          }
          if (attempt === 0) await new Promise(r => setTimeout(r, 1500));
        }
        return null;
      };

      const [
        // Use unified home endpoint that returns sections with content in correct order
        homeRes,
        playlistsRes, 
        likesRes,
        filtersRes,
        tagsRes,
        radioRes,
        geoAlbumsRes,
        nenoRes,
        songCategoriesRes,
      ] = await Promise.all([
        // Get home data with sections, hero, and burners in correct layout order.
        // null = network failure after retries → keep hydrated cache.
        fetchHomeWithRetry(),
        libraryAPI.getPlaylists().catch(() => ({ data: [] })),
        libraryAPI.getLikedSongs().catch(() => ({ data: [] })),
        homeAPI.getHomeFilters().catch(() => ({ data: { filters: [] } })),
        homeAPI.getTags().catch(() => ({ data: { tags: [] } })),
        radioAPI.getStations().catch(() => ({ data: { stations: [] } })),
        // Get geo-filtered albums if geo-filtering is enabled
        useGeoFiltering 
          ? geoAPI.getLocalizedFeed(userCountry, 'albums').catch(() => ({ data: { albums: [] } }))
          : Promise.resolve({ data: { albums: [] } }),
        nenoLaLeoAPI.getActive().catch(() => ({ data: { neno_list: [] } })),
        // Spotify-style Quick Access tiles with song-count badges (matches web)
        homeAPI.getSongCategoriesWithCounts().catch(() => ({ data: { categories: [] } })),
      ]);

      // BAD-NETWORK GUARD: if home endpoint failed AND we have hydrated
      // state from AsyncStorage, DO NOT overwrite the UI with an empty
      // payload. The user keeps seeing their last-known-good home while
      // the next refresh (pull-to-refresh or reopen) tries again.
      if (!homeRes) {
        console.warn('[HomeScreen] Home endpoint failed after retries — keeping cached UI');
        // Still update the smaller side data that we DID fetch successfully
        setNenoLaLeo(nenoRes.data?.neno_list || []);
        if (songCategoriesRes.data?.categories?.length) {
          setSongCategoriesWithCounts(songCategoriesRes.data.categories);
        }
        return;
      }

      setNenoLaLeo(nenoRes.data?.neno_list || []);
      setSongCategoriesWithCounts(songCategoriesRes.data?.categories || []);

      // Album Tags
      const tags = tagsRes.data?.tags || [];
      setAvailableTags(tags);

      // Extract data from unified home response
      const homeData = homeRes.data || {};
      const rawSections = homeData.sections || [];
      const heroData = homeData.hero || { items: [] };
      const burnersData = homeData.burners || [];
      
      // Filter active sections (they should already be filtered by backend, but double-check)
      // Shuffle items inside non-curated sections (skip hero/quick_access/categories/neno/bible/radio etc.)
      const SHUFFLE_SKIP = new Set(['hero', 'quick_access', 'categories', 'category', 'neno_la_leo', 'radio', 'bible']);
      const activeSections = rawSections
        .filter(s => s.is_active !== false)
        .map(s => {
          const t = (s.section_type || s.type || '').toString();
          if (SHUFFLE_SKIP.has(t)) return s;
          const titleLc = (s.title || '').toLowerCase();
          if (titleLc.includes('hivi karibuni') || titleLc.includes('most listened') || titleLc.includes('hot')) return s;
          if (!Array.isArray(s.items) || s.items.length <= 1) return s;
          return { ...s, items: shuffleArray(s.items) };
        });
      setLayoutSections(activeSections);
      
      // Set hero content from unified endpoint
      setHeroContent(heroData);

      // Home filters from admin panel (new endpoint)
      const homeFilters = filtersRes.data?.filters || [];
      if (homeFilters.length > 0) {
        // Use filters from admin-managed endpoint with Swahili names
        const categoryFilters = [
          { id: 'all', name: 'Zote', name_sw: 'Zote', icon: null, color: '#8B5CF6' },
          ...homeFilters
            .filter(f => f.is_active || f.enabled)
            .map(f => ({
              id: f.song_category_id || f.filter_id || f.category_id,
              name: f.name_sw || f.name,  // Prefer Swahili name
              name_en: f.name,
              name_sw: f.name_sw,
              icon: f.icon,
              color: f.color || '#6366f1',
              filter_type: f.filter_type || 'category',
              category_id: f.song_category_id || f.category_id,
              song_category_id: f.song_category_id,
              content_type: f.content_type || 'albums',
            }))
        ];
        setCategories(categoryFilters);
      } else {
        // Fallback to default
        setCategories([{ id: 'all', name: 'Zote', icon: null }]);
      }

      // Extract content from unified home response sections
      const geoAlbums = geoAlbumsRes?.data?.albums || [];
      
      // Get content from sections
      let albums = [];
      let mixes = [];
      let songs = [];
      let snippets = [];
      let churches = [];
      let mafundisho = [];
      
      // Extract content from each section - backend returns 'items', not 'content_items'
      activeSections.forEach(section => {
        const items = section.items || [];
        
        switch(section.content_type || section.section_type) {
          case 'albums':
          case 'featured_albums':
          case 'seasonal':
            albums = [...albums, ...items];
            break;
          case 'mixes':
          case 'special_mixes':
            mixes = [...mixes, ...items];
            break;
          case 'songs':
            songs = [...songs, ...items];
            break;
          case 'bible_snippets':
            snippets = [...snippets, ...items];
            break;
          case 'churches':
            churches = [...churches, ...items];
            break;
          case 'mafundisho':
          case 'teachings':
            mafundisho = [...mafundisho, ...items];
            break;
        }
      });
      
      // Use geo-filtered albums if available, otherwise use section albums
      const finalAlbums = (useGeoFiltering && geoAlbums.length > 0) ? geoAlbums : albums;

      // Set content from unified response - shuffle each time so users see variety
      setSpecialMixes(shuffleArray(mixes));
      setRecentAlbums(shuffleArray(finalAlbums));

      // Process songs with thumbnails
      const songsWithThumbnails = songs.map(song => {
        if (!song.thumbnail && !song.thumbnail_url) {
          const album = finalAlbums.find(a => a.album_id === song.album_id);
          if (album) {
            return { ...song, thumbnail: album.thumbnail || album.thumbnail_url };
          }
        }
        return song;
      });
      setAllSongs(shuffleArray(songsWithThumbnails));

      // User playlists
      const playlists = playlistsRes.data || [];
      setUserPlaylists(Array.isArray(playlists) ? playlists : []);

      // Liked songs
      const likes = likesRes.data?.songs || likesRes.data || [];
      setLikedSongsCount(Array.isArray(likes) ? likes.length : 0);

      // Set content from unified response (Bible/Churches/Mafundisho also shuffled for variety)
      setBibleSnippets(Array.isArray(snippets) ? snippets : []);
      setChurches(Array.isArray(churches) ? shuffleArray(churches) : []);
      setMafundishoContent(Array.isArray(mafundisho) ? shuffleArray(mafundisho) : []);

      // Radio Stations
      const stations = radioRes.data?.stations || [];
      setRadioStations(Array.isArray(stations) ? stations : []);

      // Quick Access config
      const quickAccessSection = activeSections.find(s => 
        s.section_type === 'quick_access' || s.name === 'quick_access'
      );
      if (quickAccessSection?.quick_access_items) {
        setQuickAccessConfig(quickAccessSection.quick_access_items);
      } else if (quickAccessSection?.content_items) {
        setQuickAccessConfig(quickAccessSection.content_items);
      }

      // Load additional sections from layout manager with content_items
      loadLayoutSections(activeSections, finalAlbums, mixes);

    } catch (error) {
      console.error('[HomeScreen] Error loading data:', error.message);
      console.error('[HomeScreen] Full error:', JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
    }
  };

  // Persist to disk cache whenever the primary data slices change.
  // Fires shortly after a successful loadData() and after loadLayoutSections()
  // has updated the derived arrays. Best-effort, non-blocking.
  useEffect(() => {
    if (recentAlbums.length === 0 && specialMixes.length === 0) return;
    persistToCache({
      recentAlbums, specialMixes, churches,
      mafundishoContent, heroContent, layoutSections, songCategoriesWithCounts,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentAlbums, specialMixes, churches, mafundishoContent, heroContent, layoutSections, songCategoriesWithCounts]);

  const loadLayoutSections = (sections, albums, mixes) => {
    // Find Lent songs section - use 'items' from unified home response
    const lentSection = sections.find(s => 
      s.name?.toLowerCase().includes('lent') || 
      s.name?.toLowerCase().includes('kwaresima') ||
      s.name?.toLowerCase().includes('kwaresma') ||
      s.section_type === 'seasonal' && s.filter_category === 'lent'
    );
    if (lentSection?.items?.length > 0) {
      setLentSongs(lentSection.items);
    } else if (albums.length > 0) {
      const lentFallback = albums.slice(0, 4).map(a => ({
        ...a,
        title: a.name || a.title,
        thumbnail: a.thumbnail || a.thumbnail_url,
        artist_name: a.artist_name || a.choir_name || 'Unknown'
      }));
      setLentSongs(lentFallback);
    }

    // Find Christmas songs section
    const christmasSection = sections.find(s => 
      s.name?.toLowerCase().includes('christmas') || 
      s.name?.toLowerCase().includes('krismasi') ||
      s.section_type === 'seasonal' && s.filter_category === 'christmas'
    );
    if (christmasSection?.items?.length > 0) {
      setChristmasSongs(christmasSection.items);
    } else if (albums.length > 2) {
      const christmasFallback = albums.slice(2, 6).map(a => ({
        ...a,
        title: a.name || a.title,
        thumbnail: a.thumbnail || a.thumbnail_url,
        artist_name: a.artist_name || a.choir_name || 'Unknown'
      }));
      setChristmasSongs(christmasFallback);
    }

    // Most listened albums - always use albums as fallback
    const mostListenedSection = sections.find(s => 
      s.name?.toLowerCase().includes('zinazosikilizwa') ||
      s.section_type === 'trending'
    );
    if (mostListenedSection?.items?.length > 0) {
      setMostListenedAlbums(mostListenedSection.items);
    } else {
      setMostListenedAlbums(albums.slice(0, 6));
    }

    // Hot new releases - always use albums as fallback
    const hotSection = sections.find(s => 
      s.name?.toLowerCase().includes('moto') ||
      s.name?.toLowerCase().includes('mpya') ||
      s.section_type === 'cta'
    );
    if (hotSection?.items?.length > 0) {
      setHotNewReleases(hotSection.items);
    } else {
      setHotNewReleases(albums.slice(0, 6));
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handlePlaySong = (song, songList) => {
    const index = songList.findIndex(s => s.song_id === song.song_id);
    playTrack(song, songList, index >= 0 ? index : 0);
  };

  const handleAlbumPress = (album) => {
    navigation.navigate('Album', { album });
  };

  const handleMixPress = (mix) => {
    navigation.navigate('Playlist', { mix });
  };

  // Helper function to render album tags overlay
  const renderAlbumTags = (album) => {
    if (!album?.tags || album.tags.length === 0) return null;
    
    // Get first tag only to show on card (top-left badge)
    const firstTagId = album.tags[0];
    const tag = availableTags.find(t => t.tag_id === firstTagId);
    
    if (!tag) return null;
    
    return (
      <View style={styles.albumTagBadge}>
        <View style={[styles.albumTagPill, { backgroundColor: tag.color }]}>
          <Text style={styles.albumTagText}>{tag.name}</Text>
        </View>
      </View>
    );
  };

  // Album card component with tags
  const renderAlbumCard = (album, index) => (
    <TouchableOpacity 
      key={album.album_id || index} 
      style={styles.smallSquareCard}
      onPress={() => handleAlbumPress(album)}
    >
      <View style={styles.albumImageContainer}>
        <Image
          source={{ uri: getImageUrl(album.thumbnail || album.thumbnail_url) || 'https://via.placeholder.com/120' }}
          style={styles.smallSquareImage}
        />
        {renderAlbumTags(album)}
        {/* Live listener social-proof badge */}
        <View style={styles.liveBadgeContainer} pointerEvents="none">
          <LiveListenerBadge albumId={album.album_id} />
        </View>
      </View>
      <Text style={styles.smallSquareTitle} numberOfLines={1}>{album.title}</Text>
      <Text style={styles.smallSquareArtist} numberOfLines={1}>{album.artist_name}</Text>
    </TouchableOpacity>
  );

  const handlePlayMix = async (mix) => {
    // Play the mix directly - get songs and start playing
    try {
      if (mix.songs && mix.songs.length > 0) {
        // Mix already has songs loaded
        const firstSong = mix.songs[0];
        playTrack(firstSong, mix.songs, 0);
      } else if (mix.mix_id) {
        // Need to fetch songs from API
        const response = await homeAPI.getMixSongs(mix.mix_id);
        const songs = response?.data?.songs || [];
        if (songs.length > 0) {
          playTrack(songs[0], songs, 0);
        }
      }
    } catch (error) {
      // If playing fails, just navigate to the mix screen
      navigation.navigate('Playlist', { mix });
    }
  };

  const handleCategoryFilter = (category) => {
    setActiveCategory(category.id);
    
    // If 'all' is selected, just update visual state
    if (category.id === 'all') {
      return;
    }
    
    // Navigate to SeeAll screen with category filter - use type 'category' 
    // to fetch content from backend endpoint
    // Use song_category_id or category_id for proper filtering
    const categoryId = category.song_category_id || category.category_id || category.id;
    navigation.navigate('SeeAll', { 
      type: 'category',
      title: category.name,
      category: categoryId,
      categoryName: category.name
    });
  };

  const handleAddToPlaylist = (song) => {
    setSelectedSong(song);
    setShowPlaylistModal(true);
  };

  const handleHeroPress = (item) => {
    // Handle different link types for hero navigation
    const linkType = item.link_type;
    const linkTarget = item.link_target;
    
    if (linkType === 'album' || item.album_id) {
      navigation.navigate('Album', { album: item });
    } else if (linkType === 'mix' || item.mix_id) {
      navigation.navigate('Playlist', { mix: item });
    } else if (linkType === 'song' || item.song_id) {
      handlePlaySong(item, [item]);
    } else if (linkType === 'church' || item.church_id) {
      navigation.navigate('Churches', { selectedChurch: item });
    } else if (linkType === 'teaching' || item.teaching_id) {
      navigation.navigate('MafundishoDetail', { teachingId: item.teaching_id, mafundisho: item });
    } else if (linkType === 'category' || item.category_id || item.song_category_id) {
      navigation.navigate('CategorySongs', {
        categoryId: item.category_id || item.song_category_id,
        categoryName: item.name_sw || item.name || item.title,
        coverHint: item.thumbnail || item.cover,
        totalHint: typeof item.total_songs === 'number' ? item.total_songs : undefined,
      });
    } else if (linkType === 'bible') {
      navigation.navigate('Bible');
    } else if (linkType === 'url' && linkTarget) {
      // External URL - open in browser
      Linking.openURL(linkTarget).catch(() => {});
    } else if (linkType === 'screen' && linkTarget) {
      // Navigate to specific screen
      navigation.navigate(linkTarget);
    } else if (item.album_id) {
      // Fallback to album navigation if album_id exists
      navigation.navigate('Album', { album: item });
    }
  };

  const handleHeroScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / HERO_WIDTH);
    setCurrentHeroIndex(index);
  };

  // Handle Mafundisho card play button
  const handleMafundishoPlay = (leader) => {
    // Navigate to leader's content screen
    navigation.navigate('LeaderContent', { 
      leader: { 
        leader_id: leader.leader_id, 
        name: leader.name,
        title: leader.title,
        photo: leader.photo,
        church_name: leader.church_name,
        followers: leader.followers,
        bio: leader.bio
      } 
    });
  };

  // Handle Mafundisho add button
  const handleMafundishoAdd = (leader) => {
    // Navigate to leader's content screen
    navigation.navigate('LeaderContent', { 
      leader: { 
        leader_id: leader.leader_id, 
        name: leader.name,
        title: leader.title,
        photo: leader.photo,
        church_name: leader.church_name
      } 
    });
  };

  // Render section items based on layout_style
  const renderSectionContent = (section, items) => {
    if (!items || items.length === 0) return null;
    
    const layoutStyle = section.layout_style || 'horizontal_small';
    const sectionType = section.section_type;
    
    // Handle item press based on content type
    const handleItemPress = (item) => {
      if (item.album_id) {
        handleAlbumPress(item);
      } else if (item.mix_id) {
        handleMixPress(item);
      } else if (item.song_id) {
        handlePlaySong(item, items);
      } else if (item.category_id || item.song_category_id) {
        // Spotify-style: tapping a category opens its full songs list + Play All.
        // Pass coverHint/totalHint so the destination screen paints the cover
        // and count instantly without waiting for the API round-trip.
        navigation.navigate('CategorySongs', {
          categoryId: item.category_id || item.song_category_id,
          categoryName: item.name_sw || item.name || item.title,
          coverHint: item.thumbnail || item.cover,
          totalHint: typeof item.total_songs === 'number' ? item.total_songs : undefined,
        });
      } else if (item.church_id) {
        navigation.navigate('Churches', { selectedChurch: item });
      } else if (item.teaching_id || item.container_id) {
        navigation.navigate('MafundishoDetail', { 
          teachingId: item.teaching_id, 
          containerId: item.container_id, 
          mafundisho: item 
        });
      }
    };

    // Horizontal Large Cards (e.g., Featured Albums, Mixes)
    if (layoutStyle === 'horizontal_large') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          {items.map((item, index) => (
            <TouchableOpacity 
              key={item.album_id || item.mix_id || item.song_id || index} 
              style={styles.largeMixCard}
              onPress={() => handleItemPress(item)}
            >
              <Image
                source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/280x150' }}
                style={styles.largeMixImage}
              />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.largeMixGradient}>
                <Text style={styles.largeMixTitle} numberOfLines={1}>{item.title || item.name}</Text>
                <Text style={styles.largeMixSubtitle} numberOfLines={1}>
                  {item.artist_name || item.description || `${item.songs_count || item.song_count || 0} nyimbo`}
                </Text>
              </LinearGradient>
              <TouchableOpacity style={styles.mixPlayButton} onPress={() => handleItemPress(item)}>
                <Ionicons name="play" size={24} color={COLORS.background} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }
    
    // Horizontal Small Cards (Default - Album grid style)
    if (layoutStyle === 'horizontal_small' || layoutStyle === 'horizontal_cards') {
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
          {items.map((item, index) => (
            <TouchableOpacity 
              key={item.album_id || item.mix_id || item.song_id || index} 
              style={styles.smallSquareCard}
              onPress={() => handleItemPress(item)}
            >
              <Image
                source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/120' }}
                style={styles.smallSquareImage}
              />
              <Text style={styles.smallSquareTitle} numberOfLines={1}>{item.title || item.name}</Text>
              <Text style={styles.smallSquareArtist} numberOfLines={1}>{item.artist_name || ''}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      );
    }
    
    // Vertical List (Song list style)
    if (layoutStyle === 'vertical_list') {
      return (
        <View>
          {items.slice(0, 5).map((item, index) => (
            <TouchableOpacity 
              key={item.song_id || item.album_id || index} 
              style={styles.songListItem}
              onPress={() => handleItemPress(item)}
            >
              <Text style={styles.songIndex}>{index + 1}</Text>
              <Image
                source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/48' }}
                style={styles.songImage}
              />
              <View style={styles.songInfo}>
                <Text style={styles.songTitle} numberOfLines={1}>{item.title || item.name}</Text>
                <Text style={styles.songArtist} numberOfLines={1}>{item.artist_name || ''}</Text>
              </View>
              <TouchableOpacity style={styles.songAddButton} onPress={() => handleAddToPlaylist(item)}>
                <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    
    // Grid style (2 column grid)
    if (layoutStyle === 'grid') {
      return (
        <View style={styles.gridContainer}>
          {items.map((item, index) => (
            <TouchableOpacity 
              key={item.album_id || item.mix_id || index} 
              style={styles.gridItem}
              onPress={() => handleItemPress(item)}
            >
              <Image
                source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/150' }}
                style={styles.gridImage}
              />
              <Text style={styles.gridTitle} numberOfLines={1}>{item.title || item.name}</Text>
              <Text style={styles.gridArtist} numberOfLines={1}>{item.artist_name || ''}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    
    // Default: horizontal small cards
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {items.map((item, index) => (
          <TouchableOpacity 
            key={item.album_id || item.mix_id || item.song_id || index} 
            style={styles.smallSquareCard}
            onPress={() => handleItemPress(item)}
          >
            <Image
              source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/120' }}
              style={styles.smallSquareImage}
            />
            <Text style={styles.smallSquareTitle} numberOfLines={1}>{item.title || item.name}</Text>
            <Text style={styles.smallSquareArtist} numberOfLines={1}>{item.artist_name || ''}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Dynamic section renderer - renders sections in layout manager order
  const renderDynamicSection = (section) => {
    if (!section || section.section_type === 'hero') return null; // Hero is rendered separately
    
    const items = section.items || [];
    if (items.length === 0) return null;
    
    const sectionTitle = section.display_name || section.name || 'Section';
    
    return (
      <View key={section.section_id} style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{sectionTitle}</Text>
          {items.length > 4 && (
            <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { 
              type: section.content_type || 'albums', 
              title: sectionTitle,
              sectionId: section.section_id 
            })}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          )}
        </View>
        {renderSectionContent(section, items)}
      </View>
    );
  };

  // Build flat list data for virtualized rendering
  const flatListData = useMemo(() => {
    const sections = [];
    
    // Track which section types have been added from layout manager
    const addedSectionTypes = new Set();
    
    // Header section
    sections.push({ type: 'header', key: 'header' });
    
    // Hero carousel
    if (heroContent?.items?.length > 0) {
      sections.push({ type: 'hero', key: 'hero', data: heroContent });
    }
    
    // Quick Access
    sections.push({ type: 'quickAccess', key: 'quickAccess' });
    
    // (Neno la Leo previously lived here — moved to row #4 below, after the
    // first 3 dynamic content sections, per product requirement.)
    
    // Category Filters
    if (categories.length > 0) {
      sections.push({ type: 'categoryFilters', key: 'categoryFilters', data: categories });
    }
    
    // Dynamic Sections from Layout Manager (excluding "all songs" type sections)
    // These should not include "Nyimbo Zote" which goes at the end
    // Filter out sections with empty/invalid items
    // Also filter out Mafundisho - we'll add it separately to control order
    let dynamicRendered = 0;
    let nenoEmitted = false;
    const NENO_AFTER = 3; // splice Neno after the 3rd dynamic content row → row #4
    layoutSections
      .filter(s => s.section_type !== 'hero' && s.items?.length > 0)
      .filter(s => !s.title?.toLowerCase().includes('nyimbo zote')) // Exclude "Nyimbo Zote" - it goes last
      .filter(s => {
        // Filter out sections that are duplicates of static sections
        const title = s.title?.toLowerCase() || '';
        if (title.includes('biblia') || title.includes('masomo')) return false;
        if (title.includes('radio') || title.includes('redio')) return false;
        if (title.includes('mafundisho') || title.includes('katekesi')) return false; // Exclude - added separately
        return true;
      })
      .filter(s => {
        // Only include sections where items have actual content (not just placeholders)
        const hasValidItems = s.items?.some(item => 
          item.thumbnail || item.thumbnail_url || item.image_url || item.audio_url || item.title
        );
        return hasValidItems;
      })
      .forEach(section => {
        sections.push({ type: 'dynamicSection', key: section.section_id, data: section });
        // Track the section type to avoid duplicates
        if (section.section_type) addedSectionTypes.add(section.section_type);
        dynamicRendered += 1;
        // Inject Neno la Leo right after the 3rd dynamic section so it lands at row #4.
        if (!nenoEmitted && dynamicRendered === NENO_AFTER && nenoLaLeo.length > 0) {
          sections.push({ type: 'nenoLaLeo', key: 'nenoLaLeo', data: nenoLaLeo });
          nenoEmitted = true;
        }
      });
    // Fewer than 3 dynamic sections? Still emit Neno la Leo so it's visible.
    if (!nenoEmitted && nenoLaLeo.length > 0) {
      sections.push({ type: 'nenoLaLeo', key: 'nenoLaLeo', data: nenoLaLeo });
    }
    
    // Special Mixes (only if not already added from layout)
    if (specialMixes.length > 0 && !addedSectionTypes.has('special_mixes')) {
      sections.push({ type: 'specialMixes', key: 'specialMixes', data: specialMixes });
    }
    
    // Most Listened Albums
    if (mostListenedAlbums.length > 0 && !addedSectionTypes.has('most_listened')) {
      sections.push({ type: 'mostListened', key: 'mostListened', data: mostListenedAlbums });
    }
    
    // Hot New Releases
    if (hotNewReleases.length > 0 && !addedSectionTypes.has('hot_releases')) {
      sections.push({ type: 'hotReleases', key: 'hotReleases', data: hotNewReleases });
    }
    
    // Bible Section - only show if not already added from layout sections
    // Check if there's already a bible-related section in layoutSections
    const hasBibleInLayout = layoutSections.some(s => 
      s.section_type === 'bible' || 
      s.title?.toLowerCase().includes('biblia') ||
      s.title?.toLowerCase().includes('masomo')
    );
    if (!addedSectionTypes.has('bible') && !hasBibleInLayout) {
      sections.push({ type: 'bibleSection', key: 'bibleSection', data: bibleSnippets });
    }
    
    // Churches
    if (churches.length > 0 && !addedSectionTypes.has('churches')) {
      sections.push({ type: 'churches', key: 'churches', data: churches });
    }
    
    // Popular Songs (Nyimbo Maarufu)
    if (allSongs.length > 0 && !addedSectionTypes.has('popular_songs')) {
      sections.push({ type: 'popularSongs', key: 'popularSongs', data: allSongs });
    }
    
    // Radio Stations - MOVED HERE (after Nyimbo za kusifu sections from dynamic content)
    if (radioStations.length > 0 && !addedSectionTypes.has('radio')) {
      // Only show radio section if stations have favicon images
      const validRadioStations = radioStations.filter(s => s.favicon || s.name);
      if (validRadioStations.length > 0) {
        sections.push({ type: 'radioStations', key: 'radioStations', data: validRadioStations });
      }
    }
    
    // Mafundisho na Katekesi - ADD ONCE at the end (before Nyimbo Zote)
    if (mafundishoContent.length > 0 && !addedSectionTypes.has('mafundisho')) {
      sections.push({ type: 'mafundisho', key: 'mafundisho', data: mafundishoContent });
      addedSectionTypes.add('mafundisho');
    }
    
    // All Albums (Nyimbo Zote) - THIS IS THE LAST CONTENT SECTION
    if (recentAlbums.length > 0) {
      sections.push({ type: 'allAlbums', key: 'allAlbums', data: recentAlbums });
    }
    
    // "Nyimbo Zote" from layout manager if exists - add at the very end
    const nyimboZoteSection = layoutSections.find(s => s.title?.toLowerCase().includes('nyimbo zote') && s.items?.length > 0);
    if (nyimboZoteSection) {
      sections.push({ type: 'dynamicSection', key: 'nyimbo_zote_final', data: nyimboZoteSection });
    }
    
    // No content fallback
    if (recentAlbums.length === 0 && specialMixes.length === 0 && churches.length === 0) {
      sections.push({ type: 'noContent', key: 'noContent' });
    }
    
    // Bottom spacer - THE END
    sections.push({ type: 'spacer', key: 'spacer' });
    
    return sections;
  }, [heroContent, categories, mafundishoContent, layoutSections, specialMixes, radioStations, 
      mostListenedAlbums, hotNewReleases, bibleSnippets, churches, allSongs, recentAlbums, nenoLaLeo]);

  // Render item for FlatList
  const renderFlatListItem = useCallback(({ item }) => {
    switch (item.type) {
      case 'header':
        return (
          <View style={styles.header}>
            <Text style={styles.greeting}>{greeting}</Text>
            <View style={styles.headerIcons}>
              <TouchableOpacity style={styles.headerIcon}>
                <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('Profile')}>
                <Ionicons name="person-circle-outline" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>
        );
      
      case 'hero':
        return renderHeroSection(item.data);
      
      case 'quickAccess':
        return renderQuickAccessSection();
      
      case 'categoryFilters':
        return renderCategoryFilters(item.data);
      
      case 'mafundisho':
        return renderMafundishoSection(item.data);
      
      case 'nenoLaLeo':
        return renderNenoLaLeoSection(item.data);
      
      case 'dynamicSection':
        return renderDynamicSection(item.data);
      
      case 'specialMixes':
        return renderSpecialMixesSection(item.data);
      
      case 'radioStations':
        return renderRadioSection(item.data);
      
      case 'mostListened':
        return renderMostListenedSection(item.data);
      
      case 'hotReleases':
        return renderHotReleasesSection(item.data);
      
      case 'bibleSection':
        return renderBibleSection(item.data);
      
      case 'churches':
        return renderChurchesSection(item.data);
      
      case 'popularSongs':
        return renderPopularSongsSection(item.data);
      
      case 'allAlbums':
        return renderAllAlbumsSection(item.data);
      
      case 'noContent':
        return renderNoContentSection();
      
      case 'spacer':
        return <View style={{ height: 150 }} />;
      
      default:
        return null;
    }
  }, [greeting, navigation, heroContent, categories, userPlaylists, recentAlbums, user, 
      mafundishoContent, specialMixes, radioStations, mostListenedAlbums, hotNewReleases,
      bibleSnippets, churches, allSongs, currentTrack, isPlaying, activeCategory]);

  // Helper render functions for FlatList sections
  const renderHeroSection = (heroData) => {
    if (!heroData?.items?.length) return null;
    return (
      <View style={styles.heroSection}>
        <ScrollView
          ref={heroScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleHeroScroll}
          contentContainerStyle={styles.heroScrollContent}
        >
          {heroData.items.map((item, index) => {
            const thumbnailUrl = item.thumbnail || item.thumbnail_url || item.image_url || item.cover_image;
            const hasImage = thumbnailUrl && thumbnailUrl.length > 0;
            const gradientColors = [
              ['#667eea', '#764ba2'],
              ['#f093fb', '#f5576c'],
              ['#4facfe', '#00f2fe'],
              ['#43e97b', '#38f9d7'],
              ['#fa709a', '#fee140'],
              ['#30cfd0', '#330867'],
            ];
            const colorIndex = index % gradientColors.length;
            
            return (
              <TouchableOpacity 
                key={item.album_id || item.mix_id || item.banner_id || `hero-${index}`}
                style={styles.heroContainer}
                onPress={() => handleHeroPress(item)}
                activeOpacity={0.9}
              >
                {hasImage ? (
                  <ImageBackground
                    source={{ uri: getImageUrl(thumbnailUrl) }}
                    style={styles.heroImage}
                    imageStyle={styles.heroImageStyle}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.7)', COLORS.background]}
                      style={styles.heroGradient}
                    >
                      <Text style={styles.heroLabel}>FEATURED</Text>
                      <Text style={styles.heroTitle} numberOfLines={2}>{item.title || item.name}</Text>
                      <Text style={styles.heroSubtitle} numberOfLines={1}>
                        {item.artist_name || item.subtitle || item.description || 'Curated for you'}
                      </Text>
                      <View style={styles.heroButtons}>
                        <TouchableOpacity style={styles.heroPlayButton} onPress={() => handleHeroPress(item)}>
                          <Ionicons name="play" size={20} color={COLORS.background} />
                          <Text style={styles.heroPlayText}>Cheza</Text>
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </ImageBackground>
                ) : (
                  <LinearGradient
                    colors={gradientColors[colorIndex]}
                    style={[styles.heroImage, styles.heroImageStyle]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.5)', COLORS.background]}
                      style={styles.heroGradient}
                    >
                      <Text style={styles.heroLabel}>FEATURED</Text>
                      <Text style={styles.heroTitle} numberOfLines={2}>{item.title || item.name}</Text>
                      <Text style={styles.heroSubtitle} numberOfLines={1}>
                        {item.artist_name || item.subtitle || 'Curated for you'}
                      </Text>
                      <View style={styles.heroButtons}>
                        <TouchableOpacity style={styles.heroPlayButton} onPress={() => handleHeroPress(item)}>
                          <Ionicons name="play" size={20} color={COLORS.background} />
                          <Text style={styles.heroPlayText}>Cheza</Text>
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {heroData.items.length > 1 && (
          <View style={styles.heroPagination}>
            {heroData.items.map((_, index) => (
              <View key={index} style={[styles.heroDot, currentHeroIndex === index && styles.heroDotActive]} />
            ))}
          </View>
        )}
      </View>
    );
  };

  // ============ Quick Access Tile (Spotify-style, matches web) ============
  // A small horizontal pill: thumbnail/icon on the left, name + optional count
  // on the right. Mirrors the QuickAccessCard component in UserStreamingApp.jsx.
  const renderQuickAccessTile = (cfg) => {
    const {
      key,
      onPress,
      thumbnail,
      iconName,
      iconColors,
      title,
      subtitle,
    } = cfg;
    return (
      <TouchableOpacity
        key={key}
        style={styles.quickAccessItem}
        onPress={onPress}
        activeOpacity={0.6}
        delayPressIn={0}
        data-testid={`quick-${key}`}
      >
        {thumbnail ? (
          <ExpoImage
            source={thumbnail}
            style={styles.quickAccessImage}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
          />
        ) : (
          <LinearGradient colors={iconColors || ['#5D3FD3', '#7B68EE']} style={styles.quickAccessIcon}>
            <Ionicons name={iconName || 'musical-notes'} size={22} color={COLORS.text} />
          </LinearGradient>
        )}
        <View style={styles.quickAccessTextWrap}>
          <Text style={styles.quickAccessText} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={styles.quickAccessSubtext} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderQuickAccessSection = () => {
    // 3 USER tiles (Spotify-style): Liked / Playlists / Downloads.
    const userTiles = [
      {
        key: 'liked_songs',
        title: 'Nyimbo Pendwa',
        iconName: 'heart',
        iconColors: ['#a855f7', '#d946ef'],
        onPress: () => navigation.navigate('Library', { tab: 'liked' }),
      },
      {
        key: 'playlists',
        title: 'Playlists',
        iconName: 'list',
        iconColors: ['#f97316', '#f59e0b'],
        onPress: () => navigation.navigate('Library', { tab: 'playlists' }),
      },
      {
        key: 'downloads',
        title: 'Zilizopakuwa',
        iconName: 'download',
        iconColors: ['#3b82f6', '#16a34a'],
        onPress: () => navigation.navigate('Library', { tab: 'downloads' }),
      },
    ];

    // Top-3 STREAMED categories from `songCategoriesWithCounts` (backend
    // returns these sorted by total_plays DESC — Kisifu / Kwaresma / Pasaka).
    // Skip empty categories so we never show a "0 nyimbo" tile.
    let adminItems = [];
    if (Array.isArray(quickAccessConfig) && quickAccessConfig.length > 0) {
      adminItems = quickAccessConfig.slice(0, 3);
    } else if (Array.isArray(songCategoriesWithCounts) && songCategoriesWithCounts.length > 0) {
      adminItems = songCategoriesWithCounts
        .filter(c => (c.total_songs === undefined) || c.total_songs > 0)
        .slice(0, 3);
    }

    // Build a {id → total_songs} map so we can decorate admin items that came
    // from the layout config (which doesn't include counts).
    const countsMap = {};
    for (const c of songCategoriesWithCounts) {
      const id = c.song_category_id || c.category_id;
      if (id && typeof c.total_songs === 'number') countsMap[id] = c.total_songs;
    }

    const adminTiles = adminItems.map((item, i) => {
      const id = item.category_id || item.song_category_id || item.album_id || item.id;
      const total = typeof item.total_songs === 'number'
        ? item.total_songs
        : (id && countsMap[id]);
      const displayName = item.name_sw || item.name || item.title || 'Category';
      const thumb = item.thumbnail || item.cover_image;
      return {
        key: id || `admin-${i}`,
        title: displayName,
        subtitle: typeof total === 'number' && total > 0 ? `${total} nyimbo` : undefined,
        thumbnail: thumb ? getImageUrl(thumb) : null,
        iconName: 'musical-notes',
        iconColors: ['#1DB954', '#169c46'],
        onPress: () => {
          if (item.category_id || item.song_category_id) {
            navigation.navigate('CategorySongs', {
              categoryId: item.category_id || item.song_category_id,
              categoryName: displayName,
              coverHint: thumb,
              totalHint: total,
            });
          } else if (item.album_id) {
            handleAlbumPress(item);
          } else if (item.mix_id) {
            handleMixPress(item);
          }
        },
      };
    });

    // 6 total tiles = 3 user + 3 top-streamed categories.
    const tiles = [...userTiles, ...adminTiles];

    return (
      <View style={styles.quickAccessContainer}>
        {tiles.map(renderQuickAccessTile)}
      </View>
    );
  };

  const renderCategoryFilters = (cats) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFiltersContainer} contentContainerStyle={styles.categoryFiltersContent}>
      {user?.name && (
        <TouchableOpacity style={styles.userFilterButton} onPress={() => setActiveCategory('all')}>
          <Text style={styles.userFilterText}>{user.name.charAt(0).toUpperCase()}</Text>
        </TouchableOpacity>
      )}
      {cats.map((category) => (
        <TouchableOpacity
          key={category.id}
          style={[styles.categoryFilterChip, activeCategory === category.id && styles.categoryFilterChipActive]}
          onPress={() => handleCategoryFilter(category)}
        >
          <Text style={[styles.categoryFilterText, activeCategory === category.id && styles.categoryFilterTextActive]}>{category.name_sw || category.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderMafundishoSection = (data) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mafundisho na Katekesi</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'mafundisho', title: 'Mafundisho na Katekesi' })}>
          <Text style={styles.seeAll}>Ona zote</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {data.map((item) => (
          <TouchableOpacity key={item.teaching_id || item.container_id} style={styles.mafundishoCard} activeOpacity={0.9}
            onPress={() => navigation.navigate('MafundishoDetail', { teachingId: item.teaching_id, containerId: item.container_id, mafundisho: item })}>
            <View style={styles.mafundishoBand}><Text style={styles.mafundishoBandText}>MAFUNDISHO</Text></View>
            <Image source={{ uri: getImageUrl(item.thumbnail || item.leader_photo) || 'https://via.placeholder.com/200' }} style={styles.mafundishoImage} />
            <View style={styles.mafundishoInfo}>
              <Text style={styles.mafundishoTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.mafundishoDesc} numberOfLines={1}>na {item.leader_name || 'Unknown'}</Text>
              <Text style={styles.mafundishoEpisodes}>{item.topic_count || 0} mada • {item.lesson_count || 0} sehemu</Text>
              <View style={styles.mafundishoActions}>
                <TouchableOpacity style={styles.mafundishoAddBtn}>
                  <Ionicons name="list-outline" size={28} color={COLORS.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.mafundishoPlayBtn}>
                  <Ionicons name="play" size={24} color={COLORS.background} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderNenoLaLeoSection = (data) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Neno la Leo</Text>
      </View>
      <Text style={{ color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, paddingHorizontal: SPACING.md, marginTop: -SPACING.sm, marginBottom: SPACING.sm }}>
        Tafakari za kila siku kutoka kwa viongozi wa dini
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {data.map((neno) => (
          <TouchableOpacity
            key={neno.neno_id}
            style={styles.nenoCard}
            activeOpacity={0.85}
            onPress={async () => {
              const url = neno.reading_audio_url || neno.reflection_audio_url;
              if (!url) return;
              const audioType = neno.reading_audio_url ? 'reading' : 'reflection';
              try {
                await nenoLaLeoAPI.trackPlay(neno.neno_id, audioType);
              } catch {}
              // Use the player to play the audio as a song-like object
              if (playTrack) {
                playTrack({
                  song_id: neno.neno_id,
                  title: neno.verse_reference,
                  artist: `${neno.leader?.title || ''} ${neno.leader?.name || ''}`.trim() || 'Neno la Leo',
                  thumbnail: neno.leader?.photo_url || null,
                  audio_url: url,
                  duration: 0,
                  is_neno_la_leo: true,
                });
              }
            }}
          >
            <LinearGradient colors={['rgba(139,92,246,0.25)', 'rgba(0,0,0,0.6)']} style={styles.nenoCardGradient}>
              <View style={styles.nenoCardHeader}>
                <View style={styles.nenoDayBadge}>
                  <Text style={styles.nenoDayBadgeText}>{neno.word_day_name}</Text>
                </View>
                <Ionicons name="play-circle" size={26} color="#a78bfa" />
              </View>
              <Text style={styles.nenoVerseRef} numberOfLines={2}>{neno.verse_reference}</Text>
              <Text style={styles.nenoDate}>{neno.word_date}</Text>
              <View style={styles.nenoLeaderRow}>
                {neno.leader?.photo_url ? (
                  <Image source={{ uri: neno.leader.photo_url }} style={styles.nenoLeaderAvatar} />
                ) : (
                  <View style={styles.nenoLeaderAvatarPlaceholder}>
                    <Text style={styles.nenoLeaderAvatarText}>{(neno.leader?.name || '?').charAt(0)}</Text>
                  </View>
                )}
                <Text style={styles.nenoLeaderName} numberOfLines={1}>
                  {neno.leader_display || `${neno.leader?.title || ''} ${neno.leader?.name || ''}`.trim()}
                </Text>
              </View>
              <View style={styles.nenoAudioBadges}>
                {neno.reading_audio_url && (
                  <Text style={[styles.nenoAudioBadge, { color: '#34d399' }]}>● Usomaji</Text>
                )}
                {neno.reflection_audio_url && (
                  <Text style={[styles.nenoAudioBadge, { color: '#a78bfa' }]}>● Tafakari</Text>
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderSpecialMixesSection = (data) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mchanganyiko Maalumu</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'mixes', title: 'Mchanganyiko Maalumu' })}>
          <Text style={styles.seeAll}>Ona zote</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {data.map((mix) => (
          <TouchableOpacity key={mix.mix_id} style={styles.largeMixCard} onPress={() => handleMixPress(mix)}>
            <Image source={{ uri: getImageUrl(mix.thumbnail) || 'https://via.placeholder.com/280x150' }} style={styles.largeMixImage} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.largeMixGradient}>
              <Text style={styles.largeMixTitle} numberOfLines={1}>{mix.title || mix.name}</Text>
              <Text style={styles.largeMixSubtitle} numberOfLines={1}>{mix.songs_count || mix.songs?.length || 0} nyimbo</Text>
            </LinearGradient>
            <TouchableOpacity style={styles.mixPlayButton} onPress={() => handlePlayMix(mix)}>
              <Ionicons name="play" size={24} color={COLORS.background} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderRadioSection = (data) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderWithIcon}>
          <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
            <Ionicons name="radio" size={18} color="#8B5CF6" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Redio za Kikristo</Text>
            <Text style={styles.sectionSubtitleText}>Sikiliza mubashara</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Radio')}>
          <Text style={styles.seeAll}>Ona zote</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {data.slice(0, 6).map((station) => {
          const isCurrentlyPlaying = currentTrack?.isRadio && currentTrack?.song_id === station.station_id && isPlaying;
          return (
            <TouchableOpacity key={station.station_id} style={[styles.radioCard, isCurrentlyPlaying && styles.radioCardActive]} onPress={() => playRadio(station)}>
              <View style={[styles.radioLogoContainer, isCurrentlyPlaying && styles.radioLogoActive]}>
                {station.favicon ? (
                  <Image source={{ uri: station.favicon }} style={styles.radioLogo} />
                ) : (
                  <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.radioLogoPlaceholder}>
                    <Ionicons name="radio" size={24} color={COLORS.text} />
                  </LinearGradient>
                )}
                {isCurrentlyPlaying && <View style={styles.radioPlayingIndicator}><View style={styles.radioPlayingDot} /></View>}
              </View>
              <Text style={styles.radioName} numberOfLines={1}>{station.name}</Text>
              <Text style={styles.radioCountry} numberOfLines={1}>{station.country}</Text>
              <View style={[styles.radioPlayButton, isCurrentlyPlaying && styles.radioPlayButtonActive]}>
                <Ionicons name={isCurrentlyPlaying ? "pause" : "play"} size={16} color={isCurrentlyPlaying ? "#8B5CF6" : COLORS.text} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderMostListenedSection = (data) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Album Zinazosikilizwa Zaidi</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'albums', title: 'Album Zinazosikilizwa Zaidi' })}>
          <Text style={styles.seeAll}>Ona zote</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {data.map((album, index) => renderAlbumCard(album, index))}
      </ScrollView>
    </View>
  );

  const renderHotReleasesSection = (data) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Mpya za Moto 🔥</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'albums', title: 'Mpya za Moto' })}>
          <Text style={styles.seeAll}>Ona zote</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {data.map((album, index) => renderAlbumCard(album, index))}
      </ScrollView>
    </View>
  );

  const renderBibleSection = (snippets) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderWithIcon}>
          <View style={styles.sectionIconBadge}><Ionicons name="book" size={20} color="#f97316" /></View>
          <View>
            <Text style={styles.sectionTitle}>Biblia na Masomo</Text>
            <Text style={styles.sectionSubtitleText}>Sikiliza Neno la Mungu</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Bible')}><Text style={styles.seeAll}>Ona yote</Text></TouchableOpacity>
      </View>
      <View style={styles.bibleTwoCardsRow}>
        <TouchableOpacity style={styles.bibleColorCard} onPress={() => navigation.navigate('Bible')} activeOpacity={0.85}>
          <LinearGradient colors={['#ea580c', '#f97316', '#fb923c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bibleColorGradient}>
            <View style={styles.bibleCardIconWrap}><Ionicons name="book-outline" size={28} color="rgba(255,255,255,0.9)" /></View>
            <Text style={styles.bibleColorTitle}>Biblia</Text>
            <Text style={styles.bibleColorSubtitle}>Agano Jipya • Kiswahili</Text>
            <Text style={styles.bibleColorDesc}>Soma na Sikiliza Neno</Text>
            <View style={styles.bibleColorButton}><Ionicons name="headset" size={14} color="#333" /><Text style={styles.bibleColorButtonText}>Fungua</Text></View>
          </LinearGradient>
        </TouchableOpacity>
        {snippets?.length > 0 ? (
          <TouchableOpacity style={styles.bibleColorCard} onPress={() => navigation.navigate('Bible', { snippet: snippets[0] })} activeOpacity={0.85}>
            <LinearGradient colors={['#7c3aed', '#8b5cf6', '#a78bfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bibleColorGradient}>
              <View style={styles.featuredSnippetBadge}><Text style={styles.featuredSnippetBadgeText}>FEATURED</Text></View>
              <Text style={styles.snippetLabelSmall}>SOMO LA LEO</Text>
              <Text style={styles.bibleColorTitle} numberOfLines={1}>{snippets[0].reference || snippets[0].title}</Text>
              <Text style={styles.bibleColorDesc} numberOfLines={2}>{snippets[0].description || snippets[0].subtitle}</Text>
              <View style={styles.bibleColorButton}><Ionicons name="headset" size={14} color="#333" /><Text style={styles.bibleColorButtonText}>Sikiliza</Text></View>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.bibleColorCard} onPress={() => navigation.navigate('Bible')} activeOpacity={0.85}>
            <LinearGradient colors={['#7c3aed', '#8b5cf6', '#a78bfa']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bibleColorGradient}>
              <View style={styles.bibleCardIconWrap}><Ionicons name="sparkles" size={28} color="rgba(255,255,255,0.9)" /></View>
              <Text style={styles.bibleColorTitle}>Masomo</Text>
              <Text style={styles.bibleColorSubtitle}>Mafundisho</Text>
              <Text style={styles.bibleColorDesc}>Sikiliza mafundisho ya Biblia</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderChurchesSection = (data) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Makanisa</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'churches', title: 'Makanisa Yote' })}>
          <Text style={styles.seeAll}>Ona zote</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {data.slice(0, 6).map((church) => (
          <TouchableOpacity key={church.church_id} style={styles.churchCard} onPress={() => navigation.navigate('Churches', { selectedChurch: church })}>
            <Image source={{ uri: getImageUrl(church.thumbnail) || 'https://via.placeholder.com/140?text=Kanisa' }} style={styles.churchImage} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.churchGradient}>
              <Ionicons name="business" size={16} color={COLORS.primary} style={styles.churchIcon} />
              <Text style={styles.churchName} numberOfLines={2}>{church.name}</Text>
              <Text style={styles.churchLocation} numberOfLines={1}>{church.location || church.city}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderPopularSongsSection = (data) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Nyimbo Maarufu</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'songs', title: 'Nyimbo Maarufu' })}>
          <Text style={styles.seeAll}>Ona zote</Text>
        </TouchableOpacity>
      </View>
      {data.slice(0, 5).map((song, index) => (
        <TouchableOpacity key={song.song_id} style={styles.songListItem} onPress={() => handlePlaySong(song, data)}>
          <Text style={[styles.songIndex, currentTrack?.song_id === song.song_id && styles.songIndexActive]}>
            {currentTrack?.song_id === song.song_id ? <Ionicons name="musical-note" size={14} color={COLORS.primary} /> : index + 1}
          </Text>
          <Image source={{ uri: getImageUrl(song.thumbnail || song.thumbnail_url) || 'https://via.placeholder.com/48' }} style={styles.songImage} />
          <View style={styles.songInfo}>
            <Text style={[styles.songTitle, currentTrack?.song_id === song.song_id && styles.songTitleActive]} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.songArtist} numberOfLines={1}>{song.artist_name}</Text>
          </View>
          <TouchableOpacity style={styles.songAddButton} onPress={() => handleAddToPlaylist(song)}>
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderAllAlbumsSection = (data) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Albums Zote</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'albums', title: 'Albums Zote' })}>
          <Text style={styles.seeAll}>Ona zote</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {data.map((album, index) => renderAlbumCard(album, index))}
      </ScrollView>
    </View>
  );

  const renderNoContentSection = () => (
    <View style={styles.noContentContainer}>
      <Ionicons name="cloud-offline-outline" size={64} color={COLORS.textSecondary} />
      <Text style={styles.noContentTitle}>Hakuna Maudhui</Text>
      <Text style={styles.noContentText}>Hatuwezi kupakia maudhui. Tafadhali angalia muunganisho wako wa mtandao na ujaribu tena.</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
        <Ionicons name="refresh" size={20} color={COLORS.text} />
        <Text style={styles.retryButtonText}>Jaribu Tena</Text>
      </TouchableOpacity>
    </View>
  );

  // No blocking full-screen loader — the FlatList shell always renders on
  // the very first frame with cached (or empty) data. Any spinner would
  // add perceived latency for no benefit.

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={flatListData}
        renderItem={renderFlatListItem}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={5}
        updateCellsBatchingPeriod={50}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        getItemLayout={(data, index) => ({
          length: 200, // Approximate item height
          offset: 200 * index,
          index,
        })}
      />

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={selectedSong}
        isAuthenticated={isAuthenticated}
      />
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  // Dynamic Section Container
  sectionContainer: {
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  greeting: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginLeft: SPACING.md,
    padding: SPACING.xs,
  },

  // Hero Carousel Section
  heroSection: {
    marginBottom: SPACING.lg,
  },
  heroScrollContent: {
    paddingHorizontal: SPACING.md,
  },
  heroContainer: {
    width: HERO_WIDTH,
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 220,
  },
  heroImageStyle: {
    borderRadius: BORDER_RADIUS.lg,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: SPACING.lg,
  },
  heroLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: SPACING.xs,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  heroButtons: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  heroPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  heroPlayText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
    marginLeft: SPACING.xs,
  },
  heroPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textMuted,
    marginHorizontal: 4,
  },
  heroDotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },

  // Quick Access Grid - 8 items (4 per row)
  quickAccessContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
  },
  quickAccessItem: {
    width: CARD_WIDTH,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.sm,
    margin: SPACING.xs,
    overflow: 'hidden',
  },
  quickAccessIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessImage: {
    width: 44,
    height: 44,
  },
  quickAccessText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  quickAccessTextWrap: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
    justifyContent: 'center',
  },
  quickAccessSubtext: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 1,
  },

  // Category Filters - Spotify style
  categoryFiltersContainer: {
    marginBottom: SPACING.md,
  },
  categoryFiltersContent: {
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  userFilterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  userFilterText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  categoryFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.sm,
  },
  categoryFilterChipActive: {
    backgroundColor: COLORS.primary,
  },
  categoryFilterIcon: {
    marginRight: SPACING.xs,
  },
  categoryFilterText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  categoryFilterTextActive: {
    color: COLORS.background,
  },

  // Mafundisho na Katekesi - Spotify "Picked for you" Style
  mafundishoCard: {
    width: 320,
    height: 180,
    marginRight: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  mafundishoBand: {
    width: 32,
    backgroundColor: '#7B2CBF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mafundishoBandText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: 'bold',
    transform: [{ rotate: '-90deg' }],
    width: 100,
    textAlign: 'center',
    letterSpacing: 2,
  },
  mafundishoImage: {
    width: 130,
    height: '100%',
  },
  mafundishoInfo: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'center',
  },
  mafundishoType: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  mafundishoTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  mafundishoDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  mafundishoEpisodes: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  mafundishoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  mafundishoAddBtn: {
    marginRight: SPACING.md,
  },
  mafundishoPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mafundishoMenu: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
  },

  // Section Styles
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  seeAll: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  horizontalList: {
    paddingHorizontal: SPACING.md,
  },

  // Large Mix Cards with Play Button
  largeMixCard: {
    width: 280,
    height: 150,
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  largeMixImage: {
    width: '100%',
    height: '100%',
  },
  largeMixGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
  },
  largeMixTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  largeMixSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  mixPlayButton: {
    position: 'absolute',
    bottom: SPACING.md,
    right: SPACING.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Radio Section Styles
  radioCard: {
    width: 110,
    marginRight: SPACING.sm,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'transparent',
  },
  radioCardActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  radioLogoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  radioLogoActive: {
    borderColor: '#8B5CF6',
    borderWidth: 3,
  },
  radioLogo: {
    width: '100%',
    height: '100%',
  },
  radioLogoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioPlayingIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioPlayingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.text,
  },
  radioName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  radioCountry: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  radioPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioPlayButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },

  // Bible Section - Enhanced Colorful Tiles
  sectionHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionSubtitleText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  bibleTwoCardsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  bibleColorCard: {
    flex: 1,
    height: 180,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  bibleColorGradient: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  bibleCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bibleColorTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: '#fff',
  },
  bibleColorSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  bibleColorDesc: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  bibleColorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    marginTop: SPACING.sm,
  },
  bibleColorButtonText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: '#333',
  },
  featuredSnippetBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  featuredSnippetBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#000',
  },
  snippetLabelSmall: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  moreSnippetsContainer: {
    paddingHorizontal: SPACING.md,
  },
  moreSnippetsLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  moreSnippetsScroll: {
    paddingRight: SPACING.md,
  },
  miniSnippetCard: {
    width: 140,
    height: 100,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  miniSnippetGradient: {
    flex: 1,
    padding: SPACING.sm,
    justifyContent: 'space-between',
  },
  miniSnippetTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: '#fff',
  },
  miniSnippetDesc: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  miniSnippetPlayIcon: {
    alignSelf: 'flex-end',
  },
  // Legacy styles kept for compatibility
  bibleRow: {
    paddingHorizontal: SPACING.md,
  },
  bibleMainCard: {
    width: 160,
    height: 180,
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  bibleMainGradient: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bibleMainTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  bibleMainSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bibleMainMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  bibleMainMetaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
  },
  snippetCard: {
    width: 140,
    height: 180,
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  snippetGradient: {
    flex: 1,
    padding: SPACING.md,
  },
  snippetTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  snippetVerse: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },

  // Churches Section
  churchCard: {
    width: 140,
    height: 180,
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  churchImage: {
    width: '100%',
    height: '100%',
  },
  churchGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    padding: SPACING.sm,
    justifyContent: 'flex-end',
  },
  churchIcon: {
    marginBottom: 4,
  },
  churchName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  churchLocation: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Small Square Cards (Albums)
  smallSquareCard: {
    width: 120,
    marginRight: SPACING.md,
  },
  albumImageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  smallSquareImage: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
  },
  albumTagBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  liveBadgeContainer: {
    position: 'absolute',
    bottom: 6,
    left: 6,
  },
  albumTagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  albumTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  smallSquareTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  smallSquareArtist: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Song List
  songListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  songIndex: {
    width: 24,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  songIndexActive: {
    color: COLORS.primary,
  },
  songImage: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.card,
  },
  songInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  songTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  songTitleActive: {
    color: COLORS.primary,
  },
  songArtist: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  songAddButton: {
    padding: SPACING.sm,
  },

  // Grid Layout Styles
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: (width - SPACING.md * 3) / 2,
    marginBottom: SPACING.md,
  },
  gridImage: {
    width: '100%',
    height: (width - SPACING.md * 3) / 2,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
  },
  gridTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  gridArtist: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  
  // No Content Fallback
  noContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
    paddingHorizontal: SPACING.lg,
  },
  noContentTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  noContentText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 25,
    marginTop: SPACING.lg,
  },
  retryButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  // Neno la Leo styles
  nenoCard: {
    width: 230,
    marginRight: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  nenoCardGradient: {
    padding: SPACING.md,
    minHeight: 180,
  },
  nenoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  nenoDayBadge: {
    backgroundColor: 'rgba(139,92,246,0.25)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  nenoDayBadgeText: {
    color: '#c4b5fd',
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  nenoVerseRef: {
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  nenoDate: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginBottom: SPACING.sm,
  },
  nenoLeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139,92,246,0.2)',
  },
  nenoLeaderAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: SPACING.xs,
  },
  nenoLeaderAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: SPACING.xs,
    backgroundColor: 'rgba(139,92,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nenoLeaderAvatarText: {
    color: '#ddd6fe',
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
  },
  nenoLeaderName: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xs,
    flex: 1,
  },
  nenoAudioBadges: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  nenoAudioBadge: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default HomeScreen;
