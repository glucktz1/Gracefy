import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, Modal, TextInput, 
  StyleSheet, FlatList, ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { libraryService } from '../services/api';
import { COLORS } from '../config';

const PlaylistModal = ({ visible, onClose, song, onPlaylistCreated }) => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchPlaylists();
    }
  }, [visible]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const data = await libraryService.getLibrary();
      setPlaylists(data.playlists || []);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlistId) => {
    try {
      await libraryService.addToPlaylist(playlistId, song.song_id);
      onClose();
    } catch (error) {
      console.error('Error adding to playlist:', error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    setCreating(true);
    try {
      const result = await libraryService.createPlaylist(newPlaylistName.trim());
      await libraryService.addToPlaylist(result.playlist_id, song.song_id);
      setNewPlaylistName('');
      setShowCreate(false);
      if (onPlaylistCreated) {
        onPlaylistCreated(result);
      }
      onClose();
    } catch (error) {
      console.error('Error creating playlist:', error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Add to Playlist</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Create New Playlist */}
          {showCreate ? (
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
                  style={styles.cancelBtn}
                  onPress={() => setShowCreate(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.createBtn, !newPlaylistName.trim() && styles.disabledBtn]}
                  onPress={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim() || creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.createBtnText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.newPlaylistBtn}
              onPress={() => setShowCreate(true)}
            >
              <View style={styles.newPlaylistIcon}>
                <Ionicons name="add" size={24} color={COLORS.textPrimary} />
              </View>
              <Text style={styles.newPlaylistText}>New Playlist</Text>
            </TouchableOpacity>
          )}

          {/* Existing Playlists */}
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.playlist_id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.playlistItem}
                  onPress={() => handleAddToPlaylist(item.playlist_id)}
                >
                  <View style={styles.playlistIcon}>
                    <Ionicons name="musical-notes" size={24} color={COLORS.textSecondary} />
                  </View>
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName}>{item.name}</Text>
                    <Text style={styles.playlistCount}>
                      {item.song_count || 0} songs
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No playlists yet</Text>
              }
              style={styles.list}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.backgroundLight,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  newPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  newPlaylistIcon: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: COLORS.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newPlaylistText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  createForm: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  input: {
    backgroundColor: COLORS.backgroundCard,
    color: COLORS.textPrimary,
    fontSize: 16,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  createButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    padding: 12,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  createBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  createBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  playlistIcon: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: COLORS.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playlistName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  playlistCount: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    padding: 32,
  },
  loader: {
    padding: 32,
  },
});

export default PlaylistModal;
