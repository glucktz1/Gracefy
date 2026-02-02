import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { contentAPI, libraryAPI, getImageUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useBilling } from '../context/BillingContext';
import { SongListItem } from '../components/Cards';
import { showToast } from '../components/Toast';
import AddToPlaylistModal, { 
  SongActionsModal, 
  LoginRequiredModal, 
  SubscriptionRequiredModal 
} from '../components/AddToPlaylistModal';

const { width } = Dimensions.get('window');

const AlbumScreen = ({ route, navigation }) => {
  // Safe extraction with fallbacks
  const params = route?.params || {};
  const { album, playlist, mix } = params;
  const item = album || playlist || mix;
  
  // If no item, show error state
  if (!item) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.errorText}>Hakuna maudhui</Text>
          <TouchableOpacity 
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Rudi Nyuma</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likedSongs, setLikedSongs] = useState(new Set());
  
  // Modals
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);

  const { playTrack, currentTrack } = usePlayer();
  const { isAuthenticated, user } = useAuth();
  const { billingEnabled, isPremium } = useBilling();

  useEffect(() => {
    loadSongs();
    if (isAuthenticated) {
      loadLikedSongs();
    }
  }, [item, isAuthenticated]);

  const loadSongs = async () => {
    try {
      let response;
      if (album?.album_id) {
        response = await contentAPI.getAlbum(album.album_id);
      } else if (playlist?.playlist_id) {
        response = await libraryAPI.getPlaylistSongs(playlist.playlist_id);
      } else if (mix?.mix_id) {
        response = await contentAPI.getMixSongs(mix.mix_id);
      }
      
      // Add item thumbnail to each song that doesn't have one
      const songsWithThumbnail = (response?.data?.songs || []).map(song => ({
        ...song,
        thumbnail: song.thumbnail || song.thumbnail_url || item?.thumbnail || item?.thumbnail_url,
        artist_name: song.artist_name || item?.artist_name,
      }));
      setSongs(songsWithThumbnail);
    } catch (error) {
      console.error('Error loading songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLikedSongs = async () => {
    try {
      const response = await libraryAPI.getLikedSongs();
      const liked = new Set((response.data?.songs || response.data || []).map(s => s.song_id));
      setLikedSongs(liked);
    } catch (error) {
      console.error('Error loading liked songs:', error);
    }
  };

  const handlePlaySong = (song) => {
    const index = songs.findIndex(s => s.song_id === song.song_id);
    playTrack(song, songs, index >= 0 ? index : 0);
  };

  const handlePlayAll = () => {
    if (songs.length > 0) {
      playTrack(songs[0], songs, 0);
    }
  };

  const handleShuffle = () => {
    if (songs.length > 0) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled, 0);
    }
  };

  const handleSongMore = (song) => {
    setSelectedSong(song);
    setShowActionsModal(true);
  };

  const handleLikeSong = async (song) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    try {
      if (likedSongs.has(song.song_id)) {
        await libraryAPI.unlikeSong(song.song_id);
        setLikedSongs(prev => {
          const newSet = new Set(prev);
          newSet.delete(song.song_id);
          return newSet;
        });
        showToast(`"${song.title}" imeondolewa ❌`, 'info');
      } else {
        await libraryAPI.likeSong(song.song_id);
        setLikedSongs(prev => new Set(prev).add(song.song_id));
        showToast(`"${song.title}" imependwa ❤️`, 'success');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      showToast('Imeshindikana kubadilisha hali ya kupenda', 'error');
    }
  };

  const handleAddToPlaylist = (song) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (billingEnabled && !isPremium) {
      setShowSubscriptionModal(true);
      return;
    }
    setSelectedSong(song);
    setShowPlaylistModal(true);
  };

  const handleDownload = async (song) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (billingEnabled && !isPremium) {
      setShowSubscriptionModal(true);
      return;
    }
    // Download is handled via the modal
    setSelectedSong(song);
    setShowPlaylistModal(true);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Sikiliza "${item?.title}" kwenye Gracefy App!`,
        title: item?.title,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const handleLoginPress = () => {
    setShowLoginModal(false);
    navigation.navigate('Login');
  };

  const handleSubscribePress = () => {
    setShowSubscriptionModal(false);
    navigation.navigate('Checkout');
  };

  const totalDuration = songs.reduce((acc, song) => acc + (song.duration || 0), 0);
  const formatTotalDuration = () => {
    const hours = Math.floor(totalDuration / 3600);
    const mins = Math.floor((totalDuration % 3600) / 60);
    if (hours > 0) {
      return `${hours} saa ${mins} dak`;
    }
    return `${mins} dak`;
  };

  const itemThumbnail = getImageUrl(item?.thumbnail || item?.thumbnail_url);
  const itemTitle = item?.title || item?.name || 'Album';
  const itemArtist = item?.artist_name || '';
  const isAlbum = !!album;
  const isPlaylist = !!playlist;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with gradient */}
        <LinearGradient
          colors={[COLORS.primary + '40', COLORS.background]}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            {/* Navigation */}
            <View style={styles.nav}>
              <TouchableOpacity 
                style={styles.navButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="chevron-back" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Album Art */}
            <View style={styles.artworkContainer}>
              <Image
                source={{ uri: itemThumbnail || 'https://via.placeholder.com/200' }}
                style={styles.artwork}
              />
            </View>

            {/* Album Info */}
            <View style={styles.albumInfo}>
              <Text style={styles.albumTitle}>{itemTitle}</Text>
              {itemArtist && (
                <TouchableOpacity style={styles.artistRow}>
                  <Image
                    source={{ uri: item?.artist_avatar || 'https://via.placeholder.com/24' }}
                    style={styles.artistAvatar}
                  />
                  <Text style={styles.artistName}>{itemArtist}</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.albumMeta}>
                {isPlaylist ? 'Playlist' : isAlbum ? 'Album' : 'Mix'} • {songs.length} nyimbo{songs.length > 0 ? `, ${formatTotalDuration()}` : ''}
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Actions */}
        <View style={styles.actions}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleLikeSong(item)}>
              <Ionicons 
                name={likedSongs.has(item?.album_id || item?.playlist_id) ? "heart" : "heart-outline"} 
                size={24} 
                color={likedSongs.has(item?.album_id || item?.playlist_id) ? COLORS.error : COLORS.textSecondary} 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleDownload(item)}>
              <Ionicons name="download-outline" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => {
                if (songs.length > 0) {
                  handleAddToPlaylist(songs[0]);
                } else {
                  showToast('Album hii haina nyimbo za kuongeza', 'warning');
                }
              }}
            >
              <Ionicons name="add-circle-outline" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.rightActions}>
            <TouchableOpacity 
              style={styles.shuffleButton}
              onPress={handleShuffle}
              disabled={songs.length === 0}
            >
              <Ionicons name="shuffle" size={24} color={songs.length > 0 ? COLORS.text : COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.playButton, songs.length === 0 && styles.playButtonDisabled]}
              onPress={handlePlayAll}
              disabled={songs.length === 0}
            >
              <Ionicons name="play" size={28} color={COLORS.background} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Songs List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : songs.length > 0 ? (
          <View style={styles.songsList}>
            {songs.map((song, index) => (
              <SongListItem
                key={song.song_id}
                item={song}
                index={index}
                isPlaying={currentTrack?.song_id === song.song_id}
                onPress={() => handlePlaySong(song)}
                onMorePress={handleSongMore}
                albumThumbnail={itemThumbnail}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Hakuna nyimbo</Text>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Song Actions Modal (Three dots menu) */}
      <SongActionsModal
        visible={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        song={selectedSong}
        isLiked={selectedSong ? likedSongs.has(selectedSong.song_id) : false}
        isAuthenticated={isAuthenticated}
        billingEnabled={billingEnabled}
        isPremium={isPremium}
        onLike={handleLikeSong}
        onAddToPlaylist={(song) => {
          setShowActionsModal(false);
          setSelectedSong(song);
          setShowPlaylistModal(true);
        }}
        onDownload={handleDownload}
        onLoginRequired={() => {
          setShowActionsModal(false);
          setShowLoginModal(true);
        }}
        onSubscriptionRequired={() => {
          setShowActionsModal(false);
          setShowSubscriptionModal(true);
        }}
      />

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={selectedSong}
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
      />

      {/* Login Required Modal */}
      <LoginRequiredModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLoginPress}
        message="Unahitaji kuingia ili kutengeneza playlist, kupakua au kupenda nyimbo"
      />

      {/* Subscription Required Modal */}
      <SubscriptionRequiredModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscribe={handleSubscribePress}
        navigation={navigation}
        message="Unahitaji kulipia ili kutengeneza playlist au kupakua nyimbo"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    paddingBottom: SPACING.lg,
  },
  nav: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  navButton: {
    padding: SPACING.xs,
  },
  artworkContainer: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  artwork: {
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
  albumInfo: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  albumTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  artistAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    marginRight: SPACING.sm,
  },
  artistName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  albumMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shuffleButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  loadingContainer: {
    paddingVertical: SPACING.xxl,
  },
  songsList: {
    paddingHorizontal: SPACING.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  // Error state styles
  header: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    padding: SPACING.xs,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  errorButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
  },
  errorButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
});

export default AlbumScreen;
