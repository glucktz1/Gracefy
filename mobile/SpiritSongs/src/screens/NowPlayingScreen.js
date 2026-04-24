import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Share,
  ScrollView,
  PermissionsAndroid,
  Platform,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useBilling } from '../context/BillingContext';
import { useDownloads, DOWNLOAD_STATUS } from '../context/DownloadContext';
import { getImageUrl, getAudioUrl, contentAPI, libraryAPI } from '../services/api';
import AddToPlaylistModal, { LoginRequiredModal, SubscriptionRequiredModal } from '../components/AddToPlaylistModal';
import { showToast } from '../components/Toast';

const { width, height } = Dimensions.get('window');

const NowPlayingScreen = ({ navigation }) => {
  const {
    currentTrack,
    isPlaying,
    position,
    duration,
    shuffle,
    repeat,
    queue,
    queueIndex,
    continuousPlay,
    togglePlay,
    seekTo,
    skipNext,
    skipPrevious,
    toggleShuffle,
    cycleRepeat,
    toggleContinuousPlay,
    playTrack,
    previewMode,
    skipDisabled,
  } = usePlayer();

  const { isAuthenticated, user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Download context
  const { 
    isDownloaded, 
    getDownloadStatus, 
    getDownloadProgress,
    queueDownload,
    removeDownload 
  } = useDownloads();
  
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  // Billing settings from context
  const { billingEnabled, isPremium, canSkip, recordSkip, getRemainingSkips, promptSubscription } = useBilling();

  // Handle skip with billing check
  const handleSkipNext = () => {
    if (!canSkip()) {
      const result = promptSubscription('skip');
      if (result === 'show_plans') {
        Alert.alert(
          'Umepitisha Kikomo',
          'Maudhui haya ni bure lakini teknolojia hii ina gharama. Changia kidogo kuwezesha iwafikie watu wengi zaidi.',
          [
            { text: 'Baadaye', style: 'cancel' },
            { text: 'Ona Vifurushi', onPress: () => navigation.navigate('Subscription') }
          ]
        );
      }
      return;
    }
    recordSkip();
    skipNext();
  };

  const handleSkipPrevious = () => {
    // Previous doesn't count towards skip limit
    skipPrevious();
  };

  // Get download status for current track
  const songIsDownloaded = currentTrack ? isDownloaded(currentTrack.song_id) : false;
  const downloadStatus = currentTrack ? getDownloadStatus(currentTrack.song_id) : DOWNLOAD_STATUS.IDLE;
  const downloadProgress = currentTrack ? getDownloadProgress(currentTrack.song_id) : 0;
  const isDownloading = downloadStatus === DOWNLOAD_STATUS.DOWNLOADING;

  if (!currentTrack) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Hakuna wimbo unaochezwa</Text>
        </View>
      </SafeAreaView>
    );
  }


  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRepeatIcon = () => {
    switch (repeat) {
      case 'one': return 'repeat';
      case 'all': return 'repeat';
      default: return 'repeat';
    }
  };

  const handleShare = async () => {
    if (!currentTrack) return;
    
    try {
      const APP_URL = 'https://gracefy.net';
      const songId = currentTrack.song_id || currentTrack.id;
      const title = currentTrack.title || 'Wimbo';
      const artist = currentTrack.artist || currentTrack.artist_name || 'Gracefy';
      const album = currentTrack.album || '';
      
      // Create shareable message with deep link
      const message = album 
        ? `🎵 Sikiliza "${title}" kutoka ${album} na ${artist} kwenye Gracefy!\n\n${APP_URL}/song/${songId}`
        : `🎵 Sikiliza "${title}" na ${artist} kwenye Gracefy!\n\n${APP_URL}/song/${songId}`;
      
      await Share.share({
        message,
        title: `${title} - ${artist}`,
        url: `${APP_URL}/song/${songId}`, // iOS only
      });
    } catch (error) {
      if (error.message && !error.message.includes('cancel')) {
        console.error('Error sharing:', error);
      }
    }
  };

  const requestStoragePermission = async () => {
    // For Android 10+ (API 29+), we don't need WRITE_EXTERNAL_STORAGE
    // expo-file-system handles this internally for app-specific directories
    if (Platform.OS === 'android' && Platform.Version < 29) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Ruhusa ya Kuhifadhi',
            message: 'Gracefy inahitaji ruhusa ya kuhifadhi nyimbo kwenye simu yako.',
            buttonNeutral: 'Uliza Baadaye',
            buttonNegative: 'Kataa',
            buttonPositive: 'Kubali',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    // For Android 10+ and iOS, no permission needed for app documents
    return true;
  };

  const handleDownload = async () => {
    // If already downloaded, offer to delete
    if (songIsDownloaded) {
      Alert.alert(
        'Tayari Imepakuliwa',
        `"${currentTrack.title}" tayari imepakuliwa. Je, unataka kuifuta?`,
        [
          { text: 'Hapana', style: 'cancel' },
          { 
            text: 'Futa', 
            style: 'destructive',
            onPress: async () => {
              await removeDownload(currentTrack.song_id);
              showToast(`"${currentTrack.title}" imefutwa ✓`, 'info');
            }
          }
        ]
      );
      return;
    }
    
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    
    if (billingEnabled && !isPremium) {
      setShowSubscriptionModal(true);
      return;
    }

    // Queue the download using download context
    const success = queueDownload(currentTrack);
    if (success) {
      showToast(`"${currentTrack.title}" inapakuliwa...`, 'success');
    } else {
      showToast('Wimbo tayari umepakuliwa au una tatizo', 'warning');
    }
  };

  const handleLike = async () => {
    // BILLING LOGIC:
    // 1. Guest: Prompt to login (NEVER prompt to pay)
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    
    // 2. Logged in + billing ON + not paid: Prompt to pay
    if (billingEnabled && !isPremium) {
      setShowSubscriptionModal(true);
      return;
    }
    
    // 3. Logged in + (billing OFF OR paid): Allow like
    try {
      if (isLiked) {
        await libraryAPI.unlikeSong(currentTrack.song_id);
        setIsLiked(false);
        showToast('Imeondolewa kwenye zilizopendwa', 'info');
      } else {
        await libraryAPI.likeSong(currentTrack.song_id);
        setIsLiked(true);
        showToast('Imeongezwa kwenye zilizopendwa ❤️', 'success');
      }
    } catch (error) {
      console.error('Like error:', error);
      showToast('Imeshindikana. Jaribu tena', 'error');
    }
  };

  // Check if song is liked when track changes
  React.useEffect(() => {
    const checkLikeStatus = async () => {
      if (isAuthenticated && currentTrack?.song_id) {
        try {
          const response = await libraryAPI.getLikedSongs();
          const likedSongs = response.data?.songs || [];
          const liked = likedSongs.some(s => s.song_id === currentTrack.song_id);
          setIsLiked(liked);
        } catch (e) {
          console.log('Could not check like status');
        }
      }
    };
    checkLikeStatus();
  }, [currentTrack?.song_id, isAuthenticated]);

  const handleAddToPlaylist = () => {
    // BILLING LOGIC:
    // 1. Guest: Prompt to login (NEVER prompt to pay)
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    
    // 2. Logged in + billing ON + not paid: Prompt to pay
    if (billingEnabled && !isPremium) {
      setShowSubscriptionModal(true);
      return;
    }
    
    // 3. Logged in + (billing OFF OR paid): Show playlist modal
    setShowPlaylistModal(true);
  };

  const artworkUrl = getImageUrl(currentTrack.thumbnail || currentTrack.thumbnail_url) || 'https://via.placeholder.com/300';

  return (
    <LinearGradient
      colors={['#2a3a2a', '#1a2a1a', COLORS.background]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView 
          style={styles.scrollView} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-down" size={28} color={COLORS.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerSubtitle}>INACHEZA KUTOKA</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {currentTrack.album_title || 'Maktaba Yako'}
              </Text>
            </View>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="ellipsis-horizontal" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Album Art */}
          <View style={styles.artworkContainer}>
            <Image
              source={{ uri: artworkUrl }}
              style={styles.artwork}
            />
          </View>

          {/* Track Info with Actions */}
          <View style={styles.trackInfo}>
            <View style={styles.trackTitleRow}>
              <View style={styles.trackTitleContainer}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {currentTrack.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {currentTrack.artist_name}
                </Text>
              </View>
              <View style={styles.trackActions}>
                {/* Like Button */}
                <TouchableOpacity 
                  style={styles.trackActionBtn}
                  onPress={handleLike}
                >
                  <Ionicons 
                    name={isLiked ? "heart" : "heart-outline"} 
                    size={26} 
                    color={isLiked ? COLORS.error : COLORS.text} 
                  />
                </TouchableOpacity>
                {/* Download Button - Shows checkmark if downloaded */}
                <TouchableOpacity 
                  style={[
                    styles.trackActionBtn, 
                    songIsDownloaded && styles.trackActionBtnDownloaded
                  ]}
                  onPress={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <View style={styles.downloadProgress}>
                      <Text style={styles.downloadProgressText}>{downloadProgress}%</Text>
                    </View>
                  ) : songIsDownloaded ? (
                    <Ionicons name="checkmark-circle" size={26} color={COLORS.primary} />
                  ) : (
                    <Ionicons name="download-outline" size={26} color={COLORS.text} />
                  )}
                </TouchableOpacity>
                {/* Add to Playlist Button */}
                <TouchableOpacity 
                  style={styles.trackActionBtn}
                  onPress={handleAddToPlaylist}
                >
                  <Ionicons name="add-circle-outline" size={28} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={duration || 1}
              value={position}
              onSlidingComplete={skipDisabled ? undefined : seekTo}
              disabled={skipDisabled || previewMode}
              minimumTrackTintColor={skipDisabled ? COLORS.textSecondary : COLORS.text}
              maximumTrackTintColor={COLORS.progressBar}
              thumbTintColor={skipDisabled ? 'transparent' : COLORS.text}
            />
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>{formatTime(position)}</Text>
              <Text style={[styles.timeText, previewMode && { color: COLORS.primary }]}>
                {previewMode ? '0:15' : formatTime(duration)}
              </Text>
            </View>
          </View>

          {/* Main Controls */}
          <View style={styles.controls}>
            <TouchableOpacity 
              style={styles.secondaryControl}
              onPress={toggleShuffle}
            >
              <Ionicons
                name="shuffle"
                size={24}
                color={shuffle ? COLORS.primary : COLORS.text}
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlButton, skipDisabled && { opacity: 0.3 }]}
              onPress={skipDisabled ? undefined : handleSkipPrevious}
              disabled={skipDisabled}
            >
              <Ionicons name="play-skip-back" size={36} color={COLORS.text} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.playButton}
              onPress={togglePlay}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={36}
                color={COLORS.background}
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.controlButton, skipDisabled && { opacity: 0.3 }]}
              onPress={skipDisabled ? undefined : handleSkipNext}
              disabled={skipDisabled}
            >
              <Ionicons name="play-skip-forward" size={36} color={COLORS.text} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryControl}
              onPress={cycleRepeat}
            >
              <View>
                <Ionicons
                  name={getRepeatIcon()}
                  size={24}
                  color={repeat !== 'off' ? COLORS.primary : COLORS.text}
                />
                {repeat === 'one' && (
                  <Text style={styles.repeatOneIndicator}>1</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Bottom Actions Row */}
          <View style={styles.bottomActionsRow}>
            {/* Continuous Play / Auto-Recommend Toggle */}
            <TouchableOpacity 
              style={styles.bottomIconBtn} 
              onPress={toggleContinuousPlay}
            >
              <View style={{ alignItems: 'center' }}>
                <Ionicons 
                  name={continuousPlay ? "infinite" : "infinite-outline"} 
                  size={22} 
                  color={continuousPlay ? COLORS.primary : COLORS.textSecondary} 
                />
                {continuousPlay && (
                  <Text style={{ fontSize: 8, color: COLORS.primary, marginTop: 2 }}>AUTO</Text>
                )}
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.bottomIconBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.bottomIconBtn} onPress={() => setShowQueueModal(true)}>
              <Ionicons name="list" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* More Like This Section */}
          {currentTrack.artist_name && (
            <View style={styles.exploreSection}>
              <Text style={styles.exploreSectionTitle}>
                Nyingine kama hii
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.exploreList}
              >
                {/* Placeholder cards for more from artist */}
                {[1, 2, 3].map((i) => (
                  <TouchableOpacity key={i} style={styles.exploreCard}>
                    <Image
                      source={{ uri: artworkUrl }}
                      style={styles.exploreCardImage}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={currentTrack}
        isAuthenticated={isAuthenticated}
        billingEnabled={billingEnabled}
        isPremium={isPremium}
        onLoginRequired={() => {
          setShowPlaylistModal(false);
          setShowLoginModal(true);
        }}
        onSubscriptionRequired={() => {
          setShowPlaylistModal(false);
          setShowSubscriptionModal(true);
        }}
        onDownload={handleDownload}
      />

      {/* Login Required Modal */}
      <LoginRequiredModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={() => {
          setShowLoginModal(false);
          navigation.navigate('Login');
        }}
      />

      {/* Subscription Required Modal */}
      <SubscriptionRequiredModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        navigation={navigation}
        onSubscribe={() => {
          setShowSubscriptionModal(false);
          navigation.navigate('SubscriptionPlans');
        }}
      />

      {/* Queue Modal */}
      <Modal
        visible={showQueueModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowQueueModal(false)}
      >
        <View style={styles.queueModalOverlay}>
          <View style={styles.queueModalContent}>
            <View style={styles.queueModalHandle} />
            <View style={styles.queueModalHeader}>
              <Text style={styles.queueModalTitle}>Orodha ya Nyimbo</Text>
              <TouchableOpacity onPress={() => setShowQueueModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            {queue.length > 0 ? (
              <FlatList
                data={queue}
                keyExtractor={(item, index) => item.song_id || index.toString()}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[
                      styles.queueItem,
                      index === queueIndex && styles.queueItemActive
                    ]}
                    onPress={() => {
                      playTrack(item, queue, index);
                      setShowQueueModal(false);
                    }}
                  >
                    <Image
                      source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/50' }}
                      style={styles.queueItemImage}
                    />
                    <View style={styles.queueItemInfo}>
                      <Text 
                        style={[
                          styles.queueItemTitle,
                          index === queueIndex && styles.queueItemTitleActive
                        ]} 
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text style={styles.queueItemArtist} numberOfLines={1}>
                        {item.artist_name}
                      </Text>
                    </View>
                    {index === queueIndex && (
                      <Ionicons name="musical-notes" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.queueList}
              />
            ) : (
              <View style={styles.queueEmpty}>
                <Ionicons name="list-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.queueEmptyText}>Hakuna nyimbo kwenye orodha</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  headerButton: {
    padding: SPACING.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 2,
  },
  artworkContainer: {
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  artwork: {
    width: width - SPACING.lg * 2,
    height: width - SPACING.lg * 2,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
  },
  trackInfo: {
    marginBottom: SPACING.lg,
  },
  trackTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackTitleContainer: {
    flex: 1,
    marginRight: SPACING.md,
  },
  trackTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  trackArtist: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  trackActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackActionBtn: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  trackActionBtnDownloaded: {
    backgroundColor: COLORS.primary + '20',
    borderRadius: 15,
  },
  downloadProgress: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadProgressText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  progressContainer: {
    marginBottom: SPACING.md,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -SPACING.sm,
  },
  timeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  secondaryControl: {
    padding: SPACING.sm,
  },
  controlButton: {
    padding: SPACING.sm,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatOneIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    fontSize: 8,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  bottomIconBtn: {
    padding: SPACING.md,
  },
  exploreSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  exploreSectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  exploreList: {
    paddingBottom: SPACING.md,
  },
  exploreCard: {
    width: 100,
    height: 100,
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  exploreCardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.card,
  },
  // Queue Modal Styles
  queueModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  queueModalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  queueModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMuted,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.md,
  },
  queueModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  queueModalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  queueList: {
    padding: SPACING.sm,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
  },
  queueItemActive: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
  },
  queueItemImage: {
    width: 50,
    height: 50,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
  },
  queueItemInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  queueItemTitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  queueItemTitleActive: {
    color: COLORS.primary,
  },
  queueItemArtist: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  queueEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },
  queueEmptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
});

export default NowPlayingScreen;
