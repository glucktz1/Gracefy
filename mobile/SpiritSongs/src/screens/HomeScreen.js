import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
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
import { homeAPI, contentAPI, libraryAPI, bibleAPI, churchAPI, getImageUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import AddToPlaylistModal from '../components/AddToPlaylistModal';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - SPACING.md * 3) / 2;
const HERO_WIDTH = width - SPACING.md * 2;

const HomeScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('');
  
  // Layout Manager Data
  const [layoutSections, setLayoutSections] = useState([]);
  const [heroContent, setHeroContent] = useState({ items: [] });
  const [quickAccessConfig, setQuickAccessConfig] = useState([]);
  
  // Content Data
  const [specialMixes, setSpecialMixes] = useState([]);
  const [recentAlbums, setRecentAlbums] = useState([]);
  const [allSongs, setAllSongs] = useState([]);
  const [userPlaylists, setUserPlaylists] = useState([]);
  const [likedSongsCount, setLikedSongsCount] = useState(0);
  const [bibleSnippets, setBibleSnippets] = useState([]);
  const [churches, setChurches] = useState([]);
  const [leaderContent, setLeaderContent] = useState([]);
  
  // Additional sections from Layout Manager
  const [lentSongs, setLentSongs] = useState([]);
  const [christmasSongs, setChristmasSongs] = useState([]);
  const [mostListenedAlbums, setMostListenedAlbums] = useState([]);
  const [hotNewReleases, setHotNewReleases] = useState([]);
  
  // Hero Carousel State
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const heroScrollRef = useRef(null);
  const heroIntervalRef = useRef(null);
  
  // Add to playlist modal
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);

  const { playTrack, currentTrack } = usePlayer();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    updateGreeting();
    loadData();
    return () => {
      if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
    };
  }, []);

  // Auto-rotate hero carousel
  useEffect(() => {
    if (heroContent?.items?.length > 1) {
      heroIntervalRef.current = setInterval(() => {
        setCurrentHeroIndex(prev => {
          const nextIndex = (prev + 1) % heroContent.items.length;
          heroScrollRef.current?.scrollTo({ x: nextIndex * HERO_WIDTH, animated: true });
          return nextIndex;
        });
      }, heroContent.rotation_interval || 5000);
    }
    return () => {
      if (heroIntervalRef.current) clearInterval(heroIntervalRef.current);
    };
  }, [heroContent]);

  const updateGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Habari ya asubuhi');
    else if (hour < 18) setGreeting('Habari ya mchana');
    else setGreeting('Habari ya jioni');
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [
        sectionsRes, 
        heroRes,
        mixesRes, 
        albumsRes, 
        songsRes, 
        playlistsRes, 
        likesRes,
        snippetsRes,
        churchesRes,
        leadersRes,
      ] = await Promise.all([
        homeAPI.getSections().catch(() => ({ data: [] })),
        homeAPI.getHeroContent().catch(() => ({ data: { items: [] } })),
        homeAPI.getSpecialMixes().catch(() => ({ data: { mixes: [] } })),
        contentAPI.getAlbums().catch(() => ({ data: { albums: [] } })),
        contentAPI.getAllSongs().catch(() => ({ data: { songs: [] } })),
        libraryAPI.getPlaylists().catch(() => ({ data: [] })),
        libraryAPI.getLikedSongs().catch(() => ({ data: [] })),
        bibleAPI.getFeaturedSnippets().catch(() => ({ data: [] })),
        churchAPI.getChurches().catch(() => ({ data: { churches: [] } })),
        homeAPI.getLeaderContent().catch(() => ({ data: { leaders: [] } })),
      ]);

      // Layout sections
      const sections = sectionsRes.data?.sections || sectionsRes.data || [];
      setLayoutSections(sections.filter(s => s.is_active));

      // Hero content from Layout Manager
      setHeroContent(heroRes.data || { items: [] });

      // Special mixes
      const mixes = mixesRes.data?.mixes || mixesRes.data || [];
      setSpecialMixes(mixes);

      // Albums
      const albums = albumsRes.data?.albums || albumsRes.data || [];
      setRecentAlbums(albums);

      // Songs with album thumbnails fallback
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

      // Churches
      setChurches(churchesRes.data?.churches || churchesRes.data || []);

      // Leader content (Mafundisho na Katekesi)
      setLeaderContent(leadersRes.data?.leaders || leadersRes.data || []);

      // Extract Quick Access config from layout sections
      const quickAccessSection = sections.find(s => 
        s.section_type === 'quick_access' || s.name === 'quick_access'
      );
      if (quickAccessSection?.content_items) {
        setQuickAccessConfig(quickAccessSection.content_items);
      }

      // Load additional sections from layout manager
      loadLayoutSections(sections, albums, mixes);

    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLayoutSections = (sections, albums, mixes) => {
    // Find Lent songs section
    const lentSection = sections.find(s => 
      s.name?.toLowerCase().includes('lent') || 
      s.name?.toLowerCase().includes('kwaresima') ||
      s.section_type === 'nyimbo_za_kwaresima'
    );
    if (lentSection?.content_items) {
      setLentSongs(lentSection.content_items);
    }

    // Find Christmas songs section
    const christmasSection = sections.find(s => 
      s.name?.toLowerCase().includes('christmas') || 
      s.name?.toLowerCase().includes('krismasi') ||
      s.section_type === 'nyimbo_za_krismasi'
    );
    if (christmasSection?.content_items) {
      setChristmasSongs(christmasSection.content_items);
    }

    // Most listened albums
    const mostListenedSection = sections.find(s => 
      s.name?.toLowerCase().includes('zinazosikilizwa') ||
      s.section_type === 'zinazosikilizwa_zaidi'
    );
    if (mostListenedSection?.content_items) {
      setMostListenedAlbums(mostListenedSection.content_items);
    } else {
      // Fallback to regular albums sorted by plays
      setMostListenedAlbums(albums.slice(0, 6));
    }

    // Hot new releases
    const hotSection = sections.find(s => 
      s.name?.toLowerCase().includes('moto') ||
      s.name?.toLowerCase().includes('mpya') ||
      s.section_type === 'mpya'
    );
    if (hotSection?.content_items) {
      setHotNewReleases(hotSection.content_items);
    } else {
      // Fallback to recent albums
      setHotNewReleases(albums.slice(0, 6));
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

  const handleHeroPress = (item) => {
    if (item.album_id) {
      navigation.navigate('Album', { album: item });
    } else if (item.mix_id) {
      navigation.navigate('Playlist', { mix: item });
    }
  };

  const handleHeroScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / HERO_WIDTH);
    setCurrentHeroIndex(index);
  };

  // Handle Mafundisho card play button
  const handleMafundishoPlay = (leader) => {
    // Navigate to leader's content/playlist
    navigation.navigate('Playlist', { 
      mix: { 
        mix_id: leader.leader_id, 
        title: leader.name,
        thumbnail: leader.photo 
      } 
    });
  };

  // Handle Mafundisho add button
  const handleMafundishoAdd = (leader) => {
    // Show add options for leader content
    setSelectedSong({
      song_id: leader.leader_id,
      title: leader.name,
      thumbnail: leader.photo,
      artist_name: leader.title || 'Mafundisho'
    });
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

        {/* Hero Carousel - Layout Manager Controlled */}
        {heroContent?.items?.length > 0 && (
          <View style={styles.heroSection}>
            <ScrollView
              ref={heroScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleHeroScroll}
              contentContainerStyle={styles.heroScrollContent}
            >
              {heroContent.items.map((item, index) => (
                <TouchableOpacity 
                  key={item.album_id || item.mix_id || index}
                  style={styles.heroContainer}
                  onPress={() => handleHeroPress(item)}
                  activeOpacity={0.9}
                >
                  <ImageBackground
                    source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/400' }}
                    style={styles.heroImage}
                    imageStyle={styles.heroImageStyle}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.7)', COLORS.background]}
                      style={styles.heroGradient}
                    >
                      <Text style={styles.heroLabel}>FEATURED</Text>
                      <Text style={styles.heroTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.heroSubtitle} numberOfLines={1}>
                        {item.artist_name || item.description || 'Curated for you'}
                      </Text>
                      <View style={styles.heroButtons}>
                        <TouchableOpacity style={styles.heroPlayButton}>
                          <Ionicons name="play" size={20} color={COLORS.background} />
                          <Text style={styles.heroPlayText}>Cheza</Text>
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </ImageBackground>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {/* Pagination Dots */}
            {heroContent.items.length > 1 && (
              <View style={styles.heroPagination}>
                {heroContent.items.map((_, index) => (
                  <View 
                    key={index} 
                    style={[styles.heroDot, currentHeroIndex === index && styles.heroDotActive]} 
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Quick Access Grid - 8 items (4 on each row) - Layout Manager Controlled */}
        <View style={styles.quickAccessContainer}>
          {/* Row 1: Liked Songs, User Playlist 1, Downloads, User Playlist 2 */}
          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Library')}
          >
            <LinearGradient colors={['#5D3FD3', '#7B68EE']} style={styles.quickAccessIcon}>
              <Ionicons name="heart" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Nyimbo Pendwa</Text>
          </TouchableOpacity>

          {userPlaylists[0] ? (
            <TouchableOpacity 
              style={styles.quickAccessItem}
              onPress={() => navigation.navigate('Playlist', { playlist: userPlaylists[0] })}
            >
              <Image
                source={{ uri: getImageUrl(userPlaylists[0].thumbnail) || 'https://via.placeholder.com/56' }}
                style={styles.quickAccessImage}
              />
              <Text style={styles.quickAccessText} numberOfLines={2}>{userPlaylists[0].name}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.quickAccessItem}
              onPress={() => navigation.navigate('Library')}
            >
              <LinearGradient colors={['#1DB954', '#169c46']} style={styles.quickAccessIcon}>
                <Ionicons name="add" size={20} color={COLORS.text} />
              </LinearGradient>
              <Text style={styles.quickAccessText} numberOfLines={2}>Playlist Mpya</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Library')}
          >
            <LinearGradient colors={['#E91429', '#ff4757']} style={styles.quickAccessIcon}>
              <Ionicons name="download" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Zilizopakuwa</Text>
          </TouchableOpacity>

          {userPlaylists[1] ? (
            <TouchableOpacity 
              style={styles.quickAccessItem}
              onPress={() => navigation.navigate('Playlist', { playlist: userPlaylists[1] })}
            >
              <Image
                source={{ uri: getImageUrl(userPlaylists[1].thumbnail) || 'https://via.placeholder.com/56' }}
                style={styles.quickAccessImage}
              />
              <Text style={styles.quickAccessText} numberOfLines={2}>{userPlaylists[1].name}</Text>
            </TouchableOpacity>
          ) : recentAlbums[0] ? (
            <TouchableOpacity 
              style={styles.quickAccessItem}
              onPress={() => handleAlbumPress(recentAlbums[0])}
            >
              <Image
                source={{ uri: getImageUrl(recentAlbums[0].thumbnail || recentAlbums[0].thumbnail_url) || 'https://via.placeholder.com/56' }}
                style={styles.quickAccessImage}
              />
              <Text style={styles.quickAccessText} numberOfLines={2}>{recentAlbums[0].title}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.quickAccessItem} />
          )}

          {/* Row 2: Bible, Churches, Album 1, Album 2 */}
          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Bible')}
          >
            <LinearGradient colors={['#1a472a', '#2d5a3d']} style={styles.quickAccessIcon}>
              <Ionicons name="book" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Biblia</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickAccessItem}
            onPress={() => navigation.navigate('Churches')}
          >
            <LinearGradient colors={['#FF6B35', '#f5a623']} style={styles.quickAccessIcon}>
              <Ionicons name="business" size={20} color={COLORS.text} />
            </LinearGradient>
            <Text style={styles.quickAccessText} numberOfLines={2}>Makanisa</Text>
          </TouchableOpacity>

          {recentAlbums[1] ? (
            <TouchableOpacity 
              style={styles.quickAccessItem}
              onPress={() => handleAlbumPress(recentAlbums[1])}
            >
              <Image
                source={{ uri: getImageUrl(recentAlbums[1].thumbnail || recentAlbums[1].thumbnail_url) || 'https://via.placeholder.com/56' }}
                style={styles.quickAccessImage}
              />
              <Text style={styles.quickAccessText} numberOfLines={2}>{recentAlbums[1].title}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.quickAccessItem} />
          )}

          {recentAlbums[2] ? (
            <TouchableOpacity 
              style={styles.quickAccessItem}
              onPress={() => handleAlbumPress(recentAlbums[2])}
            >
              <Image
                source={{ uri: getImageUrl(recentAlbums[2].thumbnail || recentAlbums[2].thumbnail_url) || 'https://via.placeholder.com/56' }}
                style={styles.quickAccessImage}
              />
              <Text style={styles.quickAccessText} numberOfLines={2}>{recentAlbums[2].title}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.quickAccessItem} />
          )}
        </View>

        {/* Mafundisho na Katekesi - Spotify "Picked for you" Style */}
        {leaderContent.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mafundisho na Katekesi</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>Ona yote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {leaderContent.map((leader) => (
                <TouchableOpacity 
                  key={leader.leader_id} 
                  style={styles.mafundishoCard}
                  activeOpacity={0.9}
                  onPress={() => handleMafundishoPlay(leader)}
                >
                  {/* Purple Accent Band */}
                  <View style={styles.mafundishoBand}>
                    <Text style={styles.mafundishoBandText}>MAFUNDISHO</Text>
                  </View>
                  
                  {/* Leader Photo */}
                  <Image
                    source={{ uri: getImageUrl(leader.photo) || 'https://via.placeholder.com/200' }}
                    style={styles.mafundishoImage}
                  />
                  
                  {/* Content Info */}
                  <View style={styles.mafundishoInfo}>
                    <Text style={styles.mafundishoType}>Teachings</Text>
                    <Text style={styles.mafundishoTitle} numberOfLines={2}>{leader.name}</Text>
                    <Text style={styles.mafundishoDesc} numberOfLines={2}>
                      {leader.title || leader.church_name || 'Mafundisho ya Imani'}
                    </Text>
                    
                    {/* Action Icons */}
                    <View style={styles.mafundishoActions}>
                      <TouchableOpacity 
                        style={styles.mafundishoAddBtn}
                        onPress={() => handleMafundishoAdd(leader)}
                      >
                        <Ionicons name="add-circle-outline" size={28} color={COLORS.textSecondary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.mafundishoPlayBtn}
                        onPress={() => handleMafundishoPlay(leader)}
                      >
                        <Ionicons name="play" size={24} color={COLORS.background} />
                      </TouchableOpacity>
                    </View>
                    
                    {/* Three dots menu */}
                    <TouchableOpacity style={styles.mafundishoMenu}>
                      <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Nyimbo za Kwaresma (Lent Songs) */}
        {lentSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nyimbo za Kwaresma</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>Ona yote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {lentSongs.map((item, index) => (
                <TouchableOpacity 
                  key={item.album_id || item.song_id || index} 
                  style={styles.smallSquareCard}
                  onPress={() => item.album_id ? handleAlbumPress(item) : handlePlaySong(item, lentSongs)}
                >
                  <Image
                    source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/120' }}
                    style={styles.smallSquareImage}
                  />
                  <Text style={styles.smallSquareTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.smallSquareArtist} numberOfLines={1}>{item.artist_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Nyimbo za Krismasi (Christmas Songs) */}
        {christmasSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nyimbo za Krismasi</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>Ona yote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {christmasSongs.map((item, index) => (
                <TouchableOpacity 
                  key={item.album_id || item.song_id || index} 
                  style={styles.smallSquareCard}
                  onPress={() => item.album_id ? handleAlbumPress(item) : handlePlaySong(item, christmasSongs)}
                >
                  <Image
                    source={{ uri: getImageUrl(item.thumbnail || item.thumbnail_url) || 'https://via.placeholder.com/120' }}
                    style={styles.smallSquareImage}
                  />
                  <Text style={styles.smallSquareTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.smallSquareArtist} numberOfLines={1}>{item.artist_name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Mchanganyiko Maalumu (Special Mixes) */}
        {specialMixes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mchanganyiko Maalumu</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>Ona yote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {specialMixes.map((mix) => (
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
                    <Text style={styles.largeMixSubtitle} numberOfLines={1}>
                      {mix.songs_count || mix.songs?.length || 0} nyimbo
                    </Text>
                  </LinearGradient>
                  <TouchableOpacity style={styles.mixPlayButton}>
                    <Ionicons name="play" size={24} color={COLORS.background} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Album Zinazosikilizwa Zaidi (Most Listened Albums) */}
        {mostListenedAlbums.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Album Zinazosikilizwa Zaidi</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>Ona yote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {mostListenedAlbums.map((album, index) => (
                <TouchableOpacity 
                  key={album.album_id || index} 
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

        {/* Mpya za Moto (Hot New Releases) */}
        {hotNewReleases.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mpya za Moto 🔥</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>Ona yote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {hotNewReleases.map((album, index) => (
                <TouchableOpacity 
                  key={album.album_id || index} 
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

        {/* Bible & Books Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Biblia na Vitabu</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Bible')}>
              <Text style={styles.seeAll}>Ona yote</Text>
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
                <Text style={styles.bibleMainTitle}>Biblia Takatifu</Text>
                <Text style={styles.bibleMainSubtitle}>Swahili TTS</Text>
                <View style={styles.bibleMainMeta}>
                  <Ionicons name="headset-outline" size={12} color={COLORS.text} />
                  <Text style={styles.bibleMainMetaText}> Sikiliza</Text>
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

        {/* Churches (Makanisa) Section */}
        {churches.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Makanisa</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Churches')}>
                <Text style={styles.seeAll}>Ona yote</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
              {churches.slice(0, 6).map((church) => (
                <TouchableOpacity 
                  key={church.church_id} 
                  style={styles.churchCard}
                  onPress={() => navigation.navigate('Churches', { selectedChurch: church })}
                >
                  <Image
                    source={{ uri: getImageUrl(church.thumbnail) || 'https://via.placeholder.com/140?text=Kanisa' }}
                    style={styles.churchImage}
                  />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.churchGradient}>
                    <Ionicons name="business" size={16} color={COLORS.primary} style={styles.churchIcon} />
                    <Text style={styles.churchName} numberOfLines={2}>{church.name}</Text>
                    <Text style={styles.churchLocation} numberOfLines={1}>
                      {church.location || church.city}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Popular Songs */}
        {allSongs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nyimbo Maarufu</Text>
              <TouchableOpacity>
                <Text style={styles.seeAll}>Ona yote</Text>
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
                  <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bottom spacing for mini player */}
        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={selectedSong}
        isAuthenticated={isAuthenticated}
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

  // Hero Carousel Section
  heroSection: {
    marginBottom: SPACING.lg,
  },
  heroScrollContent: {
    paddingHorizontal: SPACING.md,
  },
  heroContainer: {
    width: HERO_WIDTH,
    marginRight: SPACING.md,
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
  heroPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textMuted,
    marginHorizontal: 4,
  },
  heroDotActive: {
    backgroundColor: COLORS.primary,
    width: 24,
  },

  // Quick Access Grid - 8 items (4 per row)
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

  // Mafundisho na Katekesi - Spotify "Picked for you" Style
  mafundishoCard: {
    width: 320,
    height: 180,
    marginRight: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  mafundishoBand: {
    width: 32,
    backgroundColor: '#7B2CBF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mafundishoBandText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: 'bold',
    transform: [{ rotate: '-90deg' }],
    width: 100,
    textAlign: 'center',
    letterSpacing: 2,
  },
  mafundishoImage: {
    width: 130,
    height: '100%',
  },
  mafundishoInfo: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'center',
  },
  mafundishoType: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  mafundishoTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  mafundishoDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  mafundishoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  mafundishoAddBtn: {
    marginRight: SPACING.md,
  },
  mafundishoPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mafundishoMenu: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
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

  // Large Mix Cards with Play Button
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
  mixPlayButton: {
    position: 'absolute',
    bottom: SPACING.md,
    right: SPACING.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
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

  // Churches Section
  churchCard: {
    width: 140,
    height: 180,
    marginRight: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  churchImage: {
    width: '100%',
    height: '100%',
  },
  churchGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    padding: SPACING.sm,
    justifyContent: 'flex-end',
  },
  churchIcon: {
    marginBottom: 4,
  },
  churchName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  churchLocation: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Small Square Cards (Albums)
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
