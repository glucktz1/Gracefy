/**
 * LibraryScreen - Spotify-like user library
 * Features:
 * - Playlists management
 * - Liked songs with instant toggling
 * - Downloaded songs with offline playback
 * - Smooth animations and transitions
 * - Create playlist modal
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
import { SongActionsSheet, PlaylistPickerSheet } from '../components/SongActionsSheet';
import { showToast } from '../components/Toast';

const { width } = Dimensions.get('window');

const LibraryScreen = ({ navigation, route }) => {
  // State
  const [activeTab, setActiveTab] = useState(route?.params?.tab || 'playlists');
  const [playlists, setPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
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

  // Context hooks - called unconditionally
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
  const billingEnabled = billingContext?.billingEnabled ?? false;
  const isPremium = billingContext?.isPremium ?? false;
  const downloads = downloadContext?.downloads ?? [];
  const activeDownloads = downloadContext?.activeDownloads ?? {};
  const downloadQueue = downloadContext?.downloadQueue ?? [];
  const formatSize = downloadContext?.formatSize ?? (() => '0 B');
  const getTotalSize = downloadContext?.getTotalSize ?? (() => 0);
  const refreshDownloads = downloadContext?.refreshDownloads ?? (async () => {});

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
    try {
      setLoading(true);
      const [playlistsRes, likesRes] = await Promise.all([
        libraryAPI.getPlaylists().catch(() => ({ data: { playlists: [] } })),
        libraryAPI.getLikedSongs().catch(() => ({ data: { songs: [] } })),
      ]);
      
      setPlaylists(playlistsRes?.data?.playlists ?? []);
      setLikedSongs(likesRes?.data?.songs ?? []);
    } catch (error) {
      console.error('Error loading library:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadLibraryData(),
      refreshDownloads(),
    ]);
    setRefreshing(false);
  }, [refreshDownloads]);

  // Playback handlers
  const handlePlaySong = useCallback((song, songList) => {
    if (!song) return;
    try {
      playTrack(song, songList);
    } catch (error) {
      console.error('Error playing song:', error);
      showToast('Imeshindwa kucheza', 'error');
    }
  }, [playTrack]);

  const handlePlayAll = useCallback((songs) => {
    if (!songs?.length) return;
    handlePlaySong(songs[0], songs);
  }, [handlePlaySong]);

  const handleShuffle = useCallback((songs) => {
    if (!songs?.length) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    handlePlaySong(shuffled[0], shuffled);
  }, [handlePlaySong]);

  // Song actions
  const handleSongMore = useCallback((song) => {
    setSelectedSong(song);
    setShowActionsSheet(true);
  }, []);

  const handleLikeSong = useCallback(async (song) => {
    if (!song?.song_id) return;
    
    try {
      const isLiked = likedSongs.some(s => s?.song_id === song.song_id);
      
      if (isLiked) {
        await libraryAPI.unlikeSong(song.song_id);
        setLikedSongs(prev => prev.filter(s => s?.song_id !== song.song_id));
        showToast('Imeondolewa kwenye zilizopendwa', 'success');
      } else {
        await libraryAPI.likeSong(song.song_id);
        setLikedSongs(prev => [song, ...prev]);
        showToast('Imeongezwa kwenye zilizopendwa ❤️', 'success');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      showToast('Imeshindwa', 'error');
    }
  }, [likedSongs]);

  // Playlist handlers
  const handleOpenCreatePlaylist = useCallback(() => {
    if (!isAuthenticated) {
      navigation.navigate('Login');
      return;
    }
    setNewPlaylistName('');
    setShowCreatePlaylistModal(true);
  }, [isAuthenticated, navigation]);

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
      
      // If we have a selected song, add it to the new playlist
      if (selectedSong && response.data?.playlist_id) {
        await libraryAPI.addToPlaylist(response.data.playlist_id, selectedSong.song_id);
        showToast(`"${selectedSong.title}" imeongezwa`, 'success');
        setSelectedSong(null);
        setShowPlaylistPicker(false);
      }
      
      loadLibraryData();
    } catch (error) {
      showToast('Imeshindwa kutengeneza playlist', 'error');
    } finally {
      setCreatingPlaylist(false);
    }
  }, [newPlaylistName, selectedSong]);

  const handleAddToPlaylist = useCallback((song) => {
    setSelectedSong(song);
    setShowActionsSheet(false);
    setTimeout(() => setShowPlaylistPicker(true), 300);
  }, []);

  const handleSelectPlaylist = useCallback(async (playlist) => {
    if (!selectedSong) return;
    
    try {
      await libraryAPI.addToPlaylist(playlist.playlist_id, selectedSong.song_id);
      showToast(`Imeongezwa kwenye "${playlist.name}"`, 'success');
      setShowPlaylistPicker(false);
      setSelectedSong(null);
      loadLibraryData();
    } catch (error) {
      showToast('Imeshindwa kuongeza wimbo', 'error');
    }
  }, [selectedSong]);

  // Check if song is liked
  const likedSongIds = new Set(likedSongs.filter(s => s?.song_id).map(s => s.song_id));

  // Calculate download stats
  const totalDownloadSize = getTotalSize();
  const activeDownloadCount = Object.keys(activeDownloads).length + downloadQueue.length;

  // Not authenticated view
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Maktaba Yako</Text>
        </View>
        <View style={styles.emptyStateContainer}>
          <Ionicons name="library-outline" size={80} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Ingia ili kuona maktaba yako</Text>
          <Text style={styles.emptyText}>
            Playlist, nyimbo unazopenda na zilizopakuwa zitaonekana hapa
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
            data-testid="library-login-button"
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
          <Text style={styles.title}>Maktaba Yako</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const tabs = [
    { id: 'playlists', label: 'Playlist', icon: 'list' },
    { id: 'liked', label: 'Zilizopendwa', icon: 'heart' },
    { id: 'downloads', label: 'Zilizopakuwa', icon: 'download' },
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
            <Text style={styles.quickAccessTitle}>Zilizopakuwa</Text>
            <View style={styles.downloadStats}>
              <Text style={styles.quickAccessCount}>
                {downloads.length} nyimbo
              </Text>
              {activeDownloadCount > 0 && (
                <View style={styles.downloadingBadge}>
                  <ActivityIndicator size={10} color={COLORS.primary} />
                  <Text style={styles.downloadingText}>{activeDownloadCount}</Text>
                </View>
              )}
            </View>
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
        <View style={styles.emptySection}>
          <Text style={styles.emptySectionText}>Hakuna playlist bado</Text>
          <TouchableOpacity 
            style={styles.createButton} 
            onPress={handleOpenCreatePlaylist}
            data-testid="create-first-playlist"
          >
            <Ionicons name="add" size={20} color={COLORS.text} />
            <Text style={styles.createButtonText}>Tengeneza Playlist</Text>
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
            title="Nyimbo Pendwa"
            songCount={likedSongs.length}
            onPlayAll={() => handlePlayAll(likedSongs)}
            onShuffle={() => handleShuffle(likedSongs)}
          />
          {likedSongs.map((song, index) => (
            <SongListItem
              key={song?.song_id ?? `liked-${index}`}
              item={song}
              index={index}
              isPlaying={currentTrack?.song_id === song?.song_id && isPlaying}
              isCurrentSong={currentTrack?.song_id === song?.song_id}
              onPress={() => handlePlaySong(song, likedSongs)}
              onMorePress={() => handleSongMore(song)}
            />
          ))}
        </>
      ) : (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="heart-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Hakuna nyimbo unazopenda</Text>
          <Text style={styles.emptyText}>
            Bofya ikoni ya moyo ili kuhifadhi nyimbo unazopenda
          </Text>
        </View>
      )}
    </View>
  );

  // Downloads Tab Content
  const renderDownloadsTab = () => (
    <View style={styles.tabContent}>
      {/* Download Stats Header */}
      {(downloads.length > 0 || activeDownloadCount > 0) && (
        <View style={styles.downloadStatsHeader}>
          <View style={styles.downloadStatItem}>
            <Ionicons name="folder" size={20} color={COLORS.primary} />
            <Text style={styles.downloadStatText}>{formatSize(totalDownloadSize)}</Text>
          </View>
          {activeDownloadCount > 0 && (
            <View style={styles.downloadStatItem}>
              <ActivityIndicator size={16} color={COLORS.primary} />
              <Text style={styles.downloadStatText}>{activeDownloadCount} inapakua</Text>
            </View>
          )}
        </View>
      )}

      {downloads.length > 0 ? (
        <>
          <PlayAllHeader
            title="Zilizopakuwa"
            subtitle="Sikiliza bila mtandao"
            songCount={downloads.length}
            onPlayAll={() => handlePlayAll(downloads)}
            onShuffle={() => handleShuffle(downloads)}
          />
          {downloads.map((song, index) => (
            <SongListItem
              key={song?.song_id ?? `download-${index}`}
              item={song}
              index={index}
              isPlaying={currentTrack?.song_id === song?.song_id && isPlaying}
              isCurrentSong={currentTrack?.song_id === song?.song_id}
              onPress={() => handlePlaySong(song, downloads)}
              onMorePress={() => handleSongMore(song)}
            />
          ))}
        </>
      ) : (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="download-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Hakuna zilizopakuwa</Text>
          <Text style={styles.emptyText}>
            Pakua nyimbo ili kusikiliza bila mtandao
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {user?.avatar && (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          )}
          <Text style={styles.title}>Maktaba Yako</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerIcon} 
            onPress={() => navigation.navigate('Search')}
            data-testid="search-button"
          >
            <Ionicons name="search" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerIcon} 
            onPress={handleOpenCreatePlaylist}
            data-testid="add-button"
          >
            <Ionicons name="add" size={28} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
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
            {tab.id === 'downloads' && activeDownloadCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{activeDownloadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {activeTab === 'playlists' && renderPlaylistsTab()}
        {activeTab === 'liked' && renderLikedTab()}
        {activeTab === 'downloads' && renderDownloadsTab()}
        
        {/* Bottom spacing for mini player */}
        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Song Actions Sheet */}
      <SongActionsSheet
        visible={showActionsSheet}
        onClose={() => setShowActionsSheet(false)}
        song={selectedSong}
        isLiked={selectedSong?.song_id ? likedSongIds.has(selectedSong.song_id) : false}
        isAuthenticated={isAuthenticated}
        onLike={handleLikeSong}
        onAddToPlaylist={handleAddToPlaylist}
        onLoginRequired={() => navigation.navigate('Login')}
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
                data-testid="playlist-name-input"
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
                  data-testid="create-playlist-confirm"
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerIcon: {
    padding: SPACING.xs,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
    gap: SPACING.xs,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.text,
  },
  tabBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    paddingHorizontal: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.lg,
  },
  loginButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  
  // Quick Access
  quickAccessContainer: {
    marginBottom: SPACING.md,
  },
  quickAccessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  quickAccessIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  quickAccessTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  quickAccessCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  downloadStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  downloadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  downloadingText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '600',
  },
  
  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  
  // Playlist Item
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  playlistImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  playlistInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  playlistTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  playlistMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptySectionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  createButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  
  // Download Stats Header
  downloadStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  downloadStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  downloadStatText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
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

export default LibraryScreen;
