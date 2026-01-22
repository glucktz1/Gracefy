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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { libraryAPI, getImageUrl } from '../services/api';

const AddToPlaylistModal = ({ visible, onClose, song, onLike }) => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPlaylists();
    }
  }, [visible]);

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
    try {
      await libraryAPI.addToPlaylist(playlist.playlist_id, song.song_id);
      Alert.alert('Added', `"${song.title}" added to "${playlist.name}"`);
      onClose();
    } catch (error) {
      console.error('Error adding to playlist:', error);
      Alert.alert('Error', 'Failed to add song to playlist');
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }

    try {
      setCreating(true);
      const response = await libraryAPI.createPlaylist({ name: newPlaylistName });
      if (response.data?.playlist_id) {
        await libraryAPI.addToPlaylist(response.data.playlist_id, song.song_id);
        Alert.alert('Success', `Created playlist "${newPlaylistName}" and added song`);
      }
      setNewPlaylistName('');
      setShowCreateNew(false);
      onClose();
    } catch (error) {
      console.error('Error creating playlist:', error);
      Alert.alert('Error', 'Failed to create playlist');
    } finally {
      setCreating(false);
    }
  };

  const handleLike = () => {
    if (onLike) onLike();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <TouchableOpacity 
          style={styles.container} 
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handle} />
            <Text style={styles.title}>Add to playlist</Text>
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
              <Text style={styles.actionText}>Like</Text>
            </TouchableOpacity>

            {/* Create Playlist */}
            <TouchableOpacity 
              style={styles.actionItem} 
              onPress={() => setShowCreateNew(true)}
            >
              <View style={styles.actionIcon}>
                <Ionicons name="add" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.actionText}>Create playlist</Text>
            </TouchableOpacity>
          </View>

          {/* Create New Playlist Form */}
          {showCreateNew && (
            <View style={styles.createForm}>
              <TextInput
                style={styles.input}
                placeholder="Playlist name"
                placeholderTextColor={COLORS.textMuted}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                autoFocus
              />
              <View style={styles.createButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setShowCreateNew(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.createButton}
                  onPress={handleCreatePlaylist}
                  disabled={creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color={COLORS.background} />
                  ) : (
                    <Text style={styles.createButtonText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Playlists List */}
          <Text style={styles.sectionTitle}>Your playlists</Text>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
          ) : playlists.length > 0 ? (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.playlist_id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.playlistItem}
                  onPress={() => handleAddToPlaylist(item)}
                >
                  <Image
                    source={{ uri: item.thumbnail || 'https://via.placeholder.com/48' }}
                    style={styles.playlistImage}
                  />
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName}>{item.name}</Text>
                    <Text style={styles.playlistCount}>{item.song_count || 0} songs</Text>
                  </View>
                </TouchableOpacity>
              )}
              style={styles.playlistsList}
            />
          ) : (
            <Text style={styles.emptyText}>No playlists yet. Create one above!</Text>
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
    paddingBottom: SPACING.xl,
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
    width: 48,
    height: 48,
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
    marginRight: SPACING.lg,
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
});

export default AddToPlaylistModal;
