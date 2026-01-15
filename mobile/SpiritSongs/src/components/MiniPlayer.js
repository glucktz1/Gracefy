/**
 * Optimized Mini Player Component
 * Shows at bottom of screen during playback - uses Zustand store
 */

import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import {
  useCurrentTrack,
  useIsPlaying,
  useIsLoading,
  useProgress,
  usePlayerControls,
} from '../store/playerStore';
import { COLORS } from '../config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLACEHOLDER_IMAGE = require('../../assets/placeholder-album.png');

const MiniPlayer = memo(({ onPress }) => {
  const navigation = useNavigation();
  const currentTrack = useCurrentTrack();
  const isPlaying = useIsPlaying();
  const isLoading = useIsLoading();
  const { position, duration } = useProgress();
  const { togglePlayPause, skipToNext } = usePlayerControls();

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('NowPlaying');
    }
  }, [onPress, navigation]);

  const handlePlayPause = useCallback((e) => {
    e.stopPropagation();
    togglePlayPause();
  }, [togglePlayPause]);

  const handleSkipNext = useCallback((e) => {
    e.stopPropagation();
    skipToNext();
  }, [skipToNext]);

  // Don't render if no track
  if (!currentTrack) return null;

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <Pressable
      style={styles.container}
      onPress={handlePress}
      data-testid="mini-player"
    >
      {/* Background with blur effect */}
      <LinearGradient
        colors={['rgba(30, 30, 30, 0.98)', 'rgba(20, 20, 20, 0.98)']}
        style={styles.background}
      />

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Album Art */}
        <Image
          source={currentTrack.thumbnail ? { uri: currentTrack.thumbnail } : PLACEHOLDER_IMAGE}
          style={styles.albumArt}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {currentTrack.title}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {currentTrack.artist_name || 'Unknown Artist'}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Play/Pause Button */}
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
            disabled={isLoading}
            data-testid="mini-player-play-btn"
          >
            {isLoading ? (
              <View style={styles.loadingIndicator} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="#fff"
              />
            )}
          </TouchableOpacity>

          {/* Skip Next Button */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipNext}
            data-testid="mini-player-next-btn"
          >
            <Ionicons name="play-forward" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );
});

// Static height for layout calculations
MiniPlayer.HEIGHT = 64;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 60, // Above tab bar
    left: 0,
    right: 0,
    height: 64,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  albumArt: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#222',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  trackTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  artistName: {
    color: '#888',
    fontSize: 12,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  skipButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    borderTopColor: 'transparent',
  },
});

export default MiniPlayer;
