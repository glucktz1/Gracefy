/**
 * CategorySongsScreen — Spotify-style "all songs in a category" page.
 *
 * Smoothness targets:
 *   • Instant cover render from nav params (no flash of placeholder).
 *   • In-memory cache so revisiting a category opens in < 50ms.
 *   • Skeleton list rows while songs stream in (no spinner-on-empty-screen).
 *   • FlatList virtualization so 100+ song lists scroll at 60fps.
 *   • expo-image with memory+disk caching so artwork never reloads.
 *   • Press-scale animation on the cover & Play All for tactile feel.
 */
import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { getImageUrl, API_BASE_URL } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { SongListItem } from '../components/Cards';

// ============ In-memory cache (60s TTL) ============
// Keeps the most-recently viewed categories in memory so the user can swipe
// back into them instantly. The /all-songs endpoint already has a 2-minute
// server-side cache; this is just to skip the network round-trip entirely.
const SCREEN_CACHE = new Map();
const CACHE_TTL = 60 * 1000;
const cacheGet = (key) => {
  const e = SCREEN_CACHE.get(key);
  if (!e) return null;
  if (Date.now() - e.t > CACHE_TTL) {
    SCREEN_CACHE.delete(key);
    return null;
  }
  return e.v;
};
const cacheSet = (key, v) => SCREEN_CACHE.set(key, { v, t: Date.now() });

// Skeleton row — same height/structure as SongListItem so the layout doesn't
// jump when real songs arrive.
const SkeletonRow = memo(() => (
  <View style={styles.skelRow}>
    <View style={styles.skelIdx} />
    <View style={styles.skelArt} />
    <View style={{ flex: 1, gap: 6 }}>
      <View style={[styles.skelBar, { width: '70%' }]} />
      <View style={[styles.skelBar, { width: '40%', height: 8 }]} />
    </View>
  </View>
));

