/**
 * Optimized Song List Component
 * Uses @shopify/flash-list for 60FPS scrolling performance
 */

import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore, useCurrentTrack, useIsPlaying } from '../store/playerStore';
import { COLORS } from '../config';

// Optimized placeholder image
const PLACEHOLDER_IMAGE = require('../../assets/placeholder-album.png');

// Memoized Song Item Component
const SongItem = memo(({ item, index, onPress, isCurrentTrack, isPlaying }) => {
  const handlePress = useCallback(() => {
    onPress(item, index);
  }, [item, index, onPress]);

  return (
    <TouchableOpacity
      style={[styles.songItem, isCurrentTrack && styles.songItemActive]}
      onPress={handlePress}
      activeOpacity={0.7}
      data-testid={`song-item-${item.song_id}`}
    >
      {/* Track Number or Playing Indicator */}
      <View style={styles.trackNumber}>
        {isCurrentTrack && isPlaying ? (
          <Ionicons name="musical-notes" size={16} color={COLORS.primary} />
        ) : (
          <Text style={styles.trackNumberText}>{index + 1}</Text>
        )}
      </View>

      {/* Album Art with expo-image for fast loading */}
      <Image
        source={item.thumbnail ? { uri: item.thumbnail } : PLACEHOLDER_IMAGE}
        style={styles.albumArt}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        priority={index < 10 ? 'high' : 'normal'}
        placeholder={PLACEHOLDER_IMAGE}
      />

      {/* Song Info */}
      <View style={styles.songInfo}>
        <Text
          style={[styles.songTitle, isCurrentTrack && styles.songTitleActive]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text style={styles.artistName} numberOfLines={1}>
          {item.artist_name || 'Unknown Artist'}
        </Text>
      </View>

      {/* Duration */}
      <Text style={styles.duration}>
        {item.duration_formatted || formatDuration(item.duration)}
      </Text>

      {/* More Options Button */}
      <TouchableOpacity style={styles.moreButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="ellipsis-vertical" size={18} color="#888" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if these change
  return (
    prevProps.item.song_id === nextProps.item.song_id &&
    prevProps.isCurrentTrack === nextProps.isCurrentTrack &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.index === nextProps.index
  );
});

// Format duration from milliseconds
const formatDuration = (ms) => {
  if (!ms) return '--:--';
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Main SongList Component
const SongList = ({
  songs,
  onSongPress,
  loading = false,
  onEndReached,
  ListHeaderComponent,
  ListEmptyComponent,
  estimatedItemSize = 70,
  contentContainerStyle,
}) => {
  const currentTrack = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const loadTrack = usePlayerStore((state) => state.loadTrack);

  const handleSongPress = useCallback((song, index) => {
    if (onSongPress) {
      onSongPress(song, index);
    } else {
      // Default behavior: load and play the song with queue
      loadTrack(song, songs, index);
    }
  }, [onSongPress, songs, loadTrack]);

  const renderItem = useCallback(({ item, index }) => {
    const isCurrentTrack = currentTrack?.song_id === item.song_id;
    return (
      <SongItem
        item={item}
        index={index}
        onPress={handleSongPress}
        isCurrentTrack={isCurrentTrack}
        isPlaying={isCurrentTrack && isPlaying}
      />
    );
  }, [currentTrack?.song_id, isPlaying, handleSongPress]);

  const keyExtractor = useCallback((item) => item.song_id || item.id || String(Math.random()), []);

  const getItemType = useCallback((item) => {
    // All items are the same type
    return 'song';
  }, []);

  if (loading && (!songs || songs.length === 0)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading songs...</Text>
      </View>
    );
  }

  const DefaultEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="musical-notes-outline" size={64} color="#444" />
      <Text style={styles.emptyText}>No songs found</Text>
    </View>
  );

  return (
    <FlashList
      data={songs}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={estimatedItemSize}
      getItemType={getItemType}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent || DefaultEmptyComponent}
      contentContainerStyle={[styles.listContainer, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      // Performance optimizations
      drawDistance={500}
      removeClippedSubviews={true}
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    paddingBottom: 100, // Space for mini player
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
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  songItemActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  trackNumber: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackNumberText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  albumArt: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginLeft: 8,
    backgroundColor: '#222',
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  songTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 3,
  },
  songTitleActive: {
    color: COLORS.primary,
  },
  artistName: {
    color: '#888',
    fontSize: 13,
  },
  duration: {
    color: '#666',
    fontSize: 12,
    marginRight: 8,
  },
  moreButton: {
    padding: 4,
  },
});

export default memo(SongList);
