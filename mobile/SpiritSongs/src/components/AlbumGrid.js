/**
 * Optimized Album Grid Component
 * Uses FlashList with grid layout for 60FPS scrolling
 */

import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 2;
const ITEM_SPACING = 12;
const ITEM_WIDTH = (SCREEN_WIDTH - (ITEM_SPACING * (NUM_COLUMNS + 1))) / NUM_COLUMNS;

// Placeholder image
const PLACEHOLDER_IMAGE = require('../../assets/placeholder-album.png');

// Memoized Album Card Component
const AlbumCard = memo(({ item, onPress }) => {
  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  return (
    <TouchableOpacity
      style={styles.albumCard}
      onPress={handlePress}
      activeOpacity={0.8}
      data-testid={`album-card-${item.album_id}`}
    >
      {/* Album Art with expo-image */}
      <View style={styles.albumArtContainer}>
        <Image
          source={item.thumbnail ? { uri: item.thumbnail } : PLACEHOLDER_IMAGE}
          style={styles.albumArt}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          priority="normal"
          placeholder={PLACEHOLDER_IMAGE}
        />
        {/* Play overlay on hover/focus */}
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={24} color="#fff" />
          </View>
        </View>
        {/* Premium badge */}
        {item.monetization_type === 'premium' && (
          <View style={styles.premiumBadge}>
            <Ionicons name="star" size={10} color="#fff" />
          </View>
        )}
      </View>

      {/* Album Info */}
      <View style={styles.albumInfo}>
        <Text style={styles.albumTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {item.artist_name || 'Unknown Artist'}
        </Text>
        {item.songs_count > 0 && (
          <Text style={styles.songCount}>
            {item.songs_count} {item.songs_count === 1 ? 'song' : 'songs'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  return prevProps.item.album_id === nextProps.item.album_id;
});

// Main AlbumGrid Component
const AlbumGrid = ({
  albums,
  onAlbumPress,
  loading = false,
  onEndReached,
  ListHeaderComponent,
  ListEmptyComponent,
  numColumns = NUM_COLUMNS,
  contentContainerStyle,
}) => {
  const handleAlbumPress = useCallback((album) => {
    if (onAlbumPress) {
      onAlbumPress(album);
    }
  }, [onAlbumPress]);

  const renderItem = useCallback(({ item }) => {
    return (
      <AlbumCard
        item={item}
        onPress={handleAlbumPress}
      />
    );
  }, [handleAlbumPress]);

  const keyExtractor = useCallback((item) => item.album_id || item.id || String(Math.random()), []);

  if (loading && (!albums || albums.length === 0)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading albums...</Text>
      </View>
    );
  }

  const DefaultEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="albums-outline" size={64} color="#444" />
      <Text style={styles.emptyText}>No albums found</Text>
    </View>
  );

  // Calculate estimated item height (album art + text)
  const estimatedItemSize = ITEM_WIDTH + 70;

  return (
    <FlashList
      data={albums}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={estimatedItemSize}
      numColumns={numColumns}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent || DefaultEmptyComponent}
      contentContainerStyle={[styles.gridContainer, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      // Performance optimizations
      drawDistance={600}
      removeClippedSubviews={true}
    />
  );
};

// Horizontal Album List (for home sections)
export const HorizontalAlbumList = memo(({
  albums,
  onAlbumPress,
  loading = false,
  title,
}) => {
  const handleAlbumPress = useCallback((album) => {
    if (onAlbumPress) {
      onAlbumPress(album);
    }
  }, [onAlbumPress]);

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={styles.horizontalCard}
      onPress={() => handleAlbumPress(item)}
      activeOpacity={0.8}
    >
      <Image
        source={item.thumbnail ? { uri: item.thumbnail } : PLACEHOLDER_IMAGE}
        style={styles.horizontalAlbumArt}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        placeholder={PLACEHOLDER_IMAGE}
      />
      <Text style={styles.horizontalTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.horizontalArtist} numberOfLines={1}>
        {item.artist_name}
      </Text>
    </TouchableOpacity>
  ), [handleAlbumPress]);

  const keyExtractor = useCallback((item) => item.album_id || item.id, []);

  if (loading) {
    return (
      <View style={styles.horizontalLoading}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.horizontalSection}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      <FlashList
        data={albums}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        estimatedItemSize={140}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  gridContainer: {
    paddingHorizontal: ITEM_SPACING / 2,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#666',
    marginTop: 16,
    fontSize: 16,
  },
  albumCard: {
    width: ITEM_WIDTH,
    margin: ITEM_SPACING / 2,
  },
  albumArtContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#222',
  },
  albumArt: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  albumInfo: {
    paddingTop: 10,
  },
  albumTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  artistName: {
    color: '#888',
    fontSize: 12,
  },
  songCount: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  // Horizontal list styles
  horizontalSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  horizontalList: {
    paddingHorizontal: 12,
  },
  horizontalCard: {
    width: 130,
    marginHorizontal: 6,
  },
  horizontalAlbumArt: {
    width: 130,
    height: 130,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  horizontalTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
  },
  horizontalArtist: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
  horizontalLoading: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default memo(AlbumGrid);
