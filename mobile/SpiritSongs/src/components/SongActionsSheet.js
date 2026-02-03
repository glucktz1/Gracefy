/**
 * SongActionsSheet - Spotify-like bottom sheet for song actions
 * Features:
 * - Like/Unlike songs
 * - Download with progress indication
 * - Add to playlist
 * - Share functionality
 * - Smooth animations
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { getImageUrl } from '../services/api';
import { useDownloads, DOWNLOAD_STATUS } from '../context/DownloadContext';
import { showToast } from './Toast';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Progress Ring Component
const ProgressRing = ({ progress, size = 24, strokeWidth = 2.5 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.progressRingBg, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth }]} />
      <View style={[styles.progressRingContainer, { width: size, height: size }]}>
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: COLORS.primary,
          borderTopColor: 'transparent',
          borderRightColor: 'transparent',
          transform: [{ rotate: `${(progress / 100) * 360}deg` }],
        }} />
      </View>
      <View style={[styles.progressText, { width: size, height: size }]}>
        <Text style={styles.progressPercentage}>{Math.round(progress)}</Text>
      </View>
    </View>
  );
};

// Download Button Component
const DownloadButton = ({ song, onDownload }) => {
  const { isDownloaded, getDownloadProgress, getDownloadStatus, removeDownload, cancelDownload } = useDownloads();
  
  const status = getDownloadStatus(song?.song_id);
  const progress = getDownloadProgress(song?.song_id);
  const downloaded = isDownloaded(song?.song_id);

  const handlePress = async () => {
    if (downloaded) {
      // Show confirmation to remove download
      removeDownload(song.song_id);
      showToast('Imeondolewa kwenye zilizopakuwa', 'info');
    } else if (status === DOWNLOAD_STATUS.DOWNLOADING) {
      // Cancel download
      cancelDownload(song.song_id);
      showToast('Upakuaji umeghairiwa', 'info');
    } else if (status === DOWNLOAD_STATUS.QUEUED) {
      // Cancel queued
      cancelDownload(song.song_id);
      showToast('Imeondolewa kwenye foleni', 'info');
    } else {
      // Start download
      onDownload?.();
    }
  };

  return (
    <TouchableOpacity style={styles.actionItem} onPress={handlePress}>
      <View style={[styles.actionIcon, downloaded && styles.actionIconActive]}>
        {status === DOWNLOAD_STATUS.DOWNLOADING ? (
          <ProgressRing progress={progress || 0} size={28} strokeWidth={3} />
        ) : status === DOWNLOAD_STATUS.QUEUED ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : downloaded ? (
          <Ionicons name="checkmark-circle" size={28} color={COLORS.primary} />
        ) : (
          <Ionicons name="arrow-down-circle-outline" size={28} color={COLORS.text} />
        )}
      </View>
      <View style={styles.actionTextContainer}>
        <Text style={[styles.actionText, downloaded && styles.actionTextActive]}>
          {status === DOWNLOAD_STATUS.DOWNLOADING 
            ? 'Inapakua...' 
            : status === DOWNLOAD_STATUS.QUEUED
            ? 'Iko kwenye foleni'
            : downloaded 
            ? 'Imepakuliwa' 
            : 'Pakua'}
        </Text>
        {downloaded && (
          <Text style={styles.actionSubtext}>Bofya kuondoa</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Main Song Actions Sheet
export const SongActionsSheet = ({
  visible,
  onClose,
  song,
  isLiked,
  onLike,
  onAddToPlaylist,
  onViewAlbum,
  onViewArtist,
  isAuthenticated,
  onLoginRequired,
  navigation,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const { queueDownload } = useDownloads();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleLike = async () => {
    if (!isAuthenticated) {
      onClose();
      onLoginRequired?.();
      return;
    }
    // Call the like handler - it will close the sheet after completion
    onLike?.(song);
  };

  const handleDownload = async () => {
    if (!isAuthenticated) {
      onClose();
      onLoginRequired?.();
      return;
    }
    
    const result = await queueDownload(song);
    if (result.success) {
      showToast(result.message === 'Added to download queue' ? 'Imeongezwa kwenye foleni ya kupakua' : result.message, 'success');
    } else {
      showToast('Imeshindikana kupakua', 'error');
    }
  };

  const handleAddToPlaylist = () => {
    if (!isAuthenticated) {
      onClose();
      onLoginRequired?.();
      return;
    }
    onAddToPlaylist?.(song);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Sikiliza "${song?.title}" na ${song?.artist_name} kwenye Gracefy App! 🎵`,
        title: song?.title,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View 
          style={[styles.backdrop, { opacity: backdropAnim }]}
        >
          <TouchableOpacity 
            style={styles.backdropTouch} 
            activeOpacity={1} 
            onPress={onClose}
          />
        </Animated.View>

        {/* Sheet */}
        <Animated.View 
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Song Info */}
          {song && (
            <View style={styles.songInfo}>
              <Image
                source={{ uri: getImageUrl(song.thumbnail || song.thumbnail_url) || 'https://via.placeholder.com/64' }}
                style={styles.songImage}
              />
              <View style={styles.songDetails}>
                <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
                <Text style={styles.songArtist} numberOfLines={1}>{song.artist_name}</Text>
              </View>
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {/* Like */}
            <TouchableOpacity style={styles.actionItem} onPress={handleLike}>
              <View style={[styles.actionIcon, isLiked && styles.actionIconLiked]}>
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={28} 
                  color={isLiked ? COLORS.error : COLORS.text} 
                />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={[styles.actionText, isLiked && styles.actionTextLiked]}>
                  {isLiked ? 'Imependwa' : 'Penda'}
                </Text>
                {isLiked && (
                  <Text style={styles.actionSubtext}>Bofya kuondoa</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Download */}
            <DownloadButton song={song} onDownload={handleDownload} />

            {/* Add to Playlist */}
            <TouchableOpacity style={styles.actionItem} onPress={handleAddToPlaylist}>
              <View style={styles.actionIcon}>
                <Ionicons name="add-circle-outline" size={28} color={COLORS.text} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionText}>Ongeza kwenye Playlist</Text>
              </View>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity style={styles.actionItem} onPress={handleShare}>
              <View style={styles.actionIcon}>
                <Ionicons name="share-social-outline" size={28} color={COLORS.text} />
              </View>
              <View style={styles.actionTextContainer}>
                <Text style={styles.actionText}>Shiriki</Text>
              </View>
            </TouchableOpacity>

            {/* View Album */}
            {song?.album_id && (
              <TouchableOpacity style={styles.actionItem} onPress={() => {
                onClose();
                onViewAlbum?.(song);
              }}>
                <View style={styles.actionIcon}>
                  <Ionicons name="disc-outline" size={28} color={COLORS.text} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionText}>Tazama Album</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Bottom Safe Area */}
          <View style={styles.safeAreaBottom} />
        </Animated.View>
      </View>
    </Modal>
  );
};

