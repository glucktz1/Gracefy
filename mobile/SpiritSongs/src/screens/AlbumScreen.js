import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { homeAPI, libraryAPI, getImageUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useBilling } from '../context/BillingContext';
import { useDownloads } from '../context/DownloadContext';
import { SongListItem, PlayAllHeader } from '../components/Cards';
import { SongActionsSheet, PlaylistPickerSheet } from '../components/SongActionsSheet';
import { showToast } from '../components/Toast';

const AlbumScreen = ({ route, navigation }) => {
  // Safe params extraction
  const params = route?.params ?? {};
  const { album, playlist, mix } = params;
  const item = album || playlist || mix;
  
  // State
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likedSongs, setLikedSongs] = useState(new Set());
  const [playlists, setPlaylists] = useState([]);
  
  // Modal states
  const [showActionsSheet, setShowActionsSheet] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  
  // Create playlist modal
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  // Context - call hooks unconditionally at top level
  const playerContext = usePlayer();
  const authContext = useAuth();
  const billingContext = useBilling();
  const downloadContext = useDownloads();
  
  // Safe extraction
  const playTrack = playerContext?.playTrack ?? (() => {});
  const currentTrack = playerContext?.currentTrack ?? null;
  const isPlaying = playerContext?.isPlaying ?? false;
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  const user = authContext?.user ?? null;
  const billingEnabled = billingContext?.billingEnabled ?? false;
  const isPremium = billingContext?.isPremium ?? false;
  const queueAlbumDownload = downloadContext?.queueAlbumDownload ?? (async () => ({}));

  // Load data
  useEffect(() => {
    if (item) {
      loadSongs();
      if (isAuthenticated) {
        loadLikedSongs();
        loadPlaylists();
      }
    } else {
      setLoading(false);
    }
  }, [item, isAuthenticated]);

  const loadSongs = async () => {
    try {
      setLoading(true);
      let songsList = [];
      
      if (album?.album_id) {
        const response = await homeAPI.getAlbumSongs(album.album_id);
        songsList = response?.data?.songs ?? [];
      } else if (playlist?.playlist_id) {
        const response = await libraryAPI.getPlaylistSongs(playlist.playlist_id);
        songsList = response?.data?.songs ?? [];
      } else if (mix?.mix_id) {
        const response = await homeAPI.getMixSongs(mix.mix_id);
        songsList = response?.data?.songs ?? [];
      }
      
      setSongs(songsList);
    } catch (error) {
      console.error('Error loading songs:', error);
      showToast('Imeshindwa kupakia nyimbo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadLikedSongs = async () => {
    try {
      const response = await libraryAPI.getLikedSongs();
      const liked = response?.data?.songs ?? [];
      setLikedSongs(new Set(liked.filter(s => s?.song_id).map(s => s.song_id)));
    } catch (error) {
      console.error('Error loading liked songs:', error);
    }
  };

  const loadPlaylists = async () => {
    try {
      const response = await libraryAPI.getPlaylists();
      setPlaylists(response?.data?.playlists ?? []);
    } catch (error) {
      console.error('Error loading playlists:', error);
    }
  };

  const handlePlaySong = useCallback((song) => {
    if (!song) return;
    try {
      playTrack(song, songs);
    } catch (error) {
      console.error('Error playing song:', error);
      showToast('Imeshindwa kucheza', 'error');
    }
  }, [playTrack, songs]);

  const handlePlayAll = useCallback(() => {
    if (!songs?.length) return;
    const firstSong = songs[0];
    if (firstSong) {
      handlePlaySong(firstSong);
    }
  }, [songs, handlePlaySong]);

  const handleShuffle = useCallback(() => {
    if (!songs?.length) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    const firstSong = shuffled[0];
    if (firstSong) {
      playTrack(firstSong, shuffled);
    }
  }, [songs, playTrack]);

  const handleSongMore = useCallback((song) => {
    setSelectedSong(song);
    setShowActionsSheet(true);
  }, []);

  const handleAddToPlaylist = useCallback((song) => {
    setSelectedSong(song);
    setShowActionsSheet(false);
    setTimeout(() => setShowPlaylistPicker(true), 300);
  }, []);

  const handleSelectPlaylist = useCallback(async (playlist) => {
    if (!selectedSong) return;
    
    try {
      await libraryAPI.addToPlaylist(playlist.playlist_id, selectedSong.song_id);
      showToast(`Imeongezwa kwenye "${playlist.name}"`, 'success');
      setShowPlaylistPicker(false);
      setSelectedSong(null);
    } catch (error) {
      showToast('Imeshindwa kuongeza wimbo', 'error');
    }
  }, [selectedSong]);

  const handleCreatePlaylist = useCallback(async () => {
    const name = newPlaylistName.trim();
    if (!name) {
      showToast('Tafadhali weka jina la playlist', 'error');
      return;
    }
    
    setCreatingPlaylist(true);
    try {
      const response = await libraryAPI.createPlaylist({ name });
      showToast('Playlist imetengenezwa! ✓', 'success');
      setShowCreatePlaylistModal(false);
      setNewPlaylistName('');
      
      if (selectedSong && response.data?.playlist_id) {
        await libraryAPI.addToPlaylist(response.data.playlist_id, selectedSong.song_id);
        showToast(`"${selectedSong.title}" imeongezwa`, 'success');
        setSelectedSong(null);
        setShowPlaylistPicker(false);
      }
      
      loadPlaylists();
    } catch (error) {
      showToast('Imeshindwa kutengeneza playlist', 'error');
    } finally {
      setCreatingPlaylist(false);
    }
  }, [newPlaylistName, selectedSong]);

  const handleDownloadAlbum = useCallback(async () => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    
    if (songs.length === 0) {
      showToast('Hakuna nyimbo za kupakua', 'info');
      return;
    }
    
    const result = await queueAlbumDownload(songs);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast('Imeshindwa kupakua', 'error');
    }
  }, [songs, isAuthenticated, navigation, queueAlbumDownload]);

  const handleLikeSong = useCallback(async (song) => {
    if (!song?.song_id || !isAuthenticated) {
      if (!isAuthenticated) {
        navigation.navigate('Login');
      }
      return;
    }
    
    try {
      const isLiked = likedSongs.has(song.song_id);
      if (isLiked) {
        await libraryAPI.unlikeSong(song.song_id);
        setLikedSongs(prev => {
          const next = new Set(prev);
          next.delete(song.song_id);
          return next;
        });
        showToast('Imeondolewa', 'success');
      } else {
        await libraryAPI.likeSong(song.song_id);
        setLikedSongs(prev => new Set(prev).add(song.song_id));
        showToast('Imeongezwa kwenye zilizopendwa', 'success');
      }
    } catch (error) {
      showToast('Imeshindwa', 'error');
    }
  }, [likedSongs, isAuthenticated, navigation]);

  // No item provided - show error
  if (!item) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
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

  // Get item details
  const title = item?.title || item?.name || 'Album';
  const subtitle = item?.artist_name || item?.description || '';
  const thumbnail = item?.thumbnail || item?.image_url;
  const songCount = songs?.length ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header with gradient */}
        <View style={styles.headerSection}>
          <LinearGradient
            colors={[COLORS.primary + '40', COLORS.background]}
            style={styles.gradient}
          />
          
          {/* Back button */}
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.text} />
          </TouchableOpacity>
          
          {/* Album Art */}
          <View style={styles.artContainer}>
            <Image
              source={{ uri: getImageUrl(thumbnail) || 'https://via.placeholder.com/200' }}
              style={styles.albumArt}
            />
          </View>
          
          {/* Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
            ) : null}
            <Text style={styles.meta}>{songCount} nyimbo</Text>
          </View>
          
          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.shuffleButton}
              onPress={handleShuffle}
            >
              <Ionicons name="shuffle" size={24} color={COLORS.text} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.playButton}
              onPress={handlePlayAll}
            >
              <Ionicons name="play" size={28} color={COLORS.background} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Songs List */}
        <View style={styles.songsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : songCount > 0 ? (
            (songs ?? []).map((song, index) => (
              <SongListItem
                key={song?.song_id ?? `song-${index}`}
                item={song}
                index={index}
                isPlaying={currentTrack?.song_id === song?.song_id && isPlaying}
                isCurrentSong={currentTrack?.song_id === song?.song_id}
                onPress={() => handlePlaySong(song)}
                onMorePress={() => handleSongMore(song)}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="musical-notes-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Hakuna nyimbo</Text>
            </View>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Song Actions Modal */}
      <SongActionsModal
        visible={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        song={selectedSong}
        isLiked={selectedSong?.song_id ? likedSongs.has(selectedSong.song_id) : false}
        isAuthenticated={isAuthenticated}
        billingEnabled={billingEnabled}
        isPremium={isPremium}
        onLike={() => handleLikeSong(selectedSong)}
        onAddToPlaylist={() => {
          setShowActionsModal(false);
        }}
        onDownload={() => {
          setShowActionsModal(false);
        }}
        onLoginRequired={() => {
          setShowActionsModal(false);
          navigation.navigate('Login');
        }}
        onSubscriptionRequired={() => {
          setShowActionsModal(false);
          navigation.navigate('Subscription');
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  headerSection: {
    position: 'relative',
    paddingBottom: SPACING.lg,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    zIndex: 10,
    padding: SPACING.xs,
    backgroundColor: COLORS.background + '80',
    borderRadius: BORDER_RADIUS.full,
  },
  artContainer: {
    alignItems: 'center',
    marginTop: SPACING.xxl + SPACING.lg,
  },
  albumArt: {
    width: 200,
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  infoContainer: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  meta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
    gap: SPACING.lg,
  },
  shuffleButton: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songsContainer: {
    paddingHorizontal: SPACING.md,
  },
  loadingContainer: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  errorButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.lg,
  },
  errorButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
});

export default AlbumScreen;
