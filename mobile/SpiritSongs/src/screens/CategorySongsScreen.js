/**
 * CategorySongsScreen — Spotify-style "all songs in a category" page.
 * Opens from the Home Quick Access grid when the user taps a category tile
 * (e.g. Easter, Lent). Shows a cover, total song count, a Play All button,
 * and the song list. Cover defaults to the first song's thumbnail when the
 * category itself has none.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { getImageUrl, API_BASE_URL } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { SongListItem } from '../components/Cards';

const CategorySongsScreen = ({ route, navigation }) => {
  const { categoryId, categoryName } = route?.params ?? {};
  const [data, setData] = useState({ name: categoryName || 'Category', cover: null, songs: [] });
  const [loading, setLoading] = useState(true);

  const playerContext = usePlayer();
  const playTrack = playerContext?.playTrack ?? (() => {});
  const currentTrack = playerContext?.currentTrack ?? null;
  const isPlaying = playerContext?.isPlaying ?? false;

  const load = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/category/${categoryId}/all-songs?limit=200`);
      const d = res.data || {};
      const cat = d.category || {};
      setData({
        name: cat.name_sw || cat.name || categoryName || 'Category',
        cover: d.cover ? getImageUrl(d.cover) : null,
        songs: d.songs || [],
      });
    } catch (e) {
      console.log('[CategorySongs] load error:', e.message);
      setData({ name: categoryName || 'Category', cover: null, songs: [] });
    } finally {
      setLoading(false);
    }
  }, [categoryId, categoryName]);

  useEffect(() => { load(); }, [load]);

  const handlePlayAll = () => {
    if (!data.songs?.length) return;
    const queue = data.songs;
    playTrack(queue[0], queue, 0);
  };

  const handlePlaySong = (song, index) => {
    playTrack(song, data.songs, index);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header with back */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Cover & title */}
        <LinearGradient
          colors={[COLORS.primary + '33', COLORS.background]}
          style={styles.hero}
        >
          <View style={styles.coverWrap}>
            {data.cover ? (
              <Image source={{ uri: data.cover }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <Ionicons name="musical-notes" size={56} color="rgba(255,255,255,0.4)" />
              </View>
            )}
          </View>
          <Text style={styles.label}>CATEGORY</Text>
          <Text style={styles.title}>{data.name}</Text>
          <Text style={styles.subtitle}>{(data.songs || []).length} nyimbo</Text>
        </LinearGradient>

        {/* Play All */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.playAll, !data.songs?.length && { opacity: 0.5 }]}
            onPress={handlePlayAll}
            disabled={!data.songs?.length}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={26} color="#000" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
          <Text style={styles.actionsLabel}>Cheza Zote</Text>
        </View>

        {/* Songs list */}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : (data.songs || []).length === 0 ? (
          <Text style={styles.empty}>Hakuna nyimbo kwenye kategoria hii bado.</Text>
        ) : (
          <View style={{ paddingHorizontal: SPACING.md }}>
            {data.songs.map((song, idx) => (
              <SongListItem
                key={song.song_id || idx}
                item={{ ...song, thumbnail: song.thumbnail || song.album_thumbnail || data.cover }}
                index={idx}
                onPress={() => handlePlaySong(song, idx)}
                isCurrentSong={currentTrack?.song_id === song.song_id}
                isPlaying={isPlaying && currentTrack?.song_id === song.song_id}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  headerBtn: { padding: SPACING.xs },
  hero: { alignItems: 'center', paddingVertical: SPACING.lg, paddingHorizontal: SPACING.md },
  coverWrap: {
    width: 200, height: 200, marginBottom: SPACING.md,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },
  cover: { width: 200, height: 200, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.card },
  coverFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#352b66' },
  label: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: SPACING.xs },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginTop: 4, textAlign: 'center' },
  subtitle: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: 12 },
  playAll: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: COLORS.primary, shadowOpacity: 0.5, shadowRadius: 10,
  },
  actionsLabel: { color: COLORS.text, fontSize: FONT_SIZES.md, fontWeight: '700' },
  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  empty: { color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 40 },
});

export default CategorySongsScreen;
