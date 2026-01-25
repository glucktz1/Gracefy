import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { leaderContentAPI, getImageUrl, getAudioUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { showToast } from '../components/Toast';

const MafundishoDetailScreen = ({ route, navigation }) => {
  const { containerId, mafundisho } = route.params || {};
  
  const [loading, setLoading] = useState(true);
  const [container, setContainer] = useState(mafundisho || null);
  const [episodes, setEpisodes] = useState([]);
  
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  useEffect(() => {
    loadMafundishoDetail();
  }, [containerId]);

  const loadMafundishoDetail = async () => {
    try {
      setLoading(true);
      const response = await leaderContentAPI.getMafundishoDetail(containerId);
      if (response.data) {
        setContainer(response.data.container || mafundisho);
        setEpisodes(response.data.episodes || []);
      }
    } catch (error) {
      console.error('Error loading mafundisho detail:', error);
      showToast('Imeshindikana kupakia maudhui', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayEpisode = (episode, index) => {
    // Create track list from episodes
    const trackList = episodes.map((ep, idx) => ({
      song_id: ep.content_id,
      title: ep.title,
      artist_name: container?.leader_name || mafundisho?.leader_name || 'Mafundisho',
      audio_url: ep.audio_url,
      thumbnail: ep.thumbnail || container?.thumbnail || mafundisho?.thumbnail,
      series_number: ep.series_number || idx + 1,
    }));
    
    const track = trackList[index];
    playTrack(track, trackList, index);
  };

  const handlePlayAll = () => {
    if (episodes.length > 0) {
      handlePlayEpisode(episodes[0], 0);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const thumbnailUrl = getImageUrl(container?.thumbnail || mafundisho?.thumbnail) || 'https://via.placeholder.com/300';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with Cover Art */}
        <LinearGradient
          colors={['#4a1a6b', '#2a0a3b', COLORS.background]}
          style={styles.headerGradient}
        >
          <SafeAreaView edges={['top']}>
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="chevron-back" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.coverSection}>
              <Image
                source={{ uri: thumbnailUrl }}
                style={styles.coverImage}
              />
              <Text style={styles.title}>{container?.title || mafundisho?.title}</Text>
              <Text style={styles.leaderName}>
                Na. {container?.leader_name || mafundisho?.leader_name || 'Unknown'}
              </Text>
              {container?.leader_title && (
                <Text style={styles.leaderTitle}>{container.leader_title}</Text>
              )}
              <Text style={styles.episodeCount}>
                Vipindi {episodes.length}
              </Text>
            </View>

            {/* Play All Button */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.playAllButton}
                onPress={handlePlayAll}
              >
                <Ionicons name="play" size={24} color={COLORS.background} />
                <Text style={styles.playAllText}>Cheza Zote</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shuffleButton}>
                <Ionicons name="shuffle" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Description */}
        {container?.description && (
          <View style={styles.descriptionSection}>
            <Text style={styles.description}>{container.description}</Text>
          </View>
        )}

        {/* Episodes List */}
        <View style={styles.episodesSection}>
          <Text style={styles.sectionTitle}>Vipindi ({episodes.length})</Text>
          
          {episodes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Hakuna vipindi kwa sasa</Text>
            </View>
          ) : (
            episodes.map((episode, index) => {
              const isCurrentlyPlaying = currentTrack?.song_id === episode.content_id && isPlaying;
              return (
                <TouchableOpacity
                  key={episode.content_id || index}
                  style={[styles.episodeItem, isCurrentlyPlaying && styles.episodeItemPlaying]}
                  onPress={() => handlePlayEpisode(episode, index)}
                >
                  <View style={styles.episodeNumber}>
                    {isCurrentlyPlaying ? (
                      <Ionicons name="volume-high" size={20} color={COLORS.primary} />
                    ) : (
                      <Text style={styles.episodeNumberText}>{episode.series_number || index + 1}</Text>
                    )}
                  </View>
                  
                  <View style={styles.episodeInfo}>
                    <Text style={[styles.episodeTitle, isCurrentlyPlaying && styles.episodeTitlePlaying]} numberOfLines={2}>
                      {episode.title}
                    </Text>
                    <Text style={styles.episodeMeta}>
                      {episode.category || 'Mafundisho'} 
                      {episode.duration ? ` • ${formatDuration(episode.duration)}` : ''}
                    </Text>
                  </View>
                  
                  <TouchableOpacity style={styles.playButton}>
                    <Ionicons 
                      name={isCurrentlyPlaying ? "pause" : "play"} 
                      size={20} 
                      color={isCurrentlyPlaying ? COLORS.primary : COLORS.text} 
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  headerGradient: {
    paddingBottom: SPACING.xl,
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  coverSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  coverImage: {
    width: 200,
    height: 200,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.card,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  leaderName: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  leaderTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  episodeCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  playAllText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
  },
  shuffleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  descriptionSection: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  description: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  episodesSection: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  episodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  episodeItemPlaying: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    marginHorizontal: -SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderBottomWidth: 0,
  },
  episodeNumber: {
    width: 32,
    alignItems: 'center',
  },
  episodeNumberText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  episodeInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  episodeTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  episodeTitlePlaying: {
    color: COLORS.primary,
  },
  episodeMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  playButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
});

export default MafundishoDetailScreen;
