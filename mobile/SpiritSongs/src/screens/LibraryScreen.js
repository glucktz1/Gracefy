import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, StyleSheet,
  FlatList, RefreshControl, Alert, TextInput, Modal, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { libraryService, getAudioUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import MiniPlayer from '../components/MiniPlayer';

// Downloaded song item
const DownloadedSong = ({ song, onPlay, onDelete }) => (
  <View style={styles.downloadedItem}>
    <TouchableOpacity style={styles.downloadedInfo} onPress={onPlay}>
      <View style={styles.downloadedThumb}>
        <Ionicons name="musical-notes" size={20} color="#10b981" />
      </View>
      <View style={styles.downloadedText}>
        <Text style={styles.downloadedTitle} numberOfLines={1}>{song.title}</Text>
        <Text style={styles.downloadedArtist} numberOfLines={1}>{song.artist}</Text>
      </View>
    </TouchableOpacity>
    <TouchableOpacity onPress={() => onDelete(song)}>
      <Ionicons name="trash-outline" size={20} color="#ef4444" />
    </TouchableOpacity>
  </View>
);

// Playlist Card
const PlaylistCard = ({ playlist, onPress }) => (
  <TouchableOpacity style={styles.playlistCard} onPress={onPress}>
    <LinearGradient colors={['#7c3aed', '#10b981']} style={styles.playlistImage}>
      <Ionicons name="list" size={32} color="rgba(255,255,255,0.6)" />
    </LinearGradient>
    <View style={styles.playlistInfo}>
      <Text style={styles.playlistName} numberOfLines={1}>{playlist.name}</Text>
      <Text style={styles.playlistCount}>{playlist.songs?.length || 0} songs</Text>
    </View>
  </TouchableOpacity>
);

// Recent Item
const RecentItem = ({ item, onPress }) => (
  <TouchableOpacity style={styles.recentItem} onPress={onPress}>
    <View style={styles.recentThumb}>
      {item.album?.thumbnail ? (
        <Image source={{ uri: item.album.thumbnail }} style={styles.recentImage} />
      ) : (
        <View style={styles.recentPlaceholder}>
          <Ionicons name="musical-notes" size={16} color="#52525b" />
        </View>
      )}
    </View>
    <View style={styles.recentInfo}>
      <Text style={styles.recentTitle} numberOfLines={1}>{item.song.title}</Text>
      <Text style={styles.recentArtist} numberOfLines={1}>{item.album?.artist_name}</Text>
    </View>
  </TouchableOpacity>
);

export default function LibraryScreen({ navigation }) {
  const { isAuthenticated, user } = useAuth();
  const { currentSong, playSong } = usePlayer();
  const [activeTab, setActiveTab] = useState('recent');
  const [library, setLibrary] = useState(null);
  const [downloads, setDownloads] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const fetchLibrary = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const data = await libraryService.getLibrary();
      setLibrary(data);
    } catch (error) {
      console.error('Error fetching library:', error);
    } finally {
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  const loadDownloads = useCallback(async () => {
    try {
      const dir = `${FileSystem.documentDirectory}songs/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      
      if (dirInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(dir);
        const downloadedSongs = [];
        
        for (const file of files) {
          if (file.endsWith('.mp3')) {
            const metaPath = `${dir}${file.replace('.mp3', '.json')}`;
            const metaInfo = await FileSystem.getInfoAsync(metaPath);
            
            if (metaInfo.exists) {
              const meta = JSON.parse(await FileSystem.readAsStringAsync(metaPath));
              downloadedSongs.push(meta);
            }
          }
        }
        
        setDownloads(downloadedSongs);
      }
    } catch (error) {
      console.error('Error loading downloads:', error);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
    loadDownloads();
  }, [fetchLibrary, loadDownloads]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLibrary();
    loadDownloads();
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    try {
      await libraryService.createPlaylist(newPlaylistName.trim());
      setShowCreatePlaylist(false);
      setNewPlaylistName('');
      fetchLibrary();
      Alert.alert('Success', 'Playlist created!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create playlist');
    }
  };

  const deleteDownload = async (song) => {
    Alert.alert(
      'Delete Download',
      `Remove "${song.title}" from downloads?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const audioPath = `${FileSystem.documentDirectory}songs/${song.song_id}.mp3`;
              const metaPath = `${FileSystem.documentDirectory}songs/${song.song_id}.json`;
              
              await FileSystem.deleteAsync(audioPath, { idempotent: true });
              await FileSystem.deleteAsync(metaPath, { idempotent: true });
              
              loadDownloads();
            } catch (error) {
              console.error('Error deleting download:', error);
            }
          },
        },
      ]
    );
  };

  const playDownloadedSong = async (song) => {
    const audioPath = `${FileSystem.documentDirectory}songs/${song.song_id}.mp3`;
    playSong({ ...song, audio_url: audioPath }, { artist_name: song.artist }, downloads.map(d => ({ song: d, album: { artist_name: d.artist } })), downloads.indexOf(song));
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.authPrompt}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="library-outline" size={80} color="#27272a" />
        <Text style={styles.authTitle}>Your Library</Text>
        <Text style={styles.authText}>Sign in to see your playlists, downloads, and favorites</Text>
        <TouchableOpacity 
          style={styles.authButton}
          onPress={() => navigation.navigate('Auth')}
        >
          <Text style={styles.authButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}</Text>
            </View>
            <Text style={styles.headerTitle}>Your Library</Text>
          </View>
          <TouchableOpacity onPress={() => setShowCreatePlaylist(true)}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {['recent', 'playlists', 'downloads', 'favorites'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, currentSong && { paddingBottom: 90 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
      >
        {/* Recent */}
        {activeTab === 'recent' && (
          <View>
            {library?.recently_played?.length > 0 ? (
              library.recently_played.map((item, idx) => (
                <RecentItem 
                  key={item.song.song_id || idx}
                  item={item}
                  onPress={() => playSong(item.song, item.album, library.recently_played.map(r => ({ song: r.song, album: r.album })), idx)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color="#27272a" />
                <Text style={styles.emptyText}>No recent plays</Text>
              </View>
            )}
          </View>
        )}

        {/* Playlists */}
        {activeTab === 'playlists' && (
          <View>
            <TouchableOpacity style={styles.createPlaylistBtn} onPress={() => setShowCreatePlaylist(true)}>
              <View style={styles.createPlaylistIcon}>
                <Ionicons name="add" size={24} color="#000" />
              </View>
              <Text style={styles.createPlaylistText}>Create Playlist</Text>
            </TouchableOpacity>
            
            {library?.playlists?.length > 0 ? (
              library.playlists.map((playlist) => (
                <PlaylistCard 
                  key={playlist.playlist_id}
                  playlist={playlist}
                  onPress={() => navigation.navigate('Playlist', { playlistId: playlist.playlist_id })}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="list-outline" size={48} color="#27272a" />
                <Text style={styles.emptyText}>No playlists yet</Text>
              </View>
            )}
          </View>
        )}

        {/* Downloads */}
        {activeTab === 'downloads' && (
          <View>
            {downloads.length > 0 ? (
              downloads.map((song) => (
                <DownloadedSong
                  key={song.song_id}
                  song={song}
                  onPlay={() => playDownloadedSong(song)}
                  onDelete={deleteDownload}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="download-outline" size={48} color="#27272a" />
                <Text style={styles.emptyText}>No downloads yet</Text>
                <Text style={styles.emptySubtext}>Download songs to listen offline</Text>
              </View>
            )}
          </View>
        )}

        {/* Favorites */}
        {activeTab === 'favorites' && (
          <View>
            {library?.favorites?.filter(f => f.type === 'song').length > 0 ? (
              library.favorites.filter(f => f.type === 'song').map((fav, idx) => (
                <RecentItem 
                  key={fav.item?.song_id || idx}
                  item={{ song: fav.item, album: fav.album }}
                  onPress={() => playSong(fav.item, fav.album)}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={48} color="#27272a" />
                <Text style={styles.emptyText}>No liked songs</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Create Playlist Modal */}
      <Modal visible={showCreatePlaylist} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Playlist</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Playlist name"
              placeholderTextColor="#71717a"
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => { setShowCreatePlaylist(false); setNewPlaylistName(''); }}
              >
                <Text style={styles.modalButtonCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={createPlaylist}
              >
                <Text style={styles.modalButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {currentSong && <MiniPlayer navigation={navigation} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    backgroundColor: '#18181b',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  tabActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  tabText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  authPrompt: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  authTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 24,
    marginBottom: 8,
  },
  authText: {
    color: '#71717a',
    textAlign: 'center',
    marginBottom: 24,
  },
  authButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 50,
  },
  authButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#71717a',
    fontSize: 16,
    marginTop: 12,
  },
  emptySubtext: {
    color: '#52525b',
    fontSize: 14,
    marginTop: 4,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  recentThumb: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  recentImage: {
    width: '100%',
    height: '100%',
  },
  recentPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentInfo: {
    flex: 1,
  },
  recentTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  recentArtist: {
    color: '#71717a',
    fontSize: 13,
    marginTop: 2,
  },
  createPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  createPlaylistIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 12,
  },
  createPlaylistText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  playlistImage: {
    width: 56,
    height: 56,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  playlistCount: {
    color: '#71717a',
    fontSize: 13,
    marginTop: 2,
  },
  downloadedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  downloadedInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadedThumb: {
    width: 48,
    height: 48,
    backgroundColor: '#18181b',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  downloadedText: {
    flex: 1,
  },
  downloadedTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  downloadedArtist: {
    color: '#71717a',
    fontSize: 13,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  modalButtonPrimary: {
    backgroundColor: '#10b981',
  },
  modalButtonCancel: {
    color: '#71717a',
    fontWeight: '600',
  },
  modalButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
});
