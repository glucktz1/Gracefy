import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { contentAPI, getImageUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { SongListItem } from '../components/Cards';

const { width } = Dimensions.get('window');

const AlbumScreen = ({ route, navigation }) => {
  const { album } = route.params;
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  const { playTrack, currentTrack } = usePlayer();

  useEffect(() => {
    loadAlbumSongs();
  }, [album]);

  const loadAlbumSongs = async () => {
    try {
      const response = await contentAPI.getAlbum(album.album_id);
      setSongs(response.data?.songs || []);
    } catch (error) {
      console.error('Error loading album:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaySong = (song) => {
    const index = songs.findIndex(s => s.song_id === song.song_id);
    playTrack(song, songs, index >= 0 ? index : 0);
  };

  const handlePlayAll = () => {
    if (songs.length > 0) {
      playTrack(songs[0], songs, 0);
    }
  };

  const handleShuffle = () => {
    if (songs.length > 0) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled, 0);
    }
  };

  const totalDuration = songs.reduce((acc, song) => acc + (song.duration || 0), 0);
  const formatTotalDuration = () => {
    const hours = Math.floor(totalDuration / 3600);
    const mins = Math.floor((totalDuration % 3600) / 60);
    if (hours > 0) {
      return `${hours} hr ${mins} min`;
    }
    return `${mins} min`;
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with gradient */}
        <LinearGradient
          colors={[COLORS.primary + '40', COLORS.background]}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            {/* Navigation */}
            <View style={styles.nav}>
              <TouchableOpacity 
                style={styles.navButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="chevron-back" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Album Art */}
            <View style={styles.artworkContainer}>
              <Image
                source={{ uri: getImageUrl(album.thumbnail || album.thumbnail_url) || 'https://via.placeholder.com/200' }}
                style={styles.artwork}
              />
            </View>

            {/* Album Info */}
            <View style={styles.albumInfo}>
              <Text style={styles.albumTitle}>{album.title}</Text>
              <TouchableOpacity style={styles.artistRow}>
                <Image
                  source={{ uri: album.artist_avatar || 'https://via.placeholder.com/24' }}
                  style={styles.artistAvatar}
                />
                <Text style={styles.artistName}>{album.artist_name}</Text>
              </TouchableOpacity>
              <Text style={styles.albumMeta}>
                {album.year || new Date().getFullYear()} • {songs.length} songs, {formatTotalDuration()}
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Actions */}
        <View style={styles.actions}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="heart-outline" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="download-outline" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="ellipsis-horizontal" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.rightActions}>
            <TouchableOpacity 
              style={styles.shuffleButton}
              onPress={handleShuffle}
            >
              <Ionicons name="shuffle" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.playButton}
              onPress={handlePlayAll}
            >
              <Ionicons name="play" size={28} color={COLORS.background} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Songs List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <View style={styles.songsList}>
            {songs.map((song, index) => (
              <SongListItem
                key={song.song_id}
                item={song}
                index={index}
                isPlaying={currentTrack?.song_id === song.song_id}
                onPress={() => handlePlaySong(song)}
              />
            ))}
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 150 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    paddingBottom: SPACING.lg,
  },
  nav: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  navButton: {
    padding: SPACING.xs,
  },
  artworkContainer: {
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  artwork: {
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 10.32,
    elevation: 16,
  },
  albumInfo: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  albumTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  artistAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    marginRight: SPACING.sm,
  },
  artistName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  albumMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shuffleButton: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: SPACING.xxl,
  },
  songsList: {
    paddingHorizontal: SPACING.sm,
  },
});

export default AlbumScreen;
