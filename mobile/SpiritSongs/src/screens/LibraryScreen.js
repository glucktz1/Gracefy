import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, 
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Dimensions
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
const CARD_WIDTH = (width - 48) / 2;

// Quick Access Card Component - 2 columns layout
const QuickAccessCard = ({ icon, iconColor, gradient, title, subtitle, onPress }) => (
  <TouchableOpacity style={styles.quickAccessCard} onPress={onPress} activeOpacity={0.8}>
    <LinearGradient colors={gradient} style={styles.quickAccessIcon}>
      <Ionicons name={icon} size={24} color={iconColor || '#fff'} />
    </LinearGradient>
    <View style={styles.quickAccessInfo}>
      <Text style={styles.quickAccessTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.quickAccessSubtitle} numberOfLines={1}>{subtitle}</Text>
    </View>
  </TouchableOpacity>
);

// Playlist Card for grid
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

// Downloaded Song Card
const DownloadedSongCard = ({ song, onPress, onRemove, isCurrentSong }) => (
  <TouchableOpacity 
    style={[styles.downloadedCard, isCurrentSong && styles.downloadedCardActive]} 
    onPress={onPress} 
    activeOpacity={0.8}
  >
    <View style={styles.downloadedArt}>
      {song.thumbnail ? (
        <Image source={{ uri: getThumbnailUrl(song.thumbnail) }} style={styles.downloadedImg} />
      ) : (
        <LinearGradient colors={['#535353', '#121212']} style={styles.downloadedImg}>
          <Ionicons name="musical-notes" size={20} color="rgba(255,255,255,0.3)" />
        </LinearGradient>
      )}
      <View style={styles.downloadedBadge}>
        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
      </View>
    </View>
    <View style={styles.downloadedInfo}>
      <Text style={[styles.downloadedName, isCurrentSong && styles.activeText]} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.downloadedMeta} numberOfLines={1}>
        {song.artist_name || 'Unknown Artist'}
      </Text>
    </View>
    <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(song)}>
      <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  </TouchableOpacity>
);

// Liked Song Card
const LikedSongCard = ({ song, onPress, isCurrentSong }) => (
  <TouchableOpacity 
    style={[styles.likedSongCard, isCurrentSong && styles.likedSongCardActive]} 
    onPress={onPress} 
    activeOpacity={0.8}
  >
    <View style={styles.likedSongArt}>
      {song.thumbnail ? (
        <Image source={{ uri: getThumbnailUrl(song.thumbnail) }} style={styles.likedSongImg} />
      ) : (
        <LinearGradient colors={['#535353', '#121212']} style={styles.likedSongImg}>
          <Ionicons name="musical-notes" size={20} color="rgba(255,255,255,0.3)" />
        </LinearGradient>
      )}
    </View>
    <View style={styles.likedSongInfo}>
      <Text style={[styles.likedSongName, isCurrentSong && styles.activeText]} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.likedSongMeta} numberOfLines={1}>
        {song.artist_name || 'Unknown Artist'}
      </Text>
    </View>
    <Ionicons name="heart" size={20} color="#e91e63" />
  </TouchableOpacity>
);

