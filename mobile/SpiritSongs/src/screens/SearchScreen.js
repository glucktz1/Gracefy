import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { contentAPI } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { MediumCard, SongListItem, CategoryChip } from '../components/Cards';

const SearchScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState({ songs: [], albums: [] });
  const [categories, setCategories] = useState([]);
  const [allAlbums, setAllAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  const { playTrack, currentTrack } = usePlayer();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [categoriesRes, albumsRes] = await Promise.all([
        contentAPI.getCategories(),
        contentAPI.getAlbums(),
      ]);
      setCategories(categoriesRes.data || []);
      setAllAlbums(albumsRes.data?.albums || albumsRes.data || []);
    } catch (error) {
      console.error('Error loading search data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (text) => {
    setQuery(text);
    
    if (text.length < 2) {
      setResults({ songs: [], albums: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    try {
      const response = await contentAPI.search(text);
      setResults({
        songs: response.data?.songs || [],
        albums: response.data?.albums || [],
      });
    } catch (error) {
      console.error('Search error:', error);
      // Fallback: filter locally
      const filteredAlbums = allAlbums.filter(a => 
        a.title?.toLowerCase().includes(text.toLowerCase()) ||
        a.artist_name?.toLowerCase().includes(text.toLowerCase())
      );
      setResults({
        songs: [],
        albums: filteredAlbums,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlaySong = (song) => {
    playTrack(song, results.songs, results.songs.indexOf(song));
  };

  const handleAlbumPress = (album) => {
    navigation.navigate('Album', { album });
  };

  const handleCategoryPress = (category) => {
    navigation.navigate('Category', { category });
  };

  const clearSearch = () => {
    setQuery('');
    setResults({ songs: [], albums: [] });
    Keyboard.dismiss();
  };

  const hasResults = results.songs.length > 0 || results.albums.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="What do you want to listen to?"
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={handleSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Loading */}
        {isSearching && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}

        {/* Search Results */}
        {query.length > 0 && hasResults && !isSearching && (
          <>
            {/* Songs Results */}
            {results.songs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Songs</Text>
                {results.songs.slice(0, 5).map((song, index) => (
                  <SongListItem
                    key={song.song_id}
                    item={song}
                    index={index}
                    isPlaying={currentTrack?.song_id === song.song_id}
                    onPress={() => handlePlaySong(song)}
                  />
                ))}
              </View>
            )}

            {/* Albums Results */}
            {results.albums.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Albums</Text>
                <FlatList
                  horizontal
                  data={results.albums}
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
          </>
        )}

        {/* No Results */}
        {query.length > 0 && !hasResults && !isSearching && (
          <View style={styles.noResults}>
            <Ionicons name="search-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.noResultsText}>No results found for "{query}"</Text>
            <Text style={styles.noResultsSubtext}>Check your spelling or try different keywords</Text>
          </View>
        )}

        {/* Browse Categories - shown when not searching */}
        {query.length === 0 && (
          <>
            <Text style={styles.browseTitle}>Browse all</Text>
            <View style={styles.categoriesGrid}>
              {categories.map((category, index) => (
                <TouchableOpacity
                  key={category.category_id}
                  style={[
                    styles.categoryCard,
                    { backgroundColor: getCategoryColor(index) }
                  ]}
                  onPress={() => handleCategoryPress(category)}
                >
                  <Text style={styles.categoryName}>{category.name}</Text>
                </TouchableOpacity>
              ))}
              {/* Add some default categories if none exist */}
              {categories.length === 0 && (
                <>
                  <TouchableOpacity style={[styles.categoryCard, { backgroundColor: '#E13300' }]}>
                    <Text style={styles.categoryName}>Worship</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.categoryCard, { backgroundColor: '#1E3264' }]}>
                    <Text style={styles.categoryName}>Gospel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.categoryCard, { backgroundColor: '#8D67AB' }]}>
                    <Text style={styles.categoryName}>Praise</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.categoryCard, { backgroundColor: '#1DB954' }]}>
                    <Text style={styles.categoryName}>New Releases</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 150 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const getCategoryColor = (index) => {
  const colors = [
    '#E13300', '#1E3264', '#8D67AB', '#1DB954',
    '#E91429', '#148A08', '#509BF5', '#E8115B',
    '#F59B23', '#777777', '#27856A', '#BA5D07',
  ];
  return colors[index % colors.length];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  searchContainer: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: FONT_SIZES.md,
    color: COLORS.background,
  },
  clearButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  horizontalList: {
    paddingHorizontal: SPACING.md,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  noResultsText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  browseTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.sm,
  },
  categoryCard: {
    width: '46%',
    height: 100,
    margin: '2%',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  categoryName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
});

export default SearchScreen;
