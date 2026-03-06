/**
 * SongActionsSheet - Spotify-like bottom sheet for song actions
 * Features:
 * - Download songs for offline listening
 * - Like/Unlike songs
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

// Mini circular progress for download
const MiniProgress = ({ progress, size = 24 }) => {
  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={StyleSheet.absoluteFill}>
        {/* Background circle */}
        <View style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: 'rgba(255,255,255,0.2)',
        }} />
      </Animated.View>
      {/* Progress indicator - simplified */}
      <View style={{
        position: 'absolute',
        width: size,
        height: size,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <Text style={{ fontSize: 8, color: COLORS.primary, fontWeight: '700' }}>
          {Math.round(progress)}%
        </Text>
      </View>
    </View>
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
  onSubscriptionRequired,
  billingEnabled = false,
  isPremium = false,
  navigation,
}) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  
  // Download context
  const { 
    isDownloaded, 
    getDownloadStatus, 
    getDownloadProgress,
    queueDownload,
    removeDownload,
    cancelDownload 
  } = useDownloads();

  const songId = song?.song_id;
  const downloaded = songId ? isDownloaded(songId) : false;
  const downloadStatus = songId ? getDownloadStatus(songId) : DOWNLOAD_STATUS.IDLE;
  const downloadProgress = songId ? getDownloadProgress(songId) : 0;
  const isDownloading = downloadStatus === DOWNLOAD_STATUS.DOWNLOADING;
  const isQueued = downloadStatus === DOWNLOAD_STATUS.QUEUED;

  /**
   * BILLING LOGIC:
   * 1. Guest (not logged in): NEVER prompt to pay, only prompt to login
   * 2. Logged in + billing OFF: Full premium access
   * 3. Logged in + billing ON + not paid: Prompt to pay
   */
  const shouldPromptLogin = !isAuthenticated;
  const shouldPromptPayment = isAuthenticated && billingEnabled && !isPremium;

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
  }, [visible, slideAnim, backdropAnim]);

  const handleClose = useCallback(() => {
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
    ]).start(() => {
      onClose?.();
    });
  }, [slideAnim, backdropAnim, onClose]);

  const handleDownload = useCallback(() => {
    if (!song?.audio_url) {
      showToast('Wimbo huu hauna faili ya sauti', 'error');
      return;
    }

    if (downloaded) {
      // Already downloaded - offer to remove
      removeDownload(song.song_id);
      showToast('Imeondolewa kutoka vilivyopakuliwa', 'info');
    } else if (isDownloading || isQueued) {
      // Currently downloading - offer to cancel
      cancelDownload(song.song_id);
      showToast('Upakuaji umesitishwa', 'info');
    } else {
      // Check authentication before downloading
      if (!isAuthenticated) {
        onLoginRequired?.();
        return;
      }
      
      // Check billing - if billing is ON and user is not premium, require subscription
      if (billingEnabled && !isPremium) {
        onSubscriptionRequired?.();
        return;
      }
      
      // Start download
      const success = queueDownload(song);
      if (success) {
        showToast('Inapakuliwa...', 'success');
      } else {
        showToast('Haiwezi kupakua', 'error');
      }
    }
  }, [song, downloaded, isDownloading, isQueued, queueDownload, removeDownload, cancelDownload, isAuthenticated, onLoginRequired, billingEnabled, isPremium, onSubscriptionRequired]);

  const handleLike = useCallback(async () => {
    // BILLING LOGIC:
    // 1. Guest: Prompt to login (NEVER prompt to pay)
    if (shouldPromptLogin) {
      onLoginRequired?.();
      return;
    }
    
    // 2. Logged in + billing ON + not paid: Prompt to pay
    if (shouldPromptPayment) {
      onSubscriptionRequired?.();
      return;
    }
    
    // 3. Logged in + (billing OFF OR paid): Allow like
    await onLike?.();
  }, [shouldPromptLogin, shouldPromptPayment, onLike, onLoginRequired, onSubscriptionRequired]);

  const handleAddToPlaylist = useCallback(() => {
    // BILLING LOGIC:
    // 1. Guest: Prompt to login (NEVER prompt to pay)
    if (shouldPromptLogin) {
      onLoginRequired?.();
      return;
    }
    
    // 2. Logged in + billing ON + not paid: Prompt to pay
    if (shouldPromptPayment) {
      onSubscriptionRequired?.();
      return;
    }
    
    // 3. Logged in + (billing OFF OR paid): Allow access
    handleClose();
    setTimeout(() => {
      onAddToPlaylist?.();
    }, 300);
  }, [isAuthenticated, onAddToPlaylist, onLoginRequired, handleClose, billingEnabled, isPremium, onSubscriptionRequired]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Sikiliza "${song?.title}" kwenye Gracefy App!`,
        title: song?.title,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [song]);

  const handleViewAlbum = useCallback(() => {
    handleClose();
    setTimeout(() => {
      onViewAlbum?.();
    }, 300);
  }, [onViewAlbum, handleClose]);

  const handleViewArtist = useCallback(() => {
    handleClose();
    setTimeout(() => {
      onViewArtist?.();
    }, 300);
  }, [onViewArtist, handleClose]);

  if (!song) return null;

  const imageSource = song.thumbnail 
    ? (song.thumbnail.startsWith('http') || song.thumbnail.startsWith('data:') 
        ? { uri: song.thumbnail } 
        : { uri: getImageUrl(song.thumbnail) })
    : require('../../assets/placeholder-album.png');

  // Download button content
  const renderDownloadIcon = () => {
    if (downloaded) {
      return <Ionicons name="checkmark-circle" size={28} color="#1DB954" />;
    }
    if (isDownloading) {
      return <MiniProgress progress={downloadProgress} size={28} />;
    }
    if (isQueued) {
      return <ActivityIndicator size={20} color={COLORS.primary} />;
    }
    return <Ionicons name="arrow-down-circle-outline" size={28} color={COLORS.text} />;
  };

  const getDownloadText = () => {
    if (downloaded) return 'Ondoa Upakuaji';
    if (isDownloading) return `Inapakua ${downloadProgress}%`;
    if (isQueued) return 'Inasubiri...';
    return 'Pakua';
  };

  const getDownloadSubtext = () => {
    if (downloaded) return 'Imepakuliwa kwa offline';
    if (isDownloading || isQueued) return 'Gusa kusitisha';
    if (!song.audio_url) return 'Haiwezi kupakuliwa';
    return 'Sikiliza offline';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View 
          style={[
            styles.backdrop,
            { opacity: backdropAnim }
          ]}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        {/* Sheet */}
        <Animated.View 
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
            {/* Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Song Info */}
            <View style={styles.songInfo}>
              <Image source={imageSource} style={styles.thumbnail} />
              <View style={styles.songDetails}>
                <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
                <Text style={styles.songArtist} numberOfLines={1}>
                  {song.artist_name || song.choir_name || 'Unknown Artist'}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Actions */}
            <View style={styles.actionsContainer}>
              {/* Download */}
              <TouchableOpacity 
                style={styles.actionItem} 
                onPress={handleDownload}
                disabled={!song.audio_url && !downloaded}
                data-testid="download-button"
              >
                <View style={[
                  styles.actionIcon, 
                  downloaded && styles.actionIconDownloaded
                ]}>
                  {renderDownloadIcon()}
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[
                    styles.actionText, 
                    downloaded && styles.actionTextDownloaded
                  ]}>
                    {getDownloadText()}
                  </Text>
                  <Text style={styles.actionSubtext}>{getDownloadSubtext()}</Text>
                </View>
              </TouchableOpacity>

              {/* Like */}
              <TouchableOpacity 
                style={styles.actionItem} 
                onPress={handleLike}
                data-testid="like-button"
              >
                <View style={[styles.actionIcon, isLiked && styles.actionIconActive]}>
                  <Ionicons 
                    name={isLiked ? "heart" : "heart-outline"} 
                    size={28} 
                    color={isLiked ? "#1DB954" : COLORS.text} 
                  />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
                    {isLiked ? 'Imependwa' : 'Penda'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Add to Playlist */}
              <TouchableOpacity 
                style={styles.actionItem} 
                onPress={handleAddToPlaylist}
                data-testid="add-to-playlist-button"
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="add-circle-outline" size={28} color={COLORS.text} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionText}>Ongeza kwenye Orodha</Text>
                </View>
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity 
                style={styles.actionItem} 
                onPress={handleShare}
                data-testid="share-button"
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="share-outline" size={28} color={COLORS.text} />
                </View>
                <View style={styles.actionTextContainer}>
                  <Text style={styles.actionText}>Shiriki</Text>
                </View>
              </TouchableOpacity>

              {/* View Album */}
              {song.album_id && (
                <TouchableOpacity 
                  style={styles.actionItem} 
                  onPress={handleViewAlbum}
                  data-testid="view-album-button"
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name="disc-outline" size={28} color={COLORS.text} />
                  </View>
                  <View style={styles.actionTextContainer}>
                    <Text style={styles.actionText}>Tazama Albamu</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={handleClose}
              data-testid="cancel-button"
            >
              <Text style={styles.cancelText}>Funga</Text>
            </TouchableOpacity>
          </BlurView>
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
  sheet: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  blurContainer: {
    paddingBottom: 34,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
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
    padding: SPACING.md,
    paddingTop: SPACING.xs,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  songDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  songTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    marginBottom: 4,
  },
  songArtist: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
  },
  actionsContainer: {
    paddingHorizontal: SPACING.sm,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconActive: {
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
  },
  actionIconDownloaded: {
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
  },
  actionTextContainer: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  actionText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  actionTextActive: {
    color: '#1DB954',
  },
  actionTextDownloaded: {
    color: '#1DB954',
  },
  actionSubtext: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  cancelButton: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});

export default SongActionsSheet;
