import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
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
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { homeAPI, contentAPI, libraryAPI, bibleAPI, churchAPI, leaderContentAPI, getImageUrl, radioAPI, geoAPI } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useGeo } from '../context/GeoContext';
import { useBilling } from '../context/BillingContext';
import AddToPlaylistModal from '../components/AddToPlaylistModal';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.md * 3) / 2;
const HERO_WIDTH = width - SPACING.md * 2;

const HomeScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');
  
  // Layout Manager Data
  const [layoutSections, setLayoutSections] = useState([]);
  const [heroContent, setHeroContent] = useState({ items: [] });
  const [quickAccessConfig, setQuickAccessConfig] = useState([]);
  
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
    loadData();
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

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Use geo-filtered home endpoint if geo is enabled
      const useGeoFiltering = geoEnabled && userCountry && userCountry !== 'GLOBAL';
      
      const [
        // Use unified home endpoint that returns sections with content in correct order
        homeRes,
        playlistsRes, 
        likesRes,
        filtersRes,
        tagsRes,
        radioRes,
        geoAlbumsRes,
      ] = await Promise.all([
        // Get home data with sections, hero, and burners in correct layout order
        homeAPI.getAppHome().catch(() => ({ data: { sections: [], hero: { items: [] }, burners: [] } })),
        libraryAPI.getPlaylists().catch(() => ({ data: [] })),
        libraryAPI.getLikedSongs().catch(() => ({ data: [] })),
        homeAPI.getHomeFilters().catch(() => ({ data: { filters: [] } })),
        homeAPI.getTags().catch(() => ({ data: { tags: [] } })),
        radioAPI.getStations().catch(() => ({ data: { stations: [] } })),
        // Get geo-filtered albums if geo-filtering is enabled
        useGeoFiltering 
          ? geoAPI.getLocalizedFeed(userCountry, 'albums').catch(() => ({ data: { albums: [] } }))
          : Promise.resolve({ data: { albums: [] } }),
      ]);

      // Album Tags
      const tags = tagsRes.data?.tags || [];
      setAvailableTags(tags);

      // Extract data from unified home response
      const homeData = homeRes.data || {};
      const rawSections = homeData.sections || [];
      const heroData = homeData.hero || { items: [] };
      const burnersData = homeData.burners || [];
      
      // Filter active sections (they should already be filtered by backend, but double-check)
      const activeSections = rawSections.filter(s => s.is_active !== false);
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

      // Set content from unified response
      setSpecialMixes(mixes);
      setRecentAlbums(finalAlbums);

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
      setAllSongs(songsWithThumbnails);

      // User playlists
      const playlists = playlistsRes.data || [];
      setUserPlaylists(Array.isArray(playlists) ? playlists : []);

      // Liked songs
      const likes = likesRes.data?.songs || likesRes.data || [];
      setLikedSongsCount(Array.isArray(likes) ? likes.length : 0);

      // Set content from unified response
      setBibleSnippets(Array.isArray(snippets) ? snippets : []);
      setChurches(Array.isArray(churches) ? churches : []);
      setMafundishoContent(Array.isArray(mafundisho) ? mafundisho : []);

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
      // Silent error handling - app will show empty sections gracefully
    } finally {
      setLoading(false);
    }
  };

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
    if (mostListenedSection?.content_items?.length > 0) {
      setMostListenedAlbums(mostListenedSection.content_items);
    } else {
      setMostListenedAlbums(albums.slice(0, 6));
    }

    // Hot new releases - always use albums as fallback
    const hotSection = sections.find(s => 
      s.name?.toLowerCase().includes('moto') ||
      s.name?.toLowerCase().includes('mpya') ||
      s.section_type === 'cta'
    );
    if (hotSection?.content_items?.length > 0) {
      setHotNewReleases(hotSection.content_items);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.textSecondary, marginTop: 10 }}>Loading content...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Header */}
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

        {/* Hero Carousel - Layout Manager Controlled */}
        {heroContent?.items?.length > 0 && (
          <View style={styles.heroSection}>
            <ScrollView
              ref={heroScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleHeroScroll}
              contentContainerStyle={styles.heroScrollContent}
            >
              {heroContent.items.map((item, index) => {
                // Get the best available thumbnail URL
                const thumbnailUrl = item.thumbnail || item.thumbnail_url || item.image_url || item.cover_image;
                const hasImage = thumbnailUrl && thumbnailUrl.length > 0;
                
                // Default placeholder with gradient colors based on index
                const gradientColors = [
                  ['#667eea', '#764ba2'], // Purple-pink
                  ['#f093fb', '#f5576c'], // Pink-red
                  ['#4facfe', '#00f2fe'], // Blue-cyan
                  ['#43e97b', '#38f9d7'], // Green-teal
                  ['#fa709a', '#fee140'], // Pink-yellow
                  ['#30cfd0', '#330867'], // Cyan-purple
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
                        defaultSource={{ uri: 'https://via.placeholder.com/400x200/333/fff?text=Loading...' }}
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
                            {item.artist_name || item.subtitle || item.description || 'Curated for you'}
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
            {/* Pagination Dots */}
            {heroContent.items.length > 1 && (
              <View style={styles.heroPagination}>
                {heroContent.items.map((_, index) => (
                  <View 
                    key={index} 
                    style={[styles.heroDot, currentHeroIndex === index && styles.heroDotActive]} 
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Quick Access Grid - 8 items (4 on each row) - Layout Manager Controlled */}
        <View style={styles.quickAccessContainer}>
          {/* Row 1: Liked Songs, User Playlist 1, Downloads, User Playlist 2 */}
          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Library', { tab: 'liked' })}
          >
            <LinearGradient colors={['#5D3FD3', '#7B68EE']} style={styles.quickAccessIcon}>
              <Ionicons name="heart" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Nyimbo Pendwa</Text>
          </TouchableOpacity>

          {userPlaylists[0] ? (
            <TouchableOpacity 
              style={styles.quickAccessItem}
              onPress={() => {
                if (userPlaylists[0]) {
                  navigation.navigate('Playlist', { playlist: userPlaylists[0] });
                } else {
                  navigation.navigate('Library', { tab: 'playlists' });
                }
              }}
            >
              <Image
                source={{ uri: getImageUrl(userPlaylists[0]?.thumbnail) || 'https://via.placeholder.com/56' }}
                style={styles.quickAccessImage}
              />
              <Text style={styles.quickAccessText} numberOfLines={2}>{userPlaylists[0]?.name || 'Playlist'}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.quickAccessItem}
              onPress={() => navigation.navigate('Library')}
            >
              <LinearGradient colors={['#1DB954', '#169c46']} style={styles.quickAccessIcon}>
                <Ionicons name="add" size={20} color={COLORS.text} />
              </LinearGradient>
              <Text style={styles.quickAccessText} numberOfLines={2}>Playlist Mpya</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Library', { tab: 'downloads' })}
          >
            <LinearGradient colors={['#E91429', '#ff4757']} style={styles.quickAccessIcon}>
              <Ionicons name="download" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Zilizopakuwa</Text>
          </TouchableOpacity>

          {userPlaylists[1] ? (
            <TouchableOpacity 
              style={styles.quickAccessItem}
              onPress={() => {
                if (userPlaylists[1]) {
                  navigation.navigate('Playlist', { playlist: userPlaylists[1] });
                } else {
                  navigation.navigate('Library', { tab: 'playlists' });
                }
              }}
            >
              <Image
                source={{ uri: getImageUrl(userPlaylists[1]?.thumbnail) || 'https://via.placeholder.com/56' }}
                style={styles.quickAccessImage}
              />
              <Text style={styles.quickAccessText} numberOfLines={2}>{userPlaylists[1]?.name || 'Playlist'}</Text>
            </TouchableOpacity>
          ) : recentAlbums[0] ? (
            <TouchableOpacity 
              style={styles.quickAccessItem}
              onPress={() => handleAlbumPress(recentAlbums[0])}
            >
              <Image
                source={{ uri: getImageUrl(recentAlbums[0].thumbnail || recentAlbums[0].thumbnail_url) || 'https://via.placeholder.com/56' }}
                style={styles.quickAccessImage}
              />
              <Text style={styles.quickAccessText} numberOfLines={2}>{recentAlbums[0].title}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.quickAccessItem} />
          )}

          {/* Row 2: Bible, Churches, Album 1, Album 2 */}
          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Bible')}
          >
            <LinearGradient colors={['#1a472a', '#2d5a3d']} style={styles.quickAccessIcon}>
              <Ionicons name="book" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Biblia</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Churches')}
          >
            <LinearGradient colors={['#FF6B35', '#f5a623']} style={styles.quickAccessIcon}>
              <Ionicons name="business" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Makanisa</Text>
          </TouchableOpacity>

          {recentAlbums[1] ? (
            <TouchableOpacity 
              style={styles.quickAccessItem}
              onPress={() => handleAlbumPress(recentAlbums[1])}
            >
              <Image
                source={{ uri: getImageUrl(recentAlbums[1].thumbnail || recentAlbums[1].thumbnail_url) || 'https://via.placeholder.com/56' }}
                style={styles.quickAccessImage}
              />
              <Text style={styles.quickAccessText} numberOfLines={2}>{recentAlbums[1].title}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.quickAccessItem} />
          )}

          {/* Live Radio Button */}
          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Radio')}
          >
            <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.quickAccessIcon}>
              <Ionicons name="radio" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Redio</Text>
          </TouchableOpacity>
        </View>

        {/* Category Filters - Below Quick Access */}
        {categories.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.categoryFiltersContainer}
            contentContainerStyle={styles.categoryFiltersContent}
          >
            {/* User initial filter button */}
            {user?.name && (
              <TouchableOpacity 
                style={styles.userFilterButton}
                onPress={() => setActiveCategory('all')}
              >
                <Text style={styles.userFilterText}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              </TouchableOpacity>
            )}
            
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryFilterChip,
                  activeCategory === category.id && styles.categoryFilterChipActive
                ]}
                onPress={() => handleCategoryFilter(category)}
              >
                {category.icon && category.icon !== '?' && (
                  <Ionicons 
                    name={category.icon} 
                    size={14} 
                    color={activeCategory === category.id ? COLORS.background : COLORS.text}
                    style={styles.categoryFilterIcon}
                  />
                )}
                <Text style={[
                  styles.categoryFilterText,
                  activeCategory === category.id && styles.categoryFilterTextActive
                ]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Mafundisho na Katekesi - Spotify "Picked for you" Style */}
        {mafundishoContent.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mafundisho na Katekesi</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'mafundisho', title: 'Mafundisho na Katekesi' })}>
                <Text style={styles.seeAll}>Ona zote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {mafundishoContent.map((item) => (
                <TouchableOpacity 
                  key={item.teaching_id || item.container_id} 
                  style={styles.mafundishoCard}
                  activeOpacity={0.9}
                  onPress={() => navigation.navigate('MafundishoDetail', { teachingId: item.teaching_id, containerId: item.container_id, mafundisho: item })}
                >
                  {/* Purple Accent Band */}
                  <View style={styles.mafundishoBand}>
                    <Text style={styles.mafundishoBandText}>MAFUNDISHO</Text>
                  </View>
                  
                  {/* Thumbnail Image */}
                  <Image
                    source={{ uri: getImageUrl(item.thumbnail || item.leader_photo) || 'https://via.placeholder.com/200' }}
                    style={styles.mafundishoImage}
                  />
                  
                  {/* Content Info */}
                  <View style={styles.mafundishoInfo}>
                    <Text style={styles.mafundishoTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.mafundishoDesc} numberOfLines={1}>
                      na {item.leader_name || 'Unknown'}
                    </Text>
                    <Text style={styles.mafundishoEpisodes}>
                      {item.topic_count || item.series_count || 0} mada • {item.lesson_count || item.total_classes || item.episode_count || 0} sehemu
                    </Text>
                    
                    {/* Action Icons */}
                    <View style={styles.mafundishoActions}>
                      <TouchableOpacity 
                        style={styles.mafundishoAddBtn}
                        onPress={() => navigation.navigate('MafundishoDetail', { teachingId: item.teaching_id, containerId: item.container_id, mafundisho: item })}
                      >
                        <Ionicons name="list-outline" size={28} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.mafundishoPlayBtn}
                        onPress={() => navigation.navigate('MafundishoDetail', { teachingId: item.teaching_id, containerId: item.container_id, mafundisho: item })}
                      >
                        <Ionicons name="play" size={24} color={COLORS.background} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Nyimbo za Kwaresma (Lent Songs) */}
        {lentSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nyimbo za Kwaresma</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'albums', title: 'Nyimbo za Kwaresma', category: 'lent' })}>
                <Text style={styles.seeAll}>Ona zote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {lentSongs.map((item, index) => (
                <TouchableOpacity 
                  key={item.album_id || item.song_id || index} 
                  style={styles.smallSquareCard}
                  onPress={() => item.album_id ? handleAlbumPress(item) : handlePlaySong(item, lentSongs)}
                >
                  <Image
                    source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/120' }}
                    style={styles.smallSquareImage}
                  />
                  <Text style={styles.smallSquareTitle} numberOfLines={1}>{item.title || item.name}</Text>
                  <Text style={styles.smallSquareArtist} numberOfLines={1}>{item.artist_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Nyimbo za Krismasi (Christmas Songs) */}
        {christmasSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nyimbo za Krismasi</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'albums', title: 'Nyimbo za Krismasi', category: 'christmas' })}>
                <Text style={styles.seeAll}>Ona zote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {christmasSongs.map((item, index) => (
                <TouchableOpacity 
                  key={item.album_id || item.song_id || index} 
                  style={styles.smallSquareCard}
                  onPress={() => item.album_id ? handleAlbumPress(item) : handlePlaySong(item, christmasSongs)}
                >
                  <Image
                    source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/120' }}
                    style={styles.smallSquareImage}
                  />
                  <Text style={styles.smallSquareTitle} numberOfLines={1}>{item.title || item.name}</Text>
                  <Text style={styles.smallSquareArtist} numberOfLines={1}>{item.artist_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Mchanganyiko Maalumu (Special Mixes) */}
        {specialMixes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mchanganyiko Maalumu</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'mixes', title: 'Mchanganyiko Maalumu' })}>
                <Text style={styles.seeAll}>Ona zote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {specialMixes.map((mix) => (
                <TouchableOpacity 
                  key={mix.mix_id} 
                  style={styles.largeMixCard}
                  onPress={() => handleMixPress(mix)}
                >
                  <Image
                    source={{ uri: getImageUrl(mix.thumbnail) || 'https://via.placeholder.com/280x150' }}
                    style={styles.largeMixImage}
                  />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.largeMixGradient}>
                    <Text style={styles.largeMixTitle} numberOfLines={1}>{mix.title || mix.name}</Text>
                    <Text style={styles.largeMixSubtitle} numberOfLines={1}>
                      {mix.songs_count || mix.songs?.length || 0} nyimbo
                    </Text>
                  </LinearGradient>
                  <TouchableOpacity 
                    style={styles.mixPlayButton}
                    onPress={() => handlePlayMix(mix)}
                  >
                    <Ionicons name="play" size={24} color={COLORS.background} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Redio za Kikristo (Live Christian Radio) */}
        {radioStations.length > 0 && (
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
              {radioStations.slice(0, 6).map((station) => {
                const isCurrentlyPlaying = currentTrack?.isRadio && currentTrack?.song_id === station.station_id && isPlaying;
                return (
                  <TouchableOpacity 
                    key={station.station_id} 
                    style={[
                      styles.radioCard,
                      isCurrentlyPlaying && styles.radioCardActive
                    ]}
                    onPress={() => playRadio(station)}
                  >
                    <View style={[styles.radioLogoContainer, isCurrentlyPlaying && styles.radioLogoActive]}>
                      {station.favicon ? (
                        <Image
                          source={{ uri: station.favicon }}
                          style={styles.radioLogo}
                        />
                      ) : (
                        <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.radioLogoPlaceholder}>
                          <Ionicons name="radio" size={24} color={COLORS.text} />
                        </LinearGradient>
                      )}
                      {isCurrentlyPlaying && (
                        <View style={styles.radioPlayingIndicator}>
                          <View style={styles.radioPlayingDot} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.radioName} numberOfLines={1}>{station.name}</Text>
                    <Text style={styles.radioCountry} numberOfLines={1}>{station.country}</Text>
                    <View style={[styles.radioPlayButton, isCurrentlyPlaying && styles.radioPlayButtonActive]}>
                      <Ionicons 
                        name={isCurrentlyPlaying ? "pause" : "play"} 
                        size={16} 
                        color={isCurrentlyPlaying ? "#8B5CF6" : COLORS.text} 
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Album Zinazosikilizwa Zaidi (Most Listened Albums) */}
        {mostListenedAlbums.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Album Zinazosikilizwa Zaidi</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'albums', title: 'Album Zinazosikilizwa Zaidi' })}>
                <Text style={styles.seeAll}>Ona zote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {mostListenedAlbums.map((album, index) => renderAlbumCard(album, index))}
            </ScrollView>
          </View>
        )}

        {/* Mpya za Moto (Hot New Releases) */}
        {hotNewReleases.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mpya za Moto 🔥</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'albums', title: 'Mpya za Moto' })}>
                <Text style={styles.seeAll}>Ona zote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {hotNewReleases.map((album, index) => renderAlbumCard(album, index))}
            </ScrollView>
          </View>
        )}

        {/* Bible & Devotionals Section - Enhanced Colorful Tiles */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderWithIcon}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="book" size={20} color="#f97316" />
              </View>
              <View>
                <Text style={styles.sectionTitle}>Biblia na Masomo</Text>
                <Text style={styles.sectionSubtitleText}>Sikiliza Neno la Mungu</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Bible')}>
              <Text style={styles.seeAll}>Ona yote</Text>
            </TouchableOpacity>
          </View>
          
          {/* Two Main Cards Row */}
          <View style={styles.bibleTwoCardsRow}>
            {/* Bible Main Card - Orange Gradient */}
            <TouchableOpacity 
              style={styles.bibleColorCard}
              onPress={() => navigation.navigate('Bible')}
              activeOpacity={0.85}
            >
              <LinearGradient 
                colors={['#ea580c', '#f97316', '#fb923c']} 
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bibleColorGradient}
              >
                <View style={styles.bibleCardIconWrap}>
                  <Ionicons name="book-outline" size={28} color="rgba(255,255,255,0.9)" />
                </View>
                <Text style={styles.bibleColorTitle}>Biblia</Text>
                <Text style={styles.bibleColorSubtitle}>Agano Jipya • Kiswahili</Text>
                <Text style={styles.bibleColorDesc}>Soma na Sikiliza Neno</Text>
                <View style={styles.bibleColorButton}>
                  <Ionicons name="headset" size={14} color="#333" />
                  <Text style={styles.bibleColorButtonText}>Fungua</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Featured Snippet Card - Purple Gradient */}
            {bibleSnippets.length > 0 ? (
              <TouchableOpacity 
                style={styles.bibleColorCard}
                onPress={() => navigation.navigate('Bible', { snippet: bibleSnippets[0] })}
                activeOpacity={0.85}
              >
                <LinearGradient 
                  colors={['#7c3aed', '#8b5cf6', '#a78bfa']} 
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bibleColorGradient}
                >
                  <View style={styles.featuredSnippetBadge}>
                    <Text style={styles.featuredSnippetBadgeText}>FEATURED</Text>
                  </View>
                  <Text style={styles.snippetLabelSmall}>SOMO LA LEO</Text>
                  <Text style={styles.bibleColorTitle} numberOfLines={1}>
                    {bibleSnippets[0].reference || bibleSnippets[0].title}
                  </Text>
                  <Text style={styles.bibleColorDesc} numberOfLines={2}>
                    {bibleSnippets[0].description || bibleSnippets[0].subtitle}
                  </Text>
                  <View style={styles.bibleColorButton}>
                    <Ionicons name="headset" size={14} color="#333" />
                    <Text style={styles.bibleColorButtonText}>Sikiliza</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.bibleColorCard}
                onPress={() => navigation.navigate('Bible')}
                activeOpacity={0.85}
              >
                <LinearGradient 
                  colors={['#7c3aed', '#8b5cf6', '#a78bfa']} 
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bibleColorGradient}
                >
                  <View style={styles.bibleCardIconWrap}>
                    <Ionicons name="sparkles" size={28} color="rgba(255,255,255,0.9)" />
                  </View>
                  <Text style={styles.bibleColorTitle}>Masomo</Text>
                  <Text style={styles.bibleColorSubtitle}>Mafundisho</Text>
                  <Text style={styles.bibleColorDesc}>Sikiliza mafundisho ya Biblia</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* More Snippets Horizontal Scroll */}
          {bibleSnippets.length > 1 && (
            <View style={styles.moreSnippetsContainer}>
              <Text style={styles.moreSnippetsLabel}>Masomo Mengine</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.moreSnippetsScroll}
              >
                {bibleSnippets.slice(1, 6).map((snippet, index) => (
                  <TouchableOpacity 
                    key={snippet.snippet_id || index} 
                    style={styles.miniSnippetCard}
                    onPress={() => navigation.navigate('Bible', { snippet })}
                    activeOpacity={0.85}
                  >
                    <LinearGradient 
                      colors={
                        index % 3 === 0 ? ['#059669', '#10b981'] :
                        index % 3 === 1 ? ['#0891b2', '#06b6d4'] :
                        ['#dc2626', '#ef4444']
                      } 
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.miniSnippetGradient}
                    >
                      <Text style={styles.miniSnippetTitle} numberOfLines={1}>
                        {snippet.reference || snippet.title}
                      </Text>
                      <Text style={styles.miniSnippetDesc} numberOfLines={2}>
                        {snippet.description || snippet.subtitle || snippet.text?.substring(0, 40)}
                      </Text>
                      <View style={styles.miniSnippetPlayIcon}>
                        <Ionicons name="play-circle" size={22} color="rgba(255,255,255,0.9)" />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Churches (Makanisa) Section */}
        {churches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Makanisa</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'churches', title: 'Makanisa Yote' })}>
                <Text style={styles.seeAll}>Ona zote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {churches.slice(0, 6).map((church) => (
                <TouchableOpacity 
                  key={church.church_id} 
                  style={styles.churchCard}
                  onPress={() => navigation.navigate('Churches', { selectedChurch: church })}
                >
                  <Image
                    source={{ uri: getImageUrl(church.thumbnail) || 'https://via.placeholder.com/140?text=Kanisa' }}
                    style={styles.churchImage}
                  />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.churchGradient}>
                    <Ionicons name="business" size={16} color={COLORS.primary} style={styles.churchIcon} />
                    <Text style={styles.churchName} numberOfLines={2}>{church.name}</Text>
                    <Text style={styles.churchLocation} numberOfLines={1}>
                      {church.location || church.city}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Popular Songs */}
        {allSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nyimbo Maarufu</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'songs', title: 'Nyimbo Maarufu' })}>
                <Text style={styles.seeAll}>Ona zote</Text>
              </TouchableOpacity>
            </View>
            {allSongs.slice(0, 5).map((song, index) => (
              <TouchableOpacity 
                key={song.song_id} 
                style={styles.songListItem}
                onPress={() => handlePlaySong(song, allSongs)}
              >
                <Text style={[styles.songIndex, currentTrack?.song_id === song.song_id && styles.songIndexActive]}>
                  {currentTrack?.song_id === song.song_id ? (
                    <Ionicons name="musical-note" size={14} color={COLORS.primary} />
                  ) : index + 1}
                </Text>
                <Image
                  source={{ uri: getImageUrl(song.thumbnail || song.thumbnail_url) || 'https://via.placeholder.com/48' }}
                  style={styles.songImage}
                />
                <View style={styles.songInfo}>
                  <Text style={[styles.songTitle, currentTrack?.song_id === song.song_id && styles.songTitleActive]} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>{song.artist_name}</Text>
                </View>
                <TouchableOpacity style={styles.songAddButton} onPress={() => handleAddToPlaylist(song)}>
                  <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* All Albums Section - Always shows if we have albums */}
        {recentAlbums.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Albums Zote</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SeeAll', { type: 'albums', title: 'Albums Zote' })}>
                <Text style={styles.seeAll}>Ona zote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {recentAlbums.map((album, index) => renderAlbumCard(album, index))}
            </ScrollView>
          </View>
        )}

        {/* No Content Fallback */}
        {recentAlbums.length === 0 && specialMixes.length === 0 && churches.length === 0 && (
          <View style={styles.noContentContainer}>
            <Ionicons name="cloud-offline-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.noContentTitle}>Hakuna Maudhui</Text>
            <Text style={styles.noContentText}>
              Hatuwezi kupakia maudhui. Tafadhali angalia muunganisho wako wa mtandao na ujaribu tena.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Ionicons name="refresh" size={20} color={COLORS.text} />
              <Text style={styles.retryButtonText}>Jaribu Tena</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom spacing for mini player */}
        <View style={{ height: 150 }} />
      </ScrollView>

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
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.sm,
    margin: SPACING.xs,
    overflow: 'hidden',
  },
  quickAccessIcon: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessImage: {
    width: 56,
    height: 56,
  },
  quickAccessText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: SPACING.sm,
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
});

export default HomeScreen;
