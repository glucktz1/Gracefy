/**
 * LibraryScreen - User's music library
 * Features:
 * - Playlists management
 * - Liked songs
 * - Downloaded songs for offline listening
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { libraryAPI, getImageUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useBilling } from '../context/BillingContext';
import { useDownloads, DOWNLOAD_STATUS } from '../context/DownloadContext';
import { SongListItem, PlayAllHeader } from '../components/Cards';
import { SongActionsSheet } from '../components/SongActionsSheet';
import { showToast } from '../components/Toast';

const { width } = Dimensions.get('window');

const LibraryScreen = ({ navigation, route }) => {
  // State
  const [activeTab, setActiveTab] = useState(route?.params?.tab || 'playlists');
  const [playlists, setPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [likedSongIds, setLikedSongIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showActionsSheet, setShowActionsSheet] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  
  // Create playlist modal
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  // Context hooks
  const authContext = useAuth();
  const playerContext = usePlayer();
  const billingContext = useBilling();
  const downloadContext = useDownloads();
  
  // Safe extraction
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  const user = authContext?.user ?? null;
  const playTrack = playerContext?.playTrack ?? (() => {});
  const currentTrack = playerContext?.currentTrack ?? null;
  const isPlaying = playerContext?.isPlaying ?? false;
  
  // Download context
  const downloadedSongs = downloadContext?.getDownloadedSongs?.() ?? [];
  const downloadCount = downloadContext?.downloadCount ?? 0;
  const getTotalDownloadSize = downloadContext?.getTotalDownloadSize ?? (() => 0);
  const isDownloaded = downloadContext?.isDownloaded ?? (() => false);
  const getDownloadedFilePath = downloadContext?.getDownloadedFilePath ?? (() => null);
  const removeDownload = downloadContext?.removeDownload ?? (() => {});
  const clearAllDownloads = downloadContext?.clearAllDownloads ?? (() => {});

  // Update tab from route params
  useEffect(() => {
    if (route?.params?.tab) {
      setActiveTab(route.params.tab);
    }
  }, [route?.params?.tab]);

  // Load data on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadLibraryData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadLibraryData = async () => {
    console.log('[Library] Loading library data...');
    try {
      setLoading(true);
      
      // Load playlists
      try {
        const playlistsRes = await libraryAPI.getPlaylists();
        console.log('[Library] Playlists response:', playlistsRes?.data);
        setPlaylists(playlistsRes?.data?.playlists ?? []);
      } catch (err) {
        console.error('[Library] Failed to load playlists:', err.response?.data || err.message);
      }
      
      // Load liked songs
      try {
        const likesRes = await libraryAPI.getLikedSongs();
        console.log('[Library] Likes response:', likesRes?.data);
        const songs = likesRes?.data?.songs ?? [];
        setLikedSongs(songs);
        setLikedSongIds(new Set(songs.filter(s => s?.song_id).map(s => s.song_id)));
      } catch (err) {
        console.error('[Library] Failed to load likes:', err.response?.data || err.message);
      }
      
    } catch (error) {
      console.error('[Library] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLibraryData();
    setRefreshing(false);
  }, []);

  // Playlist creation
  const handleOpenCreatePlaylist = () => {
    if (!isAuthenticated) {
      showToast('Ingia kwanza ili kutengeneza playlist', 'warning');
      navigation.navigate('Auth');
      return;
    }
    setShowCreatePlaylistModal(true);
  };

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) {
      showToast('Tafadhali weka jina la playlist', 'warning');
      return;
    }

    try {
      setCreatingPlaylist(true);
      const response = await libraryAPI.createPlaylist({ name });
      console.log('[Library] Create playlist response:', response?.data);
      
      showToast(`Playlist "${name}" imetengenezwa`, 'success');
      setNewPlaylistName('');
      setShowCreatePlaylistModal(false);
      await loadLibraryData();
    } catch (error) {
      console.error('[Library] Create playlist error:', error.response?.data || error.message);
      showToast('Imeshindikana kutengeneza playlist', 'error');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // Song actions
  const handleSongOptions = (song) => {
    console.log('[Library] Song options for:', song?.title);
    setSelectedSong(song);
    setShowActionsSheet(true);
  };

  const handlePlaySong = (song, playlist = null) => {
    console.log('[Library] Playing song:', song?.title);
    const tracklist = playlist || likedSongs;
    const index = tracklist.findIndex(s => s?.song_id === song?.song_id);
    playTrack(song, tracklist, index);
  };

  const handleLikeSong = async () => {
    if (!selectedSong) return;
    
    const songId = selectedSong.song_id;
    const isLiked = likedSongIds.has(songId);
    
    try {
      if (isLiked) {
        await libraryAPI.unlikeSong(songId);
        setLikedSongIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(songId);
          return newSet;
        });
        setLikedSongs(prev => prev.filter(s => s.song_id !== songId));
        showToast('Imeondolewa kwenye pendwa', 'info');
      } else {
        await libraryAPI.likeSong(songId);
        setLikedSongIds(prev => new Set([...prev, songId]));
        showToast('Imeongezwa kwenye pendwa', 'success');
        await loadLibraryData();
      }
    } catch (error) {
      console.error('[Library] Like error:', error);
      showToast('Imeshindikana', 'error');
    }
  };

  const handleAddToPlaylist = () => {
    if (!selectedSong) return;
    setShowActionsSheet(false);
    setShowPlaylistPicker(true);
  };

  const handlePlayAll = (songs) => {
    if (songs.length > 0) {
      playTrack(songs[0], songs, 0);
    }
  };

  const handleDeletePlaylist = async (playlist) => {
    Alert.alert(
      'Futa Playlist',
      `Je, una uhakika unataka kufuta "${playlist.name}"?`,
      [
        { text: 'Hapana', style: 'cancel' },
        {
          text: 'Futa',
          style: 'destructive',
          onPress: async () => {
            try {
              await libraryAPI.deletePlaylist(playlist.playlist_id);
              showToast('Playlist imefutwa', 'success');
              await loadLibraryData();
            } catch (error) {
              console.error('[Library] Delete playlist error:', error);
              showToast('Imeshindikana kufuta', 'error');
            }
          }
        }
      ]
    );
  };

  // Not authenticated view
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Maktaba Yako</Text>
        </View>
        <View style={styles.loginPrompt}>
          <Ionicons name="library-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.loginTitle}>Karibu kwenye Maktaba</Text>
          <Text style={styles.loginMessage}>
            Ingia ili kuona playlists na nyimbo ulizopenda
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Auth')}
            data-testid="login-button"
          >
            <Text style={styles.loginButtonText}>Ingia</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Loading view
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Maktaba Yako</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Inapakia...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tabs = [
    { id: 'playlists', label: 'Playlist', icon: 'list' },
    { id: 'liked', label: 'Zilizopendwa', icon: 'heart' },
    { id: 'downloads', label: 'Downloads', icon: 'download' },
  ];

  // Playlists Tab Content
  const renderPlaylistsTab = () => (
    <View style={styles.tabContent}>
      {/* Quick Access Cards */}
      <View style={styles.quickAccessContainer}>
        {/* Liked Songs Card */}
        <TouchableOpacity 
          style={styles.quickAccessCard}
          onPress={() => setActiveTab('liked')}
          data-testid="quick-access-liked"
        >
          <View style={[styles.quickAccessIcon, { backgroundColor: COLORS.error + '30' }]}>
            <Ionicons name="heart" size={24} color={COLORS.error} />
          </View>
          <View style={styles.quickAccessInfo}>
            <Text style={styles.quickAccessTitle}>Nyimbo Pendwa</Text>
            <Text style={styles.quickAccessCount}>{likedSongs.length} nyimbo</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Downloads Card */}
        <TouchableOpacity 
          style={styles.quickAccessCard}
          onPress={() => setActiveTab('downloads')}
          data-testid="quick-access-downloads"
        >
          <View style={[styles.quickAccessIcon, { backgroundColor: COLORS.primary + '30' }]}>
            <Ionicons name="download" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.quickAccessInfo}>
            <Text style={styles.quickAccessTitle}>Downloads</Text>
            <Text style={styles.quickAccessCount}>{downloadCount} nyimbo • {formatFileSize(getTotalDownloadSize())}</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Playlists Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Playlist Zako</Text>
        <TouchableOpacity 
          onPress={handleOpenCreatePlaylist}
          data-testid="create-playlist-button"
        >
          <Ionicons name="add-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {playlists.length > 0 ? (
        playlists.map((playlist, index) => (
          <TouchableOpacity
            key={playlist?.playlist_id ?? `playlist-${index}`}
            style={styles.playlistItem}
            onPress={() => navigation.navigate('Playlist', { playlist })}
            onLongPress={() => handleDeletePlaylist(playlist)}
            data-testid={`playlist-item-${index}`}
          >
            <Image
              source={{ uri: getImageUrl(playlist?.thumbnail) || 'https://via.placeholder.com/56' }}
              style={styles.playlistImage}
            />
            <View style={styles.playlistInfo}>
              <Text style={styles.playlistTitle} numberOfLines={1}>
                {playlist?.name ?? 'Playlist'}
              </Text>
              <Text style={styles.playlistMeta}>
                {playlist?.song_count ?? 0} nyimbo
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Hakuna Playlist</Text>
          <Text style={styles.emptyMessage}>Tengeneza playlist ya kwanza</Text>
          <TouchableOpacity 
            style={styles.createFirstButton}
            onPress={handleOpenCreatePlaylist}
          >
            <Ionicons name="add" size={20} color={COLORS.text} />
            <Text style={styles.createFirstText}>Tengeneza Playlist</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // Liked Songs Tab Content
  const renderLikedTab = () => (
    <View style={styles.tabContent}>
      {likedSongs.length > 0 ? (
        <>
          <PlayAllHeader
            songCount={likedSongs.length}
            onPlayAll={() => handlePlayAll(likedSongs)}
            onShuffle={() => {
              const shuffled = [...likedSongs].sort(() => Math.random() - 0.5);
              handlePlayAll(shuffled);
            }}
          />
          {likedSongs.map((song, index) => (
            <SongListItem
              key={song?.song_id ?? `liked-${index}`}
              item={song}
              index={index}
              isPlaying={currentTrack?.song_id === song?.song_id && isPlaying}
              isLiked={true}
              onPress={() => handlePlaySong(song, likedSongs)}
              onMorePress={() => handleSongOptions(song)}
            />
          ))}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Hakuna Nyimbo Pendwa</Text>
          <Text style={styles.emptyMessage}>Penda nyimbo kuziona hapa</Text>
        </View>
      )}
    </View>
  );

  // Downloads Tab Content - Spotify-like offline songs section
  const renderDownloadsTab = () => {
    const handlePlayDownloadedSong = (song) => {
      // Play from local file path
      const localPath = getDownloadedFilePath(song.song_id);
      if (localPath) {
        // Create a copy of the song with local file path
        const offlineSong = {
          ...song,
          audio_url: localPath, // Use local file
          is_offline: true
        };
        playTrack(offlineSong, downloadedSongs.map(s => ({
          ...s,
          audio_url: getDownloadedFilePath(s.song_id) || s.audio_url,
          is_offline: true
        })));
      } else {
        // Fallback to original URL
        playTrack(song, downloadedSongs);
      }
    };

    const handleRemoveDownload = (song) => {
      Alert.alert(
        'Ondoa Download',
        `Ondoa "${song.title}" kutoka downloads?`,
        [
          { text: 'Hapana', style: 'cancel' },
          { 
            text: 'Ondoa', 
            style: 'destructive',
            onPress: () => {
              removeDownload(song.song_id);
              showToast('Imeondolewa', 'success');
            }
          }
        ]
      );
    };

    const handleClearAll = () => {
      if (downloadCount === 0) return;
      Alert.alert(
        'Futa Downloads Zote',
        `Ondoa nyimbo ${downloadCount} zote zilizopakuliwa?`,
        [
          { text: 'Hapana', style: 'cancel' },
          { 
            text: 'Futa Zote', 
            style: 'destructive',
            onPress: async () => {
              await clearAllDownloads();
              showToast('Downloads zote zimefutwa', 'success');
            }
          }
        ]
      );
    };

    return (
      <View style={styles.tabContent}>
        {downloadedSongs.length > 0 ? (
          <>
            {/* Header with storage info */}
            <View style={styles.downloadHeader}>
              <View style={styles.downloadHeaderInfo}>
                <Ionicons name="download" size={20} color={COLORS.primary} />
                <Text style={styles.downloadHeaderText}>
                  {downloadCount} nyimbo • {formatFileSize(getTotalDownloadSize())}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.clearAllButton}
                onPress={handleClearAll}
                data-testid="clear-all-downloads"
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                <Text style={styles.clearAllText}>Futa Zote</Text>
              </TouchableOpacity>
            </View>

            <PlayAllHeader
              songCount={downloadedSongs.length}
              onPlayAll={() => {
                if (downloadedSongs.length > 0) {
                  handlePlayDownloadedSong(downloadedSongs[0]);
                }
              }}
              onShuffle={() => {
                const shuffled = [...downloadedSongs].sort(() => Math.random() - 0.5);
                if (shuffled.length > 0) {
                  handlePlayDownloadedSong(shuffled[0]);
                }
              }}
            />

            {downloadedSongs.map((song, index) => (
              <View key={song?.song_id ?? `download-${index}`} style={styles.downloadedSongItem}>
                <SongListItem
                  song={song}
                  index={index}
                  isPlaying={currentTrack?.song_id === song?.song_id && isPlaying}
                  isDownloaded={true}
                  onPress={() => handlePlayDownloadedSong(song)}
                  onOptions={() => handleSongOptions(song)}
                />
                {/* Offline badge */}
                <View style={styles.offlineBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} />
                </View>
              </View>
            ))}

            {/* Info text */}
            <View style={styles.downloadInfoContainer}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.downloadInfoText}>
                Nyimbo hizi zinaweza kuchezwa bila mtandao
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="cloud-download-outline" size={64} color={COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Hakuna Downloads</Text>
            <Text style={styles.emptyMessage}>
              Pakua nyimbo ili kuzisikiliza bila mtandao
            </Text>
            <TouchableOpacity 
              style={styles.browseButton}
              onPress={() => navigation.navigate('Search')}
              data-testid="browse-songs-button"
            >
              <Ionicons name="search" size={20} color={COLORS.text} />
              <Text style={styles.browseButtonText}>Tafuta Nyimbo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Helper function for file size formatting
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Maktaba Yako</Text>
        <TouchableOpacity 
          onPress={handleOpenCreatePlaylist}
          style={styles.headerButton}
          data-testid="header-create-button"
        >
          <Ionicons name="add-circle-outline" size={28} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
            data-testid={`tab-${tab.id}`}
          >
            <Ionicons 
              name={tab.icon} 
              size={18} 
              color={activeTab === tab.id ? COLORS.text : COLORS.textMuted} 
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'playlists' && renderPlaylistsTab()}
        {activeTab === 'liked' && renderLikedTab()}
        {activeTab === 'downloads' && renderDownloadsTab()}
      </ScrollView>

      {/* Song Actions Sheet */}
      <SongActionsSheet
        visible={showActionsSheet}
        onClose={() => setShowActionsSheet(false)}
        song={selectedSong}
        isLiked={selectedSong ? likedSongIds.has(selectedSong.song_id) : false}
        onLike={handleLikeSong}
        onAddToPlaylist={handleAddToPlaylist}
        isAuthenticated={isAuthenticated}
        onLoginRequired={() => navigation.navigate('Auth')}
      />

      {/* Create Playlist Modal */}
      <Modal
        visible={showCreatePlaylistModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCreatePlaylistModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowCreatePlaylistModal(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tengeneza Playlist</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Jina la Playlist..."
              placeholderTextColor={COLORS.textMuted}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
              maxLength={50}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setNewPlaylistName('');
                  setShowCreatePlaylistModal(false);
                }}
              >
                <Text style={styles.modalCancelText}>Ghairi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalCreateButton, creatingPlaylist && styles.modalButtonDisabled]}
                onPress={handleCreatePlaylist}
                disabled={creatingPlaylist}
              >
                {creatingPlaylist ? (
                  <ActivityIndicator size="small" color={COLORS.text} />
                ) : (
                  <Text style={styles.modalCreateText}>Tengeneza</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerButton: {
    padding: SPACING.xs,
  },
  
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.text,
  },
  
  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 120,
  },
  tabContent: {
    paddingHorizontal: SPACING.md,
  },
  
  // Quick Access
  quickAccessContainer: {
    marginBottom: SPACING.lg,
  },
  quickAccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  quickAccessIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  quickAccessTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  quickAccessCount: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
  },
  
  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  
  // Playlist Item
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  playlistImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.background,
  },
  playlistInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  playlistTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginBottom: 4,
  },
  playlistMeta: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptyMessage: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  createFirstText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    marginTop: SPACING.md,
  },
  
  // Login Prompt
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  loginTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  loginMessage: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    borderRadius: BORDER_RADIUS.full,
  },
  loginButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: width - SPACING.xl * 2,
    maxWidth: 400,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    marginBottom: SPACING.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
  },
  modalCancelText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
  modalCreateButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalCreateText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },

  // Downloads Tab Styles
  downloadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  downloadHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  downloadHeaderText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.error + '15',
    borderRadius: BORDER_RADIUS.sm,
  },
  clearAllText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
  downloadedSongItem: {
    position: 'relative',
  },
  offlineBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.xl + 8,
  },
  downloadInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.lg,
    opacity: 0.7,
  },
  downloadInfoText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
  },
  emptyIconContainer: {
    marginBottom: SPACING.md,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.md,
  },
  browseButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});

export default LibraryScreen;
