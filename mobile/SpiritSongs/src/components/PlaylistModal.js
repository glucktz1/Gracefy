import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, Modal, TextInput, 
  StyleSheet, FlatList, ActivityIndicator, Alert, Keyboard, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { libraryService } from '../services/api';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

const PlaylistModal = ({ visible, onClose, song, onPlaylistCreated }) => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState(null);

  useEffect(() => {
    if (visible) {
      fetchPlaylists();
      setShowCreateInput(false);
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
      Alert.alert('Added!', `"${song.title}" added to playlist`);
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
      const result = await libraryService.createPlaylist(trimmedName);
      
      // If we have a song, add it to the new playlist
      if (song?.song_id && result?.playlist?.playlist_id) {
        try {
          await libraryService.addToPlaylist(result.playlist.playlist_id, song.song_id);
          Alert.alert('Success!', `Created "${trimmedName}" and added "${song.title}"`);
        } catch (addError) {
          Alert.alert('Playlist Created', `Created "${trimmedName}" but couldn't add the song.`);
        }
      } else {
        Alert.alert('Success!', `Created playlist "${trimmedName}"`);
      }
      
      setNewPlaylistName('');
      setShowCreateInput(false);
      
      if (onPlaylistCreated) {
        onPlaylistCreated(result.playlist);
      }
      
      fetchPlaylists();
      onClose();
    } catch (error) {
      console.error('Error creating playlist:', error);
      Alert.alert('Error', 'Could not create playlist. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Loading playlists...</Text>
        </View>
      );
    }

    // Show create input form
    if (showCreateInput) {
      return (
        <View style={styles.createSection}>
          <Text style={styles.createTitle}>Create New Playlist</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter playlist name"
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
              onPress={() => {
                setShowCreateInput(false);
                setNewPlaylistName('');
                Keyboard.dismiss();
              }}
              disabled={creating}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.confirmBtn, !newPlaylistName.trim() && styles.disabledBtn]}
              onPress={handleCreatePlaylist}
              disabled={!newPlaylistName.trim() || creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.confirmBtnText}>Create & Add</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // No playlists - show create option prominently
    if (playlists.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <LinearGradient colors={['#e91e63', '#9c27b0']} style={styles.emptyIcon}>
              <Ionicons name="musical-notes" size={40} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={styles.emptyTitle}>No Playlists Yet</Text>
          <Text style={styles.emptySubtitle}>Create your first playlist to organize your music</Text>
          <TouchableOpacity 
            style={styles.createFirstBtn}
            onPress={() => setShowCreateInput(true)}
          >
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.createFirstBtnText}>Create Playlist</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Has playlists - show list with create option at top
    return (
      <View style={styles.playlistsContainer}>
        {/* Create New Playlist Option - Always at top */}
        <TouchableOpacity 
          style={styles.createNewOption}
          onPress={() => setShowCreateInput(true)}
        >
          <View style={styles.createNewIcon}>
            <Ionicons name="add" size={28} color="#fff" />
          </View>
          <View style={styles.createNewInfo}>
            <Text style={styles.createNewText}>Create New Playlist</Text>
            <Text style={styles.createNewSubtext}>Add "{song?.title}" to a new playlist</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />
        
        <Text style={styles.sectionTitle}>Your Playlists</Text>

        {/* Existing Playlists */}
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
                <LinearGradient 
                  colors={['#282828', '#181818']} 
                  style={styles.playlistIconGradient}
                >
                  <Ionicons name="musical-notes" size={20} color={COLORS.textMuted} />
                </LinearGradient>
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
                <View style={styles.addIconContainer}>
                  <Ionicons name="add-circle" size={28} color="#e91e63" />
                </View>
              )}
            </TouchableOpacity>
          )}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayTouch} onPress={onClose} activeOpacity={1} />
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerHandle} />
            <View style={styles.headerContent}>
              <Text style={styles.title}>Add to Playlist</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            
            {/* Song Info */}
            {song && (
              <View style={styles.songInfo}>
                <Ionicons name="musical-note" size={18} color="#e91e63" />
                <Text style={styles.songTitle} numberOfLines={1}>{song.title}</Text>
              </View>
            )}
          </View>

          {/* Content */}
          {renderContent()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    minHeight: 300,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  songTitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e91e63',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
  },
  createFirstBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  // Playlists container
  playlistsContainer: {
    flex: 1,
    paddingBottom: 32,
  },
  createNewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: 'rgba(233, 30, 99, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(233, 30, 99, 0.3)',
  },
  createNewIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#e91e63',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createNewInfo: {
    flex: 1,
    marginLeft: 14,
  },
  createNewText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  createNewSubtext: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    marginVertical: 16,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  list: {
    flex: 1,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  playlistIcon: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
  },
  playlistIconGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: 14,
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
  addIconContainer: {
    padding: 4,
  },
  // Create section
  createSection: {
    padding: 20,
  },
  createTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#282828',
    color: COLORS.textPrimary,
    fontSize: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  createButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  confirmBtn: {
    backgroundColor: '#e91e63',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
    minWidth: 120,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  // Loader
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