// Playlist Picker Sheet
export const PlaylistPickerSheet = ({
  visible,
  onClose,
  song,
  playlists,
  onSelectPlaylist,
  onCreatePlaylist,
  loading,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, styles.playlistSheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          <Text style={styles.sheetTitle}>Ongeza kwenye Playlist</Text>

          {/* Song Info Mini */}
          {song && (
            <View style={styles.songInfoMini}>
              <Image
                source={{ uri: getImageUrl(song.thumbnail || song.thumbnail_url) || 'https://via.placeholder.com/40' }}
                style={styles.songImageMini}
              />
              <Text style={styles.songTitleMini} numberOfLines={1}>{song.title}</Text>
            </View>
          )}

          <View style={styles.divider} />

          {/* Create New Playlist */}
          <TouchableOpacity style={styles.createPlaylistItem} onPress={onCreatePlaylist}>
            <View style={styles.createPlaylistIcon}>
              <Ionicons name="add" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.createPlaylistText}>Tengeneza Playlist Mpya</Text>
          </TouchableOpacity>

          {/* Playlists List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : playlists?.length > 0 ? (
            <View style={styles.playlistsList}>
              {playlists.map((playlist) => (
                <TouchableOpacity
                  key={playlist.playlist_id}
                  style={styles.playlistItem}
                  onPress={() => onSelectPlaylist(playlist)}
                >
                  <Image
                    source={{ uri: getImageUrl(playlist.thumbnail) || 'https://via.placeholder.com/48' }}
                    style={styles.playlistImage}
                  />
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName} numberOfLines={1}>{playlist.name}</Text>
                    <Text style={styles.playlistCount}>{playlist.song_count || 0} nyimbo</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.emptyPlaylists}>
              <Text style={styles.emptyPlaylistsText}>Hakuna playlist bado</Text>
            </View>
          )}

          <View style={styles.safeAreaBottom} />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  playlistSheet: {
    maxHeight: SCREEN_HEIGHT * 0.75,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMuted,
    borderRadius: 2,
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  songImage: {
    width: 64,
    height: 64,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
  },
  songDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  songTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  songArtist: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
  },
  actionsContainer: {
    paddingVertical: SPACING.sm,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconActive: {
    backgroundColor: COLORS.primary + '20',
  },
  actionIconLiked: {
    backgroundColor: COLORS.error + '20',
  },
  actionTextContainer: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  actionText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  actionTextActive: {
    color: COLORS.primary,
  },
  actionTextLiked: {
    color: COLORS.error,
  },
  actionSubtext: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  safeAreaBottom: {
    height: SPACING.xxl,
  },
  
  // Progress Ring
  progressRingBg: {
    position: 'absolute',
    borderColor: COLORS.border,
  },
  progressRingContainer: {
    position: 'absolute',
  },
  progressText: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPercentage: {
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.primary,
  },

  // Playlist Sheet
  sheetTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    paddingVertical: SPACING.sm,
  },
  songInfoMini: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  songImageMini: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
  },
  songTitleMini: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  createPlaylistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  createPlaylistIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPlaylistText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: SPACING.md,
  },
  loadingContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  playlistsList: {
    maxHeight: 300,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  playlistImage: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
  },
  playlistInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  playlistName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  playlistCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  emptyPlaylists: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  emptyPlaylistsText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
  },
});

export default SongActionsSheet;
