import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, RefreshControl,
  StyleSheet, Dimensions, FlatList, StatusBar, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { contentService, getThumbnailUrl, getItemThumbnail, libraryService } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { COLORS } from '../config';

const { width, height } = Dimensions.get('window');
const GRID_CARD_WIDTH = (width - 48) / 2;

// ============ SECTION COMPONENTS ============

// Hero Carousel - Large featured banner
const HeroSection = ({ item, onPress }) => {
  if (!item) return null;
  const thumbUrl = getItemThumbnail(item);
  
  return (
    <TouchableOpacity style={styles.heroSection} onPress={onPress} activeOpacity={0.95}>
      {thumbUrl ? (
        <Image 
          source={{ uri: thumbUrl }} 
          style={styles.heroImage}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient colors={['#1e3a5f', '#0a192f']} style={styles.heroImage} />
      )}
      <LinearGradient 
        colors={['transparent', 'rgba(0,0,0,0.9)']} 
        style={styles.heroOverlay}
      >
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>FEATURED</Text>
        </View>
        <Text style={styles.heroTitle} numberOfLines={2}>{item.title || item.headline}</Text>
        <Text style={styles.heroSubtitle} numberOfLines={2}>
          {item.artist_name || item.subtitle || 'Stream now on Spirit Songs'}
        </Text>
        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.heroPlayBtn} onPress={onPress}>
            <Ionicons name="play" size={18} color="#000" />
            <Text style={styles.heroPlayText}>Play Now</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

// Category Filter Tabs - BELOW HERO
const FilterTabs = ({ categories, activeCategory, onSelect }) => {
  const allTabs = [
    { category_id: 'all', name: 'For you' },
    ...categories.slice(0, 5)
  ];
  
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterContainer}
    >
      {allTabs.map((cat) => (
        <TouchableOpacity
          key={cat.category_id}
          style={[styles.filterTab, activeCategory === cat.category_id && styles.filterTabActive]}
          onPress={() => onSelect(cat.category_id)}
        >
          <Text style={[styles.filterTabText, activeCategory === cat.category_id && styles.filterTabTextActive]}>
            {cat.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// Quick Access Grid - 2 columns x 4 rows (8 items total) like Spotify
const QuickAccessGrid = ({ items, section, likedSongsCount, playlistsCount, downloadsCount, navigation, language }) => {
  // Use items from section config if available, otherwise use defaults
  const quickAccessItems = section?.quick_access_items || items || [];
  
  // Build quick access items from API config
  const quickItems = quickAccessItems
    .filter(item => item.is_active !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(item => {
      // Get count for specific items
      let count = null;
      if (item.id === 'liked') count = likedSongsCount;
      else if (item.id === 'downloads') count = downloadsCount;
      else if (item.id === 'playlists') count = playlistsCount;
      
      return {
        ...item,
        displayName: language === 'sw' ? (item.name_sw || item.name) : item.name,
        count,
      };
    });

  const handlePress = (item) => {
    if (item.navigation) {
      navigation.navigate(item.navigation, item.navigation_params || {});
    } else if (item.album_id) {
      navigation.navigate('Album', { albumId: item.album_id });
    } else if (item.category_id) {
      navigation.navigate('Category', { category: item });
    } else {
      // Default to Library for backward compatibility
      navigation.navigate('Library');
    }
  };

  return (
    <View style={styles.quickAccessContainer}>
      {quickItems.map((item, idx) => {
        const thumbUrl = getItemThumbnail(item);
        const gradient = Array.isArray(item.gradient) ? item.gradient : ['#333', '#555'];
        return (
          <TouchableOpacity 
            key={item.id || idx}
            style={styles.quickAccessCard}
            onPress={() => handlePress(item)}
            activeOpacity={0.8}
          >
            {item.icon ? (
              <LinearGradient colors={gradient} style={styles.quickAccessIconBox}>
                <Ionicons name={item.icon} size={22} color="#fff" />
              </LinearGradient>
            ) : thumbUrl ? (
              <Image source={{ uri: thumbUrl }} style={styles.quickAccessImg} />
            ) : (
              <LinearGradient colors={gradient} style={styles.quickAccessIconBox}>
                <Ionicons name="musical-notes" size={18} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            )}
            <Text style={styles.quickAccessText} numberOfLines={2}>{item.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Horizontal Scroll - Small square tiles
const HorizontalSmallTiles = ({ title, items, onItemPress, onSeeAll }) => {
  if (!items || items.length === 0) return null;
  
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && <TouchableOpacity onPress={onSeeAll}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>}
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item, idx) => item.album_id || item.song_id || `small-${idx}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={({ item }) => {
          const thumbUrl = getItemThumbnail(item);
          return (
            <TouchableOpacity 
              style={styles.smallTile} 
              onPress={() => onItemPress(item)} 
              activeOpacity={0.8}
            >
              <View style={styles.smallTileImage}>
                {thumbUrl ? (
                  <Image source={{ uri: thumbUrl }} style={styles.smallTileImg} />
                ) : (
                  <LinearGradient colors={['#333', '#111']} style={styles.smallTileImg}>
                    <Ionicons name="musical-notes" size={24} color="rgba(255,255,255,0.3)" />
                  </LinearGradient>
                )}
              </View>
              <Text style={styles.smallTileTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.smallTileSubtitle} numberOfLines={1}>{item.artist_name || 'Stream now'}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

// Vertical List with thumbnails
const VerticalListSection = ({ title, items, onItemPress, onSeeAll }) => {
  if (!items || items.length === 0) return null;
  
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && <TouchableOpacity onPress={onSeeAll}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>}
      </View>
      <View style={styles.verticalListContainer}>
        {items.slice(0, 4).map((item, idx) => {
          const thumbUrl = getItemThumbnail(item);
          return (
            <TouchableOpacity 
              key={item.album_id || item.song_id || idx} 
              style={styles.verticalListItem}
              onPress={() => onItemPress(item)}
              activeOpacity={0.8}
            >
              <View style={styles.verticalListThumb}>
                {thumbUrl ? (
                  <Image source={{ uri: thumbUrl }} style={styles.verticalListImg} />
                ) : (
                  <LinearGradient colors={['#333', '#111']} style={styles.verticalListImg}>
                    <Ionicons name="musical-notes" size={20} color="rgba(255,255,255,0.3)" />
                  </LinearGradient>
                )}
              </View>
              <View style={styles.verticalListInfo}>
                <Text style={styles.verticalListTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.verticalListSubtitle} numberOfLines={1}>
                  {item.songs_count ? `${item.songs_count} songs` : item.artist_name || 'Stream now'}
                </Text>
              </View>
              <TouchableOpacity style={styles.verticalListPlay} onPress={() => onItemPress(item)}>
                <Ionicons name="play-circle" size={32} color="#3498DB" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// 2x2 Grid Layout
const GridSection = ({ title, items, onItemPress, onSeeAll }) => {
  if (!items || items.length === 0) return null;
  
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && <TouchableOpacity onPress={onSeeAll}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>}
      </View>
      <View style={styles.gridContainer}>
        {items.slice(0, 4).map((item, idx) => {
          const thumbUrl = getItemThumbnail(item);
          return (
            <TouchableOpacity 
              key={item.album_id || idx} 
              style={styles.gridItem}
              onPress={() => onItemPress(item)}
              activeOpacity={0.8}
            >
              <View style={styles.gridItemImage}>
                {thumbUrl ? (
                  <Image source={{ uri: thumbUrl }} style={styles.gridItemImg} />
                ) : (
                  <LinearGradient colors={['#333', '#111']} style={styles.gridItemImg}>
                    <Ionicons name="musical-notes" size={32} color="rgba(255,255,255,0.3)" />
                  </LinearGradient>
                )}
              </View>
              <Text style={styles.gridItemTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.gridItemSubtitle} numberOfLines={1}>{item.artist_name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// Churches Section - Horizontal scrolling
const ChurchesSection = ({ churches, onChurchPress, title = 'Churches' }) => {
  if (!churches || churches.length === 0) return null;
  
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <FlatList
        horizontal
        data={churches}
        keyExtractor={(item) => item.church_id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={({ item }) => {
          const thumbUrl = getItemThumbnail(item) || item.cover_image;
          return (
            <TouchableOpacity 
              style={styles.churchCard} 
              onPress={() => onChurchPress(item)} 
              activeOpacity={0.8}
            >
              <View style={styles.churchImageContainer}>
                {thumbUrl ? (
                  <Image source={{ uri: thumbUrl }} style={styles.churchImage} />
                ) : (
                  <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.churchImage}>
                    <Ionicons name="business" size={32} color="rgba(255,255,255,0.4)" />
                  </LinearGradient>
                )}
                {item.denomination && (
                  <View style={styles.churchDenomBadge}>
                    <Text style={styles.churchDenomText}>{item.denomination.slice(0, 3).toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.churchName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.churchLocation} numberOfLines={1}>
                <Ionicons name="location-outline" size={10} color={COLORS.textMuted} /> {item.location}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

// Large vertical cards
const LargeCardsSection = ({ title, items, onItemPress, onSeeAll }) => {
  if (!items || items.length === 0) return null;
  
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && <TouchableOpacity onPress={onSeeAll}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>}
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item, idx) => item.album_id || `large-${idx}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={({ item }) => {
          const thumbUrl = getItemThumbnail(item);
          return (
            <TouchableOpacity 
              style={styles.largeCard} 
              onPress={() => onItemPress(item)} 
              activeOpacity={0.8}
            >
              <View style={styles.largeCardImage}>
                {thumbUrl ? (
                  <Image source={{ uri: thumbUrl }} style={styles.largeCardImg} />
                ) : (
                  <LinearGradient colors={['#1e3a5f', '#0a192f']} style={styles.largeCardImg}>
                    <Ionicons name="musical-notes" size={40} color="rgba(255,255,255,0.3)" />
                  </LinearGradient>
                )}
              </View>
              <Text style={styles.largeCardTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.largeCardSubtitle} numberOfLines={1}>{item.artist_name || 'Stream now'}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

// Tafakari Style Cards - Spotify-like horizontal cards (like the reference image)
const TafakariSection = ({ title, items, onItemPress, onPlay }) => {
  if (!items || items.length === 0) return null;
  
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item, idx) => item.album_id || item.content_id || `tafakari-${idx}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={({ item }) => {
          const thumbUrl = getItemThumbnail(item);
          return (
            <TouchableOpacity 
              style={styles.tafakariCard} 
              onPress={() => onItemPress(item)} 
              activeOpacity={0.9}
            >
              <View style={styles.tafakariCardInner}>
                {/* Left: Album Art */}
                <View style={styles.tafakariImageContainer}>
                  {thumbUrl ? (
                    <Image source={{ uri: thumbUrl }} style={styles.tafakariImage} />
                  ) : (
                    <LinearGradient colors={['#7c3aed', '#4f46e5']} style={styles.tafakariImage}>
                      <Ionicons name="book" size={32} color="rgba(255,255,255,0.5)" />
                    </LinearGradient>
                  )}
                  {/* Radio badge */}
                  <View style={styles.tafakariBadge}>
                    <Text style={styles.tafakariBadgeText}>RADIO</Text>
                  </View>
                </View>
                
                {/* Right: Info */}
                <View style={styles.tafakariInfo}>
                  <Text style={styles.tafakariTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.tafakariSource}>Gracefy</Text>
                  <Text style={styles.tafakariMeta} numberOfLines={1}>
                    {item.songs_count || item.tracks || 10} tracks • {item.artist_name || 'Various Artists'}
                  </Text>
                  
                  {/* Action buttons */}
                  <View style={styles.tafakariActions}>
                    <TouchableOpacity style={styles.tafakariPreviewBtn}>
                      <Ionicons name="radio-outline" size={14} color="#fff" />
                      <Text style={styles.tafakariPreviewText}>Preview</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.tafakariAddBtn}>
                      <Ionicons name="add" size={20} color="#fff" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.tafakariPlayBtn}
                      onPress={() => onPlay && onPlay(item)}
                    >
                      <Ionicons name="play" size={20} color="#000" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

// Bible Devotional Cards - Wide horizontal cards with listen button
const BibleDevotionalSection = ({ title, snippets, onPress, onNavigateToBible }) => {
  if (!snippets || snippets.length === 0) return null;
  
  const cardColors = [
    ['#4c1d95', '#7c3aed'], // Purple
    ['#065f46', '#10b981'], // Green
    ['#831843', '#ec4899'], // Pink
    ['#1e3a5f', '#3b82f6'], // Blue
    ['#7c2d12', '#f97316'], // Orange
  ];
  
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="book" size={20} color="#f59e0b" style={{ marginRight: 8 }} />
          <Text style={styles.sectionTitle}>{title || 'Biblia na Masomo'}</Text>
        </View>
        {onNavigateToBible && (
          <TouchableOpacity onPress={onNavigateToBible}>
            <Text style={styles.seeAll}>Tazama Zote</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        horizontal
        data={snippets}
        keyExtractor={(item, idx) => item.snippet_id || `bible-${idx}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={({ item, index }) => {
          const colors = cardColors[index % cardColors.length];
          return (
            <TouchableOpacity 
              style={styles.bibleCard} 
              onPress={() => onPress(item)} 
              activeOpacity={0.9}
            >
              <LinearGradient 
                colors={colors} 
                style={styles.bibleCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {/* Featured badge */}
                {item.is_featured && (
                  <View style={styles.bibleFeaturedBadge}>
                    <Text style={styles.bibleFeaturedText}>FEATURED</Text>
                  </View>
                )}
                
                {/* Heading */}
                <Text style={styles.bibleHeading}>
                  {item.heading || 'SOMO LA LEO'}
                </Text>
                
                {/* Reference */}
                <Text style={styles.bibleReference}>{item.reference || item.title}</Text>
                
                {/* Subtitle */}
                {item.subtitle && (
                  <Text style={styles.bibleSubtitle} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                )}
                
                {/* Footer with duration and listen button */}
                <View style={styles.bibleFooter}>
                  <Text style={styles.bibleDuration}>
                    ~{Math.round(item.duration_estimate || 30)}s
                  </Text>
                  <View style={styles.bibleListenBtn}>
                    <Ionicons name="headset" size={14} color="#fff" />
                    <Text style={styles.bibleListenText}>Sikiliza Sasa</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

// ============ MAIN HOME SCREEN ============

export default function HomeScreen({ navigation }) {
  const [homeData, setHomeData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [allAlbums, setAllAlbums] = useState([]);
  const [churches, setChurches] = useState([]);
  const [bibleSnippets, setBibleSnippets] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [likedSongsCount, setLikedSongsCount] = useState(0);
  const [playlistsCount, setPlaylistsCount] = useState(0);
  const [downloadsCount, setDownloadsCount] = useState(0);
  const { currentSong } = usePlayer();
  const { user, isAuthenticated } = useAuth();
  const { t, strings } = useLanguage();

  const fetchData = useCallback(async () => {
    try {
      console.log('Fetching home data...');
      const [home, cats, churchesRes, snippetsRes] = await Promise.all([
        contentService.getHome(),
        contentService.getCategories(),
        contentService.getChurches().catch(() => ({ churches: [] })),
        contentService.getBibleSnippets().catch(() => ({ snippets: [] })),
      ]);
      console.log('Home data received:', home?.sections?.length, 'sections');
      console.log('Categories received:', cats?.categories?.length, 'categories');
      console.log('Churches received:', churchesRes?.churches?.length, 'churches');
      console.log('Bible snippets received:', snippetsRes?.snippets?.length, 'snippets');
      
      setHomeData(home);
      setCategories(cats.categories || []);
      setChurches(churchesRes.churches || []);
      setBibleSnippets(snippetsRes.snippets || []);
      
      // Collect all albums from sections
      const albums = [];
      home?.sections?.forEach(section => {
        console.log(`Processing section: ${section.title} with ${section.items?.length || 0} items`);
        if (section.items) {
          // Only add items that are albums (have album_id)
          const albumItems = section.items.filter(item => item.album_id);
          albums.push(...albumItems);
        }
      });
      console.log('Total albums collected:', albums.length);
      setAllAlbums(albums);

      // Fetch library stats if authenticated
      if (isAuthenticated) {
        try {
          const library = await libraryService.getLibrary();
          setLikedSongsCount(library?.favorites?.length || 0);
          setPlaylistsCount(library?.playlists?.length || 0);
        } catch (e) {
          console.log('Library fetch error:', e);
        }
      }
      
      // Get downloads count
      try {
        const { getDownloadedSongs } = require('../services/downloadService');
        const downloads = await getDownloadedSongs();
        setDownloadsCount(downloads.length);
      } catch (e) {}
      
    } catch (error) {
      console.error('Error fetching home data:', error);
      setError(error.message || 'Failed to load content');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setError(null);
    fetchData();
  };

  // Filter albums by category
  const getFilteredItems = useCallback(() => {
    if (activeCategory === 'all') return allAlbums;
    const categoryName = categories.find(c => c.category_id === activeCategory)?.name?.toLowerCase();
    return allAlbums.filter(album => 
      album.category_id === activeCategory || 
      album.category?.toLowerCase() === categoryName
    );
  }, [activeCategory, allAlbums, categories]);

  // Navigate to album with proper params
  const handleAlbumPress = useCallback((item) => {
    console.log('Album pressed:', item?.title, 'album_id:', item?.album_id);
    
    if (item.album_id) {
      navigation.navigate('Album', { albumId: item.album_id });
    } else if (item.category_id) {
      navigation.navigate('Category', { category: item });
    }
  }, [navigation]);

  const handleNowPlaying = useCallback(() => {
    navigation.navigate('NowPlaying');
  }, [navigation]);

  const handleProfilePress = useCallback(() => {
    navigation.navigate('Profile');
  }, [navigation]);

  const handleChurchPress = useCallback((church) => {
    navigation.navigate('ChurchDetail', { churchId: church.church_id });
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498DB" />
        <Text style={{ color: '#fff', marginTop: 10 }}>Loading content...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color="#3498DB" />
        <Text style={{ color: '#fff', marginTop: 10, textAlign: 'center' }}>{error}</Text>
        <TouchableOpacity 
          style={{ marginTop: 20, padding: 12, backgroundColor: '#3498DB', borderRadius: 8 }}
          onPress={onRefresh}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Get sections data
  const burner = homeData?.burners?.[0];
  const sections = homeData?.sections || [];
  const heroConfig = homeData?.hero || { hero_type: 'static_banner', items: [] };
  console.log('Rendering with sections:', sections.length, 'burner:', !!burner, 'hero:', heroConfig.hero_type);
  
  const featuredSection = sections.find(s => s.type === 'featured_albums' || s.section_type === 'featured_albums');
  const featuredAlbums = featuredSection?.items || [];
  console.log('Featured albums:', featuredAlbums.length);
  
  const filteredItems = getFilteredItems();
  console.log('All albums:', allAlbums.length, 'filtered:', filteredItems.length);
  
  // Split albums for different layouts
  const continuePlayingItems = featuredAlbums.slice(0, 6);
  const gridItems = activeCategory === 'all' ? allAlbums.slice(2, 6) : filteredItems.slice(0, 4);
  const newReleasesItems = allAlbums.slice(4, 8);
  const bestsellingItems = allAlbums.slice(0, 6);
  const popularItems = allAlbums.slice(0, 4);

  // Get hero content based on configuration
  const getHeroItem = () => {
    if (heroConfig.hero_type === 'dynamic_content' && heroConfig.items?.length > 0) {
      // Use dynamic content (albums)
      return heroConfig.items[0];
    } else if (heroConfig.items?.length > 0) {
      // Use static banners
      return heroConfig.items[0];
    }
    // Fallback to burner or featured albums
    return burner || featuredAlbums[0];
  };

  const heroItem = getHeroItem();

  // Quick access items from categories and albums
  const quickAccessItems = [
    ...categories.slice(0, 2),
    ...featuredAlbums.slice(0, 2)
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, currentSong && { paddingBottom: 140 }]}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#3498DB"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.profileBtn} onPress={handleProfilePress}>
            <LinearGradient colors={['#3498DB', '#1A295E']} style={styles.profileGradient}>
              <Text style={styles.profileInitial}>{user?.name?.charAt(0)?.toUpperCase() || 'S'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('appName')}</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('Search')}>
              <Ionicons name="search-outline" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="notifications-outline" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Section - Uses hero config from backend */}
        <HeroSection 
          item={heroItem} 
          onPress={() => {
            if (heroItem?.album_id) {
              handleAlbumPress(heroItem);
            } else if (heroItem?.link_type === 'album' && heroItem?.link_id) {
              navigation.navigate('Album', { albumId: heroItem.link_id });
            } else if (heroItem?.link_type === 'external' && heroItem?.external_url) {
              // Handle external URL if needed
            }
          }}
        />

        {/* Filter Tabs - BELOW HERO */}
        <FilterTabs 
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />

        {/* Quick Access Grid - 2 columns x 4 rows (8 items) */}
        <QuickAccessGrid 
          items={quickAccessItems}
          likedSongsCount={likedSongsCount}
          playlistsCount={playlistsCount}
          downloadsCount={downloadsCount}
          navigation={navigation}
        />

        {/* Biblia na Masomo - Bible Devotional Section */}
        {bibleSnippets.length > 0 && (
          <BibleDevotionalSection
            title="Biblia na Masomo"
            snippets={bibleSnippets}
            onPress={(snippet) => navigation.navigate('Bible', { snippet })}
            onNavigateToBible={() => navigation.navigate('Bible')}
          />
        )}

        {/* Churches Section */}
        {churches.length > 0 && (
          <ChurchesSection 
            churches={churches}
            onChurchPress={handleChurchPress}
            title={t('churches')}
          />
        )}

        {/* Fallback when no content */}
        {allAlbums.length === 0 && sections.length === 0 && (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Ionicons name="musical-notes" size={48} color="#666" />
            <Text style={{ color: '#888', marginTop: 12, textAlign: 'center' }}>
              {t('noContent')}{'\n'}{t('pullToRefresh')}
            </Text>
          </View>
        )}

        {/* Show filtered content when category selected */}
        {activeCategory !== 'all' && filteredItems.length > 0 && (
          <HorizontalSmallTiles
            title={categories.find(c => c.category_id === activeCategory)?.name || 'Results'}
            items={filteredItems}
            onItemPress={handleAlbumPress}
          />
        )}

        {/* Dynamic sections from admin - rendered based on layout_style */}
        {sections.map((section, idx) => {
          // Skip hero (handled above)
          if (section.section_type === 'hero') return null;
          // Skip quick_access with categories (handled by QuickAccessGrid)
          if (section.section_type === 'quick_access') return null;
          // Skip bible_content (handled by BibleDevotionalSection)
          if (section.section_type === 'bible_content') return null;
          // Skip churches (handled by ChurchesSection)
          if (section.section_type === 'churches') return null;
          
          const items = section.items || [];
          if (items.length === 0) return null;
          
          const layoutStyle = section.layout_style || 'horizontal_small';
          const title = section.title || section.display_name;
          
          // Render based on layout_style
          switch (layoutStyle) {
            case 'vertical_list':
              return (
                <VerticalListSection
                  key={section.section_id || `section-${idx}`}
                  title={title}
                  items={items}
                  onItemPress={handleAlbumPress}
                />
              );
            
            case 'grid':
              return (
                <GridSection
                  key={section.section_id || `section-${idx}`}
                  title={title}
                  items={items}
                  onItemPress={handleAlbumPress}
                />
              );
            
            case 'horizontal_large':
              return (
                <LargeCardsSection
                  key={section.section_id || `section-${idx}`}
                  title={title}
                  items={items}
                  onItemPress={handleAlbumPress}
                />
              );
            
            case 'tafakari_cards':
              return (
                <TafakariSection
                  key={section.section_id || `section-${idx}`}
                  title={title}
                  items={items}
                  onItemPress={handleAlbumPress}
                  onPlay={handleAlbumPress}
                />
              );
            
            case 'horizontal_cards':
            case 'horizontal_small':
            default:
              return (
                <HorizontalSmallTiles
                  key={section.section_id || `section-${idx}`}
                  title={title}
                  items={items}
                  onItemPress={handleAlbumPress}
                />
              );
          }
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  profileBtn: {},
  profileGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 12,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIcon: {
    padding: 4,
  },
  // Hero Section
  heroSection: {
    height: 220,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  heroBadge: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginBottom: 12,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 12,
  },
  heroPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498DB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  heroPlayText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },
  // Filter Tabs
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: '#3498DB',
  },
  filterTabText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  // Quick Access Grid - 2 columns x 4 rows
  quickAccessContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  quickAccessCard: {
    width: GRID_CARD_WIDTH,
    height: 56,
    backgroundColor: '#1a1a2e',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 8,
    marginBottom: 8,
  },
  quickAccessIconBox: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessImg: {
    width: 56,
    height: 56,
  },
  quickAccessText: {
    flex: 1,
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    paddingHorizontal: 10,
  },
  // Section Common
  sectionContainer: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  seeAll: {
    color: '#3498DB',
    fontSize: 13,
    fontWeight: '600',
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  // Small Tiles
  smallTile: {
    width: 120,
    marginRight: 12,
  },
  smallTileImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  smallTileImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallTileTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  smallTileSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  // Vertical List
  verticalListContainer: {
    paddingHorizontal: 16,
  },
  verticalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  verticalListThumb: {
    width: 56,
    height: 56,
    borderRadius: 4,
    overflow: 'hidden',
  },
  verticalListImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalListInfo: {
    flex: 1,
    marginLeft: 12,
  },
  verticalListTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  verticalListSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  verticalListPlay: {
    padding: 4,
  },
  // Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  gridItem: {
    width: (width - 36) / 2,
    marginHorizontal: 4,
    marginBottom: 16,
  },
  gridItemImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  gridItemImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItemTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  gridItemSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  // Large Cards
  largeCard: {
    width: width * 0.42,
    marginRight: 12,
  },
  largeCardImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  largeCardImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeCardTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  largeCardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  // Churches
  churchCard: {
    width: width * 0.35,
    marginRight: 12,
  },
  churchImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
  },
  churchImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  churchDenomBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  churchDenomText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  churchName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  churchLocation: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  // Tafakari Section - Spotify-style horizontal cards
  tafakariCard: {
    width: width * 0.85,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2D2152', // Purple/plum background like reference
  },
  tafakariCardInner: {
    flexDirection: 'row',
    padding: 12,
  },
  tafakariImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  tafakariImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tafakariBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tafakariBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tafakariInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  tafakariTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  tafakariSource: {
    color: '#3498DB', // Gracefy blue
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  tafakariMeta: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginBottom: 8,
  },
  tafakariActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tafakariPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tafakariPreviewText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  tafakariAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tafakariPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Bible Devotional Cards
  bibleCard: {
    width: width * 0.75,
    height: 160,
    marginRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bibleCardGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  bibleFeaturedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bibleFeaturedText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bibleHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  bibleReference: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  bibleSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  bibleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  bibleDuration: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  bibleListenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  bibleListenText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});
