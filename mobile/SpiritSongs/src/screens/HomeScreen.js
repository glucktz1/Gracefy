import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  FlatList,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { homeAPI, contentAPI, getImageUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { LargeCard, MediumCard, SmallCard, WideCard, CategoryChip, SongListItem } from '../components/Cards';
import AddToPlaylistModal from '../components/AddToPlaylistModal';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [layoutSections, setLayoutSections] = useState([]);
  const [quickAccess, setQuickAccess] = useState([]);
  const [featuredMixes, setFeaturedMixes] = useState([]);
  const [recentAlbums, setRecentAlbums] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [burners, setBurners] = useState([]);
  
  // Add to playlist modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);

  const { playTrack, currentTrack } = usePlayer();

  useEffect(() => {
    updateGreeting();
    loadData();
  }, []);

  const updateGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [appHomeRes, sectionsRes, burnersRes, mixesRes, albumsRes, songsRes, categoriesRes] = await Promise.all([
        homeAPI.getAppHome().catch(() => ({ data: {} })),
        homeAPI.getSections().catch(() => ({ data: [] })),
        homeAPI.getBurners().catch(() => ({ data: [] })),
        homeAPI.getSpecialMixes().catch(() => ({ data: [] })),
        contentAPI.getAlbums().catch(() => ({ data: [] })),
        contentAPI.getAllSongs().catch(() => ({ data: { songs: [] } })),
        contentAPI.getCategories().catch(() => ({ data: [] })),
      ]);

      // Layout sections from Layout Manager
      const sections = sectionsRes.data?.sections || sectionsRes.data || [];
      setLayoutSections(sections.filter(s => s.is_active));

      // Burners (quick links)
      setBurners(burnersRes.data?.burners || burnersRes.data || []);

      // Featured mixes
      setFeaturedMixes(mixesRes.data?.mixes || mixesRes.data || []);

      // Recent albums
      const albums = albumsRes.data?.albums || albumsRes.data || [];
      setRecentAlbums(albums.slice(0, 10));

      // Quick access - combine mixes and albums
      const quick = [...(mixesRes.data?.mixes || mixesRes.data || []).slice(0, 3), ...albums.slice(0, 3)];
      setQuickAccess(quick);

      // All songs - add album thumbnail to each song
      const songs = songsRes.data?.songs || [];
      const songsWithThumbnails = songs.map(song => {
        if (!song.thumbnail && !song.thumbnail_url) {
          const album = albums.find(a => a.album_id === song.album_id);
          if (album) {
            return { ...song, thumbnail: album.thumbnail || album.thumbnail_url };
          }
        }
        return song;
      });
      setAllSongs(songsWithThumbnails);

      // Categories from Layout Manager sections
      const layoutCategories = sections
        .filter(s => s.is_active && s.section_type !== 'quick_access')
        .map(s => ({ category_id: s.section_id, name: s.title || s.name }));
      setCategories([...layoutCategories, ...(categoriesRes.data || [])]);

    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
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

  const handleAddToPlaylist = (song) => {
    setSelectedSong(song);
    setShowPlaylistModal(true);
  };

  const handleQuickAccessPress = (item) => {
    // Check item type and navigate accordingly
    if (item.type === 'bible' || item.name?.toLowerCase().includes('bible') || item.name?.toLowerCase().includes('biblia')) {
      navigation.navigate('Bible');
    } else if (item.type === 'church' || item.name?.toLowerCase().includes('church') || item.name?.toLowerCase().includes('kanisa')) {
      navigation.navigate('Churches');
    } else if (item.mix_id) {
      handleMixPress(item);
    } else if (item.album_id) {
      handleAlbumPress(item);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Filter songs by category
  const filteredSongs = selectedCategory === 'all' 
    ? allSongs 
    : allSongs.filter(s => s.category_ids?.includes(selectedCategory));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="time-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerIcon}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="person-circle-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Filters - From Layout Manager */}
        {layoutSections.length > 0 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.filtersContainer}
            contentContainerStyle={styles.filtersContent}
          >
            <CategoryChip
              label="All"
              isActive={selectedCategory === 'all'}
              onPress={() => setSelectedCategory('all')}
            />
            {layoutSections.slice(0, 5).map((section) => (
              <CategoryChip
                key={section.section_id}
                label={section.title || section.name}
                isActive={selectedCategory === section.section_id}
                onPress={() => setSelectedCategory(section.section_id)}
              />
            ))}
          </ScrollView>
        )}

        {/* Quick Access Grid - Spotify style */}
        <View style={styles.quickAccessContainer}>
          <View style={styles.quickAccessGrid}>
            {/* Static quick access items */}
            <WideCard
              item={{ title: 'Liked Songs', thumbnail: null, icon: 'heart' }}
              onPress={() => navigation.navigate('Library')}
              style={styles.likedSongsCard}
            />
            <WideCard
              item={{ title: 'Biblia', thumbnail: null, icon: 'book' }}
              onPress={() => navigation.navigate('Bible')}
            />
            <WideCard
              item={{ title: 'Makanisa', thumbnail: null, icon: 'business' }}
              onPress={() => navigation.navigate('Churches')}
            />
            {/* Dynamic quick access from Layout Manager burners */}
            {burners.slice(0, 3).map((burner, index) => (
              <WideCard
                key={burner.burner_id || index}
                item={burner}
                onPress={() => handleQuickAccessPress(burner)}
              />
            ))}
          </View>
        </View>

        {/* Featured Mixes - Large Cards */}
        {featuredMixes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Featured Mixes</Text>
            <FlatList
              horizontal
              data={featuredMixes}
              keyExtractor={(item) => item.mix_id}
              renderItem={({ item }) => (
                <LargeCard
                  item={item}
                  onPress={() => handleMixPress(item)}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Layout Manager Sections */}
        {layoutSections.map((section) => {
          if (section.section_type === 'quick_access') return null;
          
          const sectionContent = section.content || [];
          if (sectionContent.length === 0 && recentAlbums.length === 0) return null;

          return (
            <View key={section.section_id} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title || section.name}</Text>
                <TouchableOpacity>
                  <Text style={styles.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                horizontal
                data={sectionContent.length > 0 ? sectionContent : recentAlbums.slice(0, 5)}
                keyExtractor={(item, index) => item.album_id || item.mix_id || `${section.section_id}-${index}`}
                renderItem={({ item }) => (
                  <MediumCard
                    item={item}
                    onPress={() => item.mix_id ? handleMixPress(item) : handleAlbumPress(item)}
                  />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              />
            </View>
          );
        })}

        {/* Recently Added Albums - Medium Cards */}
        {recentAlbums.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Added</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              data={recentAlbums}
              keyExtractor={(item) => item.album_id}
              renderItem={({ item }) => (
                <MediumCard
                  item={item}
                  onPress={() => handleAlbumPress(item)}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Popular Songs - List with Add to Playlist */}
        {allSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Songs</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AllSongs', { songs: allSongs })}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {(selectedCategory === 'all' ? allSongs : filteredSongs).slice(0, 5).map((song, index) => (
              <SongListItem
                key={song.song_id}
                item={song}
                index={index}
                isPlaying={currentTrack?.song_id === song.song_id}
                onPress={() => handlePlaySong(song, allSongs)}
                onAddPress={handleAddToPlaylist}
              />
            ))}
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
    paddingVertical: SPACING.md,
  },
  greeting: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  headerIcon: {
    marginLeft: SPACING.md,
    padding: SPACING.xs,
  },
  filtersContainer: {
    marginBottom: SPACING.md,
  },
  filtersContent: {
    paddingHorizontal: SPACING.md,
  },
  quickAccessContainer: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  likedSongsCard: {
    backgroundColor: COLORS.primary + '40',
  },
  section: {
    marginBottom: SPACING.lg,
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
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  seeAll: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  horizontalList: {
    paddingHorizontal: SPACING.md,
  },
});

export default HomeScreen;
