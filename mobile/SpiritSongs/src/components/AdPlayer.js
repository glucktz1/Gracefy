/**
 * AdPlayer - Plays audio advertisements for free users
 * 
 * Features:
 * - Plays ad audio
 * - Shows "Advertisement" label
 * - Skip button after N seconds
 * - Tracks impressions and completions
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Animated,
  Linking,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { advertisingAPI } from '../services/api';

const AdPlayer = ({ 
  visible, 
  ad, 
  settings,
  onComplete, 
  onSkip,
  deviceId,
  userId 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [canSkip, setCanSkip] = useState(false);
  const [skipCountdown, setSkipCountdown] = useState(settings?.skip_after_seconds || 5);
  
  const soundRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const startTimeRef = useRef(null);
  const impressionTrackedRef = useRef(false);

  useEffect(() => {
    if (visible && ad) {
      playAd();
    }
    
    return () => {
      stopAd();
    };
  }, [visible, ad]);

  // Skip countdown timer
  useEffect(() => {
    if (!visible || !ad) return;
    
    const skipTime = settings?.skip_after_seconds || 5;
    if (skipTime === 0) {
      // No skip allowed
      setCanSkip(false);
      return;
    }
    
    setSkipCountdown(skipTime);
    setCanSkip(false);
    
    const interval = setInterval(() => {
      setSkipCountdown(prev => {
        if (prev <= 1) {
          setCanSkip(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [visible, ad, settings]);

  const playAd = async () => {
    if (!ad?.audio_url) {
      console.log('[AdPlayer] No audio URL');
      onComplete?.();
      return;
    }

    try {
      setIsLoading(true);
      startTimeRef.current = Date.now();
      impressionTrackedRef.current = false;

      // Configure audio
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Create and load sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: ad.audio_url },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      
      soundRef.current = sound;
      setIsPlaying(true);
      setIsLoading(false);

      console.log('[AdPlayer] Playing ad:', ad.title);
    } catch (error) {
      console.error('[AdPlayer] Play error:', error);
      setIsLoading(false);
      onComplete?.();
    }
  };

  const stopAd = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
    setIsPlaying(false);
    setProgress(0);
  };

  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;

    if (status.positionMillis && status.durationMillis) {
      const prog = status.positionMillis / status.durationMillis;
      setProgress(prog);
      
      // Animate progress bar
      Animated.timing(progressAnim, {
        toValue: prog,
        duration: 100,
        useNativeDriver: false,
      }).start();
    }

    // Ad completed
    if (status.didJustFinish) {
      handleAdComplete(true);
    }
  };

  const handleAdComplete = async (completed = false) => {
    if (impressionTrackedRef.current) return;
    impressionTrackedRef.current = true;

    const durationPlayed = startTimeRef.current 
      ? Math.floor((Date.now() - startTimeRef.current) / 1000) 
      : 0;

    // Track impression
    try {
      await advertisingAPI.recordImpression({
        ad_id: ad.ad_id,
        user_id: userId,
        device_id: deviceId,
        platform: 'mobile',
        duration_played: durationPlayed,
        completed: completed,
        skipped: !completed,
        clicked: false,
      });
    } catch (e) {
      console.log('[AdPlayer] Impression tracking error:', e.message);
    }

    await stopAd();
    
    if (completed) {
      onComplete?.();
    } else {
      onSkip?.();
    }
  };

  const handleSkip = () => {
    if (!canSkip) return;
    handleAdComplete(false);
  };

  const handleAdClick = async () => {
    if (!ad?.click_url) return;
    
    // Track click
    try {
      await advertisingAPI.recordImpression({
        ad_id: ad.ad_id,
        user_id: userId,
        device_id: deviceId,
        platform: 'mobile',
        duration_played: 0,
        completed: false,
        skipped: false,
        clicked: true,
      });
    } catch (e) {}
    
    Linking.openURL(ad.click_url);
  };

  if (!visible || !ad) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Ad Label */}
          {settings?.show_ad_label !== false && (
            <View style={styles.adLabel}>
              <Ionicons name="megaphone" size={14} color="#FFC107" />
              <Text style={styles.adLabelText}>Advertisement</Text>
            </View>
          )}

          {/* Ad Content */}
          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            style={styles.adContent}
          >
            {/* Advertiser Icon */}
            <View style={styles.adIcon}>
              <Ionicons name="radio" size={40} color="#FFC107" />
            </View>

            {/* Ad Info */}
            <Text style={styles.adTitle}>{ad.title}</Text>
            <Text style={styles.advertiserName}>{ad.advertiser_name}</Text>
            
            {ad.description ? (
              <Text style={styles.adDescription}>{ad.description}</Text>
            ) : null}

            {/* Loading or Playing Indicator */}
            {isLoading ? (
              <ActivityIndicator size="large" color="#FFC107" style={styles.loader} />
            ) : (
              <View style={styles.playingIndicator}>
                <Ionicons name="volume-high" size={24} color={COLORS.primary} />
                <Text style={styles.playingText}>Playing...</Text>
              </View>
            )}

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%']
                      })
                    }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(progress * (ad.duration_seconds || 30))}s / {ad.duration_seconds || 30}s
              </Text>
            </View>

            {/* Click URL */}
            {ad.click_url ? (
              <TouchableOpacity style={styles.learnMoreButton} onPress={handleAdClick}>
                <Text style={styles.learnMoreText}>Learn More</Text>
                <Ionicons name="open-outline" size={16} color="#FFC107" />
              </TouchableOpacity>
            ) : null}
          </LinearGradient>

          {/* Skip Button */}
          <View style={styles.skipContainer}>
            {canSkip ? (
              <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>Skip Ad</Text>
                <Ionicons name="play-skip-forward" size={18} color={COLORS.text} />
              </TouchableOpacity>
            ) : skipCountdown > 0 ? (
              <View style={styles.skipCountdown}>
                <Text style={styles.skipCountdownText}>
                  Skip in {skipCountdown}s
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
  },
  adLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    gap: 6,
  },
  adLabelText: {
    color: '#FFC107',
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  adContent: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  adIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  adTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  advertiserName: {
    fontSize: FONT_SIZES.md,
    color: '#FFC107',
    marginBottom: SPACING.md,
  },
  adDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  loader: {
    marginVertical: SPACING.lg,
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: SPACING.lg,
  },
  playingText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  progressContainer: {
    width: '100%',
    marginTop: SPACING.md,
  },
  progressBackground: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFC107',
  },
  progressText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  learnMoreText: {
    color: '#FFC107',
    fontWeight: '600',
  },
  skipContainer: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  skipButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  skipCountdown: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  skipCountdownText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
  },
});

export default AdPlayer;
