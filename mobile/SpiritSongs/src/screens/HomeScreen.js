import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  FlatList,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { homeAPI, contentAPI, libraryAPI, bibleAPI, getImageUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import AddToPlaylistModal from '../components/AddToPlaylistModal';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.md * 3) / 2;

const HomeScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [layoutSections, setLayoutSections] = useState([]);
  const [featuredMixes, setFeaturedMixes] = useState([]);
  const [recentAlbums, setRecentAlbums] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [likedSongsCount, setLikedSongsCount] = useState(0);
  const [bibleSnippets, setBibleSnippets] = useState([]);
  const [heroContent, setHeroContent] = useState(null);
  
  // Add to playlist modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);

  const { playTrack, currentTrack } = usePlayer();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    updateGreeting();
    loadData();
  }, []);

  const updateGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [
        sectionsRes, 
        mixesRes, 
        albumsRes, 
        songsRes, 
        playlistsRes, 
        likesRes,
        snippetsRes,
        heroRes
      ] = await Promise.all([
        homeAPI.getSections().catch(() => ({ data: [] })),
        homeAPI.getSpecialMixes().catch(() => ({ data: [] })),
        contentAPI.getAlbums().catch(() => ({ data: [] })),
        contentAPI.getAllSongs().catch(() => ({ data: { songs: [] } })),
        libraryAPI.getPlaylists().catch(() => ({ data: [] })),
        libraryAPI.getLikedSongs().catch(() => ({ data: [] })),
        bibleAPI.getFeaturedSnippets().catch(() => ({ data: [] })),
        homeAPI.getHeroContent().catch(() => ({ data: null })),
      ]);

      // Layout sections
      const sections = sectionsRes.data?.sections || sectionsRes.data || [];
      setLayoutSections(sections.filter(s => s.is_active));

      // Featured mixes
      setFeaturedMixes(mixesRes.data?.mixes || mixesRes.data || []);

      // Albums
      const albums = albumsRes.data?.albums || albumsRes.data || [];
      setRecentAlbums(albums);

      // Songs with album thumbnails
      const songs = songsRes.data?.songs || [];
      const songsWithThumbnails = songs.map(song => {
        if (!song.thumbnail && !song.thumbnail_url) {
          const album = albums.find(a => a.album_id === song.album_id);
          if (album) {
            return { ...song, thumbnail: album.thumbnail || album.thumbnail_url };
          }
        }
        return song;
      });
      setAllSongs(songsWithThumbnails);

      // User playlists
      setUserPlaylists(playlistsRes.data || []);

      // Liked songs count
      const likes = likesRes.data?.songs || likesRes.data || [];
      setLikedSongsCount(likes.length);

      // Bible snippets
      setBibleSnippets(snippetsRes.data?.snippets || snippetsRes.data || []);

      // Hero content
      setHeroContent(heroRes.data);

    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handlePlaySong = (song, songList) => {
    const index = songList.findIndex(s => s.song_id === song.song_id);
    playTrack(song, songList, index >= 0 ? index : 0);
  };

  const handleAlbumPress = (album) => {
    navigation.navigate('Album', { album });
  };

  const handleMixPress = (mix) => {
    navigation.navigate('Playlist', { mix });
  };

  const handleAddToPlaylist = (song) => {
    setSelectedSong(song);
    setShowPlaylistModal(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting}</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon} onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="person-circle-outline" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Section */}
        {(heroContent || featuredMixes.length > 0) && (
          <TouchableOpacity 
            style={styles.heroContainer}
            onPress={() => featuredMixes[0] && handleMixPress(featuredMixes[0])}
            activeOpacity={0.9}
          >
            <ImageBackground
              source={{ uri: getImageUrl(heroContent?.thumbnail || featuredMixes[0]?.thumbnail) || 'https://via.placeholder.com/400' }}
              style={styles.heroImage}
              imageStyle={styles.heroImageStyle}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)', COLORS.background]}
                style={styles.heroGradient}
              >
                <Text style={styles.heroLabel}>FEATURED</Text>
                <Text style={styles.heroTitle}>
                  {heroContent?.title || featuredMixes[0]?.title || 'Featured Mix'}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {heroContent?.description || featuredMixes[0]?.description || 'Curated just for you'}
                </Text>
                <View style={styles.heroButtons}>
                  <TouchableOpacity style={styles.heroPlayButton}>
                    <Ionicons name="play" size={20} color={COLORS.background} />
                    <Text style={styles.heroPlayText}>Play</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        )}

        {/* Quick Access Grid - Spotify Style */}
        <View style={styles.quickAccessContainer}>
          {/* Liked Songs */}
          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Library')}
          >
            <LinearGradient colors={['#5D3FD3', '#7B68EE']} style={styles.quickAccessIcon}>
              <Ionicons name="heart" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Liked Songs</Text>
          </TouchableOpacity>

          {/* User Playlists (first 3) */}
          {userPlaylists.slice(0, 3).map((playlist) => (
            <TouchableOpacity 
              key={playlist.playlist_id}
              style={styles.quickAccessItem}
              onPress={() => navigation.navigate('Playlist', { playlist })}
            >
              <Image
                source={{ uri: getImageUrl(playlist.thumbnail) || 'https://via.placeholder.com/56' }}
                style={styles.quickAccessImage}
              />
              <Text style={styles.quickAccessText} numberOfLines={2}>{playlist.name}</Text>
            </TouchableOpacity>
          ))}

          {/* Fill remaining spots with albums */}
          {recentAlbums.slice(0, Math.max(0, 4 - userPlaylists.length - 1)).map((album) => (
            <TouchableOpacity 
              key={album.album_id}
              style={styles.quickAccessItem}
              onPress={() => handleAlbumPress(album)}
            >
              <Image
                source={{ uri: getImageUrl(album.thumbnail || album.thumbnail_url) || 'https://via.placeholder.com/56' }}
                style={styles.quickAccessImage}
              />
              <Text style={styles.quickAccessText} numberOfLines={2}>{album.title}</Text>
            </TouchableOpacity>
          ))}

          {/* Bible Quick Access */}
          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Bible')}
          >
            <LinearGradient colors={['#1DB954', '#169c46']} style={styles.quickAccessIcon}>
              <Ionicons name="book" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Biblia</Text>
          </TouchableOpacity>

          {/* Churches Quick Access */}
          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Churches')}
          >
            <LinearGradient colors={['#E91429', '#ff4757']} style={styles.quickAccessIcon}>
              <Ionicons name="business" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Makanisa</Text>
          </TouchableOpacity>
        </View>

        {/* Bible & Books Section - Horizontal Scroll */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bible & Books</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Bible')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bibleRow}>
            {/* Bible Main Card */}
            <TouchableOpacity 
              style={styles.bibleMainCard}
              onPress={() => navigation.navigate('Bible')}
            >
              <LinearGradient colors={['#1a472a', '#2d5a3d']} style={styles.bibleMainGradient}>
                <Ionicons name="book-outline" size={40} color={COLORS.primary} />
                <Text style={styles.bibleMainTitle}>Holy Bible</Text>
                <Text style={styles.bibleMainSubtitle}>Biblia Takatifu</Text>
                <View style={styles.bibleMainMeta}>
                  <Text style={styles.bibleMainMetaText}>66 Books</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Bible Snippets */}
            {bibleSnippets.slice(0, 5).map((snippet, index) => (
              <TouchableOpacity key={snippet.snippet_id || index} style={styles.snippetCard}>
                <LinearGradient colors={['#2a2a3a', '#1a1a2a']} style={styles.snippetGradient}>
                  <Ionicons name="musical-notes" size={24} color={COLORS.primary} />
                  <Text style={styles.snippetTitle} numberOfLines={2}>{snippet.title || snippet.reference}</Text>
                  <Text style={styles.snippetVerse} numberOfLines={2}>{snippet.text?.substring(0, 50)}...</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured Mixes - Large Horizontal Rectangles */}
        {featuredMixes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Mixes</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {featuredMixes.map((mix) => (
                <TouchableOpacity 
                  key={mix.mix_id} 
                  style={styles.largeMixCard}
                  onPress={() => handleMixPress(mix)}
                >
                  <Image
                    source={{ uri: getImageUrl(mix.thumbnail) || 'https://via.placeholder.com/280x150' }}
                    style={styles.largeMixImage}
                  />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.largeMixGradient}>
                    <Text style={styles.largeMixTitle} numberOfLines={1}>{mix.title}</Text>
                    <Text style={styles.largeMixSubtitle} numberOfLines={1}>{mix.song_count || 0} songs</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Recently Added - Small Square Cards */}
        {recentAlbums.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Added</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {recentAlbums.slice(0, 8).map((album) => (
                <TouchableOpacity 
                  key={album.album_id} 
                  style={styles.smallSquareCard}
                  onPress={() => handleAlbumPress(album)}
                >
                  <Image
                    source={{ uri: getImageUrl(album.thumbnail || album.thumbnail_url) || 'https://via.placeholder.com/120' }}
                    style={styles.smallSquareImage}
                  />
                  <Text style={styles.smallSquareTitle} numberOfLines={1}>{album.title}</Text>
                  <Text style={styles.smallSquareArtist} numberOfLines={1}>{album.artist_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Popular Songs - List View */}
        {allSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Popular Songs</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {allSongs.slice(0, 5).map((song, index) => (
              <TouchableOpacity 
                key={song.song_id} 
                style={styles.songListItem}
                onPress={() => handlePlaySong(song, allSongs)}
              >
                <Text style={[styles.songIndex, currentTrack?.song_id === song.song_id && styles.songIndexActive]}>
                  {currentTrack?.song_id === song.song_id ? (
                    <Ionicons name="musical-note" size={14} color={COLORS.primary} />
                  ) : index + 1}
                </Text>
                <Image
                  source={{ uri: getImageUrl(song.thumbnail || song.thumbnail_url) || 'https://via.placeholder.com/48' }}
                  style={styles.songImage}
                />
                <View style={styles.songInfo}>
                  <Text style={[styles.songTitle, currentTrack?.song_id === song.song_id && styles.songTitleActive]} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>{song.artist_name}</Text>
                </View>
                <TouchableOpacity style={styles.songAddButton} onPress={() => handleAddToPlaylist(song)}>
                  <Ionicons name="add-circle-outline" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* More Albums - Medium Cards */}
        {recentAlbums.length > 8 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>More to Explore</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {recentAlbums.slice(8, 16).map((album) => (
                <TouchableOpacity 
                  key={`more-${album.album_id}`} 
                  style={styles.mediumCard}
                  onPress={() => handleAlbumPress(album)}
                >
                  <Image
                    source={{ uri: getImageUrl(album.thumbnail || album.thumbnail_url) || 'https://via.placeholder.com/150' }}
                    style={styles.mediumCardImage}
                  />
                  <Text style={styles.mediumCardTitle} numberOfLines={2}>{album.title}</Text>
                  <Text style={styles.mediumCardSubtitle} numberOfLines={1}>{album.artist_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={selectedSong}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  greeting: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginLeft: SPACING.md,
    padding: SPACING.xs,
  },

  // Hero Section
  heroContainer: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 220,
  },
  heroImageStyle: {
    borderRadius: BORDER_RADIUS.lg,
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: SPACING.lg,
  },
  heroLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 2,
    marginBottom: SPACING.xs,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  heroButtons: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  heroPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  heroPlayText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
    marginLeft: SPACING.xs,
  },

  // Quick Access Grid
  quickAccessContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
  },
  quickAccessItem: {
    width: CARD_WIDTH,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.sm,
    margin: SPACING.xs,
    overflow: 'hidden',
  },
  quickAccessIcon: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessImage: {
    width: 56,
    height: 56,
  },
  quickAccessText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: SPACING.sm,
  },

  // Bible Section
  bibleRow: {
    paddingHorizontal: SPACING.md,
  },
  bibleMainCard: {
    width: 160,
    height: 180,
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  bibleMainGradient: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bibleMainTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  bibleMainSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bibleMainMeta: {
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  bibleMainMetaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
  },
  snippetCard: {
    width: 140,
    height: 180,
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  snippetGradient: {
    flex: 1,
    padding: SPACING.md,
  },
  snippetTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  snippetVerse: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },

  // Section Styles
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  seeAll: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  horizontalList: {
    paddingHorizontal: SPACING.md,
  },

  // Large Mix Cards (Horizontal Rectangles)
  largeMixCard: {
    width: 280,
    height: 150,
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  largeMixImage: {
    width: '100%',
    height: '100%',
  },
  largeMixGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
  },
  largeMixTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  largeMixSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Small Square Cards
  smallSquareCard: {
    width: 120,
    marginRight: SPACING.md,
  },
  smallSquareImage: {
    width: 120,
    height: 120,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
  },
  smallSquareTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  smallSquareArtist: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Medium Cards
  mediumCard: {
    width: 150,
    marginRight: SPACING.md,
  },
  mediumCardImage: {
    width: 150,
    height: 150,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
  },
  mediumCardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  mediumCardSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Song List
  songListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  songIndex: {
    width: 24,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  songIndexActive: {
    color: COLORS.primary,
  },
  songImage: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.card,
  },
  songInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  songTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  songTitleActive: {
    color: COLORS.primary,
  },
  songArtist: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  songAddButton: {
    padding: SPACING.sm,
  },
});

export default HomeScreen;
