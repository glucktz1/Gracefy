import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions, Animated, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useBilling } from '../context/BillingContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { getImageUrl } from '../services/api';
import AnimatedEqualizer from './AnimatedEqualizer';
import AddToPlaylistModal, { LoginRequiredModal, SubscriptionRequiredModal } from './AddToPlaylistModal';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = 50;

const MiniPlayer = ({ onPress, navigation }) => {
  const { currentTrack, isPlaying, isLoading, togglePlay, skipNext, skipPrevious, position, duration, queue, queueIndex } = usePlayer();
  const { isAuthenticated } = useAuth();
  const billingContext = useBilling();
  
  // Get billing values directly from context
  const billingEnabled = billingContext?.billingEnabled ?? false;
  const isPremium = billingContext?.isPremium ?? false;
  
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  
  // Prevent double-tap issues
  const isProcessingRef = useRef(false);

  /**
   * BILLING LOGIC:
   * 1. Guest (not logged in): NEVER prompt to pay, only prompt to login
   * 2. Logged in + billing OFF: Full premium access
   * 3. Logged in + billing ON + not paid: Prompt to pay
   */
  const shouldPromptLogin = !isAuthenticated;
  const shouldPromptPayment = isAuthenticated && billingEnabled && !isPremium;
  
  // Swipe animation
  const translateX = useRef(new Animated.Value(0)).current;
  
  // Pan responder for swipe gestures (premium only)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderGrant: () => {
        translateX.setOffset(0);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow swipe for premium users
        if (billingEnabled && !isPremium) return;
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        translateX.flattenOffset();
        
        // Check if user is premium
        if (billingEnabled && !isPremium) {
          // Reset position
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          return;
        }
        
        if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe right - previous track
          Animated.timing(translateX, {
            toValue: width,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            skipPrevious();
            translateX.setValue(-width);
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          });
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left - next track
          Animated.timing(translateX, {
            toValue: -width,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            skipNext();
            translateX.setValue(width);
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          });
        } else {
          // Return to original position
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

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

  const handleAddToPlaylist = useCallback((e) => {
    e?.stopPropagation?.();
    
    // BILLING LOGIC:
    // 1. Guest: Prompt to login (NEVER prompt to pay)
    if (shouldPromptLogin) {
      setShowLoginModal(true);
      return;
    }
    
    // 2. Logged in + billing ON + not paid: Prompt to pay
    if (shouldPromptPayment) {
      setShowSubscriptionModal(true);
      return;
    }
    
    // 3. Logged in + (billing OFF OR paid): Allow access
    setShowPlaylistModal(true);
  }, [shouldPromptLogin, shouldPromptPayment]);

  const handlePlayPause = useCallback(async (e) => {
    e.stopPropagation();
    
    // Prevent double-tap and rapid taps
    if (isProcessingRef.current) {
      console.log('[MiniPlayer] Ignoring tap - already processing');
      return;
    }
    
    isProcessingRef.current = true;
    
    try {
      // Don't wait for isLoading check - just call togglePlay immediately
      await togglePlay();
    } catch (error) {
      console.error('[MiniPlayer] Play/pause error:', error);
    } finally {
      // Reset after a short delay to prevent rapid double-taps
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 300);
    }
  }, [togglePlay]);
  
  const handleSubscribe = () => {
    setShowSubscriptionModal(false);
    if (navigation) {
      navigation.navigate('SubscriptionPlans');
    }
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.innerContainer} 
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
              {/* Swipeable track info area - only this part swipes */}
              <Animated.View 
                style={[styles.swipeableArea, { transform: [{ translateX }] }]}
                {...panResponder.panHandlers}
              >
                {/* Album art with equalizer overlay */}
                <View style={styles.albumArtContainer}>
                  <Image
                    source={{ uri: getImageUrl(currentTrack.thumbnail || currentTrack.thumbnail_url || currentTrack.album_thumbnail) || 'https://via.placeholder.com/48' }}
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
              </Animated.View>

              {/* Controls - fixed position, not swipeable */}
              <View style={styles.controls}>
                {/* Add to playlist button */}
                <TouchableOpacity 
                  style={styles.controlButton}
                  onPress={handleAddToPlaylist}
                >
                  <Ionicons 
                    name="add-circle-outline" 
                    size={26} 
                    color={COLORS.text} 
                  />
              </TouchableOpacity>

              {/* Play/Pause button */}
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={handlePlayPause}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Ionicons name="hourglass-outline" size={28} color={COLORS.text} />
                ) : (
                  <Ionicons 
                    name={isPlaying ? 'pause' : 'play'} 
                    size={28} 
                    color={COLORS.text} 
                  />
                )}
              </TouchableOpacity>

              {/* Skip next button */}
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
      </View>

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        visible={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        song={currentTrack}
        isAuthenticated={isAuthenticated}
        onLoginRequired={() => {
          setShowPlaylistModal(false);
          setShowLoginModal(true);
        }}
      />

      {/* Login Required Modal */}
      <LoginRequiredModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={() => {
          setShowLoginModal(false);
          // Navigate to login screen
          navigation?.navigate('Auth');
        }}
      />
      
      {/* Subscription Required Modal for Premium Features */}
      <SubscriptionRequiredModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscribe={handleSubscribe}
      />
    </>
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
  innerContainer: {
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
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
  swipeableArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
