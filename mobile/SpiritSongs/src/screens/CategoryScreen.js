import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, ActivityIndicator, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { contentService } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import MiniPlayer from '../components/MiniPlayer';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

const AlbumCard = ({ album, onPress }) => (
  <TouchableOpacity style={styles.albumCard} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.albumArt}>
      {album.thumbnail ? (
        <Image source={{ uri: album.thumbnail }} style={styles.albumImg} />
      ) : (
        <LinearGradient colors={['#535353', '#121212']} style={styles.albumImg}>
          <Ionicons name="musical-notes" size={40} color="rgba(255,255,255,0.3)" />
        </LinearGradient>
      )}
    </View>
    <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
    <Text style={styles.albumArtist} numberOfLines={1}>{album.artist_name || 'Various Artists'}</Text>
  </TouchableOpacity>
);

export default function CategoryScreen({ route, navigation }) {
  const { category } = route.params;
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const { currentSong } = usePlayer();

  useEffect(() => {
    fetchCategoryAlbums();
  }, [category.category_id]);

  const fetchCategoryAlbums = async () => {
    try {
      const data = await contentService.getCategoryAlbums(category.category_id);
      setAlbums(data.albums || []);
    } catch (error) {
      console.error('Error fetching category albums:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNowPlaying = () => {
    navigation.navigate('NowPlaying');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#404040', COLORS.background]}
        style={styles.header}
      >
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.categoryTitle}>{category.name}</Text>
        <Text style={styles.albumCount}>{albums.length} albums</Text>
      </LinearGradient>

      {/* Albums Grid */}
      <FlatList
        data={albums}
        keyExtractor={(item) => item.album_id}
        numColumns={2}
        renderItem={({ item }) => (
          <AlbumCard 
            album={item}
            onPress={() => navigation.navigate('Album', { albumId: item.album_id })}
          />
        )}
        contentContainerStyle={[
          styles.albumsGrid,
          currentSong && { paddingBottom: 140 }
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="disc-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No albums in this category</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Mini Player */}
      {currentSong && <MiniPlayer navigation={navigation} onPress={handleNowPlaying} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  backBtn: {
    marginBottom: 16,
  },
  categoryTitle: {
    color: COLORS.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  albumCount: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  albumsGrid: {
    padding: 16,
  },
  albumCard: {
    width: (width - 48) / 2,
    marginRight: 16,
    marginBottom: 24,
  },
  albumArt: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  albumImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  albumArtist: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 16,
  },
});
