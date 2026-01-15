import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePlayer } from '../context/PlayerContext';
import { getThumbnailUrl } from '../services/api';
import AnimatedBars from './AnimatedBars';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

const MiniPlayer = ({ navigation, onPress }) => {
  const { currentSong, currentAlbum, isPlaying, togglePlay, playNext, position, duration } = usePlayer();

  if (!currentSong) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  const thumbnailUrl = getThumbnailUrl(currentSong.thumbnail || currentAlbum?.thumbnail);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation?.navigate('NowPlaying');
    }
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={handlePress}
      activeOpacity={0.95}
    >
      {/* Progress bar at top */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>

      <View style={styles.content}>
        {/* Album Art */}
        <View style={styles.artContainer}>
          {thumbnailUrl ? (
            <Image 
              source={{ uri: thumbnailUrl }} 
              style={styles.albumArt}
            />
          ) : (
            <LinearGradient colors={['#7c3aed', '#10b981']} style={styles.albumArt}>
              <Ionicons name="musical-notes" size={20} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          )}
        </View>

        {/* Song Info */}
        <View style={styles.infoContainer}>
          <View style={styles.titleRow}>
            {isPlaying && <AnimatedBars isPlaying={isPlaying} size="small" />}
            <Text style={styles.songTitle} numberOfLines={1}>
              {currentSong.title}
            </Text>
          </View>
          <Text style={styles.artistName} numberOfLines={1}>
            {currentSong.artist_name || currentAlbum?.artist_name || 'Unknown Artist'}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity onPress={togglePlay} style={styles.playButton}>
            <Ionicons 
              name={isPlaying ? 'pause' : 'play'} 
              size={28} 
              color={COLORS.textPrimary} 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={playNext} style={styles.controlButton}>
            <Ionicons name="play-forward" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 60,
    left: 8,
    right: 8,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  progressContainer: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#e91e63',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  artContainer: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
  },
  albumArt: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  songTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  artistName: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playButton: {
    padding: 8,
  },
  controlButton: {
    padding: 8,
  },
});

export default MiniPlayer;
