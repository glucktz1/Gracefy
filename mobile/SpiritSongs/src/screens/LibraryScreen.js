import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, 
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { libraryService, contentService, getThumbnailUrl } from '../services/api';
import { getDownloadedSongs, removeDownload, clearAllDownloads, getDownloadsSize } from '../services/downloadService';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import PlaylistModal from '../components/PlaylistModal';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// Quick Access Card
const QuickAccessCard = ({ icon, gradient, title, subtitle, onPress, isActive }) => (
  <TouchableOpacity 
    style={[styles.quickAccessCard, isActive && styles.quickAccessCardActive]} 
    onPress={onPress} 
    activeOpacity={0.8}
  >
    <LinearGradient colors={gradient} style={styles.quickAccessIcon}>
      <Ionicons name={icon} size={22} color="#fff" />
    </LinearGradient>
    <View style={styles.quickAccessInfo}>
      <Text style={styles.quickAccessTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.quickAccessSubtitle} numberOfLines={1}>{subtitle}</Text>
    </View>
  </TouchableOpacity>
);

// Song Card
const SongCard = ({ song, onPress, onRemove, isCurrentSong, showRemove, isLiked }) => (
  <TouchableOpacity 
    style={[styles.songCard, isCurrentSong && styles.songCardActive]} 
    onPress={onPress} 
    activeOpacity={0.8}
  >
    <View style={styles.songArt}>
      {song.thumbnail ? (
        <Image source={{ uri: getThumbnailUrl(song.thumbnail) }} style={styles.songImg} />
      ) : (
        <LinearGradient colors={['#535353', '#121212']} style={styles.songImg}>
          <Ionicons name="musical-notes" size={20} color="rgba(255,255,255,0.3)" />
        </LinearGradient>
      )}
    </View>
    <View style={styles.songInfo}>
      <Text style={[styles.songName, isCurrentSong && styles.activeText]} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.songMeta} numberOfLines={1}>
        {song.artist_name || 'Unknown Artist'}
      </Text>
    </View>
    {isLiked && <Ionicons name="heart" size={18} color="#e91e63" style={styles.likeIcon} />}
    {showRemove && (
      <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(song)}>
        <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    )}
  </TouchableOpacity>
);

// Playlist Card
const PlaylistGridCard = ({ playlist, onPress }) => (
  <TouchableOpacity style={styles.playlistGridCard} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.playlistGridArt}>
      <LinearGradient colors={['#282828', '#181818']} style={styles.playlistGridGradient}>
        <Ionicons name="musical-notes" size={32} color={COLORS.textMuted} />
      </LinearGradient>
    </View>
    <Text style={styles.playlistGridName} numberOfLines={1}>{playlist.name}</Text>
    <Text style={styles.playlistGridMeta}>{playlist.songs?.length || 0} songs</Text>
  </TouchableOpacity>
);

