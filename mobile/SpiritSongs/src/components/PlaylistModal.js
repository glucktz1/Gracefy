import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, Modal, TextInput, 
  StyleSheet, FlatList, ActivityIndicator, Alert, Keyboard, Dimensions,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { libraryService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../config';

const { width, height } = Dimensions.get('window');

/**
 * Unified Song Action Modal
 * Shows when user taps "+" button on a song
 * Options: Like, Add to existing playlist, Create new playlist
 */
const PlaylistModal = ({ visible, onClose, song, onPlaylistCreated, onLike, isLiked = false }) => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [error, setError] = useState(null);
  const [likeLoading, setLikeLoading] = useState(false);
  const { isAuthenticated, token } = useAuth();

  useEffect(() => {
    if (visible) {
      setError(null);
      if (isAuthenticated) {
        fetchPlaylists();
      } else {
        setPlaylists([]);
        setLoading(false);
      }
      setShowCreateInput(false);
      setNewPlaylistName('');
    }
  }, [visible, isAuthenticated]);

  const fetchPlaylists = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching playlists... isAuthenticated:', isAuthenticated);
      
      const data = await libraryService.getLibrary();
      console.log('Library data received');
      
      const fetchedPlaylists = data.playlists || [];
      console.log('Playlists found:', fetchedPlaylists.length);
      
      setPlaylists(fetchedPlaylists);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      setError('Could not load playlists');
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLikeSong = async () => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please log in to like songs');
      return;
    }
    
    setLikeLoading(true);
    try {
      if (onLike) {
        await onLike();
      }
      // Close modal after liking
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      console.error('Error liking song:', error);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlistId) => {
    if (!song?.song_id) {
      Alert.alert('Error', 'No song selected');
      return;
    }

    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please log in to add songs to playlists');
      onClose();
      return;
    }
    
    setAddingTo(playlistId);
    try {
      console.log('Adding song to playlist:', playlistId, song.song_id);
      await libraryService.addToPlaylist(playlistId, song.song_id);
      Alert.alert('Added!', `"${song.title}" added to playlist`);
      onClose();
    } catch (error) {
      console.error('Error adding to playlist:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Could not add song to playlist');
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

    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please log in to create playlists');
      onClose();
      return;
    }
    
    Keyboard.dismiss();
    setCreating(true);
    
    try {
      console.log('Creating playlist:', trimmedName);
      const result = await libraryService.createPlaylist(trimmedName);
      console.log('Create playlist result:', result);
      
      if (!result || !result.playlist) {
        throw new Error('Invalid response from server');
      }
      
      // If we have a song, add it to the new playlist
      if (song?.song_id && result.playlist.playlist_id) {
        try {
          console.log('Adding song to new playlist:', result.playlist.playlist_id);
          await libraryService.addToPlaylist(result.playlist.playlist_id, song.song_id);
          Alert.alert('Success!', `Created "${trimmedName}" and added "${song.title}"`);
        } catch (addError) {
          console.error('Error adding song:', addError);
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
      
      onClose();
    } catch (error) {
      console.error('Error creating playlist:', error);
      const errorMsg = error.response?.data?.detail || error.message || 'Could not create playlist';
      Alert.alert('Error', errorMsg);
    } finally {
      setCreating(false);
    }
  };

  const renderNotLoggedIn = () => (
    <View style={styles.notLoggedIn}>
      <Ionicons name="lock-closed-outline" size={48} color={COLORS.textMuted} />
      <Text style={styles.notLoggedInTitle}>Login Required</Text>
      <Text style={styles.notLoggedInText}>Please log in to like songs and manage playlists</Text>
      <TouchableOpacity style={styles.loginBtn} onPress={onClose}>
        <Text style={styles.loginBtnText}>Close</Text>
      </TouchableOpacity>
    </View>
  );

  // Create playlist input form
  const renderCreateForm = () => (
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
          <Text style={styles.cancelBtnText}>Back</Text>
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

  const renderContent = () => {
    if (!isAuthenticated) {
      return renderNotLoggedIn();
    }

    // Show create input form
    if (showCreateInput) {
      return renderCreateForm();
    }

    return (
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick Actions Section */}
        <View style={styles.quickActionsSection}>
          {/* Like Button - Primary Action */}
          <TouchableOpacity 
            style={[styles.quickActionBtn, isLiked && styles.quickActionBtnActive]}
            onPress={handleLikeSong}
            disabled={likeLoading}
          >
            <View style={[styles.quickActionIcon, isLiked && styles.quickActionIconActive]}>
              {likeLoading ? (
                <ActivityIndicator size="small" color={isLiked ? '#fff' : '#e91e63'} />
              ) : (
                <Ionicons 
                  name={isLiked ? 'heart' : 'heart-outline'} 
                  size={24} 
                  color={isLiked ? '#fff' : '#e91e63'} 
                />
              )}
            </View>
            <Text style={[styles.quickActionText, isLiked && styles.quickActionTextActive]}>
              {isLiked ? 'Liked' : 'Like Song'}
            </Text>
          </TouchableOpacity>

          {/* Create New Playlist - Right Side */}
          <TouchableOpacity 
            style={styles.quickActionBtn}
            onPress={() => setShowCreateInput(true)}
          >
            <View style={[styles.quickActionIcon, styles.createIcon]}>
              <Ionicons name="add" size={26} color="#fff" />
            </View>
            <Text style={styles.quickActionText}>New Playlist</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Playlists Section */}
        <View style={styles.playlistsSection}>
          <Text style={styles.sectionTitle}>
            {loading ? 'Loading...' : `Add to Playlist${playlists.length > 0 ? ` (${playlists.length})` : ''}`}
          </Text>

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="small" color="#e91e63" />
            </View>
          ) : playlists.length === 0 ? (
            <View style={styles.noPlaylistsMsg}>
              <Ionicons name="albums-outline" size={32} color={COLORS.textMuted} />
              <Text style={styles.noPlaylistsText}>No playlists yet</Text>
              <Text style={styles.noPlaylistsHint}>Tap "New Playlist" to create one</Text>
            </View>
          ) : (
            playlists.map((item) => (
              <TouchableOpacity 
                key={item.playlist_id}
                style={styles.playlistItem}
                onPress={() => handleAddToPlaylist(item.playlist_id)}
                disabled={addingTo === item.playlist_id}
              >
                <View style={styles.playlistIcon}>
                  <LinearGradient 
                    colors={['#282828', '#181818']} 
                    style={styles.playlistIconGradient}
                  >
                    <Ionicons name="musical-notes" size={18} color={COLORS.textMuted} />
                  </LinearGradient>
                </View>
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.playlistCount}>
                    {item.songs?.length || 0} songs
                  </Text>
                </View>
                {addingTo === item.playlist_id ? (
                  <ActivityIndicator size="small" color="#e91e63" />
                ) : (
                  <View style={styles.addIconContainer}>
                    <Ionicons name="add-circle" size={26} color="#e91e63" />
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
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
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  overlayTouch: {
    flex: 1,
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    minHeight: 280,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerHandle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 8,
  },
  songTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  // Quick Actions - Like & Create Playlist side by side
  quickActionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  quickActionBtn: {
    alignItems: 'center',
    width: (width - 64) / 2,
  },
  quickActionBtnActive: {},
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(233, 30, 99, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(233, 30, 99, 0.3)',
  },
  quickActionIconActive: {
    backgroundColor: '#e91e63',
    borderColor: '#e91e63',
  },
  createIcon: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  quickActionText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  quickActionTextActive: {
    color: '#e91e63',
    fontWeight: '600',
  },
  // Not logged in
  notLoggedIn: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  notLoggedInTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  notLoggedInText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  loginBtn: {
    backgroundColor: '#e91e63',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  loginBtnText: {
    color: '#000',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
  },
  // Playlists section
  playlistsSection: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  noPlaylistsMsg: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noPlaylistsText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 10,
  },
  noPlaylistsHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  playlistIcon: {
    width: 44,
    height: 44,
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
    marginLeft: 12,
  },
  playlistName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  playlistCount: {
    color: COLORS.textSecondary,
    fontSize: 12,
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
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    minWidth: 110,
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
    paddingVertical: 24,
  },
  loaderText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
});

export default PlaylistModal;
