import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, Image, StyleSheet, Dimensions,
  Animated, Share, ScrollView, Modal, Alert, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { getThumbnailUrl } from '../services/api';
import AnimatedBars from '../components/AnimatedBars';
import SongListItem from '../components/SongListItem';
import PlaylistModal from '../components/PlaylistModal';
import { COLORS } from '../config';

const { width, height } = Dimensions.get('window');

const NowPlayingScreen = ({ navigation }) => {
  const { 
    currentSong, 
    currentAlbum, 
    isPlaying, 
    isLoading,
    position, 
    duration, 
    queue,
    queueIndex,
    shuffle, 
    repeat,
    liked,
    isDownloaded,
    isDownloading,
    downloadProgress,
    togglePlay, 
    playNext, 
    playPrevious, 
    seekTo,
    toggleShuffle,
    cycleRepeat,
    toggleLike,
    shareSong,
    downloadCurrentSong,
  } = usePlayer();

  const { 
    isPremium, 
    canPerformAction, 
    canSkip, 
    useSkip, 
    getRemainingSkips,
    showUpgradePrompt,
    isShuffleForced,
    features,
  } = useSubscription();
  
  const [showQueue, setShowQueue] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [previewEnded, setPreviewEnded] = useState(false);
  
  const albumRotate = useRef(new Animated.Value(0)).current;

  // Navigate to subscription screen
  const goToSubscription = (feature) => {
    navigation.navigate('Subscription', { lockedFeature: feature });
  };

  // Handle skip with subscription check
  const handleSkip = async (direction) => {
    if (!isPremium) {
      // Check if user has skips available
      if (!canSkip()) {
        const remaining = getRemainingSkips();
        Alert.alert(
          'Skip Limit Reached',
          `You've used all your skips for this hour. Upgrade to Premium for unlimited skips!`,
          [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Upgrade', onPress: () => goToSubscription('skip') }
          ]
        );
        return;
      }
      // Use a skip
      useSkip();
    }
    
    if (direction === 'next') {
      await playNext();
    } else {
      await playPrevious();
    }
  };

  // Handle shuffle toggle with subscription check
  const handleShuffleToggle = () => {
    if (!isPremium && isShuffleForced()) {
      showUpgradePrompt('shuffle_control', goToSubscription);
      return;
    }
    toggleShuffle();
  };

  // Handle download with subscription check
  const handleDownload = () => {
    if (!canPerformAction('download')) {
      showUpgradePrompt('download', goToSubscription);
      return;
    }
    if (downloadCurrentSong) {
      downloadCurrentSong();
    }
  };

  // Handle add to playlist with subscription check
  const handleAddToPlaylist = () => {
    if (!canPerformAction('create_playlist')) {
      showUpgradePrompt('create_playlist', goToSubscription);
      return;
    }
    setShowPlaylistModal(true);
  };

  // Album art rotation animation when playing
  useEffect(() => {
    let rotationAnimation;
    if (isPlaying) {
      rotationAnimation = Animated.loop(
        Animated.timing(albumRotate, {
          toValue: 1,
          duration: 20000,
          useNativeDriver: true,
        })
      );
      rotationAnimation.start();
    } else {
      albumRotate.stopAnimation();
    }
    return () => {
      if (rotationAnimation) {
        rotationAnimation.stop();
      }
    };
  }, [isPlaying]);

  const spin = albumRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleShare = async () => {
    if (shareSong) {
      shareSong();
    } else if (currentSong) {
      try {
        await Share.share({
          message: `🎵 Check out "${currentSong.title}" by ${currentAlbum?.artist_name || 'Unknown Artist'} on Spirit Songs!\n\nDownload the app to listen now.`,
          title: `${currentSong.title} - Spirit Songs`,
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    }
  };

  const handleDownload = () => {
    if (downloadCurrentSong) {
      downloadCurrentSong();
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  const handleSeek = (event) => {
    const { locationX } = event.nativeEvent;
    const progressWidth = width - 64;
    const seekPosition = (locationX / progressWidth) * duration;
    seekTo(Math.max(0, Math.min(seekPosition, duration)));
  };

  if (!currentSong) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="musical-notes-outline" size={80} color={COLORS.textMuted} />
        <Text style={styles.emptyText}>No song playing</Text>
        <Text style={styles.emptyHint}>Select a song to start listening</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const thumbnailUrl = getThumbnailUrl(currentSong.thumbnail || currentAlbum?.thumbnail);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#0a0a1a', '#0a0a1a']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-down" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>PLAYING FROM</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentAlbum?.title || 'Unknown Album'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowQueue(true)} style={styles.headerBtn}>
            <Ionicons name="list" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Album Art */}
        <View style={styles.artContainer}>
          <Animated.View style={[styles.artWrapper, { transform: [{ rotate: spin }] }]}>
            {thumbnailUrl ? (
              <Image 
                source={{ uri: thumbnailUrl }} 
                style={styles.albumArt}
              />
            ) : (
              <LinearGradient colors={['#7c3aed', '#10b981']} style={styles.albumArt}>
                <Ionicons name="musical-notes" size={80} color="rgba(255,255,255,0.4)" />
              </LinearGradient>
            )}
          </Animated.View>
          
          {/* Animated Bars Overlay */}
          {isPlaying && (
            <View style={styles.barsOverlay}>
              <AnimatedBars isPlaying={isPlaying} size="large" color="#fff" />
            </View>
          )}
        </View>

        {/* Song Info */}
        <View style={styles.songInfo}>
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.songTitle} numberOfLines={1}>
                {currentSong.title}
              </Text>
              <Text style={styles.artistName} numberOfLines={1}>
                {currentSong.artist_name || currentAlbum?.artist_name || 'Unknown Artist'}
              </Text>
            </View>
            <TouchableOpacity onPress={toggleLike} style={styles.likeButton}>
              <Ionicons 
                name={liked ? 'heart' : 'heart-outline'} 
                size={28} 
                color={liked ? '#e91e63' : COLORS.textPrimary} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <TouchableOpacity 
            style={styles.progressContainer}
            onPress={handleSeek}
            activeOpacity={1}
          >
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
              <View style={[styles.progressKnob, { left: `${progress * 100}%` }]} />
            </View>
          </TouchableOpacity>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* Main Controls */}
        <View style={styles.controls}>
          <TouchableOpacity 
            onPress={handleShuffleToggle} 
            style={styles.controlBtn}
          >
            <Ionicons 
              name="shuffle" 
              size={24} 
              color={shuffle ? '#e91e63' : COLORS.textSecondary} 
            />
            {!isPremium && isShuffleForced() && (
              <Ionicons name="lock-closed" size={10} color="#FF9800" style={styles.lockBadge} />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleSkip('prev')} style={styles.controlBtn}>
            <Ionicons name="play-skip-back" size={32} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={togglePlay} 
            style={styles.playButton}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="large" color="#000" />
            ) : (
              <Ionicons 
                name={isPlaying ? 'pause' : 'play'} 
                size={32} 
                color="#000" 
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleSkip('next')} style={styles.controlBtn}>
            <Ionicons name="play-skip-forward" size={32} color={COLORS.textPrimary} />
            {!isPremium && (
              <View style={styles.skipCountBadge}>
                <Text style={styles.skipCountText}>{getRemainingSkips()}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={cycleRepeat} style={styles.controlBtn}>
            <Ionicons 
              name={repeat === 'one' ? 'repeat' : 'repeat'} 
              size={24} 
              color={repeat !== 'off' ? '#e91e63' : COLORS.textSecondary} 
            />
            {repeat === 'one' && (
              <View style={styles.repeatOneBadge}>
                <Text style={styles.repeatOneText}>1</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Skip Counter for Free Users */}
        {!isPremium && (
          <View style={styles.skipInfoBar}>
            <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.skipInfoText}>
              {getRemainingSkips()} skips left this hour
            </Text>
            <TouchableOpacity onPress={() => goToSubscription('skip')}>
              <Text style={styles.upgradeLink}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Secondary Actions */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleAddToPlaylist}>
            <View style={styles.secondaryIconWrapper}>
              <Ionicons name="add-circle-outline" size={28} color={COLORS.textSecondary} />
              {!canPerformAction('create_playlist') && (
                <Ionicons name="lock-closed" size={12} color="#FF9800" style={styles.featureLock} />
              )}
            </View>
            <Text style={styles.secondaryText}>Add to Playlist</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={28} color={COLORS.textSecondary} />
            <Text style={styles.secondaryText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleDownload}>
            {isDownloading ? (
              <>
                <ActivityIndicator size="small" color="#e91e63" />
                <Text style={styles.secondaryText}>{Math.round(downloadProgress * 100)}%</Text>
              </>
            ) : (
              <View style={styles.secondaryIconWrapper}>
                <Ionicons 
                  name={isDownloaded ? 'checkmark-circle' : 'download-outline'} 
                  size={28} 
                  color={isDownloaded ? '#4CAF50' : COLORS.textSecondary} 
                />
                {!canPerformAction('download') && !isDownloaded && (
                  <Ionicons name="lock-closed" size={12} color="#FF9800" style={styles.featureLock} />
                )}
              </View>
            )}
            <Text style={[styles.secondaryText, isDownloaded && { color: '#4CAF50' }]}>
                  {isDownloaded ? 'Downloaded' : 'Download'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Queue Modal */}
      <Modal
        visible={showQueue}
        animationType="slide"
        onRequestClose={() => setShowQueue(false)}
      >
        <View style={styles.queueContainer}>
          <View style={styles.queueHeader}>
            <Text style={styles.queueTitle}>Queue</Text>
            <TouchableOpacity onPress={() => setShowQueue(false)}>
              <Ionicons name="close" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.nowPlayingSection}>
            <Text style={styles.queueSectionTitle}>Now Playing</Text>
            <SongListItem 
              song={currentSong}
              album={currentAlbum}
              index={queueIndex}
              showIndex={false}
              showThumbnail={true}
            />
          </View>

          <Text style={styles.queueSectionTitle}>Next in Queue</Text>
          <ScrollView style={styles.queueList}>
            {queue.slice(queueIndex + 1).map((item, idx) => (
              <SongListItem 
                key={item.song?.song_id || item.song_id || idx}
                song={item.song || item}
                album={item.album || currentAlbum}
                index={queueIndex + 1 + idx}
                showIndex={true}
                showThumbnail={false}
              />
            ))}
            {queue.length <= queueIndex + 1 && (
              <Text style={styles.queueEmpty}>No more songs in queue</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Playlist Modal */}
      <PlaylistModal 
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={currentSong}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  gradient: {
    flex: 1,
    paddingTop: 48,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyHint: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  backButton: {
    backgroundColor: '#e91e63',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  headerBtn: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  artContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  artWrapper: {
    width: width - 80,
    height: width - 80,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  albumArt: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barsOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 48,
  },
  songInfo: {
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    marginRight: 16,
  },
  songTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  artistName: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 4,
  },
  likeButton: {
    padding: 8,
  },
  progressSection: {
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  progressContainer: {
    height: 20,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'visible',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#e91e63',
    borderRadius: 2,
  },
  progressKnob: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e91e63',
    marginLeft: -6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
    gap: 16,
  },
  controlBtn: {
    padding: 12,
    position: 'relative',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  repeatOneBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e91e63',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatOneText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingHorizontal: 32,
  },
  secondaryBtn: {
    alignItems: 'center',
    gap: 4,
    minWidth: 80,
  },
  secondaryText: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  queueContainer: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    paddingTop: 48,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  queueTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  nowPlayingSection: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 8,
  },
  queueSectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  queueList: {
705|    flex: 1,
706|  },
707|  queueEmpty: {
708|    color: COLORS.textMuted,
709|    fontSize: 14,
710|    textAlign: 'center',
711|    padding: 32,
712|  },
  lockBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  skipCountBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF9800',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  skipCountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  skipInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    marginTop: -8,
    marginBottom: 16,
  },
  skipInfoText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  upgradeLink: {
    color: '#e91e63',
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryIconWrapper: {
    position: 'relative',
  },
  featureLock: {
    position: 'absolute',
    bottom: -2,
    right: -4,
  },
});

export default NowPlayingScreen;