const CategorySongsScreen = ({ route, navigation }) => {
  const {
    categoryId,
    categoryName,
    // Optional optimistic params — the tile that opened us can pass these so
    // we paint the cover instantly without waiting for the API:
    coverHint,
    totalHint,
  } = route?.params ?? {};

  // Seed initial state from cache OR hints so first frame is meaningful.
  const cached = categoryId ? cacheGet(categoryId) : null;
  const [data, setData] = useState(
    cached || {
      name: categoryName || 'Category',
      cover: coverHint ? getImageUrl(coverHint) : null,
      songs: [],
      total: typeof totalHint === 'number' ? totalHint : null,
    }
  );
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);

  const playerContext = usePlayer();
  const playTrack = playerContext?.playTrack ?? (() => {});
  const currentTrack = playerContext?.currentTrack ?? null;
  const isPlaying = playerContext?.isPlaying ?? false;

  // Press-scale animation for the Play All button (Spotify-style tactile feel).
  const playScale = useRef(new Animated.Value(1)).current;
  const onPressInPlay = () =>
    Animated.spring(playScale, { toValue: 0.92, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const onPressOutPlay = () =>
    Animated.spring(playScale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  const load = useCallback(async (showSkeleton = true) => {
    if (!categoryId) return;
    if (showSkeleton && !cached) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/category/${categoryId}/all-songs?limit=200`);
      const d = res.data || {};
      const cat = d.category || {};
      const next = {
        name: cat.name_sw || cat.name || categoryName || 'Category',
        cover: d.cover ? getImageUrl(d.cover) : (coverHint ? getImageUrl(coverHint) : null),
        songs: d.songs || [],
        total: d.total_songs ?? (d.songs?.length || 0),
      };
      setData(next);
      cacheSet(categoryId, next);
    } catch (e) {
      // Keep optimistic state on failure — don't blank the screen.
      console.log('[CategorySongs] load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [categoryId, categoryName, coverHint, cached]);

  useEffect(() => { load(true); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Force-bypass cache on pull-to-refresh.
    if (categoryId) SCREEN_CACHE.delete(categoryId);
    load(false);
  }, [load, categoryId]);

  const handlePlayAll = useCallback(() => {
    if (!data.songs?.length) return;
    playTrack(data.songs[0], data.songs, 0);
  }, [data.songs, playTrack]);

  const handlePlaySong = useCallback((song, index) => {
    playTrack(song, data.songs, index);
  }, [data.songs, playTrack]);

  const renderSong = useCallback(({ item, index }) => (
    <SongListItem
      item={{ ...item, thumbnail: item.thumbnail || item.album_thumbnail || data.cover }}
      index={index}
      onPress={() => handlePlaySong(item, index)}
      isCurrentSong={currentTrack?.song_id === item.song_id}
      isPlaying={isPlaying && currentTrack?.song_id === item.song_id}
    />
  ), [data.cover, handlePlaySong, currentTrack?.song_id, isPlaying]);

  const keyExtractor = useCallback((item, idx) => item.song_id || String(idx), []);

  const ListHeader = (
    <>
      {/* Cover & title */}
      <LinearGradient colors={[COLORS.primary + '33', COLORS.background]} style={styles.hero}>
        <View style={styles.coverWrap}>
          {data.cover ? (
            <Image
              source={data.cover}
              style={styles.cover}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
              priority="high"
            />
          ) : (
            <View style={[styles.cover, styles.coverFallback]}>
              <Ionicons name="musical-notes" size={56} color="rgba(255,255,255,0.4)" />
            </View>
          )}
        </View>
        <Text style={styles.label}>CATEGORY</Text>
        <Text style={styles.title}>{data.name}</Text>
        <Text style={styles.subtitle}>
          {data.total != null ? `${data.total} nyimbo` : ' '}
        </Text>
      </LinearGradient>

      {/* Play All */}
      <View style={styles.actions}>
        <Animated.View style={{ transform: [{ scale: playScale }] }}>
          <TouchableOpacity
            style={[styles.playAll, !data.songs?.length && { opacity: 0.5 }]}
            onPress={handlePlayAll}
            onPressIn={onPressInPlay}
            onPressOut={onPressOutPlay}
            disabled={!data.songs?.length}
            activeOpacity={1}
          >
            <Ionicons name="play" size={26} color="#000" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.actionsLabel}>Cheza Zote</Text>
      </View>
    </>
  );

  const ListEmpty = (
    loading ? (
      <View style={{ paddingHorizontal: SPACING.md }}>
        {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
      </View>
    ) : (
      <Text style={styles.empty}>Hakuna nyimbo kwenye kategoria hii bado.</Text>
    )
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={loading ? [] : (data.songs || [])}
        keyExtractor={keyExtractor}
        renderItem={renderSong}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        // Virtualization knobs for buttery scroll on 100+ song lists.
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  headerBtn: { padding: SPACING.xs },
  hero: {
    alignItems: 'center', paddingVertical: SPACING.lg, paddingHorizontal: SPACING.md,
  },
  coverWrap: {
    width: 200, height: 200, marginBottom: SPACING.md,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  cover: {
    width: 200, height: 200, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.card,
  },
  coverFallback: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#352b66',
  },
  label: {
    color: COLORS.textSecondary, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, marginTop: SPACING.xs,
  },
  title: {
    color: COLORS.text, fontSize: 28, fontWeight: '800',
    marginTop: 4, textAlign: 'center',
  },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: 4, minHeight: 18 },
  actions: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: 12,
  },
  playAll: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: COLORS.primary, shadowOpacity: 0.5, shadowRadius: 10,
  },
  actionsLabel: { color: COLORS.text, fontSize: FONT_SIZES.md, fontWeight: '700' },
  empty: { color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 40 },
  // Skeleton row mirrors the SongListItem layout to avoid layout jumps.
  skelRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 12,
  },
  skelIdx: { width: 18, height: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 4 },
  skelArt: { width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6 },
  skelBar: { height: 12, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4 },
});

export default CategorySongsScreen;
