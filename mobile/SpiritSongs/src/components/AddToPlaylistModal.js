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
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { libraryAPI, getImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Login Required Modal Component
export const LoginRequiredModal = ({ visible, onClose, onLogin, message }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.loginModal}>
        <Ionicons name="lock-closed-outline" size={48} color={COLORS.primary} />
        <Text style={styles.loginTitle}>Ingia kwanza</Text>
        <Text style={styles.loginMessage}>
          {message || 'Unahitaji kuingia ili kutengeneza playlist au kupakua nyimbo'}
        </Text>
        <TouchableOpacity style={styles.loginButton} onPress={onLogin}>
          <Text style={styles.loginButtonText}>Ingia Sasa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
          <Text style={styles.cancelLinkText}>Baadaye</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);

// Subscription Required Modal Component
export const SubscriptionRequiredModal = ({ visible, onClose, onSubscribe, message }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.loginModal}>
        <Ionicons name="star-outline" size={48} color={COLORS.warning} />
        <Text style={styles.loginTitle}>Jiandikishe</Text>
        <Text style={styles.loginMessage}>
          {message || 'Unahitaji kulipia ili kutengeneza playlist au kupakua nyimbo'}
        </Text>
        <TouchableOpacity style={[styles.loginButton, { backgroundColor: COLORS.warning }]} onPress={onSubscribe}>
          <Text style={styles.loginButtonText}>Lipia Sasa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
          <Text style={styles.cancelLinkText}>Baadaye</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  </Modal>
);

// Song Actions Bottom Sheet (Three dots menu)
export const SongActionsModal = ({ 
  visible, 
  onClose, 
  song, 
  onLike, 
  onAddToPlaylist, 
  onDownload, 
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

  const handleDownload = () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    if (billingEnabled && !isPremium) {
      onSubscriptionRequired?.();
      return;
    }
    onDownload?.(song);
    onClose();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Sikiliza "${song?.title}" kwenye Gracefy App!`,
        title: song?.title,
      });
    } catch (error) {
      console.log('Share error:', error);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.actionsContainer}>
          {/* Header */}
          <View style={styles.actionsHeader}>
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

            <TouchableOpacity style={styles.actionItem} onPress={handleDownload}>
              <Ionicons name="download-outline" size={24} color={COLORS.text} />
              <Text style={styles.actionText}>Pakua</Text>
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
      setPlaylists(response.data || []);
    } catch (error) {
      console.error('Error loading playlists:', error);
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
      Alert.alert('Imefanikiwa', `"${song.title}" imeongezwa kwenye "${playlist.name}"`);
      onClose();
    } catch (error) {
      console.error('Error adding to playlist:', error);
      Alert.alert('Kosa', 'Imeshindikana kuongeza wimbo kwenye playlist');
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
      Alert.alert('Kosa', 'Tafadhali weka jina la playlist');
      return;
    }

    try {
      setCreating(true);
      const response = await libraryAPI.createPlaylist({ name: newPlaylistName });
      if (response.data?.playlist_id) {
        await libraryAPI.addToPlaylist(response.data.playlist_id, song.song_id);
        Alert.alert('Imefanikiwa', `Playlist "${newPlaylistName}" imetengenezwa na wimbo umeongezwa`);
      }
      setNewPlaylistName('');
      setShowCreateNew(false);
      onClose();
    } catch (error) {
      console.error('Error creating playlist:', error);
      Alert.alert('Kosa', 'Imeshindikana kutengeneza playlist');
    } finally {
      setCreating(false);
    }
  };

  const handleLike = () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      onClose();
      return;
    }
    if (onLike) onLike();
    onClose();
  };

  // Not logged in view
  if (!isAuthenticated) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.handle} />
            </View>
            <View style={styles.notLoggedInContainer}>
              <Ionicons name="lock-closed-outline" size={48} color={COLORS.primary} />
              <Text style={styles.notLoggedInTitle}>Ingia kwanza</Text>
              <Text style={styles.notLoggedInText}>
                Unahitaji kuingia ili kutengeneza playlist au kupakua nyimbo
              </Text>
              <TouchableOpacity 
                style={styles.loginPromptButton}
                onPress={() => {
                  onClose();
                  onLoginRequired?.();
                }}
              >
                <Text style={styles.loginPromptButtonText}>Ingia Sasa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.container} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <Text style={styles.title}>Ongeza kwenye playlist</Text>
          </View>

          {/* Song Info */}
          {song && (
            <View style={styles.songInfo}>
              <Image
                source={{ uri: getImageUrl(song.thumbnail || song.thumbnail_url) || 'https://via.placeholder.com/48' }}
                style={styles.songImage}
              />
              <View style={styles.songDetails}>
                <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
                <Text style={styles.songArtist} numberOfLines={1}>{song.artist_name}</Text>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {/* Like Button */}
            <TouchableOpacity style={styles.actionItem} onPress={handleLike}>
              <View style={styles.actionIcon}>
                <Ionicons name="heart-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.actionText}>Penda</Text>
            </TouchableOpacity>

            {/* Create Playlist */}
            <TouchableOpacity style={styles.actionItem} onPress={() => setShowCreateNew(true)}>
              <View style={styles.actionIcon}>
                <Ionicons name="add" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.actionText}>Tengeneza playlist</Text>
            </TouchableOpacity>
          </View>

          {/* Create New Playlist Form */}
          {showCreateNew && (
            <View style={styles.createForm}>
              <TextInput
                style={styles.input}
                placeholder="Jina la playlist"
                placeholderTextColor={COLORS.textMuted}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                autoFocus
              />
              <View style={styles.createButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCreateNew(false)}>
                  <Text style={styles.cancelButtonText}>Ghairi</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.createButton} onPress={handleCreatePlaylist} disabled={creating}>
                  {creating ? (
                    <ActivityIndicator size="small" color={COLORS.background} />
                  ) : (
                    <Text style={styles.createButtonText}>Tengeneza</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Playlists List */}
          <Text style={styles.sectionTitle}>Playlist zako</Text>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
          ) : playlists.length > 0 ? (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.playlist_id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.playlistItem} onPress={() => handleAddToPlaylist(item)}>
                  <Image
                    source={{ uri: item.thumbnail || 'https://via.placeholder.com/48' }}
                    style={styles.playlistImage}
                  />
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName}>{item.name}</Text>
                    <Text style={styles.playlistCount}>{item.song_count || 0} nyimbo</Text>
                  </View>
                </TouchableOpacity>
              )}
              style={styles.playlistsList}
            />
          ) : (
            <Text style={styles.emptyText}>Hakuna playlist. Tengeneza moja hapo juu!</Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '80%',
    paddingBottom: SPACING.xxl,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMuted,
    borderRadius: 2,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  songImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
  },
  songDetails: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  songTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  songArtist: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  actionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
    marginLeft: SPACING.sm,
  },
  createForm: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  createButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  createButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  loader: {
    paddingVertical: SPACING.lg,
  },
  playlistsList: {
    maxHeight: 250,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
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
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  // Login Modal Styles
  loginModal: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  loginTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  loginMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    width: '100%',
    alignItems: 'center',
  },
  loginButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
  },
  cancelLink: {
    marginTop: SPACING.md,
  },
  cancelLinkText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  // Not logged in container in modal
  notLoggedInContainer: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  notLoggedInTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  notLoggedInText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  loginPromptButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  loginPromptButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
  },
  // Actions container for song menu
  actionsContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingBottom: SPACING.xxl,
  },
  actionsHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  actionsList: {
    paddingHorizontal: SPACING.md,
  },
});

export default AddToPlaylistModal;
