/**
 * Mini Player Component
 * Shows at bottom of screen during playback - uses PlayerContext
 */

import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayer } from '../context/PlayerContext';
import { COLORS } from '../config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MiniPlayer = memo(() => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { 
    currentSong, 
    currentAlbum, 
    isPlaying, 
    isLoading, 
    position, 
    duration,
    togglePlay,
    playNext 
  } = usePlayer();

  const handlePress = useCallback(() => {
    navigation.navigate('NowPlaying');
  }, [navigation]);

  const handlePlayPause = useCallback((e) => {
    e.stopPropagation();
    togglePlay();
  }, [togglePlay]);

  const handleSkipNext = useCallback((e) => {
    e.stopPropagation();
    playNext();
  }, [playNext]);

  // Don't render if no track
  if (!currentSong) return null;

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  // Get thumbnail
  const thumbnail = currentSong.thumbnail || currentAlbum?.thumbnail;

  // Calculate tab bar height with safe area
  const tabBarHeight = 60 + Math.max(insets.bottom, 12);

  return (
    <Pressable
      style={[styles.container, { bottom: tabBarHeight }]}
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
        {thumbnail ? (
          <Image
            source={{ uri: thumbnail }}
            style={styles.albumArt}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <LinearGradient 
            colors={['#7c3aed', '#10b981']} 
            style={styles.albumArt}
          >
            <Ionicons name="musical-notes" size={20} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        )}

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {currentSong.title || 'Unknown Track'}
          </Text>
          <Text style={styles.artistName} numberOfLines={1}>
            {currentSong.artist_name || currentAlbum?.artist_name || 'Unknown Artist'}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Play/Pause Button */}
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={COLORS.textPrimary} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={28}
                color={COLORS.textPrimary}
              />
            )}
          </TouchableOpacity>

          {/* Skip Next Button */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipNext}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="play-forward" size={24} color={COLORS.textSecondary} />
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
    bottom: Platform.OS === 'ios' ? 84 : 64, // Above tab bar
    left: 0,
    right: 0,
    height: 64,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    zIndex: 1000,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
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
    paddingVertical: 8,
  },
  albumArt: {
    width: 48,
    height: 48,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  trackTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  artistName: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MiniPlayer;
