import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  Share,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { libraryAPI, getImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from './Toast';

// Login Required Modal Component
export const LoginRequiredModal = ({ visible, onClose, onLogin, message }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.centeredOverlay}>
      <TouchableOpacity style={styles.overlayBackground} activeOpacity={1} onPress={onClose} />
      <View style={styles.loginModal}>
        <Ionicons name="lock-closed-outline" size={48} color={COLORS.primary} />
        <Text style={styles.loginTitle}>Ingia kwanza</Text>
        <Text style={styles.loginMessage}>
          {message || 'Unahitaji kuingia ili kutumia huduma hii'}
        </Text>
        <TouchableOpacity style={styles.loginButton} onPress={onLogin}>
          <Text style={styles.loginButtonText}>Ingia Sasa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
          <Text style={styles.cancelLinkText}>Baadaye</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// Subscription Required Modal Component
export const SubscriptionRequiredModal = ({ visible, onClose, onSubscribe }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.centeredOverlay}>
      <TouchableOpacity style={styles.overlayBackground} activeOpacity={1} onPress={onClose} />
      <View style={styles.loginModal}>
        <Ionicons name="star-outline" size={48} color={COLORS.primary} />
        <Text style={styles.loginTitle}>Usajili Unahitajika</Text>
        <Text style={styles.loginMessage}>
          Unahitaji usajili wa premium ili kutumia huduma hii
        </Text>
        <TouchableOpacity style={styles.loginButton} onPress={onSubscribe}>
          <Text style={styles.loginButtonText}>Jisajili Sasa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
          <Text style={styles.cancelLinkText}>Baadaye</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// Song Actions Bottom Sheet (Three dots menu) - Without download
export const SongActionsModal = ({ 
  visible, 
  onClose, 
  song, 
  onLike, 
  onAddToPlaylist, 
  onShare,
  isLiked,
  isAuthenticated,
  billingEnabled,
  isPremium,
  onLoginRequired,
  onSubscriptionRequired,
}) => {

  const handleLike = async () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    onLike?.(song);
    onClose();
  };

  const handleAddToPlaylist = () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    if (billingEnabled && !isPremium) {
      onSubscriptionRequired?.();
      return;
    }
    onAddToPlaylist?.(song);
    onClose();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Sikiliza "${song?.title}" kwenye Gracefy App!`,
        title: song?.title || 'Shiriki Wimbo',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
    onClose();
  };

  if (!song) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={styles.bottomSheet}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Song Info */}
          {song && (
            <View style={styles.songInfo}>
              <Image
                source={{ uri: getImageUrl(song.thumbnail || song.thumbnail_url) || 'https://via.placeholder.com/56' }}
                style={styles.songImage}
              />
              <View style={styles.songDetails}>
                <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
                <Text style={styles.songArtist} numberOfLines={1}>{song.artist_name}</Text>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsList}>
            <TouchableOpacity style={styles.actionItem} onPress={handleLike}>
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={24} 
                color={isLiked ? COLORS.error : COLORS.text} 
              />
              <Text style={styles.actionText}>{isLiked ? 'Ondoa Penzi' : 'Penda'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={handleAddToPlaylist}>
              <Ionicons name="add-circle-outline" size={24} color={COLORS.text} />
              <Text style={styles.actionText}>Ongeza kwenye Playlist</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color={COLORS.text} />
              <Text style={styles.actionText}>Shiriki</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// Main Add to Playlist Modal
const AddToPlaylistModal = ({ 
  visible, 
  onClose, 
  song, 
  onLike,
  isAuthenticated,
  billingEnabled,
  isPremium,
  onLoginRequired,
  onSubscriptionRequired,
}) => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible && isAuthenticated) {
      loadPlaylists();
    } else if (visible && !isAuthenticated) {
      setLoading(false);
    }
  }, [visible, isAuthenticated]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const response = await libraryAPI.getPlaylists();
      const playlistsData = response.data?.playlists || response.data || [];
      console.log('Loaded playlists:', playlistsData.length);
      setPlaylists(playlistsData);
    } catch (error) {
      console.error('Error loading playlists:', error);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlist) => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      onClose();
      return;
    }
    if (billingEnabled && !isPremium) {
      onSubscriptionRequired?.();
      onClose();
      return;
    }
    try {
      await libraryAPI.addToPlaylist(playlist.playlist_id, song.song_id);
      showToast(`Imeongezwa kwenye "${playlist.name}"`, 'success');
      onClose();
    } catch (error) {
      console.error('Error adding to playlist:', error);
      showToast('Imeshindikana kuongeza wimbo', 'error');
    }
  };

  const handleCreatePlaylist = async () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    if (billingEnabled && !isPremium) {
      onSubscriptionRequired?.();
      return;
    }
    if (!newPlaylistName.trim()) {
      showToast('Tafadhali weka jina la playlist', 'warning');
      return;
    }

    try {
      setCreating(true);
      Keyboard.dismiss();
      const response = await libraryAPI.createPlaylist({ name: newPlaylistName });
      if (response.data?.playlist_id && song) {
        await libraryAPI.addToPlaylist(response.data.playlist_id, song.song_id);
        showToast(`Playlist "${newPlaylistName}" imetengenezwa`, 'success');
      } else {
        showToast(`Playlist "${newPlaylistName}" imetengenezwa`, 'success');
      }
      setNewPlaylistName('');
      setShowCreateNew(false);
      await loadPlaylists();
    } catch (error) {
      console.error('Error creating playlist:', error);
      showToast('Imeshindikana kutengeneza playlist', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      onClose();
      return;
    }
    try {
      await libraryAPI.likeSong(song.song_id);
      showToast(`"${song.title}" imependwa ❤️`, 'success');
      if (onLike) onLike();
      onClose();
    } catch (error) {
      console.error('Error liking song:', error);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Sikiliza "${song?.title}" kwenye Gracefy App!`,
        title: song?.title || 'Shiriki Wimbo',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const renderPlaylistItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.playlistItem} 
      onPress={() => handleAddToPlaylist(item)}
      data-testid={`playlist-item-${item.playlist_id}`}
    >
      <View style={styles.playlistImageContainer}>
        <Ionicons name="musical-notes" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.playlistCount}>{item.song_count || 0} nyimbo</Text>
      </View>
      <Ionicons name="add" size={24} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.modalOverlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1} 
          onPress={onClose} 
        />
        <View style={styles.modalContent}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Title */}
          <Text style={styles.modalTitle}>Ongeza kwenye Playlist</Text>

          {/* Song Info */}
          {song && (
            <View style={styles.songInfoSmall}>
              <Image
                source={{ uri: getImageUrl(song.thumbnail) || 'https://via.placeholder.com/40' }}
                style={styles.songImageSmall}
              />
              <View style={styles.songDetailsSmall}>
                <Text style={styles.songTitleSmall} numberOfLines={1}>{song.title}</Text>
                <Text style={styles.songArtistSmall} numberOfLines={1}>{song.artist_name}</Text>
              </View>
            </View>
          )}

          {/* Playlists */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : !isAuthenticated ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="lock-closed-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Ingia ili uone playlists zako</Text>
              <TouchableOpacity style={styles.loginSmallButton} onPress={onLoginRequired}>
                <Text style={styles.loginSmallButtonText}>Ingia</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <FlatList
                data={playlists}
                renderItem={renderPlaylistItem}
                keyExtractor={(item) => item.playlist_id}
                style={styles.playlistList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="musical-notes-outline" size={48} color={COLORS.textMuted} />
                    <Text style={styles.emptyText}>Hakuna playlists</Text>
                    <Text style={styles.emptySubtext}>Tengeneza playlist mpya hapa chini</Text>
                  </View>
                }
              />

              {/* Create New Playlist */}
              {showCreateNew ? (
                <View style={styles.createPlaylistContainer}>
                  <TextInput
                    style={styles.playlistInput}
                    placeholder="Jina la playlist..."
                    placeholderTextColor={COLORS.textMuted}
                    value={newPlaylistName}
                    onChangeText={setNewPlaylistName}
                    autoFocus
                    maxLength={50}
                  />
                  <View style={styles.createButtonsRow}>
                    <TouchableOpacity 
                      style={styles.cancelCreateButton}
                      onPress={() => {
                        setShowCreateNew(false);
                        setNewPlaylistName('');
                      }}
                    >
                      <Text style={styles.cancelCreateText}>Ghairi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.createButton, creating && styles.createButtonDisabled]}
                      onPress={handleCreatePlaylist}
                      disabled={creating}
                    >
                      {creating ? (
                        <ActivityIndicator size="small" color={COLORS.background} />
                      ) : (
                        <Text style={styles.createButtonText}>Tengeneza</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.newPlaylistButton}
                  onPress={() => setShowCreateNew(true)}
                >
                  <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                  <Text style={styles.newPlaylistText}>Tengeneza Playlist Mpya</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.bottomActionItem} onPress={handleLike}>
              <Ionicons name="heart-outline" size={22} color={COLORS.text} />
              <Text style={styles.bottomActionText}>Penda</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bottomActionItem} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color={COLORS.text} />
              <Text style={styles.bottomActionText}>Shiriki</Text>
            </TouchableOpacity>
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Funga</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  centeredOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Login Modal
  loginModal: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '85%',
    maxWidth: 320,
  },
  loginTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  loginMessage: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.full,
    width: '100%',
    alignItems: 'center',
  },
  loginButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  cancelLink: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
  },
  cancelLinkText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
  },
  
  // Bottom Sheet
  bottomSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
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
  
  // Song Info
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  songImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.background,
  },
  songDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  songTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginBottom: 4,
  },
  songArtist: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  
  // Actions List
  actionsList: {
    paddingVertical: SPACING.sm,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  actionText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    marginLeft: SPACING.md,
  },
  
  // Modal Content
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
    paddingBottom: 34,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  
  // Small Song Info
  songInfoSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  songImageSmall: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.xs,
    backgroundColor: COLORS.background,
  },
  songDetailsSmall: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  songTitleSmall: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  songArtistSmall: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
  },
  
  // Loading & Empty
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.xs,
  },
  loginSmallButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.md,
  },
  loginSmallButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  
  // Playlist List
  playlistList: {
    maxHeight: 300,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  playlistImageContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  playlistName: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  playlistCount: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  
  // Create Playlist
  createPlaylistContainer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  playlistInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    marginBottom: SPACING.sm,
  },
  createButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelCreateButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
  },
  cancelCreateText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
  },
  createButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  newPlaylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  newPlaylistText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    marginLeft: SPACING.sm,
  },
  
  // Bottom Actions
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.xl,
  },
  bottomActionItem: {
    alignItems: 'center',
  },
  bottomActionText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    marginTop: 4,
  },
  
  // Close Button
  closeButton: {
    marginHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
  },
  closeButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});

export default AddToPlaylistModal;
