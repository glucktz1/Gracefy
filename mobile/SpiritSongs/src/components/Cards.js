import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, BORDER_RADIUS, SPACING, FONT_SIZES } from '../config/theme';
import { getImageUrl } from '../services/api';
import { useDownloads, DOWNLOAD_STATUS } from '../context/DownloadContext';
import AnimatedEqualizer from './AnimatedEqualizer';
import LiveListenerBadge from './LiveListenerBadge';

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
    <View style={styles.cardLiveBadge} pointerEvents="none">
      <LiveListenerBadge albumId={item.album_id} songId={item.song_id} />
    </View>
  </TouchableOpacity>
);

// Medium Card - Album/Playlist style
export const MediumCard = ({ item, onPress, style }) => (
  <TouchableOpacity 
    style={[styles.mediumCard, style]} 
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.mediumCardImageWrap}>
      <Image
        source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/150' }}
        style={styles.mediumCardImage}
      />
      <View style={styles.cardLiveBadge} pointerEvents="none">
        <LiveListenerBadge albumId={item.album_id} songId={item.song_id} />
      </View>
    </View>
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
    <View style={styles.smallCardImageWrap}>
      <Image
        source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/80' }}
        style={styles.smallCardImage}
      />
      <View style={styles.cardLiveBadge} pointerEvents="none">
        <LiveListenerBadge albumId={item.album_id} songId={item.song_id} />
      </View>
    </View>
    <View style={styles.smallCardInfo}>
      <Text style={styles.smallCardTitle} numberOfLines={1}>{item.title || item.name}</Text>
    </View>
  </TouchableOpacity>
);

// Mini Progress Ring for download indication
const MiniProgressRing = ({ progress }) => (
  <View style={styles.miniProgressContainer}>
    <View style={[styles.miniProgressBg]} />
    <View style={[
      styles.miniProgressFill,
      { transform: [{ rotate: `${(progress / 100) * 360}deg` }] }
    ]} />
    <View style={styles.miniProgressCenter}>
      <Ionicons name="arrow-down" size={8} color={COLORS.primary} />
    </View>
  </View>
);

// Song List Item - With three dots menu, equalizer, and download status
export const SongListItem = ({ 
  item, 
  index, 
  onPress, 
  isPlaying,
  isCurrentSong,
  onAddPress, 
  onMorePress,
  albumThumbnail, 
  isDownloaded: propIsDownloaded,
  style 
}) => {
  const songId = item?.song_id;
  const showEqualizer = isCurrentSong || isPlaying;
  
  // Download context - with safe fallbacks
  const downloadContext = useDownloads();
  const isDownloaded = propIsDownloaded ?? (downloadContext?.isDownloaded?.(songId) ?? false);
  const downloadStatus = downloadContext?.getDownloadStatus?.(songId) ?? DOWNLOAD_STATUS.IDLE;
  const downloadProgress = downloadContext?.getDownloadProgress?.(songId) ?? 0;
  
  const isDownloading = downloadStatus === DOWNLOAD_STATUS.DOWNLOADING;
  const isQueued = downloadStatus === DOWNLOAD_STATUS.QUEUED;
  const downloaded = isDownloaded || downloadStatus === DOWNLOAD_STATUS.COMPLETED;
  
  return (
    <TouchableOpacity 
      style={[styles.songListItem, style]} 
      onPress={onPress}
      activeOpacity={0.55}
      delayPressIn={0}
    >
      {/* Index/Equalizer column */}
      <View style={styles.songIndexContainer}>
        {showEqualizer ? (
          <AnimatedEqualizer 
            isPlaying={isPlaying} 
            barCount={3} 
            barWidth={3} 
            barHeight={14}
            color={COLORS.primary}
            gap={2}
          />
        ) : (
          <Text style={styles.songIndex}>{index + 1}</Text>
        )}
      </View>
      
      {/* Thumbnail */}
      <View style={styles.songImageContainer}>
        <Image
          source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url || albumThumbnail) || 'https://via.placeholder.com/50' }}
          style={styles.songListImage}
        />
      </View>
      
      {/* Song info */}
      <View style={styles.songListInfo}>
        <Text style={[styles.songListTitle, (isCurrentSong || isPlaying) && styles.songListTitleActive]} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={styles.songListMeta}>
          {isDownloading && (
            <View style={styles.downloadingTag}>
              <Ionicons name="arrow-down" size={10} color={COLORS.primary} />
              <Text style={styles.downloadingTagText}>{downloadProgress || 0}%</Text>
            </View>
          )}
          {isQueued && (
            <View style={styles.queuedTag}>
              <Ionicons name="time-outline" size={10} color={COLORS.warning} />
              <Text style={styles.queuedTagText}>Foleni</Text>
            </View>
          )}
          {downloaded && !isDownloading && !isQueued && (
            <View style={styles.downloadedTag}>
              <Ionicons name="arrow-down-circle" size={12} color={COLORS.primary} />
            </View>
          )}
          <Text style={[styles.songListArtist, (downloaded || isDownloading || isQueued) && styles.songListArtistWithTag]} numberOfLines={1}>
            {item.artist_name}
          </Text>
        </View>
      </View>
      
      {/* Download indicator or three dots menu */}
      <View style={styles.songListActions}>
        {/* Show download icon if downloaded */}
        {downloaded && !isDownloading && (
          <View style={styles.downloadedIcon}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
          </View>
        )}
        {/* Show progress if downloading */}
        {isDownloading && (
          <View style={styles.downloadingIcon}>
            <Text style={styles.downloadingIconText}>{downloadProgress}%</Text>
          </View>
        )}
        {/* Three dots menu button */}
        <TouchableOpacity 
          style={styles.songListMore} 
          onPress={() => onMorePress ? onMorePress(item) : (onAddPress && onAddPress(item))}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

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
  cardLiveBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // Medium Card
  mediumCard: {
    width: 150,
    marginRight: SPACING.md,
  },
  mediumCardImageWrap: {
    width: 150,
    height: 150,
    position: 'relative',
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
  smallCardImageWrap: {
    width: 64,
    height: 64,
    position: 'relative',
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
  songIndexContainer: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  songIndex: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  songIndexActive: {
    color: COLORS.primary,
  },
  songImageContainer: {
    position: 'relative',
    marginLeft: SPACING.sm,
  },
  songListImage: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
  },
  downloadedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 1,
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
  songListMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  downloadedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  downloadedTagText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginLeft: 2,
  },
  downloadingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
    gap: 3,
  },
  downloadingTagText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  queuedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
    gap: 3,
  },
  queuedTagText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
  },
  downloadedTag: {
    marginRight: 6,
  },
  songListArtist: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  songListArtistWithTag: {
    flex: 1,
  },
  songListActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadedIcon: {
    marginRight: 4,
  },
  downloadingIcon: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 4,
  },
  downloadingIconText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  songListMore: {
    padding: SPACING.sm,
  },
  songListAdd: {
    padding: SPACING.sm,
  },
  // Mini Progress Ring for downloads
  miniProgressContainer: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniProgressBg: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  miniProgressFill: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  miniProgressCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
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
