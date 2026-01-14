import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../config';

const AnimatedBars = ({ isPlaying, size = 'small', color = COLORS.primary }) => {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.5)).current;
  const bar3 = useRef(new Animated.Value(0.7)).current;
  const bar4 = useRef(new Animated.Value(0.4)).current;

  const barHeight = size === 'large' ? 24 : size === 'medium' ? 16 : 12;
  const barWidth = size === 'large' ? 4 : size === 'medium' ? 3 : 2;
  const gap = size === 'large' ? 3 : 2;

  useEffect(() => {
    if (isPlaying) {
      const createAnimation = (animValue, duration, minVal, maxVal) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: maxVal,
              duration: duration,
              useNativeDriver: false,
            }),
            Animated.timing(animValue, {
              toValue: minVal,
              duration: duration * 0.8,
              useNativeDriver: false,
            }),
          ])
        );
      };

      const anim1 = createAnimation(bar1, 300, 0.2, 1);
      const anim2 = createAnimation(bar2, 400, 0.3, 0.9);
      const anim3 = createAnimation(bar3, 350, 0.25, 1);
      const anim4 = createAnimation(bar4, 450, 0.35, 0.85);

      anim1.start();
      anim2.start();
      anim3.start();
      anim4.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
        anim4.stop();
      };
    } else {
      // Reset to static position when paused
      Animated.parallel([
        Animated.timing(bar1, { toValue: 0.4, duration: 200, useNativeDriver: false }),
        Animated.timing(bar2, { toValue: 0.6, duration: 200, useNativeDriver: false }),
        Animated.timing(bar3, { toValue: 0.5, duration: 200, useNativeDriver: false }),
        Animated.timing(bar4, { toValue: 0.4, duration: 200, useNativeDriver: false }),
      ]).start();
    }
  }, [isPlaying]);

  const renderBar = (animValue) => ({
    width: barWidth,
    height: animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [barHeight * 0.2, barHeight],
    }),
    backgroundColor: color,
    borderRadius: barWidth / 2,
  });

  return (
    <View style={[styles.container, { height: barHeight, gap }]}>
      <Animated.View style={renderBar(bar1)} />
      <Animated.View style={renderBar(bar2)} />
      <Animated.View style={renderBar(bar3)} />
      <Animated.View style={renderBar(bar4)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});

export default AnimatedBars;
