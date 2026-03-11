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
import { useDownloads, DOWNLOAD_STATUS } from '../context/DownloadContext';
import { SongListItem, PlayAllHeader } from '../components/Cards';
import { SongActionsSheet } from '../components/SongActionsSheet';
import PlaylistPickerSheet from '../components/PlaylistPickerSheet';
import { showToast } from '../components/Toast';
import { InlineLoader } from '../components/GracefyLoader';

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
  const [availableTags, setAvailableTags] = useState([]);
  
  // Modal states
  const [showActionsSheet, setShowActionsSheet] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [isAddingAllSongs, setIsAddingAllSongs] = useState(false); // Track if adding all songs
  
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
  
  // Download context
  const queueAlbumDownload = downloadContext?.queueAlbumDownload ?? (() => ({ success: false }));
  const isDownloaded = downloadContext?.isDownloaded ?? (() => false);
  const getDownloadStatus = downloadContext?.getDownloadStatus ?? (() => DOWNLOAD_STATUS.IDLE);
  const downloadCount = downloadContext?.downloadCount ?? 0;
  const queueCount = downloadContext?.queueCount ?? 0;

  // Load data
  useEffect(() => {
    if (item) {
      loadSongs();
      loadTags();
      if (isAuthenticated) {
        loadLikedSongs();
        loadPlaylists();
      }
    } else {
      setLoading(false);
    }
  }, [item, isAuthenticated]);

  const loadTags = async () => {
    try {
      const res = await homeAPI.getTags();
      setAvailableTags(res?.data?.tags || []);
    } catch (e) {
      console.log('Failed to load tags:', e.message);
    }
  };

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
    
    // Check if this is a user playlist (not an album or mix)
    const isUserPlaylist = playlist && playlist.playlist_id && !album && !mix;
    
    // Gate playing from user playlists behind premium when billing is enabled
    if (isUserPlaylist && billingEnabled && !isPremium) {
      const result = billingContext?.promptSubscription?.('playlist');
      if (result === 'show_plans') {
        navigation.navigate('SubscriptionPlans');
      }
      return;
    }
    
    try {
      // Add album thumbnail to each song if it doesn't have one
      const albumThumbnail = item?.thumbnail || item?.thumbnail_url;
      const songsWithThumbnails = songs.map(s => ({
        ...s,
        album_thumbnail: s.thumbnail || s.thumbnail_url || albumThumbnail,
        thumbnail: s.thumbnail || s.thumbnail_url || albumThumbnail
      }));
      const songWithThumbnail = {
        ...song,
        album_thumbnail: song.thumbnail || song.thumbnail_url || albumThumbnail,
        thumbnail: song.thumbnail || song.thumbnail_url || albumThumbnail
      };
      playTrack(songWithThumbnail, songsWithThumbnails);
    } catch (error) {
      console.error('Error playing song:', error);
      showToast('Imeshindwa kucheza', 'error');
    }
  }, [playTrack, songs, item, playlist, album, mix, billingEnabled, isPremium, billingContext, navigation]);

  const handlePlayAll = useCallback(() => {
    if (!songs?.length) return;
    const firstSong = songs[0];
    if (firstSong) {
      handlePlaySong(firstSong);
    }
  }, [songs, handlePlaySong]);

  const handleShuffle = useCallback(() => {
    if (!songs?.length) return;
    const albumThumbnail = item?.thumbnail || item?.thumbnail_url;
    const shuffled = [...songs].map(s => ({
      ...s,
      album_thumbnail: s.thumbnail || s.thumbnail_url || albumThumbnail,
      thumbnail: s.thumbnail || s.thumbnail_url || albumThumbnail
    })).sort(() => Math.random() - 0.5);
    const firstSong = shuffled[0];
    if (firstSong) {
      playTrack(firstSong, shuffled);
    }
  }, [songs, playTrack, item]);

  // Handle download all songs in album
  const handleDownloadAlbum = useCallback(() => {
    if (!songs?.length) {
      showToast('Hakuna nyimbo za kupakua', 'warning');
      return;
    }
    
    // BILLING LOGIC:
    // 1. Guest: Prompt to login (NEVER prompt to pay)
    if (!isAuthenticated) {
      showToast('Tafadhali ingia kwanza ili kupakua', 'warning');
      navigation.navigate('Login');
      return;
    }
    
    // 2. Logged in + billing ON + not paid: Prompt to pay
    if (billingEnabled && !isPremium) {
      const result = billingContext?.promptSubscription?.('download');
      if (result === 'show_plans') {
        navigation.navigate('SubscriptionPlans');
      }
      return;
    }
    
    // 3. Logged in + (billing OFF OR paid): Allow download
    // Check how many songs are already downloaded
    const notDownloaded = songs.filter(s => !isDownloaded(s.song_id));
    
    if (notDownloaded.length === 0) {
      showToast('Nyimbo zote tayari zimepakuliwa! ✓', 'success');
      return;
    }
    
    const result = queueAlbumDownload(songs);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message || 'Haiwezi kupakua', 'error');
    }
  }, [songs, queueAlbumDownload, isDownloaded, isAuthenticated, navigation, billingEnabled, isPremium, billingContext]);

  // Check if all songs are downloaded
  const allSongsDownloaded = songs?.length > 0 && songs.every(s => isDownloaded(s.song_id));
  const someDownloading = queueCount > 0;

  // Handle adding all songs to playlist
  const handleAddAlbumToPlaylist = useCallback(() => {
    if (!songs?.length) {
      showToast('Hakuna nyimbo za kuongeza', 'warning');
      return;
    }
    
    // BILLING LOGIC:
    // 1. Guest: Prompt to login (NEVER prompt to pay)
    if (!isAuthenticated) {
      showToast('Tafadhali ingia kwanza', 'warning');
      navigation.navigate('Login');
      return;
    }
    
    // 2. Logged in + billing ON + not paid: Prompt to pay
    if (billingEnabled && !isPremium) {
      const result = billingContext?.promptSubscription?.('playlist');
      if (result === 'show_plans') {
        navigation.navigate('SubscriptionPlans');
      }
      return;
    }
    
    // 3. Logged in + (billing OFF OR paid): Show playlist picker
    setIsAddingAllSongs(true);
    setSelectedSong(songs[0]); // For modal display
    setShowPlaylistPicker(true);
  }, [songs, isAuthenticated, navigation, billingEnabled, isPremium, billingContext]);

  const handleSongMore = useCallback((song) => {
    setSelectedSong(song);
    setShowActionsSheet(true);
  }, []);

  const handleAddToPlaylist = useCallback((song) => {
    setIsAddingAllSongs(false);
    setSelectedSong(song);
    setShowActionsSheet(false);
    setTimeout(() => setShowPlaylistPicker(true), 300);
  }, []);

  const handleSelectPlaylist = useCallback(async (playlist) => {
    if (!selectedSong && !isAddingAllSongs) return;
    
    try {
      if (isAddingAllSongs && songs?.length) {
        // Add all songs to the playlist
        let addedCount = 0;
        for (const song of songs) {
          try {
            await libraryAPI.addToPlaylist(playlist.playlist_id, song.song_id);
            addedCount++;
          } catch (e) {
            // Skip duplicates or errors silently
          }
        }
        showToast(`Nyimbo ${addedCount} zimeongezwa kwenye "${playlist.name}"`, 'success');
      } else if (selectedSong) {
        // Add single song
        await libraryAPI.addToPlaylist(playlist.playlist_id, selectedSong.song_id);
        showToast(`Imeongezwa kwenye "${playlist.name}"`, 'success');
      }
      setShowPlaylistPicker(false);
      setSelectedSong(null);
      setIsAddingAllSongs(false);
    } catch (error) {
      showToast('Imeshindwa kuongeza', 'error');
    }
  }, [selectedSong, isAddingAllSongs, songs]);

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
            {/* Album Tags - Top Left */}
            {album?.tags && album.tags.length > 0 && (
              <View style={styles.albumTagsOverlay}>
                {album.tags.slice(0, 2).map(tagId => {
                  const tag = availableTags.find(t => t.tag_id === tagId);
                  return tag ? (
                    <View key={tagId} style={[styles.albumTagChip, { backgroundColor: tag.color }]}>
                      <Text style={styles.albumTagChipText}>{tag.name}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            )}
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
            {/* Add to Playlist Button */}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleAddAlbumToPlaylist}
              data-testid="add-to-playlist-button"
            >
              <Ionicons name="add-circle-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>

            {/* Download Album Button */}
            <TouchableOpacity 
              style={[
                styles.actionButton,
                allSongsDownloaded && styles.actionButtonDone
              ]}
              onPress={handleDownloadAlbum}
              data-testid="download-album-button"
            >
              {someDownloading && !allSongsDownloaded ? (
                <ActivityIndicator size={20} color={COLORS.primary} />
              ) : (
                <Ionicons 
                  name={allSongsDownloaded ? "checkmark-circle" : "arrow-down-circle-outline"} 
                  size={24} 
                  color={allSongsDownloaded ? COLORS.primary : COLORS.text} 
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleShuffle}
              data-testid="shuffle-button"
            >
              <Ionicons name="shuffle" size={24} color={COLORS.text} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.playButton}
              onPress={handlePlayAll}
              data-testid="play-all-button"
            >
              <Ionicons name="play" size={28} color={COLORS.background} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Songs List */}
        <View style={styles.songsContainer}>
          {loading ? (
            <InlineLoader text="Loading songs..." />
          ) : songCount > 0 ? (
            (songs ?? []).map((song, index) => (
              <SongListItem
                key={song?.song_id ?? `song-${index}`}
                item={song}
                index={index}
                isPlaying={currentTrack?.song_id === song?.song_id && isPlaying}
                isCurrentSong={currentTrack?.song_id === song?.song_id}
                albumThumbnail={item?.thumbnail || item?.thumbnail_url}
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

      {/* Song Actions Sheet */}
      <SongActionsSheet
        visible={showActionsSheet}
        onClose={() => setShowActionsSheet(false)}
        song={selectedSong}
        isLiked={selectedSong?.song_id ? likedSongs.has(selectedSong.song_id) : false}
        isAuthenticated={isAuthenticated}
        billingEnabled={billingEnabled}
        isPremium={isPremium}
        onLike={handleLikeSong}
        onAddToPlaylist={handleAddToPlaylist}
        onLoginRequired={() => navigation.navigate('Login')}
        onSubscriptionRequired={() => navigation.navigate('SubscriptionPlans')}
        navigation={navigation}
      />

      {/* Playlist Picker Sheet */}
      <PlaylistPickerSheet
        visible={showPlaylistPicker}
        onClose={() => setShowPlaylistPicker(false)}
        song={selectedSong}
        playlists={playlists}
        loading={false}
        onSelectPlaylist={handleSelectPlaylist}
        onCreatePlaylist={() => {
          setShowPlaylistPicker(false);
          setTimeout(() => setShowCreatePlaylistModal(true), 300);
        }}
      />

      {/* Create Playlist Modal */}
      <Modal
        visible={showCreatePlaylistModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreatePlaylistModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCreatePlaylistModal(false)}
          >
            <View 
              style={styles.createPlaylistModal} 
              onStartShouldSetResponder={() => true}
            >
              <Text style={styles.modalTitle}>Playlist Mpya</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Jina la playlist..."
                placeholderTextColor={COLORS.textMuted}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                autoFocus
                maxLength={50}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalCancelButton}
                  onPress={() => setShowCreatePlaylistModal(false)}
                >
                  <Text style={styles.modalCancelText}>Ghairi</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.modalCreateButton, 
                    !newPlaylistName.trim() && styles.modalButtonDisabled
                  ]}
                  onPress={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim() || creatingPlaylist}
                >
                  {creatingPlaylist ? (
                    <ActivityIndicator size="small" color={COLORS.text} />
                  ) : (
                    <Text style={styles.modalCreateText}>Tengeneza</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
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
    position: 'relative',
  },
  albumArt: {
    width: 200,
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  albumTagsOverlay: {
    position: 'absolute',
    top: 8,
    left: -30,
    flexDirection: 'column',
    gap: 4,
  },
  albumTagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  albumTagChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
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
    gap: SPACING.md,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonDone: {
    backgroundColor: COLORS.primary + '20',
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
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPlaylistModal: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '85%',
    maxWidth: 350,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  modalCancelButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  modalCancelText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  modalCreateButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 100,
    alignItems: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalCreateText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});

export default AlbumScreen;
