import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, RefreshControl,
  StyleSheet, Dimensions, FlatList, StatusBar, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { contentService, getThumbnailUrl, libraryService } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import MiniPlayer from '../components/MiniPlayer';
import { COLORS } from '../config';

const { width, height } = Dimensions.get('window');

// ============ SECTION COMPONENTS ============

// Hero Carousel - Large featured banner
const HeroSection = ({ item, onPress }) => {
  if (!item) return null;
  
  return (
    <TouchableOpacity style={styles.heroSection} onPress={onPress} activeOpacity={0.95}>
      {item.thumbnail ? (
        <Image 
          source={{ uri: getThumbnailUrl(item.thumbnail) }} 
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
          <TouchableOpacity style={styles.heroInfoBtn}>
            <Ionicons name="information-circle-outline" size={20} color="#fff" />
            <Text style={styles.heroInfoText}>More Info</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
      <View style={styles.heroPlaysBadge}>
        <Text style={styles.heroPlaysText}>{item.total_plays || '2M'}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Category Filter Tabs - NOW BELOW HERO
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

// Quick Access Grid - 2x4 layout (Liked songs, Playlists, Admin content) - RESTORED
const QuickAccessGrid = ({ items, onItemPress, likedSongsCount, playlistsCount, navigation }) => {
  // Build quick access items: 2 fixed (liked, playlists) + up to 6 from admin
  const quickItems = [
    { 
      id: 'liked', 
      name: 'Liked Songs', 
      icon: 'heart', 
      color: '#e91e63', 
      count: likedSongsCount,
      isSpecial: true 
    },
    { 
      id: 'playlists', 
      name: 'Your Playlists', 
      icon: 'list', 
      color: '#4CAF50', 
      count: playlistsCount,
      isSpecial: true 
    },
    ...items.slice(0, 6).map(item => ({
      ...item,
      id: item.album_id || item.category_id || item.id,
      name: item.title || item.name,
    }))
  ].slice(0, 8); // Maximum 8 items (4 per row)

  const handlePress = (item) => {
    if (item.id === 'liked') {
      navigation.navigate('Library');
    } else if (item.id === 'playlists') {
      navigation.navigate('Library');
    } else if (item.album_id) {
      navigation.navigate('Album', { albumId: item.album_id });
    } else if (item.category_id) {
      navigation.navigate('Category', { category: item });
    }
  };

  return (
    <View style={styles.quickAccessContainer}>
      {quickItems.map((item, idx) => (
        <TouchableOpacity 
          key={item.id || idx}
          style={styles.quickAccessCard}
          onPress={() => handlePress(item)}
          activeOpacity={0.8}
        >
          <View style={[styles.quickAccessImage, item.color && { backgroundColor: item.color }]}>
            {item.icon ? (
              <Ionicons name={item.icon} size={20} color="#fff" />
            ) : item.thumbnail ? (
              <Image source={{ uri: getThumbnailUrl(item.thumbnail) }} style={styles.quickAccessImg} />
            ) : (
              <LinearGradient colors={['#333', '#111']} style={styles.quickAccessImg}>
                <Ionicons name="musical-notes" size={18} color="rgba(255,255,255,0.5)" />
              </LinearGradient>
            )}
          </View>
          <Text style={styles.quickAccessText} numberOfLines={2}>{item.name}</Text>
        </TouchableOpacity>
      ))}
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
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.smallTile} 
            onPress={() => onItemPress(item)} 
            activeOpacity={0.8}
          >
            <View style={styles.smallTileImage}>
              {item.thumbnail ? (
                <Image source={{ uri: getThumbnailUrl(item.thumbnail) }} style={styles.smallTileImg} />
              ) : (
                <LinearGradient colors={['#333', '#111']} style={styles.smallTileImg}>
                  <Ionicons name="musical-notes" size={24} color="rgba(255,255,255,0.3)" />
                </LinearGradient>
              )}
            </View>
            <Text style={styles.smallTileTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.smallTileSubtitle} numberOfLines={1}>{item.artist_name || '2M Plays'}</Text>
          </TouchableOpacity>
        )}
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
        {items.slice(0, 4).map((item, idx) => (
          <TouchableOpacity 
            key={item.album_id || item.song_id || idx} 
            style={styles.verticalListItem}
            onPress={() => onItemPress(item)}
            activeOpacity={0.8}
          >
            <View style={styles.verticalListThumb}>
              {item.thumbnail ? (
                <Image source={{ uri: getThumbnailUrl(item.thumbnail) }} style={styles.verticalListImg} />
              ) : (
                <LinearGradient colors={['#333', '#111']} style={styles.verticalListImg}>
                  <Ionicons name="musical-notes" size={20} color="rgba(255,255,255,0.3)" />
                </LinearGradient>
              )}
            </View>
            <View style={styles.verticalListInfo}>
              <Text style={styles.verticalListTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.verticalListSubtitle} numberOfLines={1}>
                {item.songs_count ? `${item.songs_count} songs` : item.artist_name || '2M Plays'}
              </Text>
            </View>
            <TouchableOpacity style={styles.verticalListPlay} onPress={() => onItemPress(item)}>
              <Ionicons name="play-circle" size={32} color="#e91e63" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
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
        {items.slice(0, 4).map((item, idx) => (
          <TouchableOpacity 
            key={item.album_id || idx} 
            style={styles.gridItem}
            onPress={() => onItemPress(item)}
            activeOpacity={0.8}
          >
            <View style={styles.gridItemImage}>
              {item.thumbnail ? (
                <Image source={{ uri: getThumbnailUrl(item.thumbnail) }} style={styles.gridItemImg} />
              ) : (
                <LinearGradient colors={['#333', '#111']} style={styles.gridItemImg}>
                  <Ionicons name="musical-notes" size={32} color="rgba(255,255,255,0.3)" />
                </LinearGradient>
              )}
            </View>
            <Text style={styles.gridItemTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.gridItemSubtitle} numberOfLines={1}>{item.artist_name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// List with description and rating
const DescriptionListSection = ({ title, items, onItemPress, onSeeAll }) => {
  if (!items || items.length === 0) return null;
  
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll && <TouchableOpacity onPress={onSeeAll}><Text style={styles.seeAll}>See All</Text></TouchableOpacity>}
      </View>
      {items.slice(0, 3).map((item, idx) => (
        <TouchableOpacity 
          key={item.album_id || idx} 
          style={styles.descListItem}
          onPress={() => onItemPress(item)}
          activeOpacity={0.8}
        >
          <View style={styles.descListThumb}>
            {item.thumbnail ? (
              <Image source={{ uri: getThumbnailUrl(item.thumbnail) }} style={styles.descListImg} />
            ) : (
              <LinearGradient colors={['#333', '#111']} style={styles.descListImg}>
                <Ionicons name="musical-notes" size={28} color="rgba(255,255,255,0.3)" />
              </LinearGradient>
            )}
            <View style={styles.descListPlayBtn}>
              <Ionicons name="play" size={16} color="#fff" />
            </View>
          </View>
          <View style={styles.descListInfo}>
            <Text style={styles.descListTitle} numberOfLines={1}>{item.title}</Text>
            <View style={styles.descListMeta}>
              <Ionicons name="play" size={12} color={COLORS.textMuted} />
              <Text style={styles.descListPlays}>{item.total_plays || '366K'}</Text>
            </View>
            <Text style={styles.descListDesc} numberOfLines={2}>
              {item.description || `${item.artist_name || 'Various Artists'} - Stream now`}
            </Text>
          </View>
          <View style={styles.descListRating}>
            <Ionicons name="star" size={14} color="#FFD700" />
            <Text style={styles.descListRatingText}>4.5</Text>
          </View>
        </TouchableOpacity>
      ))}
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
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.largeCard} 
            onPress={() => onItemPress(item)} 
            activeOpacity={0.8}
          >
            <View style={styles.largeCardImage}>
              {item.thumbnail ? (
                <Image source={{ uri: getThumbnailUrl(item.thumbnail) }} style={styles.largeCardImg} />
              ) : (
                <LinearGradient colors={['#1e3a5f', '#0a192f']} style={styles.largeCardImg}>
                  <Ionicons name="musical-notes" size={40} color="rgba(255,255,255,0.3)" />
                </LinearGradient>
              )}
            </View>
            <Text style={styles.largeCardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.largeCardSubtitle} numberOfLines={1}>{item.artist_name || '2M Plays'}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

// ============ MAIN HOME SCREEN ============

export default function HomeScreen({ navigation }) {
  const [homeData, setHomeData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [allAlbums, setAllAlbums] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likedSongsCount, setLikedSongsCount] = useState(0);
  const [playlistsCount, setPlaylistsCount] = useState(0);
  const { currentSong } = usePlayer();
  const { user, isAuthenticated } = useAuth();

  const fetchData = useCallback(async () => {
    try {
      const [home, cats] = await Promise.all([
        contentService.getHome(),
        contentService.getCategories(),
      ]);
      setHomeData(home);
      setCategories(cats.categories || []);
      
      // Collect all albums from sections
      const albums = [];
      home?.sections?.forEach(section => {
        if (section.items) {
          albums.push(...section.items);
        }
      });
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
    } catch (error) {
      console.error('Error fetching home data:', error);
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

  // FIXED: Navigate to album with proper params - ensuring album_id is always passed
  const handleAlbumPress = useCallback((item) => {
    console.log('Album pressed:', item?.title, 'album_id:', item?.album_id);
    
    if (item.album_id) {
      navigation.navigate('Album', { albumId: item.album_id });
    } else if (item.id === 'liked') {
      navigation.navigate('Library');
    } else if (item.id === 'playlists') {
      navigation.navigate('Library');
    } else if (item.category_id) {
      navigation.navigate('Category', { category: item });
    } else {
      console.warn('No valid navigation target for item:', item);
    }
  }, [navigation]);

  const handleNowPlaying = useCallback(() => {
    navigation.navigate('NowPlaying');
  }, [navigation]);

  const handleProfilePress = useCallback(() => {
    navigation.navigate('Profile');
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e91e63" />
      </View>
    );
  }

  // Get sections data
  const burner = homeData?.burners?.[0];
  const sections = homeData?.sections || [];
  const featuredAlbums = sections.find(s => s.type === 'featured_albums')?.items || [];
  const filteredItems = getFilteredItems();
  
  // Split albums for different layouts
  const continuePlayingItems = featuredAlbums.slice(0, 6);
  const completedSeriesItems = allAlbums.slice(0, 8);
  const gridItems = activeCategory === 'all' ? allAlbums.slice(2, 6) : filteredItems.slice(0, 4);
  const newReleasesItems = allAlbums.slice(4, 7);
  const bestsellingItems = allAlbums.slice(0, 6);

  // Quick access items from categories and albums
  const quickAccessItems = [
    ...categories.slice(0, 3),
    ...featuredAlbums.slice(0, 3)
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
            tintColor="#e91e63"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.profileBtn} onPress={handleProfilePress}>
            <LinearGradient colors={['#e91e63', '#9c27b0']} style={styles.profileGradient}>
              <Text style={styles.profileInitial}>{user?.name?.charAt(0)?.toUpperCase() || 'S'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Spirit Songs</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('Search')}>
              <Ionicons name="search-outline" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="notifications-outline" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Section */}
        <HeroSection 
          item={burner || featuredAlbums[0]} 
          onPress={() => {
            const targetAlbum = burner || featuredAlbums[0];
            if (targetAlbum?.album_id) {
              handleAlbumPress(targetAlbum);
            }
          }}
        />

        {/* Filter Tabs - BELOW HERO (as requested) */}
        <FilterTabs 
          categories={categories}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />

        {/* Quick Access Grid - 8 items (4 per row) - RESTORED */}
        <QuickAccessGrid 
          items={quickAccessItems}
          onItemPress={handleAlbumPress}
          likedSongsCount={likedSongsCount}
          playlistsCount={playlistsCount}
          navigation={navigation}
        />

        {/* Continue Playing - Horizontal small tiles */}
        <HorizontalSmallTiles
          title="Continue Playing"
          items={continuePlayingItems}
          onItemPress={handleAlbumPress}
          onSeeAll={() => {}}
        />

        {/* Show filtered content when category selected */}
        {activeCategory !== 'all' && filteredItems.length > 0 && (
          <GridSection
            title={categories.find(c => c.category_id === activeCategory)?.name || 'Results'}
            items={filteredItems}
            onItemPress={handleAlbumPress}
            onSeeAll={() => {}}
          />
        )}

        {/* Completed mini series - Vertical list */}
        <VerticalListSection
          title="Popular Albums"
          items={completedSeriesItems}
          onItemPress={handleAlbumPress}
          onSeeAll={() => {}}
        />

        {/* Contemporary content - 2x2 Grid */}
        <GridSection
          title="Top Picks"
          items={gridItems}
          onItemPress={handleAlbumPress}
          onSeeAll={() => {}}
        />

        {/* New Releases - List with descriptions */}
        <DescriptionListSection
          title="New Releases"
          items={newReleasesItems}
          onItemPress={handleAlbumPress}
          onSeeAll={() => {}}
        />

        {/* Bestselling Stories - Large vertical cards */}
        <LargeCardsSection
          title="Bestselling"
          items={bestsellingItems}
          onItemPress={handleAlbumPress}
          onSeeAll={() => {}}
        />

        {/* Dynamic sections from admin */}
        {sections.map((section, idx) => {
          if (section.type === 'hero' || section.type === 'featured_albums') return null;
          const items = section.items || [];
          if (items.length === 0) return null;

          // Alternate layouts
          if (idx % 3 === 0) {
            return (
              <HorizontalSmallTiles
                key={section.section_id || idx}
                title={section.title}
                items={items}
                onItemPress={handleAlbumPress}
              />
            );
          } else if (idx % 3 === 1) {
            return (
              <GridSection
                key={section.section_id || idx}
                title={section.title}
                items={items}
                onItemPress={handleAlbumPress}
              />
            );
          } else {
            return (
              <LargeCardsSection
                key={section.section_id || idx}
                title={section.title}
                items={items}
                onItemPress={handleAlbumPress}
              />
            );
          }
        })}

        {/* Subscription Banner */}
        <TouchableOpacity style={styles.subscriptionBanner} onPress={handleProfilePress}>
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionTitle}>Subscription</Text>
            <View style={styles.subscriptionPlan}>
              <Text style={styles.subscriptionPlanName}>Free Plan</Text>
            </View>
          </View>
          <View style={styles.subscriptionPrice}>
            <Text style={styles.subscriptionPriceText}>Upgrade</Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Mini Player */}
      {currentSong && <MiniPlayer navigation={navigation} onPress={handleNowPlaying} />}
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
    height: 240,
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
    backgroundColor: '#e91e63',
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
    backgroundColor: '#e91e63',
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
  heroInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
  },
  heroInfoText: {
    color: '#fff',
    fontSize: 13,
  },
  heroPlaysBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#e91e63',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  heroPlaysText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
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
    backgroundColor: '#e91e63',
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
  // Quick Access Grid
  quickAccessContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  quickAccessCard: {
    width: (width - 32) / 2,
    height: 56,
    backgroundColor: '#1a1a2e',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    margin: 4,
  },
  quickAccessImage: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  seeAll: {
    color: '#e91e63',
    fontSize: 13,
    fontWeight: '600',
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  // Small Tiles
  smallTile: {
    width: 110,
    marginRight: 12,
  },
  smallTileImage: {
    width: 110,
    height: 110,
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
    fontSize: 12,
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
    aspectRatio: 16 / 10,
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
  // Description List
  descListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  descListThumb: {
    width: 70,
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  descListImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  descListPlayBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  descListInfo: {
    flex: 1,
    marginLeft: 12,
  },
  descListTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  descListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  descListPlays: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  descListDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  descListRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  descListRatingText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
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
  // Subscription Banner
  subscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
  },
  subscriptionInfo: {},
  subscriptionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionPlan: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 6,
  },
  subscriptionPlanName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  subscriptionPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e91e63',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 4,
  },
  subscriptionPriceText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
