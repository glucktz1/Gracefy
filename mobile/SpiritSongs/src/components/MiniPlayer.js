import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { usePlayer } from '../context/PlayerContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { getImageUrl } from '../services/api';
import AnimatedEqualizer from './AnimatedEqualizer';

const { width } = Dimensions.get('window');

const MiniPlayer = ({ onPress }) => {
  const { currentTrack, isPlaying, togglePlay, skipNext, position, duration, queue, queueIndex } = usePlayer();

  if (!currentTrack) return null;

  const progress = duration > 0 ? (position / duration) * 100 : 0;
  
  // Show "More like this" or queue info
  const getSubtitle = () => {
    if (queue.length > 1) {
      const remaining = queue.length - queueIndex - 1;
      return remaining > 0 ? `Zingine kama hizi • ${remaining} zaidi` : 'Zingine kama hizi';
    }
    return currentTrack.artist_name || 'Zingine kama hizi';
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.95}
    >
      <LinearGradient
        colors={[COLORS.card, COLORS.surface]}
        style={styles.gradient}
      >
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>

        <View style={styles.content}>
          {/* Album art with equalizer overlay */}
          <View style={styles.albumArtContainer}>
            <Image
              source={{ uri: getImageUrl(currentTrack.thumbnail || currentTrack.thumbnail_url) || 'https://via.placeholder.com/48' }}
              style={styles.albumArt}
            />
            {/* Show equalizer on album art when playing */}
            {isPlaying && (
              <View style={styles.equalizerOverlay}>
                <AnimatedEqualizer 
                  isPlaying={isPlaying} 
                  barCount={3} 
                  barWidth={3} 
                  barHeight={16}
                  color={COLORS.text}
                  gap={2}
                />
              </View>
            )}
          </View>

          {/* Track info */}
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {getSubtitle()}
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity 
              style={styles.controlButton}
              onPress={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
            >
              <Ionicons 
                name={isPlaying ? 'pause' : 'play'} 
                size={28} 
                color={COLORS.text} 
              />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.controlButton}
              onPress={(e) => {
                e.stopPropagation();
                skipNext();
              }}
            >
              <Ionicons name="play-forward" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradient: {
    borderRadius: BORDER_RADIUS.md,
  },
  progressContainer: {
    height: 2,
    backgroundColor: COLORS.progressBar,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  albumArtContainer: {
    position: 'relative',
    width: 48,
    height: 48,
  },
  albumArt: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
  },
  equalizerOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    padding: 2,
  },
  trackInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  trackTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  trackArtist: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    padding: SPACING.sm,
  },
});

export default MiniPlayer;