export default function LibraryScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('liked');
  const [library, setLibrary] = useState(null);
  const [likedSongs, setLikedSongs] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [downloadsSize, setDownloadsSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  
  const { currentSong, playSong } = usePlayer();
  const { isAuthenticated, user } = useAuth();

  const fetchLibrary = useCallback(async () => {
    try {
      // Get downloads
      const downloadedSongs = await getDownloadedSongs();
      setDownloads(downloadedSongs);
      
      const size = await getDownloadsSize();
      setDownloadsSize(size);

      // Get liked songs from local storage
      const localFavorites = await SecureStore.getItemAsync('local_favorites');
      const favoriteIds = localFavorites ? JSON.parse(localFavorites) : [];
      
      // If authenticated, also get from backend and merge
      if (isAuthenticated) {
        try {
          const data = await libraryService.getLibrary();
          setLibrary(data);
          
          // Merge backend favorites with local
          const backendFavIds = (data.favorites || []).map(f => f.item?.song_id || f.id);
          const allFavIds = [...new Set([...favoriteIds, ...backendFavIds])];
          
          // Fetch song details for all favorites
          const songs = [];
          for (const favId of allFavIds) {
            // First check if we have it in backend response
            const backendFav = (data.favorites || []).find(f => f.item?.song_id === favId);
            if (backendFav?.item) {
              songs.push({
                ...backendFav.item,
                album: backendFav.album,
              });
            } else if (downloadedSongs.find(d => d.song_id === favId)) {
              // Check downloads
              songs.push(downloadedSongs.find(d => d.song_id === favId));
            }
          }
          setLikedSongs(songs);
        } catch (e) {
          console.log('Library fetch error:', e);
          // Use local favorites for downloaded songs
          const songs = downloadedSongs.filter(d => favoriteIds.includes(d.song_id));
          setLikedSongs(songs);
        }
      } else {
        // Not authenticated - show liked from downloads only
        const songs = downloadedSongs.filter(d => favoriteIds.includes(d.song_id));
        setLikedSongs(songs);
      }
    } catch (error) {
      console.error('Error fetching library:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchLibrary();
    });
    return unsubscribe;
  }, [navigation, fetchLibrary]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLibrary();
  };

  const handleCreatePlaylist = () => {
    setShowPlaylistModal(true);
  };

  const handlePlayDownloaded = (song, index) => {
    const album = {
      album_id: song.album_id,
      title: song.album_title || 'Downloads',
      artist_name: song.artist_name,
      thumbnail: song.thumbnail,
    };
    
    const queue = downloads.map(s => ({
      song: s,
      album: { album_id: s.album_id, title: s.album_title || 'Downloads', artist_name: s.artist_name, thumbnail: s.thumbnail }
    }));
    
    playSong(song, album, queue, index);
  };

  const handlePlayLikedSong = (song, index) => {
    const album = {
      album_id: song.album_id || song.album?.album_id,
      title: song.album?.title || 'Liked Songs',
      artist_name: song.artist_name || song.album?.artist_name,
      thumbnail: song.thumbnail || song.album?.thumbnail,
    };
    
    const queue = likedSongs.map(s => ({
      song: s,
      album: { album_id: s.album_id, title: 'Liked Songs', artist_name: s.artist_name, thumbnail: s.thumbnail }
    }));
    
    playSong(song, album, queue, index);
  };

  const handleRemoveDownload = async (song) => {
    Alert.alert(
      'Remove Download',
      `Remove "${song.title}" from downloads?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeDownload(song.song_id);
              fetchLibrary();
            } catch (error) {
              Alert.alert('Error', 'Could not remove download');
            }
          }
        }
      ]
    );
  };

  const handleClearAllDownloads = () => {
    if (downloads.length === 0) return;
    
    Alert.alert(
      'Clear All Downloads',
      'Remove all downloaded songs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllDownloads();
              fetchLibrary();
            } catch (error) {
              Alert.alert('Error', 'Could not clear downloads');
            }
          }
        }
      ]
    );
  };

  const handleNowPlaying = () => {
    navigation.navigate('NowPlaying');
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const likedCount = likedSongs.length;
  const playlistsCount = library?.playlists?.length || 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e91e63" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
            <LinearGradient colors={['#e91e63', '#9c27b0']} style={styles.profileGradient}>
              <Text style={styles.profileInitial}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Library</Text>
          <TouchableOpacity style={styles.addBtn} onPress={handleCreatePlaylist}>
            <Ionicons name="add" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentPadding, currentSong && { paddingBottom: 140 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e91e63" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Access Grid - 2 columns x 4 rows */}
        <View style={styles.quickAccessGrid}>
          <QuickAccessCard
            icon="heart"
            gradient={['#7c3aed', '#ec4899']}
            title="Liked Songs"
            subtitle={`${likedCount} songs`}
            onPress={() => setActiveTab('liked')}
            isActive={activeTab === 'liked'}
          />
          <QuickAccessCard
            icon="download"
            gradient={['#1e88e5', '#4fc3f7']}
            title="Downloads"
            subtitle={`${downloads.length} songs`}
            onPress={() => setActiveTab('downloads')}
            isActive={activeTab === 'downloads'}
          />
          <QuickAccessCard
            icon="list"
            gradient={['#4CAF50', '#8BC34A']}
            title="Playlists"
            subtitle={`${playlistsCount} playlists`}
            onPress={() => setActiveTab('playlists')}
            isActive={activeTab === 'playlists'}
          />
          <QuickAccessCard
            icon="time"
            gradient={['#ff6b6b', '#ffa502']}
            title="Recent"
            subtitle="History"
            onPress={() => setActiveTab('recent')}
            isActive={activeTab === 'recent'}
          />
          {/* Additional items from playlists */}
          {library?.playlists?.slice(0, 4).map((playlist, idx) => (
            <QuickAccessCard
              key={playlist.playlist_id}
              icon="musical-notes"
              gradient={[
                ['#FF9800', '#FFB74D'],
                ['#00BCD4', '#4DD0E1'],
                ['#9c27b0', '#e040fb'],
                ['#795548', '#A1887F'],
              ][idx] || ['#333', '#555']}
              title={playlist.name}
              subtitle={`${playlist.songs?.length || 0} songs`}
              onPress={() => navigation.navigate('Playlist', { playlistId: playlist.playlist_id })}
            />
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {/* Liked Songs */}
          {activeTab === 'liked' && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Liked Songs</Text>
                <Text style={styles.sectionCount}>{likedCount} songs</Text>
              </View>
              {likedSongs.length > 0 ? (
                likedSongs.map((song, index) => (
                  <SongCard
                    key={song.song_id || index}
                    song={song}
                    onPress={() => handlePlayLikedSong(song, index)}
                    isCurrentSong={currentSong?.song_id === song.song_id}
                    isLiked={true}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <LinearGradient colors={['#7c3aed', '#ec4899']} style={styles.emptyIcon}>
                    <Ionicons name="heart-outline" size={40} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.emptyTitle}>No Liked Songs</Text>
                  <Text style={styles.emptySubtitle}>Tap the heart icon on any song to add it here</Text>
                </View>
              )}
            </>
          )}

          {/* Downloads */}
          {activeTab === 'downloads' && (
            <>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Downloads</Text>
                  <Text style={styles.sectionCount}>{downloads.length} songs • {formatSize(downloadsSize)}</Text>
                </View>
                {downloads.length > 0 && (
                  <TouchableOpacity onPress={handleClearAllDownloads}>
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </TouchableOpacity>
                )}
              </View>
              {downloads.length > 0 ? (
                downloads.map((song, index) => (
                  <SongCard
                    key={song.song_id || index}
                    song={song}
                    onPress={() => handlePlayDownloaded(song, index)}
                    onRemove={handleRemoveDownload}
                    isCurrentSong={currentSong?.song_id === song.song_id}
                    showRemove={true}
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <LinearGradient colors={['#1e88e5', '#4fc3f7']} style={styles.emptyIcon}>
                    <Ionicons name="download-outline" size={40} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.emptyTitle}>No Downloads</Text>
                  <Text style={styles.emptySubtitle}>Download songs to listen offline</Text>
                </View>
              )}
            </>
          )}

          {/* Playlists */}
          {activeTab === 'playlists' && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Playlists</Text>
                <TouchableOpacity onPress={handleCreatePlaylist}>
                  <Text style={styles.createText}>+ Create</Text>
                </TouchableOpacity>
              </View>
              {(library?.playlists?.length || 0) > 0 ? (
                <View style={styles.playlistsGrid}>
                  {library.playlists.map((playlist) => (
                    <PlaylistGridCard
                      key={playlist.playlist_id}
                      playlist={playlist}
                      onPress={() => navigation.navigate('Playlist', { playlistId: playlist.playlist_id })}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <LinearGradient colors={['#4CAF50', '#8BC34A']} style={styles.emptyIcon}>
                    <Ionicons name="list-outline" size={40} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.emptyTitle}>No Playlists</Text>
                  <Text style={styles.emptySubtitle}>Create playlists to organize your music</Text>
                  <TouchableOpacity style={styles.createBtn} onPress={handleCreatePlaylist}>
                    <Text style={styles.createBtnText}>Create Playlist</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* Recent */}
          {activeTab === 'recent' && (
            <View style={styles.emptyState}>
              <LinearGradient colors={['#ff6b6b', '#ffa502']} style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={40} color="#fff" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>Recently Played</Text>
              <Text style={styles.emptySubtitle}>Your listening history will appear here</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Playlist Modal */}
      <PlaylistModal 
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        onPlaylistCreated={() => fetchLibrary()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 48,
    backgroundColor: COLORS.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  profileBtn: {},
  profileGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 12,
  },
  addBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: 16,
  },
  // Quick Access Grid - 2 columns
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  quickAccessCard: {
    width: CARD_WIDTH,
    height: 56,
    backgroundColor: '#1a1a2e',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    marginRight: 8,
    marginBottom: 8,
  },
  quickAccessCardActive: {
    borderWidth: 1,
    borderColor: '#e91e63',
  },
  quickAccessIcon: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessInfo: {
    flex: 1,
    paddingHorizontal: 10,
  },
  quickAccessTitle: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  quickAccessSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  // Tab Content
  tabContent: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCount: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  clearAllText: {
    color: '#e91e63',
    fontSize: 14,
    fontWeight: '600',
  },
  createText: {
    color: '#e91e63',
    fontSize: 14,
    fontWeight: '600',
  },
  // Song Card
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  songCardActive: {
    backgroundColor: 'rgba(233, 30, 99, 0.1)',
  },
  songArt: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
  },
  songImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
  },
  songName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  songMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  activeText: {
    color: '#e91e63',
  },
  likeIcon: {
    marginRight: 8,
  },
  removeBtn: {
    padding: 10,
  },
  // Playlists Grid
  playlistsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  playlistGridCard: {
    width: CARD_WIDTH,
    margin: 6,
  },
  playlistGridArt: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  playlistGridGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistGridName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  playlistGridMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  // Empty States
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
  },
  createBtn: {
    backgroundColor: '#e91e63',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
  },
  createBtnText: {
    color: '#000',
    fontWeight: '600',
  },
});
