import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { radioAPI } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import Toast from '../components/Toast';
import { FullScreenLoader } from '../components/GracefyLoader';

const RadioScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stations, setStations] = useState([]);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  
  // Animation for playing indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Use the shared player context
  const { playRadio, stopPlayback, currentTrack, isPlaying } = usePlayer();

  // Determine if a station is currently playing
  const playingStation = currentTrack?.isRadio ? currentTrack?.radioStation : null;
  const isStationPlaying = (station) => 
    playingStation?.station_id === station.station_id && isPlaying;

  useEffect(() => {
    loadStations();
  }, []);

  // Pulse animation for playing station
  useEffect(() => {
    if (playingStation && isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [playingStation, isPlaying]);

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
  };

  const loadStations = async () => {
    try {
      const response = await radioAPI.getStations();
      setStations(response.data?.stations || []);
    } catch (error) {
      console.error('Error loading radio stations:', error);
      showToast('Imeshindwa kupakia redio', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadStations();
  }, []);

  const handlePlayStation = async (station) => {
    try {
      // If same station is playing, toggle pause/play
      if (isStationPlaying(station)) {
        await stopPlayback();
        showToast(`Imesimamishwa: ${station.name}`, 'info');
        return;
      }

      showToast(`Inapakia ${station.name}...`, 'info');
      
      // Use the shared player context to play radio
      await playRadio(station);
      
      // Track play analytics
      try {
        await radioAPI.trackPlay({
          station_id: station.station_id,
          platform: 'mobile',
        });
      } catch (e) {
        console.log('Failed to track radio play:', e);
      }

      showToast(`Inacheza: ${station.name}`, 'success');
    } catch (error) {
      console.error('Error playing station:', error);
      showToast('Imeshindwa kucheza redio. Jaribu tena.', 'error');
    }
  };

  const handleStopPlayback = async () => {
    await stopPlayback();
    showToast('Redio imesimamishwa', 'info');
  };

  const renderStationCard = (station, index) => {
    const isActive = isStationPlaying(station);

    return (
      <TouchableOpacity
        key={station.station_id}
        style={[
          styles.stationCard,
          isActive && styles.stationCardActive,
        ]}
        onPress={() => handlePlayStation(station)}
        activeOpacity={0.7}
      >
        <View style={styles.stationRow}>
          {/* Station Logo */}
          <View style={[styles.stationLogo, isActive && styles.stationLogoActive]}>
            {station.favicon ? (
              <Image
                source={{ uri: station.favicon }}
                style={styles.logoImage}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={['#8B5CF6', '#A855F7']}
                style={styles.logoGradient}
              >
                <Ionicons name="radio" size={24} color={COLORS.text} />
              </LinearGradient>
            )}
            {isActive && (
              <Animated.View 
                style={[
                  styles.playingIndicator,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              />
            )}
          </View>

          {/* Station Info */}
          <View style={styles.stationInfo}>
            <View style={styles.stationNameRow}>
              <Text style={styles.stationName} numberOfLines={1}>
                {station.name}
              </Text>
              {station.is_featured && (
                <View style={styles.featuredBadge}>
                  <Ionicons name="star" size={10} color="#F59E0B" />
                </View>
              )}
            </View>
            <View style={styles.stationMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="globe-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{station.country}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="language-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{station.language}</Text>
              </View>
            </View>
          </View>

          {/* Play/Pause Button */}
          <TouchableOpacity
            style={[styles.playButton, isActive && styles.playButtonActive]}
            onPress={() => handlePlayStation(station)}
          >
            <Ionicons
              name={isActive ? 'pause' : 'play'}
              size={24}
              color={isActive ? '#8B5CF6' : COLORS.text}
            />
          </TouchableOpacity>
        </View>

        {/* Playing Animation Bar */}
        {isActive && (
          <View style={styles.playingBar}>
            <View style={styles.soundWave}>
              {[...Array(5)].map((_, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      height: 8 + Math.random() * 12,
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.playingText}>Inacheza Sasa</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Inapakia redio...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <Ionicons name="radio" size={28} color="#8B5CF6" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Redio za Kikristo</Text>
            <Text style={styles.headerSubtitle}>Sikiliza mubashara</Text>
          </View>
        </View>
        {playingStation && (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStopPlayback}
          >
            <Ionicons name="stop-circle" size={28} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Now Playing Banner */}
      {playingStation && isPlaying && (
        <View style={styles.nowPlayingBanner}>
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nowPlayingGradient}
          >
            <View style={styles.nowPlayingContent}>
              <View style={styles.soundWaveSmall}>
                {[...Array(4)].map((_, i) => (
                  <View key={i} style={[styles.waveBarSmall, { height: 8 + Math.random() * 12 }]} />
                ))}
              </View>
              <View style={styles.nowPlayingInfo}>
                <Text style={styles.nowPlayingLabel}>INACHEZA SASA</Text>
                <Text style={styles.nowPlayingName} numberOfLines={1}>
                  {playingStation.name}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.nowPlayingPause}
                onPress={handleStopPlayback}
              >
                <Ionicons name="pause" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Featured Section */}
        {stations.filter(s => s.is_featured).length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="star" size={18} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Redio Maarufu</Text>
            </View>
            {stations.filter(s => s.is_featured).map((station, index) => 
              renderStationCard(station, index)
            )}
          </View>
        )}

        {/* All Stations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="radio-outline" size={18} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Redio Zote</Text>
            <Text style={styles.stationCount}>{stations.length}</Text>
          </View>
          {stations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="radio-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Hakuna redio zinazopatikana</Text>
            </View>
          ) : (
            stations.map((station, index) => renderStationCard(station, index))
          )}
        </View>

        {/* Bottom Padding for mini player */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Toast */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: SPACING.xs,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  stopButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nowPlayingBanner: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: SPACING.md,
    overflow: 'hidden',
  },
  nowPlayingGradient: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  nowPlayingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  soundWaveSmall: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 20,
    marginRight: SPACING.sm,
  },
  waveBarSmall: {
    width: 3,
    backgroundColor: COLORS.text,
    marginHorizontal: 1,
    borderRadius: 1,
  },
  nowPlayingInfo: {
    flex: 1,
  },
  nowPlayingLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  nowPlayingName: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  nowPlayingPause: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginLeft: SPACING.xs,
  },
  stationCount: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    marginLeft: 'auto',
  },
  stationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stationCardActive: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
  },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stationLogo: {
    width: 56,
    height: 56,
    borderRadius: SPACING.md,
    overflow: 'hidden',
    position: 'relative',
  },
  stationLogoActive: {
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playingIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  stationInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  stationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stationName: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    flex: 1,
  },
  featuredBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: SPACING.xs,
  },
  stationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  metaText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    marginLeft: 4,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  playingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
  },
  soundWave: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 20,
  },
  waveBar: {
    width: 3,
    backgroundColor: '#8B5CF6',
    marginHorizontal: 1,
    borderRadius: 1,
  },
  playingText: {
    color: '#8B5CF6',
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    marginLeft: SPACING.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    marginTop: SPACING.md,
  },
});

export default RadioScreen;
