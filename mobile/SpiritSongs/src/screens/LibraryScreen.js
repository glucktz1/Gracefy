import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { libraryAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MediumCard, SongListItem } from '../components/Cards';
import { usePlayer } from '../context/PlayerContext';

const LibraryScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('playlists');
  const [playlists, setPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);

  const { isAuthenticated, user } = useAuth();
  const { playTrack, currentTrack } = usePlayer();

  useEffect(() => {
    if (isAuthenticated) {
      loadLibraryData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadLibraryData = async () => {
    try {
      const [playlistsRes, likesRes] = await Promise.all([
        libraryAPI.getPlaylists().catch(() => ({ data: [] })),
        libraryAPI.getLikedSongs().catch(() => ({ data: [] })),
      ]);
      
      setPlaylists(playlistsRes.data || []);
      setLikedSongs(likesRes.data?.songs || likesRes.data || []);
    } catch (error) {
      console.error('Error loading library:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaySong = (song, songList) => {
    const index = songList.findIndex(s => s.song_id === song.song_id);
    playTrack(song, songList, index >= 0 ? index : 0);
  };

  // Not logged in view
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Library</Text>
        </View>
        <View style={styles.notLoggedIn}>
          <Ionicons name="library-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.notLoggedInTitle}>Your Library is Empty</Text>
          <Text style={styles.notLoggedInText}>
            Log in to save songs, create playlists, and access your library
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tabs = [
    { id: 'playlists', label: 'Playlists' },
    { id: 'liked', label: 'Liked Songs' },
    { id: 'downloads', label: 'Downloads' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={{ uri: user?.avatar || 'https://via.placeholder.com/32' }}
            style={styles.avatar}
          />
          <Text style={styles.title}>Your Library</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="add" size={28} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Playlists Tab */}
        {activeTab === 'playlists' && (
          <>
            {/* Liked Songs Card */}
            <TouchableOpacity 
              style={styles.likedSongsCard}
              onPress={() => setActiveTab('liked')}
            >
              <View style={styles.likedSongsGradient}>
                <Ionicons name="heart" size={24} color={COLORS.text} />
              </View>
              <View style={styles.likedSongsInfo}>
                <Text style={styles.likedSongsTitle}>Liked Songs</Text>
                <Text style={styles.likedSongsCount}>{likedSongs.length} songs</Text>
              </View>
            </TouchableOpacity>

            {/* User Playlists */}
            {playlists.map((playlist) => (
              <TouchableOpacity
                key={playlist.playlist_id}
                style={styles.playlistItem}
                onPress={() => navigation.navigate('Playlist', { playlist })}
              >
                <Image
                  source={{ uri: playlist.thumbnail || 'https://via.placeholder.com/56' }}
                  style={styles.playlistImage}
                />
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistTitle}>{playlist.name}</Text>
                  <Text style={styles.playlistMeta}>
                    Playlist • {playlist.song_count || 0} songs
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {playlists.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No playlists yet</Text>
                <TouchableOpacity style={styles.createPlaylistButton}>
                  <Text style={styles.createPlaylistText}>Create Playlist</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        {/* Liked Songs Tab */}
        {activeTab === 'liked' && (
          <>
            {likedSongs.length > 0 ? (
              <>
                <TouchableOpacity style={styles.shuffleButton}>
                  <Ionicons name="shuffle" size={20} color={COLORS.background} />
                  <Text style={styles.shuffleText}>Shuffle Play</Text>
                </TouchableOpacity>
                {likedSongs.map((song, index) => (
                  <SongListItem
                    key={song.song_id}
                    item={song}
                    index={index}
                    isPlaying={currentTrack?.song_id === song.song_id}
                    onPress={() => handlePlaySong(song, likedSongs)}
                  />
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={64} color={COLORS.textMuted} />
                <Text style={styles.emptyStateTitle}>Songs you like will appear here</Text>
                <Text style={styles.emptyStateText}>Save songs by tapping the heart icon</Text>
              </View>
            )}
          </>
        )}

        {/* Downloads Tab */}
        {activeTab === 'downloads' && (
          <View style={styles.emptyState}>
            <Ionicons name="download-outline" size={64} color={COLORS.textMuted} />
            <Text style={styles.emptyStateTitle}>No downloads yet</Text>
            <Text style={styles.emptyStateText}>
              Download songs to listen offline
            </Text>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 150 }} />
      </ScrollView>
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
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: SPACING.md,
    backgroundColor: COLORS.card,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerIcon: {
    marginLeft: SPACING.md,
    padding: SPACING.xs,
  },
  tabsContainer: {
    maxHeight: 50,
  },
  tabsContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.card,
    marginRight: SPACING.sm,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  tabTextActive: {
    color: COLORS.background,
  },
  content: {
    flex: 1,
  },
  likedSongsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
  },
  likedSongsGradient: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likedSongsInfo: {
    marginLeft: SPACING.md,
  },
  likedSongsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  likedSongsCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  playlistImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
  },
  playlistInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  playlistTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  playlistMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  shuffleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  shuffleText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
    marginLeft: SPACING.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  emptyStateTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  createPlaylistButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.full,
  },
  createPlaylistText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
  },
  notLoggedIn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  notLoggedInTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.lg,
  },
  notLoggedInText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  loginButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.full,
  },
  loginButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
  },
});

export default LibraryScreen;
