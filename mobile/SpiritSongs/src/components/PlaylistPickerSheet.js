/**
 * PlaylistPickerSheet - Bottom sheet for selecting a playlist to add a song
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { getImageUrl } from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const PlaylistPickerSheet = ({
  visible,
  onClose,
  song,
  playlists,
  loading,
  onSelectPlaylist,
  onCreatePlaylist,
}) => {
  if (!visible) return null;

  const renderPlaylistItem = ({ item }) => (
    <TouchableOpacity
      style={styles.playlistItem}
      onPress={() => onSelectPlaylist(item)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: getImageUrl(item?.thumbnail) || 'https://via.placeholder.com/48' }}
        style={styles.playlistImage}
      />
      <View style={styles.playlistInfo}>
        <Text style={styles.playlistName} numberOfLines={1}>
          {item?.name || 'Playlist'}
        </Text>
        <Text style={styles.playlistSongCount}>
          {item?.song_count || 0} nyimbo
        </Text>
      </View>
      <Ionicons name="add-circle-outline" size={24} color={COLORS.primary} />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Sheet */}
        <View style={styles.sheet}>
          <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
            {/* Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Ongeza kwenye Playlist</Text>
              {song && (
                <Text style={styles.subtitle} numberOfLines={1}>
                  "{song.title}"
                </Text>
              )}
            </View>

            {/* Create New Playlist Button */}
            <TouchableOpacity
              style={styles.createButton}
              onPress={onCreatePlaylist}
            >
              <View style={styles.createIcon}>
                <Ionicons name="add" size={24} color={COLORS.text} />
              </View>
              <Text style={styles.createText}>Tengeneza Playlist Mpya</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Playlists List */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : playlists?.length > 0 ? (
              <FlatList
                data={playlists}
                renderItem={renderPlaylistItem}
                keyExtractor={(item) => item?.playlist_id || Math.random().toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="musical-notes-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>Hakuna playlist</Text>
                <Text style={styles.emptySubtext}>Tengeneza playlist ya kwanza</Text>
              </View>
            )}

            {/* Cancel Button */}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Ghairi</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sheet: {
    maxHeight: SCREEN_HEIGHT * 0.7,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  blurContainer: {
    paddingBottom: 34,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textMuted,
    borderRadius: 2,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.primary + '20',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  createIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  createText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
    marginHorizontal: SPACING.md,
  },
  loadingContainer: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  playlistImage: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  playlistInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  playlistName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  playlistSongCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  cancelButton: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});

export default PlaylistPickerSheet;
