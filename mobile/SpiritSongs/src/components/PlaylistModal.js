import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, Modal, TextInput, 
  StyleSheet, FlatList, ActivityIndicator, Alert, Keyboard
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
  const [addingTo, setAddingTo] = useState(null);

  useEffect(() => {
    if (visible) {
      fetchPlaylists();
      setShowCreate(false);
      setNewPlaylistName('');
    }
  }, [visible]);

  const fetchPlaylists = async () => {
    setLoading(true);
    try {
      const data = await libraryService.getLibrary();
      setPlaylists(data.playlists || []);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      // Show empty state instead of error
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlistId) => {
    if (!song?.song_id) {
      Alert.alert('Error', 'No song selected');
      return;
    }
    
    setAddingTo(playlistId);
    try {
      await libraryService.addToPlaylist(playlistId, song.song_id);
      Alert.alert('Success', `Added "${song.title}" to playlist`);
      onClose();
    } catch (error) {
      console.error('Error adding to playlist:', error);
      Alert.alert('Error', 'Could not add song to playlist. Please try again.');
    } finally {
      setAddingTo(null);
    }
  };

  const handleCreatePlaylist = async () => {
    const trimmedName = newPlaylistName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }
    
    Keyboard.dismiss();
    setCreating(true);
    
    try {
      console.log('Creating playlist:', trimmedName);
      const result = await libraryService.createPlaylist(trimmedName);
      console.log('Playlist created:', result);
      
      // If we have a song, add it to the new playlist
      if (song?.song_id && result?.playlist?.playlist_id) {
        try {
          await libraryService.addToPlaylist(result.playlist.playlist_id, song.song_id);
          Alert.alert('Success', `Created playlist "${trimmedName}" and added "${song.title}"`);
        } catch (addError) {
          console.error('Error adding song to new playlist:', addError);
          Alert.alert('Playlist Created', `Created "${trimmedName}" but couldn't add the song.`);
        }
      } else {
        Alert.alert('Success', `Created playlist "${trimmedName}"`);
      }
      
      setNewPlaylistName('');
      setShowCreate(false);
      
      if (onPlaylistCreated) {
        onPlaylistCreated(result.playlist);
      }
      
      // Refresh playlists
      fetchPlaylists();
      
      onClose();
    } catch (error) {
      console.error('Error creating playlist:', error);
      Alert.alert('Error', 'Could not create playlist. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleCancelCreate = () => {
    setShowCreate(false);
    setNewPlaylistName('');
    Keyboard.dismiss();
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
            <Text style={styles.title}>
              {song ? 'Add to Playlist' : 'Your Playlists'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Song Info */}
          {song && (
            <View style={styles.songInfo}>
              <Ionicons name="musical-note" size={20} color={COLORS.textSecondary} />
              <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
            </View>
          )}

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
                maxLength={50}
                returnKeyType="done"
                onSubmitEditing={handleCreatePlaylist}
              />
              <View style={styles.createButtons}>
                <TouchableOpacity 
                  style={styles.cancelBtn}
                  onPress={handleCancelCreate}
                  disabled={creating}
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
              <Text style={styles.newPlaylistText}>Create New Playlist</Text>
            </TouchableOpacity>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Existing Playlists */}
          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loaderText}>Loading playlists...</Text>
            </View>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.playlist_id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.playlistItem}
                  onPress={() => handleAddToPlaylist(item.playlist_id)}
                  disabled={addingTo === item.playlist_id}
                >
                  <View style={styles.playlistIcon}>
                    <Ionicons name="musical-notes" size={24} color={COLORS.textSecondary} />
                  </View>
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName}>{item.name}</Text>
                    <Text style={styles.playlistCount}>
                      {item.songs?.length || item.song_count || 0} songs
                    </Text>
                  </View>
                  {addingTo === item.playlist_id ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="library-outline" size={48} color={COLORS.textMuted} />
                  <Text style={styles.emptyText}>No playlists yet</Text>
                  <Text style={styles.emptyHint}>Create your first playlist above</Text>
                </View>
              }
              style={styles.list}
              contentContainerStyle={playlists.length === 0 && styles.emptyListContent}
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
    backgroundColor: COLORS.backgroundLight || '#181818',
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
    borderBottomColor: COLORS.divider || '#333',
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 4,
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  songTitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  newPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  newPlaylistIcon: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: COLORS.backgroundCard || '#282828',
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
  },
  input: {
    backgroundColor: COLORS.backgroundCard || '#282828',
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
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  createBtn: {
    backgroundColor: COLORS.primary || '#1DB954',
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
  divider: {
    height: 1,
    backgroundColor: COLORS.divider || '#333',
    marginHorizontal: 16,
  },
  list: {
    flex: 1,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
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
    backgroundColor: COLORS.backgroundCard || '#282828',
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyHint: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  loaderContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  loaderText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
});

export default PlaylistModal;
