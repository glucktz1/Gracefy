import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, 
  StyleSheet, Dimensions, FlatList, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { contentService, getThumbnailUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import SongListItem from '../components/SongListItem';
import MiniPlayer from '../components/MiniPlayer';
import PlaylistModal from '../components/PlaylistModal';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

export default function AlbumScreen({ route, navigation }) {
  const { albumId } = route.params;
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  
  const { playSong, currentSong, isPlaying, togglePlay } = usePlayer();

  useEffect(() => {
    fetchAlbum();
  }, [albumId]);

  const fetchAlbum = async () => {
    try {
      const data = await contentService.getAlbum(albumId);
      setAlbum(data);
    } catch (error) {
      console.error('Error fetching album:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAll = () => {
    if (album?.songs?.length > 0) {
      const queue = album.songs.map(song => ({ song, album }));
      playSong(album.songs[0], album, queue, 0);
    }
  };

  const handleShuffle = () => {
    if (album?.songs?.length > 0) {
      const shuffled = [...album.songs].sort(() => Math.random() - 0.5);
      const queue = shuffled.map(song => ({ song, album }));
      playSong(shuffled[0], album, queue, 0);
    }
  };

  const handleAddToPlaylist = (song) => {
    setSelectedSong(song);
    setShowPlaylistModal(true);
  };

  const handleNowPlaying = () => {
    navigation.navigate('NowPlaying');
  };

  const isAlbumPlaying = currentSong && album?.songs?.some(s => s.song_id === currentSong.song_id);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!album) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Album not found</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalDuration = album.songs?.reduce((acc, song) => acc + (song.duration || 0), 0) || 0;
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
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
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
              {album.category} • {album.songs?.length || 0} songs • {formatDuration(totalDuration)}
            </Text>
          </View>
        </LinearGradient>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="heart-outline" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="download-outline" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="ellipsis-horizontal" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.shuffleBtn} onPress={handleShuffle}>
              <Ionicons name="shuffle" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.playBtn} onPress={handlePlayAll}>
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
          {album.songs?.map((song, index) => (
            <SongListItem
              key={song.song_id}
              song={song}
              album={album}
              index={index}
              queue={album.songs.map(s => ({ song: s, album }))}
              showIndex={true}
              onAddToPlaylist={handleAddToPlaylist}
            />
          ))}
        </View>

        {/* Album Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerDate}>
            {album.release_date || new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Text>
          <Text style={styles.footerMeta}>
            {album.songs?.length || 0} songs, {formatDuration(totalDuration)}
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
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  backButtonText: {
    color: '#000',
    fontWeight: '600',
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
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songsList: {
    paddingTop: 8,
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
