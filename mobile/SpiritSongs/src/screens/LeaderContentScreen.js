import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { leaderContentAPI, getImageUrl, getAudioUrl } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { showToast } from '../components/Toast';

const { width } = Dimensions.get('window');

const LeaderContentScreen = ({ route, navigation }) => {
  const { leader } = route.params || {};
  
  const [loading, setLoading] = useState(true);
  const [leaderData, setLeaderData] = useState(leader || null);
  const [content, setContent] = useState([]);
  const [containers, setContainers] = useState([]);
  
  const { playTrack, currentTrack, isPlaying } = usePlayer();

  useEffect(() => {
    loadLeaderContent();
  }, [leader?.leader_id]);

  const loadLeaderContent = async () => {
    try {
      setLoading(true);
      if (leader?.leader_id) {
        const response = await leaderContentAPI.getByLeader(leader.leader_id);
        if (response.data) {
          setLeaderData(response.data.leader || leader);
          setContent(response.data.content || []);
          setContainers(response.data.containers || []);
        }
      }
    } catch (error) {
      console.error('Error loading leader content:', error);
      showToast('Imeshindikana kupakia maudhui', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayContent = (item) => {
    if (item.audio_url) {
      // Play individual content item
      const track = {
        song_id: item.content_id || item.container_id,
        title: item.title,
        artist_name: leaderData?.name || item.leader_name || 'Mafundisho',
        audio_url: item.audio_url,
        thumbnail: item.thumbnail || leaderData?.photo,
      };
      playTrack(track, [track], 0);
    } else if (item.container_id) {
      // Navigate to container details
      navigation.navigate('Album', {
        album: {
          album_id: item.container_id,
          title: item.title,
          artist_name: leaderData?.name || item.leader_name,
          thumbnail: item.thumbnail_url || leaderData?.photo,
          description: item.description,
        }
      });
    } else {
      showToast('Hakuna sauti kwa sasa', 'info');
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

  const artworkUrl = getImageUrl(leaderData?.photo) || 'https://via.placeholder.com/300';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with Leader Info */}
        <LinearGradient
          colors={['#3a2a1a', '#2a1a0a', COLORS.background]}
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

            <View style={styles.leaderInfo}>
              <Image
                source={{ uri: artworkUrl }}
                style={styles.leaderPhoto}
              />
              <Text style={styles.leaderName}>{leaderData?.name}</Text>
              <Text style={styles.leaderTitle}>
                {leaderData?.title || 'Kiongozi wa Dini'} • {leaderData?.church_name || 'Mafundisho'}
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{content.length + containers.length}</Text>
                  <Text style={styles.statLabel}>Maudhui</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{leaderData?.followers || 0}</Text>
                  <Text style={styles.statLabel}>Wafuasi</Text>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* Bio Section */}
        {leaderData?.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.sectionTitle}>Kuhusu</Text>
            <Text style={styles.bioText}>{leaderData.bio}</Text>
          </View>
        )}

        {/* Content Containers (Series/Courses) */}
        {containers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mafunzo na Masomo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {containers.map((container) => (
                <TouchableOpacity
                  key={container.container_id}
                  style={styles.containerCard}
                  onPress={() => handlePlayContent(container)}
                >
                  <Image
                    source={{ uri: getImageUrl(container.thumbnail_url) || artworkUrl }}
                    style={styles.containerImage}
                  />
                  <Text style={styles.containerTitle} numberOfLines={2}>
                    {container.title}
                  </Text>
                  <Text style={styles.containerMeta}>
                    {container.total_episodes || 0} sehemu
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Individual Content Items */}
        {content.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Maudhui Yote</Text>
            {content.map((item, index) => {
              const isCurrentlyPlaying = currentTrack?.song_id === item.content_id && isPlaying;
              return (
                <TouchableOpacity
                  key={item.content_id || index}
                  style={[styles.contentItem, isCurrentlyPlaying && styles.contentItemPlaying]}
                  onPress={() => handlePlayContent(item)}
                >
                  <Image
                    source={{ uri: getImageUrl(item.thumbnail) || artworkUrl }}
                    style={styles.contentThumbnail}
                  />
                  <View style={styles.contentInfo}>
                    <Text style={[styles.contentTitle, isCurrentlyPlaying && styles.contentTitlePlaying]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.contentMeta}>
                      {item.category || 'Mafundisho'} {item.duration ? `• ${formatDuration(item.duration)}` : ''}
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
            })}
          </View>
        )}

        {/* Empty State */}
        {content.length === 0 && containers.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Hakuna maudhui kwa sasa</Text>
            <Text style={styles.emptySubtext}>Maudhui mapya yatakuja hivi karibuni</Text>
          </View>
        )}

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
  leaderInfo: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  leaderPhoto: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: COLORS.card,
    marginBottom: SPACING.md,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  leaderName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  leaderTitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: SPACING.xl,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  bioSection: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bioText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  section: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  containerCard: {
    width: 140,
    marginRight: SPACING.md,
  },
  containerImage: {
    width: 140,
    height: 140,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.card,
    marginBottom: SPACING.sm,
  },
  containerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  containerMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contentItemPlaying: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    marginHorizontal: -SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  contentThumbnail: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.card,
  },
  contentInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  contentTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  contentTitlePlaying: {
    color: COLORS.primary,
  },
  contentMeta: {
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

export default LeaderContentScreen;
