import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, SPACING, FONT_SIZES } from '../config/theme';
import { getImageUrl } from '../services/api';

const { width } = Dimensions.get('window');

// Large Card - Featured/Hero style
export const LargeCard = ({ item, onPress, style }) => (
  <TouchableOpacity 
    style={[styles.largeCard, style]} 
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Image
      source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/300' }}
      style={styles.largeCardImage}
    />
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.8)']}
      style={styles.largeCardGradient}
    >
      <Text style={styles.largeCardTitle} numberOfLines={2}>{item.title || item.name}</Text>
      <Text style={styles.largeCardSubtitle} numberOfLines={1}>
        {item.artist_name || item.description || `${item.song_count || 0} songs`}
      </Text>
    </LinearGradient>
  </TouchableOpacity>
);

// Medium Card - Album/Playlist style
export const MediumCard = ({ item, onPress, style }) => (
  <TouchableOpacity 
    style={[styles.mediumCard, style]} 
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Image
      source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/150' }}
      style={styles.mediumCardImage}
    />
    <Text style={styles.mediumCardTitle} numberOfLines={2}>{item.title || item.name}</Text>
    <Text style={styles.mediumCardSubtitle} numberOfLines={1}>
      {item.artist_name || item.type || 'Album'}
    </Text>
  </TouchableOpacity>
);

// Small Card - Compact grid style
export const SmallCard = ({ item, onPress, style }) => (
  <TouchableOpacity 
    style={[styles.smallCard, style]} 
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Image
      source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/80' }}
      style={styles.smallCardImage}
    />
    <View style={styles.smallCardInfo}>
      <Text style={styles.smallCardTitle} numberOfLines={1}>{item.title || item.name}</Text>
    </View>
  </TouchableOpacity>
);

// Song List Item - With three dots menu
export const SongListItem = ({ 
  item, 
  index, 
  onPress, 
  isPlaying, 
  onAddPress, 
  onMorePress,
  albumThumbnail, 
  style 
}) => (
  <TouchableOpacity 
    style={[styles.songListItem, style]} 
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.songIndex, isPlaying && styles.songIndexActive]}>
      {isPlaying ? <Ionicons name="musical-note" size={14} color={COLORS.primary} /> : index + 1}
    </Text>
    <Image
      source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url || albumThumbnail) || 'https://via.placeholder.com/50' }}
      style={styles.songListImage}
    />
    <View style={styles.songListInfo}>
      <Text style={[styles.songListTitle, isPlaying && styles.songListTitleActive]} numberOfLines={1}>
        {item.title}
      </Text>
      <Text style={styles.songListArtist} numberOfLines={1}>{item.artist_name}</Text>
    </View>
    {/* Three dots menu button */}
    <TouchableOpacity 
      style={styles.songListMore} 
      onPress={() => onMorePress ? onMorePress(item) : (onAddPress && onAddPress(item))}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  </TouchableOpacity>
);

// Quick Access Grid Item
export const QuickAccessItem = ({ item, onPress }) => (
  <TouchableOpacity 
    style={styles.quickAccessItem} 
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Image
      source={{ uri: getImageUrl(item.thumbnail || item.icon_url) || 'https://via.placeholder.com/60' }}
      style={styles.quickAccessImage}
    />
    <Text style={styles.quickAccessTitle} numberOfLines={1}>{item.title || item.name}</Text>
  </TouchableOpacity>
);

// Wide Card - Spotify style recent/quick picks
export const WideCard = ({ item, onPress, style }) => (
  <TouchableOpacity 
    style={[styles.wideCard, style]} 
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Image
      source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/60' }}
      style={styles.wideCardImage}
    />
    <Text style={styles.wideCardTitle} numberOfLines={2}>{item.title || item.name}</Text>
  </TouchableOpacity>
);

// Category Chip
export const CategoryChip = ({ label, isActive, onPress }) => (
  <TouchableOpacity 
    style={[styles.categoryChip, isActive && styles.categoryChipActive]} 
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// Play All Header Component
export const PlayAllHeader = ({ 
  title, 
  subtitle, 
  songCount, 
  onPlayAll, 
  onShuffle, 
  showPlayAll = true 
}) => (
  <View style={styles.playAllHeader}>
    <View style={styles.playAllInfo}>
      <Text style={styles.playAllTitle}>{title}</Text>
      {subtitle && <Text style={styles.playAllSubtitle}>{subtitle}</Text>}
      {songCount > 0 && <Text style={styles.playAllCount}>{songCount} nyimbo</Text>}
    </View>
    {showPlayAll && songCount > 0 && (
      <View style={styles.playAllActions}>
        <TouchableOpacity style={styles.shuffleBtn} onPress={onShuffle}>
          <Ionicons name="shuffle" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.playAllBtn} onPress={onPlayAll}>
          <Ionicons name="play" size={28} color={COLORS.background} />
        </TouchableOpacity>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  // Large Card
  largeCard: {
    width: width * 0.85,
    height: 200,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  largeCardImage: {
    width: '100%',
    height: '100%',
  },
  largeCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    paddingTop: SPACING.xl,
  },
  largeCardTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  largeCardSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Medium Card
  mediumCard: {
    width: 150,
    marginRight: SPACING.md,
  },
  mediumCardImage: {
    width: 150,
    height: 150,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
  },
  mediumCardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  mediumCardSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Small Card
  smallCard: {
    width: (width - SPACING.md * 3) / 2,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  smallCardImage: {
    width: 64,
    height: 64,
  },
  smallCardInfo: {
    flex: 1,
    paddingHorizontal: SPACING.sm,
  },
  smallCardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Song List Item
  songListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  songIndex: {
    width: 24,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  songIndexActive: {
    color: COLORS.primary,
  },
  songListImage: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.card,
  },
  songListInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  songListTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  songListTitleActive: {
    color: COLORS.primary,
  },
  songListArtist: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  songListMore: {
    padding: SPACING.sm,
  },
  songListAdd: {
    padding: SPACING.sm,
  },

  // Quick Access Item
  quickAccessItem: {
    alignItems: 'center',
    width: 80,
    marginRight: SPACING.md,
  },
  quickAccessImage: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.card,
  },
  quickAccessTitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  // Wide Card
  wideCard: {
    width: (width - SPACING.md * 3) / 2,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  wideCardImage: {
    width: 56,
    height: 56,
  },
  wideCardTitle: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: SPACING.sm,
  },

  // Category Chip
  categoryChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.card,
    marginRight: SPACING.sm,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  categoryChipTextActive: {
    color: '#000',
  },

  // Play All Header
  playAllHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  playAllInfo: {
    flex: 1,
  },
  playAllTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  playAllSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  playAllCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  playAllActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shuffleBtn: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  playAllBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
