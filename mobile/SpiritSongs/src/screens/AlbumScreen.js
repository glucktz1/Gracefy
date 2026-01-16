import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, 
  StyleSheet, Dimensions, ActivityIndicator, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { contentService, getThumbnailUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useSubscription } from '../context/SubscriptionContext';
import { downloadSong, isSongDownloaded } from '../services/downloadService';
import SongListItem from '../components/SongListItem';
import MiniPlayer from '../components/MiniPlayer';
import PlaylistModal from '../components/PlaylistModal';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

// Cache for album data
const albumCache = new Map();

export default function AlbumScreen({ route, navigation }) {
  const { albumId } = route.params || {};
  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const { playSong, currentSong, isPlaying, togglePlay } = usePlayer();
  const { 
    isPremium, 
    canPerformAction, 
    showUpgradePrompt,
    isShuffleForced,
    isPremiumContent,
    features,
  } = useSubscription();

  // Navigate to subscription screen
  const goToSubscription = (feature) => {
    navigation.navigate('Subscription', { lockedFeature: feature });
  };

  useEffect(() => {
    if (albumId) {
      fetchAlbum();
    } else {
      console.error('No albumId provided to AlbumScreen');
      setError('No album ID provided');
      setLoading(false);
    }
  }, [albumId, retryCount]);

  const fetchAlbum = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check cache first
      const cacheKey = `album_${albumId}`;
      const cached = albumCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 60000) {
        setAlbum(cached.album);
        setSongs(cached.songs);
        setLoading(false);
        return;
      }
      
      console.log('Fetching album:', albumId);
      
      // Fetch with timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      try {
        const data = await contentService.getAlbum(albumId);
        clearTimeout(timeoutId);
        
        console.log('Raw API response:', JSON.stringify(data).substring(0, 200));
        
        // Handle different response formats
        let albumData, songsData;
        
        if (data.album) {
          albumData = data.album;
          songsData = data.songs || [];
        } else if (data.title) {
          // Direct album object
          albumData = data;
          songsData = data.songs || [];
        } else {
          throw new Error('Invalid album data format');
        }
        
        console.log('Album:', albumData?.title, 'Songs:', songsData?.length);
        
        // Cache the result
        albumCache.set(cacheKey, {
          album: albumData,
          songs: songsData,
          timestamp: Date.now()
        });
        
        setAlbum(albumData);
        setSongs(songsData || []);
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
      
    } catch (err) {
      console.error('Error fetching album:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Could not load album';
      setError(errorMessage);
      
      // Only show alert for non-network errors or after retries
      if (retryCount >= 2 || !err.message?.includes('Network')) {
        Alert.alert('Error', 'Could not load album. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  // Pre-build the queue
  const songQueue = useMemo(() => {
    return songs.map(song => ({ song, album }));
  }, [songs, album]);

  // Check if album is premium content
  const isAlbumPremium = useMemo(() => {
    return album && isPremiumContent(album);
  }, [album, isPremiumContent]);

  // Handle song selection with subscription check
  const handleSongSelect = useCallback((song, index) => {
    // Check if user can select specific songs
    if (!isPremium && !features.song_selection) {
      // Free users - can't choose specific songs, show upgrade prompt
      Alert.alert(
        'Premium Feature',
        'Choosing specific songs is a premium feature. Free users can only use shuffle play.',
        [
          { text: 'Shuffle Play', onPress: handleShuffle },
          { text: 'Upgrade', onPress: () => goToSubscription('select_song'), style: 'default' },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    
    // Check if content is premium-only
    if (isAlbumPremium && !isPremium) {
      showUpgradePrompt('premium_content', goToSubscription);
      return;
    }
    
    // Premium user or free feature - play the song
    playSong(song, album, songQueue, index);
  }, [isPremium, features, isAlbumPremium, showUpgradePrompt, goToSubscription, playSong, album, songQueue]);

  const handlePlayAll = useCallback(() => {
    if (songs.length > 0) {
      // Check if content is premium-only
      if (isAlbumPremium && !isPremium) {
        showUpgradePrompt('premium_content', goToSubscription);
        return;
      }
      
      // Free users - shuffle forced
      if (!isPremium && isShuffleForced()) {
        handleShuffle();
        return;
      }
      
      playSong(songs[0], album, songQueue, 0);
    }
  }, [songs, album, songQueue, playSong, isPremium, isShuffleForced, isAlbumPremium, showUpgradePrompt, goToSubscription]);

  const handleShuffle = useCallback(() => {
    if (songs.length > 0) {
      // Check if content is premium-only
      if (isAlbumPremium && !isPremium) {
        showUpgradePrompt('premium_content', goToSubscription);
        return;
      }
      
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      const shuffledQueue = shuffled.map(song => ({ song, album }));
      playSong(shuffled[0], album, shuffledQueue, 0);
    }
  }, [songs, album, playSong, isAlbumPremium, isPremium, showUpgradePrompt, goToSubscription]);

  const handleAddToPlaylist = useCallback((song) => {
    // Check if user can create playlists
    if (!canPerformAction('create_playlist')) {
      showUpgradePrompt('create_playlist', goToSubscription);
      return;
    }
    setSelectedSong(song);
    setShowPlaylistModal(true);
  }, [canPerformAction, showUpgradePrompt, goToSubscription]);

  const handleDownloadSong = useCallback(async (song) => {
    // Check if user can download
    if (!canPerformAction('download')) {
      showUpgradePrompt('download', goToSubscription);
      return;
    }
    
    try {
      const isDownloaded = await isSongDownloaded(song.song_id);
      if (isDownloaded) {
        Alert.alert('Already Downloaded', 'This song is already available offline.');
        return;
      }
      
      await downloadSong(song, album, (progress) => {
        console.log(`Download progress: ${Math.round(progress * 100)}%`);
      });
      
      Alert.alert('Download Complete', `"${song.title}" is now available offline.`);
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Failed', 'Could not download this song. Please try again.');
    }
  }, [album, canPerformAction, showUpgradePrompt, goToSubscription]);

  const handleDownloadAll = async () => {
    // Check if user can download
    if (!canPerformAction('download')) {
      showUpgradePrompt('download', goToSubscription);
      return;
    }
    
    if (!songs.length) return;
    
    Alert.alert(
      'Download Album',
      `Download all ${songs.length} songs for offline listening?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: async () => {
            setDownloadingAll(true);
            let downloaded = 0;
            let failed = 0;
            
            for (const song of songs) {
              try {
                const isDownloaded = await isSongDownloaded(song.song_id);
                if (!isDownloaded) {
                  await downloadSong(song, album);
                  downloaded++;
                }
              } catch (error) {
                failed++;
                console.error('Failed to download:', song.title, error);
              }
            }
            
            setDownloadingAll(false);
            Alert.alert(
              'Download Complete',
              `Downloaded ${downloaded} songs${failed > 0 ? `. ${failed} failed.` : '.'}`
            );
          }
        }
      ]
    );
  };

  const handleNowPlaying = useCallback(() => {
    navigation.navigate('NowPlaying');
  }, [navigation]);

  const isAlbumPlaying = currentSong && songs.some(s => s.song_id === currentSong.song_id);

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e91e63" />
        <Text style={styles.loadingText}>Loading album...</Text>
      </View>
    );
  }

  // Error state
  if (error || !album) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="disc-outline" size={64} color={COLORS.textMuted} />
        <Text style={styles.errorText}>{error || 'Album not found'}</Text>
        <View style={styles.errorButtons}>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Ionicons name="refresh" size={20} color="#000" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const totalDuration = songs.reduce((acc, song) => acc + (song.duration || 0), 0);
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours} hr ${mins} min`;
    return `${mins} min`;
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, currentSong && { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Album Art */}
        <LinearGradient
          colors={['#404040', COLORS.background]}
          style={styles.headerGradient}
        >
          {/* Back Button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Album Art */}
          <View style={styles.artContainer}>
            {album.thumbnail ? (
              <Image source={{ uri: getThumbnailUrl(album.thumbnail) }} style={styles.albumArt} />
            ) : (
              <LinearGradient colors={['#535353', '#121212']} style={styles.albumArt}>
                <Ionicons name="musical-notes" size={80} color="rgba(255,255,255,0.3)" />
              </LinearGradient>
            )}
          </View>

          {/* Album Info */}
          <View style={styles.albumInfo}>
            <Text style={styles.albumTitle}>{album.title}</Text>
            <TouchableOpacity style={styles.artistRow}>
              <View style={styles.artistAvatar}>
                <Ionicons name="person" size={16} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.artistName}>{album.artist_name || 'Various Artists'}</Text>
            </TouchableOpacity>
            <Text style={styles.albumMeta}>
              {album.category || 'Album'} • {songs.length} songs • {formatDuration(totalDuration)}
            </Text>
          </View>
        </LinearGradient>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="heart-outline" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={handleDownloadAll}
              disabled={downloadingAll}
            >
              {downloadingAll ? (
                <ActivityIndicator size="small" color="#e91e63" />
              ) : (
                <Ionicons name="download-outline" size={24} color={COLORS.textSecondary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="ellipsis-horizontal" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.shuffleBtn} onPress={handleShuffle}>
              <Ionicons name="shuffle" size={24} color="#e91e63" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.playBtn} 
              onPress={isAlbumPlaying && isPlaying ? togglePlay : handlePlayAll}
            >
              <Ionicons 
                name={isAlbumPlaying && isPlaying ? 'pause' : 'play'} 
                size={28} 
                color="#000" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Songs List */}
        <View style={styles.songsList}>
          {songs.length > 0 ? (
            songs.map((song, index) => (
              <SongListItem
                key={song.song_id || `song-${index}`}
                song={song}
                album={album}
                index={index}
                queue={songQueue}
                showIndex={true}
                onAddToPlaylist={handleAddToPlaylist}
                onDownload={handleDownloadSong}
                onSongPress={handleSongSelect}
                showLockIcon={!isPremium && !features.song_selection}
              />
            ))
          ) : (
            <View style={styles.noSongs}>
              <Ionicons name="musical-notes-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.noSongsText}>No songs in this album</Text>
            </View>
          )}
        </View>

        {/* Album Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerDate}>
            {album.release_date || new Date().toLocaleDateString('en-US', { 
              year: 'numeric', month: 'long', day: 'numeric' 
            })}
          </Text>
          <Text style={styles.footerMeta}>
            {songs.length} songs, {formatDuration(totalDuration)}
          </Text>
        </View>
      </ScrollView>

      {/* Mini Player */}
      {currentSong && <MiniPlayer navigation={navigation} onPress={handleNowPlaying} />}

      {/* Playlist Modal */}
      <PlaylistModal 
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={selectedSong}
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
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e91e63',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  retryButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  backButton: {
    backgroundColor: '#333',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerGradient: {
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  backBtn: {
    marginBottom: 16,
    width: 40,
  },
  artContainer: {
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  albumArt: {
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumInfo: {
    alignItems: 'center',
  },
  albumTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  artistAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundCard,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  artistName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  albumMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionBtn: {
    padding: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  shuffleBtn: {
    padding: 4,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e91e63',
    justifyContent: 'center',
    alignItems: 'center',
  },
  songsList: {
    paddingTop: 8,
  },
  noSongs: {
    alignItems: 'center',
    padding: 48,
  },
  noSongsText: {
    color: COLORS.textMuted,
    fontSize: 16,
    marginTop: 16,
  },
  footer: {
    padding: 20,
    alignItems: 'flex-start',
  },
  footerDate: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
  footerMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
});
