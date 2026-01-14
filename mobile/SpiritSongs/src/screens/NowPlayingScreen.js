import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, Image, StyleSheet, Dimensions,
  Animated, PanResponder, Share, ScrollView, Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { libraryService } from '../services/api';
import AnimatedBars from '../components/AnimatedBars';
import SongListItem from '../components/SongListItem';
import PlaylistModal from '../components/PlaylistModal';
import { COLORS } from '../config';

const { width, height } = Dimensions.get('window');

const NowPlayingScreen = ({ navigation }) => {
  const { 
    currentSong, 
    currentAlbum, 
    isPlaying, 
    isLoading,
    position, 
    duration, 
    queue,
    queueIndex,
    shuffle, 
    repeat,
    togglePlay, 
    playNext, 
    playPrevious, 
    seekTo,
    setShuffle,
    cycleRepeat,
  } = usePlayer();
  
  const { isFavorite, addFavorite, removeFavorite, isAuthenticated } = useAuth();
  const [liked, setLiked] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const albumRotate = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (currentSong) {
      setLiked(isFavorite(currentSong.song_id));
    }
  }, [currentSong?.song_id]);

  // Album art rotation animation when playing
  useEffect(() => {
    let rotationAnimation;
    if (isPlaying) {
      rotationAnimation = Animated.loop(
        Animated.timing(albumRotate, {
          toValue: 1,
          duration: 20000,
          useNativeDriver: true,
        })
      );
      rotationAnimation.start();
    } else {
      albumRotate.stopAnimation();
    }
    return () => {
      if (rotationAnimation) {
        rotationAnimation.stop();
      }
    };
  }, [isPlaying]);

  const spin = albumRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleLike = async () => {
    if (!isAuthenticated || !currentSong) return;
    
    try {
      if (liked) {
        await libraryService.removeFromFavorites(currentSong.song_id);
        removeFavorite(currentSong.song_id);
        setLiked(false);
      } else {
        await libraryService.addToFavorites('song', currentSong.song_id);
        addFavorite('song', currentSong.song_id);
        setLiked(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleShare = async () => {
    if (!currentSong) return;
    try {
      await Share.share({
        message: `Check out "${currentSong.title}" on Spirit Songs!`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  const handleSeek = (event) => {
    const { locationX } = event.nativeEvent;
    const progressWidth = width - 64;
    const seekPosition = (locationX / progressWidth) * duration;
    seekTo(Math.max(0, Math.min(seekPosition, duration)));
  };

  if (!currentSong) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No song playing</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e3a5f', '#121212', '#121212']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Ionicons name="chevron-down" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>PLAYING FROM</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentAlbum?.title || 'Unknown Album'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowQueue(true)} style={styles.headerBtn}>
            <Ionicons name="list" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Album Art */}
        <View style={styles.artContainer}>
          <Animated.View style={[styles.artWrapper, { transform: [{ rotate: spin }] }]}>
            {currentSong.thumbnail || currentAlbum?.thumbnail ? (
              <Image 
                source={{ uri: currentSong.thumbnail || currentAlbum?.thumbnail }} 
                style={styles.albumArt}
              />
            ) : (
              <LinearGradient colors={['#7c3aed', '#10b981']} style={styles.albumArt}>
                <Ionicons name="musical-notes" size={80} color="rgba(255,255,255,0.4)" />
              </LinearGradient>
            )}
          </Animated.View>
          
          {/* Animated Bars Overlay */}
          {isPlaying && (
            <View style={styles.barsOverlay}>
              <AnimatedBars isPlaying={isPlaying} size="large" color="#fff" />
            </View>
          )}
        </View>

        {/* Song Info */}
        <View style={styles.songInfo}>
          <View style={styles.titleRow}>
            <View style={styles.titleContainer}>
              <Text style={styles.songTitle} numberOfLines={1}>
                {currentSong.title}
              </Text>
              <Text style={styles.artistName} numberOfLines={1}>
                {currentSong.artist_name || currentAlbum?.artist_name || 'Unknown Artist'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleLike} style={styles.likeButton}>
              <Ionicons 
                name={liked ? 'heart' : 'heart-outline'} 
                size={28} 
                color={liked ? COLORS.primary : COLORS.textPrimary} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <TouchableOpacity 
            style={styles.progressContainer}
            onPress={handleSeek}
            activeOpacity={1}
          >
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
              <View style={[styles.progressKnob, { left: `${progress * 100}%` }]} />
            </View>
          </TouchableOpacity>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(position)}</Text>
            <Text style={styles.timeText}>{formatTime(duration)}</Text>
          </View>
        </View>

        {/* Main Controls */}
        <View style={styles.controls}>
          <TouchableOpacity 
            onPress={() => setShuffle(!shuffle)} 
            style={styles.controlBtn}
          >
            <Ionicons 
              name="shuffle" 
              size={24} 
              color={shuffle ? COLORS.primary : COLORS.textSecondary} 
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={playPrevious} style={styles.controlBtn}>
            <Ionicons name="play-skip-back" size={32} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={togglePlay} 
            style={styles.playButton}
            disabled={isLoading}
          >
            {isLoading ? (
              <Ionicons name="hourglass" size={32} color="#000" />
            ) : (
              <Ionicons 
                name={isPlaying ? 'pause' : 'play'} 
                size={32} 
                color="#000" 
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={playNext} style={styles.controlBtn}>
            <Ionicons name="play-skip-forward" size={32} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={cycleRepeat} style={styles.controlBtn}>
            <Ionicons 
              name={repeat === 'one' ? 'repeat' : 'repeat'} 
              size={24} 
              color={repeat !== 'off' ? COLORS.primary : COLORS.textSecondary} 
            />
            {repeat === 'one' && (
              <View style={styles.repeatOneBadge}>
                <Text style={styles.repeatOneText}>1</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Secondary Actions */}
        <View style={styles.secondaryActions}>
          <TouchableOpacity 
            style={styles.secondaryBtn}
            onPress={() => setShowPlaylistModal(true)}
          >
            <Ionicons name="add-circle-outline" size={24} color={COLORS.textSecondary} />
            <Text style={styles.secondaryText}>Add to Playlist</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color={COLORS.textSecondary} />
            <Text style={styles.secondaryText}>Share</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Queue Modal */}
      <Modal
        visible={showQueue}
        animationType="slide"
        onRequestClose={() => setShowQueue(false)}
      >
        <View style={styles.queueContainer}>
          <View style={styles.queueHeader}>
            <Text style={styles.queueTitle}>Queue</Text>
            <TouchableOpacity onPress={() => setShowQueue(false)}>
              <Ionicons name="close" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.nowPlayingSection}>
            <Text style={styles.queueSectionTitle}>Now Playing</Text>
            <SongListItem 
              song={currentSong}
              album={currentAlbum}
              index={queueIndex}
              showIndex={false}
              showThumbnail={true}
            />
          </View>

          <Text style={styles.queueSectionTitle}>Next in Queue</Text>
          <ScrollView style={styles.queueList}>
            {queue.slice(queueIndex + 1).map((item, idx) => (
              <SongListItem 
                key={item.song?.song_id || item.song_id || idx}
                song={item.song || item}
                album={item.album || currentAlbum}
                index={queueIndex + 1 + idx}
                showIndex={true}
                showThumbnail={false}
              />
            ))}
            {queue.length <= queueIndex + 1 && (
              <Text style={styles.queueEmpty}>No more songs in queue</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Playlist Modal */}
      <PlaylistModal 
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={currentSong}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
    paddingTop: 48,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  headerBtn: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  artContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  artWrapper: {
    width: width - 80,
    height: width - 80,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  albumArt: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barsOverlay: {
    position: 'absolute',
    bottom: 16,
    right: 48,
  },
  songInfo: {
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    marginRight: 16,
  },
  songTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  artistName: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 4,
  },
  likeButton: {
    padding: 8,
  },
  progressSection: {
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  progressContainer: {
    height: 20,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: COLORS.backgroundElevated,
    borderRadius: 2,
    overflow: 'visible',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.textPrimary,
    borderRadius: 2,
  },
  progressKnob: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.textPrimary,
    marginLeft: -6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
    gap: 16,
  },
  controlBtn: {
    padding: 12,
    position: 'relative',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  repeatOneBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatOneText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
  },
  secondaryBtn: {
    alignItems: 'center',
    gap: 4,
  },
  secondaryText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  queueContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 48,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  queueTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  nowPlayingSection: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingBottom: 8,
  },
  queueSectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  queueList: {
    flex: 1,
  },
  queueEmpty: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    padding: 32,
  },
});

export default NowPlayingScreen;
