import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, 
  StyleSheet, FlatList, ActivityIndicator, RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { libraryService, contentService } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import MiniPlayer from '../components/MiniPlayer';
import SongListItem from '../components/SongListItem';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');
import { Dimensions } from 'react-native';

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
        Playlist • {playlist.song_count || 0} songs
      </Text>
    </View>
  </TouchableOpacity>
);

const FavoriteCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.favoriteCard} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.favoriteArt}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.favoriteImg} />
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const { currentSong } = usePlayer();
  const { isAuthenticated, user } = useAuth();

  const fetchLibrary = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    try {
      const data = await libraryService.getLibrary();
      setLibrary(data);
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

  const onRefresh = () => {
    setRefreshing(true);
    fetchLibrary();
  };

  const handleCreatePlaylist = async () => {
    // Navigate to create playlist or show modal
  };

  const handleNowPlaying = () => {
    navigation.navigate('NowPlaying');
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
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
          <TouchableOpacity style={styles.profileBtn}>
            <LinearGradient colors={['#b83280', '#ff6b6b']} style={styles.profileGradient}>
              <Text style={styles.profileInitial}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Library</Text>
          <TouchableOpacity style={styles.addBtn}>
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
