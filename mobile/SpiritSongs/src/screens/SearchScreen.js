import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Image,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { searchAPI, homeAPI, getImageUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { AlbumCard, SongListItem, CategoryChip } from '../components/Cards';
import { showToast } from '../components/Toast';

const SearchScreen = ({ navigation }) => {
  // State
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState({ songs: [], albums: [] });
  const [categories, setCategories] = useState([]);
  const [allAlbums, setAllAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  // Context - call hooks unconditionally at top level
  const playerContext = usePlayer();
  
  // Safe extraction
  const playTrack = playerContext?.playTrack ?? (() => {});
  const currentTrack = playerContext?.currentTrack ?? null;
  
  // Ref for search debounce
  const searchTimeoutRef = useRef(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Auto-search with debounce when query changes
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // If query is empty, clear results immediately
    if (!query.trim()) {
      setResults({ songs: [], albums: [] });
      return;
    }
    
    // Debounce search - wait 500ms after user stops typing
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch();
    }, 500);
    
    // Cleanup
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, handleSearch]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, albumsRes] = await Promise.all([
        homeAPI.getCategories().catch(() => ({ data: { categories: [] } })),
        homeAPI.getAlbums().catch(() => ({ data: { albums: [] } })),
      ]);
      
      setCategories(categoriesRes?.data?.categories ?? []);
      setAllAlbums(albumsRes?.data?.albums ?? []);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async () => {
    const searchQuery = query.trim();
    if (!searchQuery) {
      setResults({ songs: [], albums: [] });
      return;
    }

    setIsSearching(true);
    
    try {
      const response = await searchAPI.search(searchQuery);
      setResults({
        songs: response?.data?.songs ?? [],
        albums: response?.data?.albums ?? [],
      });
    } catch (error) {
      console.error('Search error:', error);
      showToast('Imeshindwa kutafuta', 'error');
      setResults({ songs: [], albums: [] });
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setResults({ songs: [], albums: [] });
    Keyboard.dismiss();
  }, []);

  const handlePlaySong = useCallback((song, songList) => {
    if (!song) return;
    try {
      playTrack(song, songList);
    } catch (error) {
      console.error('Error playing song:', error);
      showToast('Imeshindwa kucheza', 'error');
    }
  }, [playTrack]);

  const handleCategoryPress = useCallback((category) => {
    navigation.navigate('SeeAll', {
      type: 'category',
      category: category,
      title: category?.name ?? 'Category',
    });
  }, [navigation]);

  const handleAlbumPress = useCallback((album) => {
    navigation.navigate('Album', { album });
  }, [navigation]);

  // Check if we have search results
  const hasResults = (results?.songs?.length ?? 0) > 0 || (results?.albums?.length ?? 0) > 0;
  const showSearchResults = query.trim().length > 0;

  // Render search results
  const renderSearchResults = () => (
    <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Inatafuta...</Text>
        </View>
      ) : hasResults ? (
        <>
          {/* Albums Results */}
          {(results?.albums?.length ?? 0) > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionTitle}>Albamu</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {(results?.albums ?? []).map((album, index) => (
                  <TouchableOpacity
                    key={album?.album_id ?? `album-${index}`}
                    style={styles.albumCard}
                    onPress={() => handleAlbumPress(album)}
                  >
                    <Image
                      source={{ uri: getImageUrl(album?.thumbnail) || 'https://via.placeholder.com/120' }}
                      style={styles.albumImage}
                    />
                    <Text style={styles.albumTitle} numberOfLines={1}>
                      {album?.title ?? 'Album'}
                    </Text>
                    <Text style={styles.albumArtist} numberOfLines={1}>
                      {album?.artist_name ?? 'Artist'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Songs Results */}
          {(results?.songs?.length ?? 0) > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultSectionTitle}>Nyimbo</Text>
              {(results?.songs ?? []).map((song, index) => (
                <SongListItem
                  key={song?.song_id ?? `song-${index}`}
                  item={song}
                  index={index}
                  isPlaying={currentTrack?.song_id === song?.song_id}
                  isCurrentSong={currentTrack?.song_id === song?.song_id}
                  onPress={() => handlePlaySong(song, results.songs)}
                />
              ))}
            </View>
          )}
        </>
      ) : query.trim().length > 0 ? (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.noResultsTitle}>Hakuna matokeo</Text>
          <Text style={styles.noResultsText}>
            Jaribu kutafuta kwa maneno mengine
          </Text>
        </View>
      ) : null}

      {/* Bottom spacing */}
      <View style={{ height: 150 }} />
    </ScrollView>
  );

  // Render browse content (when not searching)
  const renderBrowseContent = () => (
    <ScrollView style={styles.browseContainer} showsVerticalScrollIndicator={false}>
      {/* Categories */}
      {(categories?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aina za Muziki</Text>
          <View style={styles.categoriesGrid}>
            {(categories ?? []).map((category, index) => (
              <TouchableOpacity
                key={category?.category_id ?? `cat-${index}`}
                style={[
                  styles.categoryCard,
                  { backgroundColor: getCategoryColor(index) }
                ]}
                onPress={() => handleCategoryPress(category)}
              >
                <Text style={styles.categoryName}>{category?.name ?? 'Category'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Browse Albums */}
      {(allAlbums?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vinjari Albamu</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(allAlbums ?? []).slice(0, 10).map((album, index) => (
              <TouchableOpacity
                key={album?.album_id ?? `browse-album-${index}`}
                style={styles.albumCard}
                onPress={() => handleAlbumPress(album)}
              >
                <Image
                  source={{ uri: getImageUrl(album?.thumbnail) || 'https://via.placeholder.com/120' }}
                  style={styles.albumImage}
                />
                <Text style={styles.albumTitle} numberOfLines={1}>
                  {album?.title ?? 'Album'}
                </Text>
                <Text style={styles.albumArtist} numberOfLines={1}>
                  {album?.artist_name ?? 'Artist'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Bottom spacing */}
      <View style={{ height: 150 }} />
    </ScrollView>
  );

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tafuta</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tafuta</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Nyimbo, albamu, wasanii..."
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {query.length > 0 && (
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Tafuta</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {showSearchResults ? renderSearchResults() : renderBrowseContent()}
    </SafeAreaView>
  );
};

// Helper function for category colors
const getCategoryColor = (index) => {
  const colors = [
    '#1DB954', '#E91E63', '#9C27B0', '#3F51B5',
    '#00BCD4', '#FF9800', '#795548', '#607D8B',
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
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
  },
  browseContainer: {
    flex: 1,
  },
  resultsContainer: {
    flex: 1,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  categoryCard: {
    width: '47%',
    height: 80,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    justifyContent: 'flex-end',
  },
  categoryName: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  albumCard: {
    width: 140,
    marginLeft: SPACING.md,
  },
  albumImage: {
    width: 140,
    height: 140,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  albumTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  albumArtist: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  resultSection: {
    marginBottom: SPACING.lg,
  },
  resultSectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.xxl,
  },
  noResultsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  noResultsText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
});

export default SearchScreen;
