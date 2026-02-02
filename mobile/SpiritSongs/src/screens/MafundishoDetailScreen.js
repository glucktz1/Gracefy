import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { leaderContentAPI, getImageUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import Toast from '../components/Toast';

const MafundishoDetailScreen = ({ route, navigation }) => {
  const { teachingId, containerId, mafundisho } = route.params || {};
  const id = teachingId || containerId;
  
  const [loading, setLoading] = useState(true);
  const [container, setContainer] = useState(mafundisho || null);
  const [series, setSeries] = useState([]);
  const [topics, setTopics] = useState([]);
  const [expandedSeries, setExpandedSeries] = useState({});
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    if (id) {
      loadMafundishoDetail();
    }
  }, [id]);

  const loadMafundishoDetail = async () => {
    try {
      setLoading(true);
      const response = await leaderContentAPI.getMafundishoDetail(id);
      if (response.data) {
        // Support both old container structure and new teaching structure
        setContainer(response.data.container || response.data || mafundisho);
        
        // Handle both old 'series' structure and new 'topics' structure
        // Convert topics/lessons to series/episodes format for backward compatibility
        const rawSeries = response.data.series || [];
        const rawTopics = response.data.topics || [];
        
        if (rawTopics.length > 0) {
          // Convert topics/lessons to series/episodes format
          const convertedSeries = rawTopics.map(topic => ({
            series_id: topic.topic_id,
            title: topic.title_sw || topic.title || 'Mada',
            description: topic.description,
            thumbnail_url: topic.thumbnail_url || topic.thumbnail,
            episodes: (topic.lessons || []).map(lesson => ({
              episode_id: lesson.lesson_id,
              title: lesson.title_sw || lesson.title,
              audio_url: lesson.audio_url,
              duration_seconds: lesson.duration,
              duration_formatted: lesson.duration_formatted,
            }))
          }));
          setSeries(convertedSeries);
        } else {
          setSeries(rawSeries);
        }
        
        setTopics(rawTopics);
        
        // Auto-expand first series/topic
        if (rawSeries.length > 0) {
          setExpandedSeries({ [rawSeries[0].series_id]: true });
        } else if (rawTopics.length > 0) {
          setExpandedSeries({ [rawTopics[0].topic_id]: true });
        }
      }
    } catch (error) {
      console.error('Error loading mafundisho detail:', error);
      showToast('Imeshindikana kupakia maudhui', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSeriesExpand = (seriesId) => {
    setExpandedSeries(prev => ({
      ...prev,
      [seriesId]: !prev[seriesId]
    }));
  };

  const handlePlayEpisode = (episode, seriesItem, episodeIndex) => {
    if (!episode.audio_url) {
      showToast('Hakuna sauti kwa kipindi hiki', 'warning');
      return;
    }
    
    // Get series thumbnail for the episode
    const seriesThumbnail = seriesItem.thumbnail_url || seriesItem.thumbnail;
    
    // Create track list from all episodes in this series
    const trackList = (seriesItem.episodes || [])
      .filter(ep => ep.audio_url)
      .map((ep, idx) => ({
        song_id: ep.episode_id,
        title: ep.title,
        artist_name: container?.leader_name || mafundisho?.leader_name || 'Mafundisho',
        audio_url: ep.audio_url,
        thumbnail: seriesThumbnail || container?.thumbnail,
        episode_number: idx + 1,
      }));
    
    const trackIndex = trackList.findIndex(t => t.song_id === episode.episode_id);
    const track = trackList[trackIndex >= 0 ? trackIndex : 0];
    playTrack(track, trackList, trackIndex >= 0 ? trackIndex : 0);
  };

  const handlePlayAll = () => {
    // Collect all episodes from all series that have audio
    const allTracks = [];
    series.forEach(s => {
      const seriesThumbnail = s.thumbnail_url || s.thumbnail;
      (s.episodes || []).forEach(ep => {
        if (ep.audio_url) {
          allTracks.push({
            song_id: ep.episode_id,
            title: ep.title,
            artist_name: container?.leader_name || mafundisho?.leader_name || 'Mafundisho',
            audio_url: ep.audio_url,
            thumbnail: seriesThumbnail || container?.thumbnail,
          });
        }
      });
    });
    
    if (allTracks.length > 0) {
      playTrack(allTracks[0], allTracks, 0);
    } else {
      showToast('Hakuna sauti za kucheza', 'warning');
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

  const thumbnailUrl = getImageUrl(container?.thumbnail) || 'https://via.placeholder.com/300';
  const totalEpisodes = series.reduce((acc, s) => acc + (s.episodes?.length || 0), 0);

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
                na {container?.leader_name || mafundisho?.leader_name || 'Unknown'}
              </Text>
              {container?.leader_title && (
                <Text style={styles.leaderTitle}>{container.leader_title}</Text>
              )}
              <Text style={styles.statsText}>
                {series.length} mfululizo • {totalEpisodes} vipindi
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
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Description */}
        {container?.description && (
          <View style={styles.descriptionSection}>
            <Text style={styles.description}>{container.description}</Text>
          </View>
        )}

        {/* Series List */}
        <View style={styles.seriesSection}>
          {series.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="folder-open-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Hakuna mfululizo kwa sasa</Text>
              <Text style={styles.emptySubtext}>Maudhui mapya yatakuja hivi karibuni</Text>
            </View>
          ) : (
            series.map((seriesItem, sIdx) => {
              const isExpanded = expandedSeries[seriesItem.series_id];
              const seriesThumbnail = getImageUrl(seriesItem.thumbnail_url || seriesItem.thumbnail) || thumbnailUrl;
              
              return (
                <View key={seriesItem.series_id} style={styles.seriesCard}>
                  {/* Series Header - Beautiful Card */}
                  <TouchableOpacity 
                    style={styles.seriesHeader}
                    onPress={() => toggleSeriesExpand(seriesItem.series_id)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: seriesThumbnail }}
                      style={styles.seriesThumbnail}
                    />
                    <View style={styles.seriesInfo}>
                      <Text style={styles.seriesTitle} numberOfLines={2}>
                        {seriesItem.title}
                      </Text>
                      <Text style={styles.seriesMeta}>
                        {seriesItem.episodes?.length || 0} vipindi
                      </Text>
                    </View>
                    <Ionicons 
                      name={isExpanded ? "chevron-up" : "chevron-down"} 
                      size={24} 
                      color={COLORS.textMuted} 
                    />
                  </TouchableOpacity>
                  
                  {/* Episodes List - Expandable */}
                  {isExpanded && (
                    <View style={styles.episodesContainer}>
                      {seriesItem.episodes?.length === 0 ? (
                        <Text style={styles.noEpisodesText}>Hakuna vipindi bado</Text>
                      ) : (
                        seriesItem.episodes?.map((episode, eIdx) => {
                          const isCurrentlyPlaying = currentTrack?.song_id === episode.episode_id && isPlaying;
                          
                          return (
                            <TouchableOpacity
                              key={episode.episode_id}
                              style={[
                                styles.episodeItem,
                                isCurrentlyPlaying && styles.episodeItemPlaying
                              ]}
                              onPress={() => handlePlayEpisode(episode, seriesItem, eIdx)}
                            >
                              <View style={styles.episodeNumber}>
                                {isCurrentlyPlaying ? (
                                  <Ionicons name="volume-high" size={18} color={COLORS.primary} />
                                ) : (
                                  <Text style={styles.episodeNumberText}>{eIdx + 1}</Text>
                                )}
                              </View>
                              
                              <View style={styles.episodeInfo}>
                                <Text 
                                  style={[
                                    styles.episodeTitle, 
                                    isCurrentlyPlaying && styles.episodeTitlePlaying
                                  ]} 
                                  numberOfLines={2}
                                >
                                  {episode.title}
                                </Text>
                                <Text style={styles.episodeDuration}>
                                  {episode.duration_seconds ? formatDuration(episode.duration_seconds) : ''}
                                </Text>
                              </View>
                              
                              {episode.audio_url ? (
                                <View style={styles.playIcon}>
                                  <Ionicons 
                                    name={isCurrentlyPlaying ? "pause-circle" : "play-circle"} 
                                    size={32} 
                                    color={isCurrentlyPlaying ? COLORS.primary : COLORS.textMuted} 
                                  />
                                </View>
                              ) : (
                                <View style={styles.noAudioBadge}>
                                  <Text style={styles.noAudioText}>Inakuja</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
      
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
      />
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
    width: 180,
    height: 180,
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
  statsText: {
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
  seriesSection: {
    padding: SPACING.md,
  },
  seriesCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  seriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  seriesThumbnail: {
    width: 70,
    height: 70,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  seriesInfo: {
    flex: 1,
  },
  seriesTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  seriesMeta: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  episodesContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: SPACING.xs,
  },
  noEpisodesText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.sm,
  },
  episodeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  episodeItemPlaying: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  episodeNumber: {
    width: 30,
    alignItems: 'center',
  },
  episodeNumberText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  episodeInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  episodeTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  episodeTitlePlaying: {
    color: COLORS.primary,
  },
  episodeDuration: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  playIcon: {
    padding: SPACING.xs,
  },
  noAudioBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  noAudioText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
});

export default MafundishoDetailScreen;
