import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image,
  StyleSheet, Dimensions, ActivityIndicator, Keyboard
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { contentService, getItemThumbnail } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import SongListItem from '../components/SongListItem';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

const CategoryCard = ({ category, onPress }) => {
  const colors = [
    ['#e13300', '#a52800'],
    ['#8c1932', '#5e1020'],
    ['#477d95', '#2a5066'],
    ['#1e3264', '#0f1932'],
    ['#503750', '#30223a'],
    ['#8b2041', '#5c1530'],
    ['#2d7f6e', '#1a4d42'],
    ['#7856ff', '#4f3bb2'],
  ];
  const colorIndex = Math.abs(category.name?.charCodeAt(0) || 0) % colors.length;
  
  return (
    <TouchableOpacity style={styles.categoryCard} onPress={onPress} activeOpacity={0.8}>
      <LinearGradient
        colors={colors[colorIndex]}
        style={styles.categoryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.categoryName}>{category.name}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const AlbumCard = ({ album, onPress }) => {
  const thumbUrl = getItemThumbnail(album);
  return (
    <TouchableOpacity style={styles.searchAlbumCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.searchAlbumArt}>
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.searchAlbumImg} />
        ) : (
          <LinearGradient colors={['#535353', '#121212']} style={styles.searchAlbumImg}>
            <Ionicons name="musical-notes" size={32} color="rgba(255,255,255,0.3)" />
          </LinearGradient>
        )}
      </View>
      <View style={styles.searchAlbumInfo}>
        <Text style={styles.searchAlbumTitle} numberOfLines={1}>{album.title}</Text>
        <Text style={styles.searchAlbumArtist} numberOfLines={1}>Album • {album.artist_name}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { currentSong } = usePlayer();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await contentService.getCategories();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async (text) => {
    setQuery(text);
    
    if (text.length < 2) {
      setResults(null);
      return;
    }

    setSearching(true);
    try {
      const data = await contentService.search(text);
      setResults(data);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setSearching(false);
    }
  }, []);

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    Keyboard.dismiss();
  };

  const handleNowPlaying = () => {
    navigation.navigate('NowPlaying');
  };

  const renderSearchResults = () => {
    if (!results) return null;

    const hasResults = 
      (results.songs?.length > 0) || 
      (results.albums?.length > 0) || 
      (results.artists?.length > 0);

    if (!hasResults) {
      return (
        <View style={styles.noResults}>
          <Ionicons name="search-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.noResultsText}>No results found for "{query}"</Text>
          <Text style={styles.noResultsHint}>
            Check your spelling or try different keywords
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={[
          ...(results.songs?.slice(0, 5).map(s => ({ ...s, type: 'song' })) || []),
          ...(results.albums?.slice(0, 5).map(a => ({ ...a, type: 'album' })) || []),
        ]}
        keyExtractor={(item, idx) => `${item.type}-${item.song_id || item.album_id || idx}`}
        renderItem={({ item }) => {
          if (item.type === 'song') {
            return (
              <SongListItem
                song={item}
                showIndex={false}
                showThumbnail={true}
              />
            );
          }
          return (
            <AlbumCard 
              album={item}
              onPress={() => navigation.navigate('Album', { albumId: item.album_id })}
            />
          );
        }}
        contentContainerStyle={styles.resultsList}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.background} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="What do you want to listen to?"
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {searching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : query.length >= 2 ? (
        renderSearchResults()
      ) : loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.category_id}
          numColumns={2}
          renderItem={({ item }) => (
            <CategoryCard 
              category={item}
              onPress={() => navigation.navigate('Category', { category: item })}
            />
          )}
          contentContainerStyle={[
            styles.categoriesGrid,
            currentSong && { paddingBottom: 140 }
          ]}
          ListHeaderComponent={
            <Text style={styles.browseTitle}>Browse all</Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.textPrimary,
    borderRadius: 4,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '500',
  },
  clearBtn: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  browseTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  categoriesGrid: {
    padding: 16,
  },
  categoryCard: {
    width: (width - 40) / 2,
    height: 100,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  categoryGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'flex-end',
  },
  categoryName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  noResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noResultsText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  noResultsHint: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  resultsList: {
    paddingBottom: 100,
  },
  searchAlbumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
  },
  searchAlbumArt: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
  },
  searchAlbumImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchAlbumInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchAlbumTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  searchAlbumArtist: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
});
