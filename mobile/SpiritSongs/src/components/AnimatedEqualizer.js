import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../config/theme';

/**
 * AnimatedEqualizer - Dancing bars animation for playing songs
 * Shows animated bars that simulate audio visualization
 */
const AnimatedEqualizer = ({ 
  isPlaying = false, 
  barCount = 3, 
  barWidth = 3, 
  barHeight = 14, 
  color = COLORS.primary,
  gap = 2,
}) => {
  const animations = useRef(
    Array(barCount).fill(0).map(() => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (isPlaying) {
      // Start animations for each bar with different timings
      const animationConfigs = animations.map((anim, index) => {
        // Random duration for each bar to create natural effect
        const duration = 300 + (index * 100) + Math.random() * 200;
        
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.3 + Math.random() * 0.5, // Random min height
              duration: duration / 2,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.8 + Math.random() * 0.2, // Random max height
              duration: duration / 2,
              useNativeDriver: true,
            }),
          ])
        );
      });

      // Start all animations
      animationConfigs.forEach(anim => anim.start());

      // Cleanup
      return () => {
        animationConfigs.forEach(anim => anim.stop());
      };
    } else {
      // Reset to idle state
      animations.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [isPlaying, animations]);

  return (
    <View style={[styles.container, { gap }]}>
      {animations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              width: barWidth,
              height: barHeight,
              backgroundColor: color,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
};

/**
 * PlayingIndicator - Shows equalizer when playing, play icon when paused
 * Use this in song lists to indicate the currently playing song
 */
export const PlayingIndicator = ({ 
  isPlaying, 
  isCurrentSong,
  color = COLORS.primary,
  size = 'medium',
}) => {
  if (!isCurrentSong) {
    return null;
  }

  const sizeConfig = {
    small: { barWidth: 2, barHeight: 10, barCount: 3, gap: 1 },
    medium: { barWidth: 3, barHeight: 14, barCount: 3, gap: 2 },
    large: { barWidth: 4, barHeight: 20, barCount: 4, gap: 2 },
  };

  const config = sizeConfig[size] || sizeConfig.medium;

  return (
    <AnimatedEqualizer
      isPlaying={isPlaying}
      barCount={config.barCount}
      barWidth={config.barWidth}
      barHeight={config.barHeight}
      color={color}
      gap={config.gap}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 20,
  },
  bar: {
    borderRadius: 2,
  },
});

export default AnimatedEqualizer;
