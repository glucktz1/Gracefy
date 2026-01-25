import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { libraryAPI, getImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SongListItem, PlayAllHeader } from '../components/Cards';
import { usePlayer } from '../context/PlayerContext';
import { useBilling } from '../context/BillingContext';
import { showToast } from '../components/Toast';
import AddToPlaylistModal, { 
  SongActionsModal, 
  LoginRequiredModal, 
  SubscriptionRequiredModal 
} from '../components/AddToPlaylistModal';

const LibraryScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('playlists');
  const [playlists, setPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);

  const { isAuthenticated, user } = useAuth();
  const { playTrack, currentTrack } = usePlayer();
  const { billingEnabled, isPremium } = useBilling();

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
        libraryAPI.getPlaylists().catch(() => ({ data: { playlists: [] } })),
        libraryAPI.getLikedSongs().catch(() => ({ data: { songs: [] } })),
      ]);
      
      // Handle both response formats
      const playlistsData = playlistsRes.data?.playlists || playlistsRes.data || [];
      const likesData = likesRes.data?.songs || likesRes.data || [];
      
      console.log('Library data loaded:', { playlists: playlistsData.length, likes: likesData.length });
      
      setPlaylists(playlistsData);
      setLikedSongs(likesData);
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

  const handlePlayAll = (songList) => {
    if (songList.length > 0) {
      playTrack(songList[0], songList, 0);
    }
  };

  const handleShuffle = (songList) => {
    if (songList.length > 0) {
      const shuffled = [...songList].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled, 0);
    }
  };

  const handleSongMore = (song) => {
    setSelectedSong(song);
    setShowActionsModal(true);
  };

  const handleLikeSong = async (song) => {
    try {
      await libraryAPI.unlikeSong(song.song_id);
      setLikedSongs(prev => prev.filter(s => s.song_id !== song.song_id));
      showToast(`"${song.title}" imeondolewa ❌`, 'info');
    } catch (error) {
      console.error('Error unliking song:', error);
    }
  };

  const handleAddToPlaylist = (song) => {
    if (billingEnabled && !isPremium) {
      setShowSubscriptionModal(true);
      return;
    }
    setSelectedSong(song);
    setShowPlaylistModal(true);
  };

  const handleDownload = (song) => {
    if (billingEnabled && !isPremium) {
      setShowSubscriptionModal(true);
      return;
    }
    // Open the playlist modal which has download functionality
    setSelectedSong(song);
    setShowPlaylistModal(true);
  };

  const handleCreatePlaylist = () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (billingEnabled && !isPremium) {
      setShowSubscriptionModal(true);
      return;
    }
    // Open create playlist modal
    setSelectedSong(null);
    setShowPlaylistModal(true);
  };

  // Not logged in view
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Maktaba Yako</Text>
        </View>
        <View style={styles.notLoggedIn}>
          <Ionicons name="library-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.notLoggedInTitle}>Maktaba Yako ni Tupu</Text>
          <Text style={styles.notLoggedInText}>
            Ingia ili kuhifadhi nyimbo, kutengeneza playlist, na kupata maktaba yako
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Ingia</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tabs = [
    { id: 'playlists', label: 'Playlist' },
    { id: 'liked', label: 'Zilizopendwa' },
    { id: 'downloads', label: 'Zilizopakuwa' },
  ];

  const likedSongsSet = new Set(likedSongs.map(s => s.song_id));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={{ uri: user?.avatar || 'https://via.placeholder.com/32' }}
            style={styles.avatar}
          />
          <Text style={styles.title}>Maktaba Yako</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={handleCreatePlaylist}>
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
                <Text style={styles.likedSongsTitle}>Nyimbo Pendwa</Text>
                <Text style={styles.likedSongsCount}>{likedSongs.length} nyimbo</Text>
              </View>
              {likedSongs.length > 0 && (
                <TouchableOpacity 
                  style={styles.playIconButton}
                  onPress={() => handlePlayAll(likedSongs)}
                >
                  <Ionicons name="play" size={20} color={COLORS.background} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* User Playlists */}
            {playlists.map((playlist) => (
              <TouchableOpacity
                key={playlist.playlist_id}
                style={styles.playlistItem}
                onPress={() => navigation.navigate('Playlist', { playlist })}
              >
                <Image
                  source={{ uri: getImageUrl(playlist.thumbnail) || 'https://via.placeholder.com/56' }}
                  style={styles.playlistImage}
                />
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistTitle}>{playlist.name}</Text>
                  <Text style={styles.playlistMeta}>
                    Playlist • {playlist.song_count || 0} nyimbo
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {playlists.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Hakuna playlist bado</Text>
                <TouchableOpacity style={styles.createPlaylistButton} onPress={handleCreatePlaylist}>
                  <Text style={styles.createPlaylistText}>Tengeneza Playlist</Text>
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
                {/* Play All Header */}
                <PlayAllHeader
                  title="Nyimbo Pendwa"
                  songCount={likedSongs.length}
                  onPlayAll={() => handlePlayAll(likedSongs)}
                  onShuffle={() => handleShuffle(likedSongs)}
                />
                
                {likedSongs.map((song, index) => (
                  <SongListItem
                    key={song.song_id}
                    item={song}
                    index={index}
                    isPlaying={currentTrack?.song_id === song.song_id}
                    onPress={() => handlePlaySong(song, likedSongs)}
                    onMorePress={handleSongMore}
                  />
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={64} color={COLORS.textMuted} />
                <Text style={styles.emptyStateTitle}>Nyimbo unazopenda zitaonekana hapa</Text>
                <Text style={styles.emptyStateText}>Hifadhi nyimbo kwa kubofya ikoni ya moyo</Text>
              </View>
            )}
          </>
        )}

        {/* Downloads Tab */}
        {activeTab === 'downloads' && (
          <>
            {downloads.length > 0 ? (
              <>
                {/* Play All Header */}
                <PlayAllHeader
                  title="Zilizopakuwa"
                  songCount={downloads.length}
                  onPlayAll={() => handlePlayAll(downloads)}
                  onShuffle={() => handleShuffle(downloads)}
                />
                
                {downloads.map((song, index) => (
                  <SongListItem
                    key={song.song_id}
                    item={song}
                    index={index}
                    isPlaying={currentTrack?.song_id === song.song_id}
                    onPress={() => handlePlaySong(song, downloads)}
                    onMorePress={handleSongMore}
                  />
                ))}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="download-outline" size={64} color={COLORS.textMuted} />
                <Text style={styles.emptyStateTitle}>Hakuna zilizopakuwa bado</Text>
                <Text style={styles.emptyStateText}>
                  Pakua nyimbo ili kusikiliza bila mtandao
                </Text>
              </View>
            )}
          </>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Song Actions Modal */}
      <SongActionsModal
        visible={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        song={selectedSong}
        isLiked={selectedSong ? likedSongsSet.has(selectedSong.song_id) : false}
        isAuthenticated={isAuthenticated}
        billingEnabled={billingEnabled}
        isPremium={isPremium}
        onLike={handleLikeSong}
        onAddToPlaylist={(song) => {
          setShowActionsModal(false);
          handleAddToPlaylist(song);
        }}
        onDownload={handleDownload}
        onLoginRequired={() => {
          setShowActionsModal(false);
          setShowLoginModal(true);
        }}
        onSubscriptionRequired={() => {
          setShowActionsModal(false);
          setShowSubscriptionModal(true);
        }}
      />

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={selectedSong}
        isAuthenticated={isAuthenticated}
        billingEnabled={billingEnabled}
        isPremium={isPremium}
        onLoginRequired={() => {
          setShowPlaylistModal(false);
          setShowLoginModal(true);
        }}
        onSubscriptionRequired={() => {
          setShowPlaylistModal(false);
          setShowSubscriptionModal(true);
        }}
      />

      {/* Login Required Modal */}
      <LoginRequiredModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={() => {
          setShowLoginModal(false);
          navigation.navigate('Login');
        }}
      />

      {/* Subscription Required Modal */}
      <SubscriptionRequiredModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscribe={() => {
          setShowSubscriptionModal(false);
          navigation.navigate('Checkout');
        }}
      />
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
    flex: 1,
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
  playIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
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
