import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, 
  StyleSheet, FlatList, ActivityIndicator, RefreshControl, Alert, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { libraryService, contentService, getThumbnailUrl } from '../services/api';
import { getDownloadedSongs, removeDownload, clearAllDownloads, getDownloadsSize } from '../services/downloadService';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import MiniPlayer from '../components/MiniPlayer';
import SongListItem from '../components/SongListItem';
import PlaylistModal from '../components/PlaylistModal';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

const PlaylistCard = ({ playlist, onPress }) => (
  <TouchableOpacity style={styles.playlistCard} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.playlistArt}>
      <LinearGradient colors={['#282828', '#121212']} style={styles.playlistArtGradient}>
        <Ionicons name="musical-notes" size={32} color={COLORS.textMuted} />
      </LinearGradient>
    </View>
    <View style={styles.playlistInfo}>
      <Text style={styles.playlistName} numberOfLines={1}>{playlist.name}</Text>
      <Text style={styles.playlistMeta}>
        Playlist • {playlist.songs?.length || playlist.song_count || 0} songs
      </Text>
    </View>
  </TouchableOpacity>
);

const DownloadedSongCard = ({ song, onPress, onRemove }) => (
  <TouchableOpacity style={styles.downloadedCard} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.downloadedArt}>
      {song.thumbnail ? (
        <Image source={{ uri: getThumbnailUrl(song.thumbnail) }} style={styles.downloadedImg} />
      ) : (
        <LinearGradient colors={['#535353', '#121212']} style={styles.downloadedImg}>
          <Ionicons name="musical-notes" size={24} color="rgba(255,255,255,0.3)" />
        </LinearGradient>
      )}
      <View style={styles.downloadedBadge}>
        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
      </View>
    </View>
    <View style={styles.downloadedInfo}>
      <Text style={styles.downloadedName} numberOfLines={1}>{song.title}</Text>
      <Text style={styles.downloadedMeta} numberOfLines={1}>
        {song.artist_name || 'Unknown Artist'}
      </Text>
    </View>
    <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(song)}>
      <Ionicons name="trash-outline" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  </TouchableOpacity>
);

const FavoriteCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.favoriteCard} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.favoriteArt}>
      {item.thumbnail ? (
        <Image source={{ uri: getThumbnailUrl(item.thumbnail) }} style={styles.favoriteImg} />
      ) : (
        <LinearGradient colors={['#535353', '#121212']} style={styles.favoriteImg}>
          <Ionicons name="musical-notes" size={24} color="rgba(255,255,255,0.3)" />
        </LinearGradient>
      )}
    </View>
    <View style={styles.favoriteInfo}>
      <Text style={styles.favoriteName} numberOfLines={1}>{item.title || item.name}</Text>
      <Text style={styles.favoriteMeta} numberOfLines={1}>
        {item.type === 'song' ? 'Song' : 'Album'} • {item.artist_name || 'Unknown'}
      </Text>
    </View>
  </TouchableOpacity>
);

