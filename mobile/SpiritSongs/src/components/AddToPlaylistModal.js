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
  PermissionsAndroid,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Use legacy API for backward compatibility with SDK 54
import * as FileSystem from 'expo-file-system/legacy';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { libraryAPI, contentAPI, getImageUrl, getAudioUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from './Toast';

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
  const [downloading, setDownloading] = useState(false);

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

  const requestStoragePermission = async () => {
    // For Android 10+ (API 29+), we don't need WRITE_EXTERNAL_STORAGE
    if (Platform.OS === 'android' && Platform.Version < 29) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Ruhusa ya Kuhifadhi',
            message: 'Gracefy inahitaji ruhusa ya kuhifadhi nyimbo kwenye simu yako.',
            buttonNeutral: 'Uliza Baadaye',
            buttonNegative: 'Kataa',
            buttonPositive: 'Kubali',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const handleDownload = async () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    if (billingEnabled && !isPremium) {
      onSubscriptionRequired?.();
      return;
    }

    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Ruhusa Inahitajika', 'Tafadhali ruhusu Gracefy kuhifadhi faili kwenye simu yako katika Settings.');
      return;
    }

    try {
      setDownloading(true);
      
      let fileUrl = null;
      let fileName = `${song.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;

      // Try to get download URL from API first
      if (song?.song_id) {
        try {
          const response = await contentAPI.getSongDownloadUrl(song.song_id);
          if (response.data?.download_url) {
            fileUrl = getAudioUrl(response.data.download_url);
            if (response.data.filename) {
              fileName = response.data.filename.replace(/[^a-zA-Z0-9.]/g, '_');
            }
          }
        } catch (e) {
          console.log('Could not get download URL from API');
        }
      }

      // Fallback to song's audio_url
      if (!fileUrl) {
        fileUrl = song?.audio_url || song?.file_url;
        if (!fileUrl) {
          Alert.alert('Kosa', 'Wimbo huu hauwezi kupakuliwa');
          setDownloading(false);
          return;
        }
        fileUrl = getAudioUrl(fileUrl);
      }

      console.log('Downloading from:', fileUrl);

      // Use app's document directory
      const downloadDir = `${FileSystem.documentDirectory}downloads/`;
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      }

      const downloadPath = `${downloadDir}${fileName}`;

      const result = await FileSystem.downloadAsync(fileUrl, downloadPath, {
        headers: { 'Accept': 'audio/mpeg, audio/*, */*' }
      });
      
      if (result?.uri) {
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        if (fileInfo.exists && fileInfo.size > 1000) {
          Alert.alert('Imefanikiwa! ✓', `"${song.title}" imehifadhiwa`);
        } else {
          throw new Error('Downloaded file is empty or too small');
        }
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Kosa', `Imeshindikana kupakua wimbo: ${error.message || 'Jaribu tena'}`);
    } finally {
      setDownloading(false);
      onClose();
    }
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

            <TouchableOpacity style={styles.actionItem} onPress={handleDownload} disabled={downloading}>
              {downloading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="download-outline" size={24} color={COLORS.text} />
              )}
              <Text style={styles.actionText}>{downloading ? 'Inapakua...' : 'Pakua'}</Text>
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

// Main Add to Playlist Modal - UPDATED: Playlists at top, Like & Create at bottom
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
  onDownload,
}) => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState(false);

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
      // Handle both response formats
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
      // Reload playlists to show the new one
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

  const requestStoragePermission = async () => {
    // For Android 10+ (API 29+), we don't need WRITE_EXTERNAL_STORAGE
    if (Platform.OS === 'android' && Platform.Version < 29) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Ruhusa ya Kuhifadhi',
            message: 'Gracefy inahitaji ruhusa ya kuhifadhi nyimbo kwenye simu yako.',
            buttonNeutral: 'Uliza Baadaye',
            buttonNegative: 'Kataa',
            buttonPositive: 'Kubali',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  const handleDownload = async () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }
    if (billingEnabled && !isPremium) {
      onSubscriptionRequired?.();
      return;
    }

    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Ruhusa Inahitajika', 'Tafadhali ruhusu Gracefy kuhifadhi faili kwenye simu yako katika Settings.');
      return;
    }

    if (onDownload) {
      onDownload(song);
      onClose();
      return;
    }

    try {
      setDownloading(true);
      
      let fileUrl = null;
      let fileName = `${song.title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`;

      // Try to get download URL from API first
      if (song?.song_id) {
        try {
          const response = await contentAPI.getSongDownloadUrl(song.song_id);
          if (response.data?.download_url) {
            fileUrl = getAudioUrl(response.data.download_url);
            if (response.data.filename) {
              fileName = response.data.filename;
            }
          }
        } catch (e) {
          console.log('Could not get download URL from API');
        }
      }

      // Fallback to song's audio_url
      if (!fileUrl) {
        fileUrl = song?.audio_url || song?.file_url;
        if (!fileUrl) {
          Alert.alert('Kosa', 'Wimbo huu hauwezi kupakuliwa');
          setDownloading(false);
          return;
        }
        fileUrl = getAudioUrl(fileUrl);
      }

      console.log('Downloading from:', fileUrl);

      const downloadPath = `${FileSystem.documentDirectory}downloads/${fileName}`;
      await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}downloads/`, { intermediates: true });

      const result = await FileSystem.downloadAsync(fileUrl, downloadPath, {
        headers: { 'Accept': 'audio/mpeg, audio/*, */*' }
      });
      
      if (result?.uri) {
        const fileInfo = await FileSystem.getInfoAsync(result.uri);
        if (fileInfo.exists && fileInfo.size > 1000) {
          Alert.alert('Imefanikiwa! ✓', `"${song.title}" imehifadhiwa`);
        } else {
          throw new Error('Downloaded file is empty or too small');
        }
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Kosa', `Imeshindikana kupakua wimbo: ${error.message || 'Jaribu tena'}`);
    } finally {
      setDownloading(false);
      onClose();
    }
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
            <Text style={styles.title}>Ongeza kwenye...</Text>
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

          {/* EXISTING PLAYLISTS AT TOP */}
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
                  <Ionicons name="add" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
              style={styles.playlistsList}
              scrollEnabled={playlists.length > 4}
            />
          ) : (
            <Text style={styles.emptyText}>Hakuna playlist bado</Text>
          )}

          {/* DIVIDER */}
          <View style={styles.divider} />

          {/* LIKE AND CREATE AT BOTTOM */}
          <View style={styles.bottomActions}>
            {/* Like Button */}
            <TouchableOpacity style={styles.bottomActionItem} onPress={handleLike}>
              <View style={[styles.bottomActionIcon, { backgroundColor: '#E91429' }]}>
                <Ionicons name="heart" size={20} color={COLORS.text} />
              </View>
              <Text style={styles.bottomActionText}>Penda Wimbo</Text>
            </TouchableOpacity>

            {/* Download Button */}
            <TouchableOpacity style={styles.bottomActionItem} onPress={handleDownload} disabled={downloading}>
              <View style={[styles.bottomActionIcon, { backgroundColor: COLORS.primary }]}>
                {downloading ? (
                  <ActivityIndicator size="small" color={COLORS.text} />
                ) : (
                  <Ionicons name="download" size={20} color={COLORS.text} />
                )}
              </View>
              <Text style={styles.bottomActionText}>{downloading ? 'Inapakua...' : 'Pakua'}</Text>
            </TouchableOpacity>

            {/* Create Playlist */}
            <TouchableOpacity style={styles.bottomActionItem} onPress={() => setShowCreateNew(true)}>
              <View style={[styles.bottomActionIcon, { backgroundColor: COLORS.card }]}>
                <Ionicons name="add" size={20} color={COLORS.text} />
              </View>
              <Text style={styles.bottomActionText}>Tengeneza Playlist</Text>
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
    maxHeight: '85%',
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
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  loader: {
    paddingVertical: SPACING.lg,
  },
  playlistsList: {
    maxHeight: 200,
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
    paddingVertical: SPACING.md,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
    marginHorizontal: SPACING.md,
  },
  bottomActions: {
    paddingHorizontal: SPACING.md,
  },
  bottomActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  bottomActionIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  bottomActionText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  createForm: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.md,
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
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  actionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
    marginLeft: SPACING.md,
  },
});

export default AddToPlaylistModal;
