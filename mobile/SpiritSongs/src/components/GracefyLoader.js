/**
 * GracefyLoader - Beautiful loading animation with cross and sound waves
 * Matches the Gracefy logo aesthetic
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS, FONT_SIZES } from '../config/theme';
import { LinearGradient } from 'expo-linear-gradient';

const GracefyLoader = ({ 
  size = 'default', 
  text = 'Loading...', 
  showText = true,
  color = COLORS.primary 
}) => {
  // Animation values for the 4 sound wave rings
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const wave3 = useRef(new Animated.Value(0)).current;
  const wave4 = useRef(new Animated.Value(0)).current;
  
  // Cross glow animation
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  const sizeConfig = {
    small: { container: 60, cross: { width: 3, height: 20 }, text: FONT_SIZES.xs },
    default: { container: 80, cross: { width: 4, height: 28 }, text: FONT_SIZES.sm },
    large: { container: 100, cross: { width: 5, height: 36 }, text: FONT_SIZES.md },
    xlarge: { container: 120, cross: { width: 6, height: 44 }, text: FONT_SIZES.lg },
  };

  const config = sizeConfig[size] || sizeConfig.default;

  useEffect(() => {
    // Create wave animation
    const createWaveAnimation = (animValue, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(animValue, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(animValue, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Create glow pulse animation
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Start all animations
    const animations = [
      createWaveAnimation(wave1, 0),
      createWaveAnimation(wave2, 400),
      createWaveAnimation(wave3, 800),
      createWaveAnimation(wave4, 1200),
      glowAnimation,
    ];

    animations.forEach(anim => anim.start());

    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, []);

  const renderWave = (animValue, index) => {
    const scale = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    });

    const opacity = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 0],
    });

    return (
      <Animated.View
        key={index}
        style={[
          styles.wave,
          {
            width: config.container,
            height: config.container,
            borderColor: color,
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.loaderContainer, { width: config.container, height: config.container }]}>
        {/* Sound Wave Rings */}
        <View style={styles.wavesContainer}>
          {renderWave(wave1, 0)}
          {renderWave(wave2, 1)}
          {renderWave(wave3, 2)}
          {renderWave(wave4, 3)}
        </View>

        {/* Glow effect behind cross */}
        <Animated.View
          style={[
            styles.glow,
            {
              backgroundColor: color,
              opacity: glowAnim,
            },
          ]}
        />

        {/* Cross at center */}
        <View style={styles.crossContainer}>
          {/* Vertical bar */}
          <LinearGradient
            colors={[COLORS.primaryLight, color, COLORS.primaryDark]}
            style={[
              styles.crossVertical,
              {
                width: config.cross.width,
                height: config.cross.height,
              },
            ]}
          />
          {/* Horizontal bar */}
          <LinearGradient
            colors={[COLORS.primaryLight, color, COLORS.primaryDark]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[
              styles.crossHorizontal,
              {
                width: config.cross.height * 0.7,
                height: config.cross.width,
                top: config.cross.height * 0.25,
              },
            ]}
          />
        </View>
      </View>

      {/* Loading text */}
      {showText && (
        <Text style={[styles.text, { fontSize: config.text, color }]}>
          {text}
        </Text>
      )}
    </View>
  );
};

// Full screen loader
export const FullScreenLoader = ({ text = 'Loading...' }) => (
  <View style={styles.fullScreen}>
    <GracefyLoader size="large" text={text} />
  </View>
);

// Inline loader for lists/sections
export const InlineLoader = ({ text = 'Loading...' }) => (
  <View style={styles.inline}>
    <GracefyLoader size="default" text={text} />
  </View>
);

// Small loader for buttons
export const SmallLoader = ({ color = COLORS.primary }) => (
  <GracefyLoader size="small" showText={false} color={color} />
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wavesContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  glow: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    opacity: 0.4,
  },
  crossContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  crossVertical: {
    borderRadius: 2,
  },
  crossHorizontal: {
    position: 'absolute',
    borderRadius: 2,
    left: '50%',
    transform: [{ translateX: -10 }],
  },
  text: {
    marginTop: 16,
    fontWeight: '500',
    opacity: 0.8,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GracefyLoader;