export default function LibraryScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('playlists');
  const [library, setLibrary] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [downloadsSize, setDownloadsSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  
  const { currentSong, playSong } = usePlayer();
  const { isAuthenticated, user } = useAuth();

  const fetchLibrary = useCallback(async () => {
    try {
      // Fetch downloads regardless of auth status
      const downloadedSongs = await getDownloadedSongs();
      setDownloads(downloadedSongs);
      
      const size = await getDownloadsSize();
      setDownloadsSize(size);

      if (isAuthenticated) {
        const data = await libraryService.getLibrary();
        setLibrary(data);
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

  // Refresh when screen comes into focus
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

  const handlePlayDownloaded = (song) => {
    // Create a simple album object for the downloaded song
    const album = {
      album_id: song.album_id,
      title: song.album_title || 'Downloads',
      artist_name: song.artist_name,
      thumbnail: song.thumbnail,
    };
    
    // Create queue from all downloads
    const queue = downloads.map(s => ({
      song: s,
      album: {
        album_id: s.album_id,
        title: s.album_title || 'Downloads',
        artist_name: s.artist_name,
        thumbnail: s.thumbnail,
      }
    }));
    
    const index = downloads.findIndex(s => s.song_id === song.song_id);
    playSong(song, album, queue, index >= 0 ? index : 0);
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
              fetchLibrary(); // Refresh the list
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
      'This will remove all downloaded songs. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllDownloads();
              fetchLibrary();
              Alert.alert('Done', 'All downloads cleared');
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

  if (!isAuthenticated && activeTab !== 'downloads') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitleCentered}>Your Library</Text>
        </View>
        
        {/* Tabs - always show */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {[
            { id: 'playlists', label: 'Playlists' },
            { id: 'favorites', label: 'Liked Songs' },
            { id: 'downloads', label: 'Downloads' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {activeTab === 'downloads' ? (
          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {downloads.length > 0 ? (
              <>
                <View style={styles.downloadsHeader}>
                  <Text style={styles.downloadsCount}>{downloads.length} songs • {formatSize(downloadsSize)}</Text>
                  <TouchableOpacity onPress={handleClearAllDownloads}>
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
                {downloads.map((song, index) => (
                  <DownloadedSongCard
                    key={song.song_id || index}
                    song={song}
                    onPress={() => handlePlayDownloaded(song)}
                    onRemove={handleRemoveDownload}
                  />
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="download-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No downloads yet</Text>
                <Text style={styles.emptyHint}>Download songs to listen offline</Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <View style={styles.authPrompt}>
            <Ionicons name="library-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.authTitle}>Your Library</Text>
            <Text style={styles.authSubtitle}>
              Log in to see your saved songs, playlists, and more
            </Text>
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginButtonText}>Log In</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {currentSong && <MiniPlayer navigation={navigation} onPress={handleNowPlaying} />}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const tabs = [
    { id: 'playlists', label: 'Playlists' },
    { id: 'favorites', label: 'Liked Songs' },
    { id: 'downloads', label: 'Downloads' },
    { id: 'recent', label: 'Recent' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'playlists':
        return (
          <>
            {/* Create Playlist Button */}
            <TouchableOpacity style={styles.createPlaylistBtn} onPress={handleCreatePlaylist}>
              <View style={styles.createPlaylistIcon}>
                <Ionicons name="add" size={32} color={COLORS.textMuted} />
              </View>
              <View style={styles.createPlaylistInfo}>
                <Text style={styles.createPlaylistText}>Create Playlist</Text>
              </View>
            </TouchableOpacity>

            {/* Liked Songs Shortcut */}
            <TouchableOpacity 
              style={styles.likedSongsCard}
              onPress={() => setActiveTab('favorites')}
            >
              <LinearGradient 
                colors={['#4527a0', '#7e57c2']} 
                style={styles.likedSongsArt}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="heart" size={24} color="#fff" />
              </LinearGradient>
              <View style={styles.likedSongsInfo}>
                <Text style={styles.likedSongsTitle}>Liked Songs</Text>
                <Text style={styles.likedSongsMeta}>
                  Playlist • {library?.favorites?.length || 0} songs
                </Text>
              </View>
            </TouchableOpacity>

            {/* Downloads Shortcut */}
            <TouchableOpacity 
              style={styles.likedSongsCard}
              onPress={() => setActiveTab('downloads')}
            >
              <LinearGradient 
                colors={['#1e88e5', '#4fc3f7']} 
                style={styles.likedSongsArt}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="download" size={24} color="#fff" />
              </LinearGradient>
              <View style={styles.likedSongsInfo}>
                <Text style={styles.likedSongsTitle}>Downloads</Text>
                <Text style={styles.likedSongsMeta}>
                  {downloads.length} songs • {formatSize(downloadsSize)}
                </Text>
              </View>
            </TouchableOpacity>

            {/* User Playlists */}
            {library?.playlists?.map((playlist) => (
              <PlaylistCard
                key={playlist.playlist_id}
                playlist={playlist}
                onPress={() => navigation.navigate('Playlist', { playlistId: playlist.playlist_id })}
              />
            ))}

            {(!library?.playlists || library.playlists.length === 0) && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No playlists yet</Text>
                <Text style={styles.emptyHint}>Create a playlist to get started</Text>
              </View>
            )}
          </>
        );

      case 'favorites':
        return (
          <>
            {library?.favorites?.length > 0 ? (
              library.favorites.map((item, index) => (
                <SongListItem
                  key={item.id || index}
                  song={item}
                  index={index}
                  showIndex={false}
                  showThumbnail={true}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No liked songs yet</Text>
                <Text style={styles.emptyHint}>Songs you like will appear here</Text>
              </View>
            )}
          </>
        );

      case 'downloads':
        return (
          <>
            {downloads.length > 0 ? (
              <>
                <View style={styles.downloadsHeader}>
                  <Text style={styles.downloadsCount}>{downloads.length} songs • {formatSize(downloadsSize)}</Text>
                  <TouchableOpacity onPress={handleClearAllDownloads}>
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </TouchableOpacity>
                </View>
                {downloads.map((song, index) => (
                  <DownloadedSongCard
                    key={song.song_id || index}
                    song={song}
                    onPress={() => handlePlayDownloaded(song)}
                    onRemove={handleRemoveDownload}
                  />
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="download-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No downloads yet</Text>
                <Text style={styles.emptyHint}>Download songs to listen offline</Text>
              </View>
            )}
          </>
        );

      case 'recent':
        return (
          <>
            {library?.recently_played?.length > 0 ? (
              library.recently_played.map((item, index) => (
                <FavoriteCard
                  key={item.id || index}
                  item={item}
                  onPress={() => {
                    if (item.album_id) {
                      navigation.navigate('Album', { albumId: item.album_id });
                    }
                  }}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No recent activity</Text>
                <Text style={styles.emptyHint}>Songs you play will appear here</Text>
              </View>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
            <LinearGradient colors={['#b83280', '#ff6b6b']} style={styles.profileGradient}>
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

        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          currentSong && { paddingBottom: 140 }
        ]}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderContent()}
      </ScrollView>

      {/* Mini Player */}
      {currentSong && <MiniPlayer navigation={navigation} onPress={handleNowPlaying} />}

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
  headerTitleCentered: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 48,
    paddingBottom: 16,
  },
  profileBtn: {
    marginRight: 12,
  },
  profileGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  headerTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  addBtn: {
    padding: 4,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.textMuted,
    marginRight: 8,
  },
  activeTab: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  authTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
  },
  authSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  loginButton: {
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  loginButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  createPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  createPlaylistIcon: {
    width: 56,
    height: 56,
    borderRadius: 4,
    backgroundColor: COLORS.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPlaylistInfo: {
    marginLeft: 12,
  },
  createPlaylistText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  likedSongsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  likedSongsArt: {
    width: 56,
    height: 56,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likedSongsInfo: {
    marginLeft: 12,
  },
  likedSongsTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  likedSongsMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  playlistArt: {
    width: 56,
    height: 56,
    borderRadius: 4,
    overflow: 'hidden',
  },
  playlistArtGradient: {
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
    fontSize: 16,
    fontWeight: '500',
  },
  playlistMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  // Downloads
  downloadsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  downloadsCount: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  clearAllText: {
    color: '#e91e63',
    fontSize: 14,
    fontWeight: '600',
  },
  downloadedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  downloadedArt: {
    width: 56,
    height: 56,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  downloadedImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#0a0a1a',
    borderRadius: 10,
    padding: 2,
  },
  downloadedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  downloadedName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  downloadedMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  removeBtn: {
    padding: 12,
  },
  // Favorites
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  favoriteArt: {
    width: 56,
    height: 56,
    borderRadius: 4,
    overflow: 'hidden',
  },
  favoriteImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  favoriteName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  favoriteMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyHint: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
});