export default function LibraryScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('library');
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
      album: {
        album_id: s.album_id,
        title: s.album_title || 'Downloads',
        artist_name: s.artist_name,
        thumbnail: s.thumbnail,
      }
    }));
    
    playSong(song, album, queue, index);
  };

  const handlePlayLikedSong = (song, index) => {
    const album = {
      album_id: song.album_id,
      title: 'Liked Songs',
      artist_name: song.artist_name,
      thumbnail: song.thumbnail,
    };
    
    const likedSongs = library?.favorites || [];
    const queue = likedSongs.map(s => ({
      song: s,
      album: {
        album_id: s.album_id,
        title: 'Liked Songs',
        artist_name: s.artist_name,
        thumbnail: s.thumbnail,
      }
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

  const likedCount = library?.favorites?.length || 0;
  const playlistsCount = library?.playlists?.length || 0;

  // Auth required screen
  if (!isAuthenticated && activeTab !== 'downloads') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitleCentered}>Your Library</Text>
        </View>
        
        <View style={styles.tabsRow}>
          {['library', 'downloads'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab === 'library' ? 'Library' : 'Downloads'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'downloads' ? (
          <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
            {renderDownloadsContent()}
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

  const renderDownloadsContent = () => (
    <>
      {downloads.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionCount}>{downloads.length} songs • {formatSize(downloadsSize)}</Text>
            <TouchableOpacity onPress={handleClearAllDownloads}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          </View>
          {downloads.map((song, index) => (
            <DownloadedSongCard
              key={song.song_id || index}
              song={song}
              onPress={() => handlePlayDownloaded(song, index)}
              onRemove={handleRemoveDownload}
              isCurrentSong={currentSong?.song_id === song.song_id}
            />
          ))}
        </>
      ) : (
        <View style={styles.emptyState}>
          <LinearGradient colors={['#1e88e5', '#4fc3f7']} style={styles.emptyIcon}>
            <Ionicons name="download-outline" size={40} color="#fff" />
          </LinearGradient>
          <Text style={styles.emptyTitle}>No Downloads</Text>
          <Text style={styles.emptySubtitle}>Download songs to listen offline anytime</Text>
        </View>
      )}
    </>
  );

  const renderLikedContent = () => {
    const likedSongs = library?.favorites || [];
    
    return (
      <>
        {likedSongs.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionCount}>{likedSongs.length} songs</Text>
            </View>
            {likedSongs.map((song, index) => (
              <LikedSongCard
                key={song.song_id || song.id || index}
                song={song}
                onPress={() => handlePlayLikedSong(song, index)}
                isCurrentSong={currentSong?.song_id === song.song_id}
              />
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <LinearGradient colors={['#e91e63', '#ff5722']} style={styles.emptyIcon}>
              <Ionicons name="heart-outline" size={40} color="#fff" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No Liked Songs</Text>
            <Text style={styles.emptySubtitle}>Songs you like will appear here</Text>
          </View>
        )}
      </>
    );
  };

  const renderPlaylistsContent = () => {
    const playlists = library?.playlists || [];
    
    return (
      <>
        {/* Create New Playlist */}
        <TouchableOpacity style={styles.createPlaylistCard} onPress={handleCreatePlaylist}>
          <View style={styles.createPlaylistIcon}>
            <Ionicons name="add" size={32} color={COLORS.textPrimary} />
          </View>
          <Text style={styles.createPlaylistText}>Create Playlist</Text>
        </TouchableOpacity>

        {playlists.length > 0 ? (
          <View style={styles.playlistsGrid}>
            {playlists.map((playlist) => (
              <PlaylistGridCard
                key={playlist.playlist_id}
                playlist={playlist}
                onPress={() => navigation.navigate('Playlist', { playlistId: playlist.playlist_id })}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyStateSmall}>
            <Text style={styles.emptySubtitleSmall}>Create playlists to organize your music</Text>
          </View>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
        contentContainerStyle={[
          styles.contentPadding,
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
        {/* Quick Access Grid - 2 columns x 4 rows (8 items) */}
        <View style={styles.quickAccessGrid}>
          {/* Row 1 */}
          <QuickAccessCard
            icon="heart"
            gradient={['#e91e63', '#ff5722']}
            title="Liked Songs"
            subtitle={`${likedCount} songs`}
            onPress={() => setActiveTab('liked')}
          />
          <QuickAccessCard
            icon="download"
            gradient={['#1e88e5', '#4fc3f7']}
            title="Downloads"
            subtitle={`${downloads.length} songs`}
            onPress={() => setActiveTab('downloads')}
          />
          
          {/* Row 2 */}
          <QuickAccessCard
            icon="list"
            gradient={['#4CAF50', '#8BC34A']}
            title="Playlists"
            subtitle={`${playlistsCount} playlists`}
            onPress={() => setActiveTab('playlists')}
          />
          <QuickAccessCard
            icon="time"
            gradient={['#9c27b0', '#e040fb']}
            title="Recently Played"
            subtitle="Your history"
            onPress={() => setActiveTab('recent')}
          />
          
          {/* Row 3 - Additional quick access from playlists */}
          {library?.playlists?.slice(0, 2).map((playlist, idx) => (
            <QuickAccessCard
              key={playlist.playlist_id}
              icon="musical-notes"
              gradient={idx === 0 ? ['#FF9800', '#FFB74D'] : ['#00BCD4', '#4DD0E1']}
              title={playlist.name}
              subtitle={`${playlist.songs?.length || 0} songs`}
              onPress={() => navigation.navigate('Playlist', { playlistId: playlist.playlist_id })}
            />
          ))}
          
          {/* Fill remaining slots if needed */}
          {(!library?.playlists || library.playlists.length < 2) && (
            <>
              {library?.playlists?.length < 1 && (
                <QuickAccessCard
                  icon="add-circle"
                  gradient={['#607D8B', '#90A4AE']}
                  title="New Playlist"
                  subtitle="Create one"
                  onPress={handleCreatePlaylist}
                />
              )}
              {library?.playlists?.length < 2 && (
                <QuickAccessCard
                  icon="shuffle"
                  gradient={['#795548', '#A1887F']}
                  title="Shuffle All"
                  subtitle="Mix it up"
                  onPress={() => {/* shuffle all */}}
                />
              )}
            </>
          )}
        </View>

        {/* Tab Selection */}
        <View style={styles.tabsRow}>
          {[
            { id: 'liked', label: 'Liked Songs', icon: 'heart' },
            { id: 'downloads', label: 'Downloads', icon: 'download' },
            { id: 'playlists', label: 'Playlists', icon: 'list' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons 
                name={tab.icon} 
                size={16} 
                color={activeTab === tab.id ? '#000' : COLORS.textSecondary} 
              />
              <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content based on active tab */}
        <View style={styles.tabContent}>
          {activeTab === 'liked' && renderLikedContent()}
          {activeTab === 'downloads' && renderDownloadsContent()}
          {activeTab === 'playlists' && renderPlaylistsContent()}
          {activeTab === 'recent' && (
            <View style={styles.emptyState}>
              <LinearGradient colors={['#9c27b0', '#e040fb']} style={styles.emptyIcon}>
                <Ionicons name="time-outline" size={40} color="#fff" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>Recently Played</Text>
              <Text style={styles.emptySubtitle}>Your listening history will appear here</Text>
            </View>
          )}
        </View>
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
    marginHorizontal: -4,
  },
  quickAccessCard: {
    width: CARD_WIDTH,
    height: 64,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    margin: 4,
    overflow: 'hidden',
  },
  quickAccessIcon: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessInfo: {
    flex: 1,
    paddingHorizontal: 12,
  },
  quickAccessTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  quickAccessSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  // Tabs
  tabsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.textMuted,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#e91e63',
    borderColor: '#e91e63',
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sectionCount: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  clearAllText: {
    color: '#e91e63',
    fontSize: 14,
    fontWeight: '600',
  },
  // Downloaded Song Card
  downloadedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  downloadedCardActive: {
    backgroundColor: 'rgba(233, 30, 99, 0.1)',
  },
  downloadedArt: {
    width: 48,
    height: 48,
    borderRadius: 6,
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
    borderRadius: 8,
    padding: 1,
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
    fontSize: 12,
    marginTop: 2,
  },
  removeBtn: {
    padding: 10,
  },
  // Liked Song Card
  likedSongCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  likedSongCardActive: {
    backgroundColor: 'rgba(233, 30, 99, 0.1)',
  },
  likedSongArt: {
    width: 48,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
  },
  likedSongImg: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likedSongInfo: {
    flex: 1,
    marginLeft: 12,
  },
  likedSongName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  likedSongMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  activeText: {
    color: '#e91e63',
  },
  // Playlists Grid
  createPlaylistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  createPlaylistIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#282828',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  createPlaylistText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
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
  emptyStateSmall: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptySubtitleSmall: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  // Auth Prompt
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
});
