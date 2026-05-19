/**
 * LiveListenerBadge — small "🔴 N" social-proof badge for the mobile app.
 *
 * Renders null when count <= 0. Animated pulse draws attention without being
 * intrusive on small album cards.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { useLiveListenersForAlbum, useLiveListenersForSong } from '../hooks/useLiveListenerCounts';

const formatCount = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

const PulsingDot = () => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2.2,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.dotPing, { transform: [{ scale }], opacity }]} />
      <View style={styles.dot} />
    </View>
  );
};

export const LiveListenerBadge = ({ albumId, songId, style }) => {
  const albumCount = useLiveListenersForAlbum(albumId);
  const songCount = useLiveListenersForSong(songId);
  const count = songId ? songCount : albumCount;

  if (!count || count <= 0) return null;

  return (
    <View style={[styles.badge, style]} testID={`live-listener-badge-${albumId || songId}`}>
      <PulsingDot />
      <Text style={styles.count}>{formatCount(count)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderColor: 'rgba(239,68,68,0.45)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  dotWrap: {
    width: 8,
    height: 8,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  dotPing: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f87171',
  },
  count: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default LiveListenerBadge;
