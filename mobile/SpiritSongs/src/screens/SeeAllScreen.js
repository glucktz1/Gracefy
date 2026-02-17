import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { contentAPI, churchAPI, leaderContentAPI, homeAPI, getImageUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { SongListItem } from '../components/Cards';

const SeeAllScreen = ({ navigation, route }) => {
  const { category, title, type } = route.params || {};
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableTags, setAvailableTags] = useState([]);
  
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  useEffect(() => {
    loadItems();
    loadTags();
  }, [category, type]);

  const loadTags = async () => {
    try {
      const res = await homeAPI.getTags();
      setAvailableTags(res?.data?.tags || []);
    } catch (e) {
      console.log('Failed to load tags');
    }
  };

  useEffect(() => {
    filterItems();
  }, [searchQuery, items]);

  const loadItems = async () => {
    try {
      setLoading(true);
      let data = [];
      
      switch (type) {
        case 'albums':
          const albumsRes = await contentAPI.getAlbums();
          data = albumsRes.data?.albums || albumsRes.data || [];
          if (category && category !== 'all') {
            data = data.filter(a => 
              a.category?.toLowerCase() === category.toLowerCase() ||
              a.genre?.toLowerCase() === category.toLowerCase()
            );
          }
          break;
          
        case 'songs':
          const songsRes = await contentAPI.getAllSongs();
          data = songsRes.data?.songs || songsRes.data || [];
          if (category && category !== 'all') {
            data = data.filter(s => 
              s.category?.toLowerCase() === category.toLowerCase() ||
              s.genre?.toLowerCase() === category.toLowerCase()
            );
          }
          break;
          
        case 'churches':
          const churchRes = await churchAPI.getChurches();
          data = churchRes.data?.churches || churchRes.data || [];
          break;
          
        case 'leaders':
          const leadersRes = await leaderContentAPI.getLeaders?.() || { data: [] };
          data = leadersRes.data?.leaders || leadersRes.data || [];
          break;
          
        case 'mafundisho':
          const mafundishoRes = await leaderContentAPI.getMafundisho();
          data = mafundishoRes.data?.mafundisho || mafundishoRes.data || [];
          break;
          
        default:
          // Try to load albums as default
          const defaultRes = await contentAPI.getAlbums();
          data = defaultRes.data?.albums || defaultRes.data || [];
      }
      
      setItems(data);
      setFilteredItems(data);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterItems = () => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = items.filter(item => {
      const name = item.name || item.title || '';
      const artist = item.artist_name || item.leader_name || '';
      const location = item.location || item.city || '';
      return (
        name.toLowerCase().includes(query) ||
        artist.toLowerCase().includes(query) ||
        location.toLowerCase().includes(query)
      );
    });
    setFilteredItems(filtered);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadItems();
  }, [category, type]);

  const handleItemPress = (item) => {
    switch (type) {
      case 'albums':
        navigation.navigate('Album', { album: item });
        break;
      case 'songs':
        playTrack(item, filteredItems, filteredItems.indexOf(item));
        break;
      case 'churches':
        navigation.navigate('Churches', { selectedChurch: item });
        break;
      case 'leaders':
      case 'mafundisho':
        navigation.navigate('MafundishoDetail', { 
          containerId: item.container_id, 
          mafundisho: item 
        });
        break;
      default:
        navigation.navigate('Album', { album: item });
    }
  };

  const renderAlbumItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.albumCard}
      onPress={() => handleItemPress(item)}
    >
      <Image
        source={{ uri: getImageUrl(item.thumbnail) || 'https://via.placeholder.com/150' }}
        style={styles.albumImage}
      />
      <Text style={styles.albumTitle} numberOfLines={2}>{item.name || item.title}</Text>
      <Text style={styles.albumArtist} numberOfLines={1}>{item.artist_name || 'Unknown'}</Text>
    </TouchableOpacity>
  );

  const renderSongItem = ({ item, index }) => (
    <SongListItem
      item={item}
      index={index}
      isPlaying={currentTrack?.song_id === item.song_id && isPlaying}
      isCurrentSong={currentTrack?.song_id === item.song_id}
      onPress={() => handleItemPress(item)}
    />
  );

  const renderChurchItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.churchCard}
      onPress={() => handleItemPress(item)}
    >
      <Image
        source={{ uri: getImageUrl(item.thumbnail) || 'https://via.placeholder.com/100' }}
        style={styles.churchImage}
      />
      <View style={styles.churchInfo}>
        <Text style={styles.churchName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.churchLocation} numberOfLines={1}>
          <Ionicons name="location-outline" size={12} color={COLORS.textMuted} /> 
          {item.location || item.city || 'Tanzania'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  const renderMafundishoItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.mafundishoCard}
      onPress={() => handleItemPress(item)}
    >
      <Image
        source={{ uri: getImageUrl(item.thumbnail || item.leader_photo) || 'https://via.placeholder.com/80' }}
        style={styles.mafundishoImage}
      />
      <View style={styles.mafundishoInfo}>
        <Text style={styles.mafundishoTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.mafundishoLeader} numberOfLines={1}>
          na {item.leader_name || 'Unknown'}
        </Text>
        <Text style={styles.mafundishoMeta}>
          {item.series_count || 0} mfululizo • {item.total_classes || item.episode_count || 0} vipindi
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  const getRenderer = () => {
    switch (type) {
      case 'songs':
        return renderSongItem;
      case 'churches':
        return renderChurchItem;
      case 'leaders':
      case 'mafundisho':
        return renderMafundishoItem;
      default:
        return renderAlbumItem;
    }
  };

  const getNumColumns = () => {
    return type === 'albums' ? 2 : 1;
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title || 'Orodha'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tafuta..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results Count */}
      <Text style={styles.resultsCount}>
        {filteredItems.length} {type === 'songs' ? 'nyimbo' : 'matokeo'}
      </Text>

      {/* Items List */}
      <FlatList
        data={filteredItems}
        renderItem={getRenderer()}
        keyExtractor={(item) => item.song_id || item.album_id || item.church_id || item.container_id || item.leader_id || Math.random().toString()}
        numColumns={getNumColumns()}
        key={getNumColumns()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Hakuna matokeo</Text>
          </View>
        }
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  resultsCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100,
  },
  // Album styles
  albumCard: {
    flex: 1,
    margin: SPACING.xs,
    maxWidth: '48%',
  },
  albumImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
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
  // Church styles
  churchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  churchImage: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  churchInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  churchName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  churchLocation: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  // Mafundisho styles
  mafundishoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  mafundishoImage: {
    width: 70,
    height: 70,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  mafundishoInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  mafundishoTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  mafundishoLeader: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginTop: 2,
  },
  mafundishoMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
});

export default SeeAllScreen;
