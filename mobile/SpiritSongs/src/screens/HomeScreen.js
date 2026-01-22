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

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [sections, setSections] = useState([]);
  const [quickAccess, setQuickAccess] = useState([]);
  const [featuredMixes, setFeaturedMixes] = useState([]);
  const [recentAlbums, setRecentAlbums] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');

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
      const [homeRes, mixesRes, albumsRes, songsRes, categoriesRes] = await Promise.all([
        homeAPI.getHome().catch(() => ({ data: {} })),
        homeAPI.getSpecialMixes().catch(() => ({ data: [] })),
        contentAPI.getAlbums().catch(() => ({ data: [] })),
        contentAPI.getAllSongs().catch(() => ({ data: { songs: [] } })),
        contentAPI.getCategories().catch(() => ({ data: [] })),
      ]);

      // Process sections from home API
      if (homeRes.data?.sections) {
        setSections(homeRes.data.sections);
      }

      // Featured mixes
      setFeaturedMixes(mixesRes.data?.mixes || mixesRes.data || []);

      // Recent albums (take first 10)
      const albums = albumsRes.data?.albums || albumsRes.data || [];
      setRecentAlbums(albums.slice(0, 10));

      // Quick access - combine mixes and albums
      const quick = [...(mixesRes.data?.mixes || mixesRes.data || []).slice(0, 3), ...albums.slice(0, 3)];
      setQuickAccess(quick);

      // All songs
      setAllSongs(songsRes.data?.songs || []);

      // Categories
      setCategories(categoriesRes.data || []);

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

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
              onPress={() => navigation.navigate('Settings')}
            >
              <Ionicons name="settings-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Access Grid - Spotify style */}
        {quickAccess.length > 0 && (
          <View style={styles.quickAccessContainer}>
            <View style={styles.quickAccessGrid}>
              {quickAccess.slice(0, 6).map((item, index) => (
                <WideCard
                  key={item.album_id || item.mix_id || index}
                  item={item}
                  onPress={() => item.mix_id ? handleMixPress(item) : handleAlbumPress(item)}
                />
              ))}
            </View>
          </View>
        )}

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

        {/* Category Filters */}
        {categories.length > 0 && (
          <View style={styles.section}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              <CategoryChip
                label="All"
                isActive={selectedCategory === 'all'}
                onPress={() => setSelectedCategory('all')}
              />
              {categories.map((cat) => (
                <CategoryChip
                  key={cat.category_id}
                  label={cat.name}
                  isActive={selectedCategory === cat.category_id}
                  onPress={() => setSelectedCategory(cat.category_id)}
                />
              ))}
            </ScrollView>
          </View>
        )}

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

        {/* Popular Songs - List */}
        {allSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Songs</Text>
              <TouchableOpacity onPress={() => navigation.navigate('AllSongs', { songs: allSongs })}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {allSongs.slice(0, 5).map((song, index) => (
              <SongListItem
                key={song.song_id}
                item={song}
                index={index}
                isPlaying={currentTrack?.song_id === song.song_id}
                onPress={() => handlePlaySong(song, allSongs)}
              />
            ))}
          </View>
        )}

        {/* Made for You - Medium Cards */}
        {recentAlbums.length > 3 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Made for You</Text>
            <FlatList
              horizontal
              data={recentAlbums.slice(3, 8)}
              keyExtractor={(item) => `made-${item.album_id}`}
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

        {/* Bottom spacing for mini player */}
        <View style={{ height: 150 }} />
      </ScrollView>
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
  quickAccessContainer: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
  categoryScroll: {
    paddingHorizontal: SPACING.md,
  },
});

export default HomeScreen;
