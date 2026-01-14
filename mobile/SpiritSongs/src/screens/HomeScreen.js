import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, RefreshControl,
  StyleSheet, Dimensions, FlatList, StatusBar, ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { contentService } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import MiniPlayer from '../components/MiniPlayer';
import CategoryTabs from '../components/CategoryTabs';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

// Format greeting based on time
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Quick Access Card - Compact horizontal cards like Spotify
const QuickAccessCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.quickAccessCard} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.quickAccessImage}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.quickAccessImg} />
      ) : (
        <LinearGradient colors={['#1DB954', '#191414']} style={styles.quickAccessGradient}>
          <Ionicons name="musical-notes" size={18} color="#fff" />
        </LinearGradient>
      )}
    </View>
    <Text style={styles.quickAccessText} numberOfLines={2}>{item.name || item.title}</Text>
  </TouchableOpacity>
);

// Album Card - Square cards
const AlbumCard = ({ album, onPress, size = 'medium' }) => {
  const cardWidth = size === 'large' ? width * 0.55 : size === 'small' ? width * 0.36 : width * 0.42;
  
  return (
    <TouchableOpacity 
      style={[styles.albumCard, { width: cardWidth }]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.albumImageContainer, { height: cardWidth }]}>
        {album.thumbnail ? (
          <Image source={{ uri: album.thumbnail }} style={styles.albumImage} />
        ) : (
          <LinearGradient colors={['#535353', '#121212']} style={styles.albumPlaceholder}>
            <Ionicons name="musical-notes" size={cardWidth * 0.3} color="rgba(255,255,255,0.3)" />
          </LinearGradient>
        )}
      </View>
      <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
      <Text style={styles.albumArtist} numberOfLines={1}>{album.artist_name || 'Various Artists'}</Text>
    </TouchableOpacity>
  );
};

// Mix Card - For "Your top mixes" section
const MixCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.mixCard} onPress={onPress} activeOpacity={0.8}>
    <LinearGradient 
      colors={item.colors || ['#274a78', '#1e3264']} 
      style={styles.mixGradient}
    >
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.mixImage} />
      ) : (
        <View style={styles.mixImagePlaceholder}>
          <Ionicons name="musical-notes" size={32} color="rgba(255,255,255,0.5)" />
        </View>
      )}
      <View style={styles.mixInfo}>
        <Text style={styles.mixTitle} numberOfLines={2}>{item.title || item.name}</Text>
        <Text style={styles.mixSubtitle} numberOfLines={1}>
          {item.artist_name || item.description || 'Mix'}
        </Text>
      </View>
    </LinearGradient>
  </TouchableOpacity>
);

// Recently Played Card - Compact cards
const RecentCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.recentCard} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.recentImageContainer}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.recentImage} />
      ) : (
        <LinearGradient colors={['#535353', '#121212']} style={styles.recentImage}>
          <Ionicons name="musical-notes" size={24} color="rgba(255,255,255,0.4)" />
        </LinearGradient>
      )}
    </View>
    <Text style={styles.recentTitle} numberOfLines={2}>{item.title || item.name}</Text>
    <Text style={styles.recentSubtitle} numberOfLines={1}>
      {item.artist_name || item.type || 'Album'}
    </Text>
  </TouchableOpacity>
);

// Section Header
const SectionHeader = ({ title, subtitle, onSeeAll }) => (
  <View style={styles.sectionHeader}>
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll}>
        <Text style={styles.seeAll}>Show all</Text>
      </TouchableOpacity>
    )}
  </View>
);

export default function HomeScreen({ navigation }) {
  const [homeData, setHomeData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { currentSong } = usePlayer();
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    try {
      const [home, cats] = await Promise.all([
        contentService.getHome(),
        contentService.getCategories(),
      ]);
      setHomeData(home);
      setCategories(cats.categories || []);
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleNowPlaying = () => {
    navigation.navigate('NowPlaying');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const burner = homeData?.burners?.[0];
  const quickAccess = categories.slice(0, 6);
  
  // Create mock "Your top mixes" from albums
  const topMixes = (homeData?.sections?.find(s => s.type === 'featured_albums')?.items || []).slice(0, 5);
  
  // Create "Recents" from random albums
  const recents = (homeData?.sections?.find(s => s.type !== 'featured_albums' && s.type !== 'hero')?.items || []).slice(0, 8);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, currentSong && { paddingBottom: 140 }]}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Category Tabs */}
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.profileButton}>
              <LinearGradient colors={['#b83280', '#ff6b6b']} style={styles.profileGradient}>
                <Text style={styles.profileInitial}>
                  {user?.name?.charAt(0)?.toUpperCase() || 'S'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <CategoryTabs 
              categories={categories.slice(0, 3)} 
              activeCategory={activeCategory}
              onSelect={setActiveCategory}
            />
          </View>
        </View>

        {/* Featured Burner Card */}
        {burner && (
          <TouchableOpacity style={styles.featuredCard} activeOpacity={0.9}>
            <LinearGradient
              colors={['#8b6914', '#3d2f0a']}
              style={styles.featuredGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.featuredContent}>
                <Text style={styles.featuredTitle} numberOfLines={2}>
                  {burner.headline || 'Discover Sacred Music'}
                </Text>
                <Text style={styles.featuredSubtitle} numberOfLines={2}>
                  {burner.subtitle || 'Stream Christian songs and hymns'}
                </Text>
                <View style={styles.featuredActions}>
                  <TouchableOpacity style={styles.previewButton}>
                    <Ionicons name="play" size={16} color="#000" />
                    <Text style={styles.previewText}>Preview</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addButton}>
                    <Ionicons name="add" size={24} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Greeting */}
        <Text style={styles.greeting}>{getGreeting()}</Text>

        {/* Quick Access Grid */}
        <View style={styles.quickAccessGrid}>
          {quickAccess.map((item, index) => (
            <QuickAccessCard 
              key={item.category_id || index}
              item={item}
              onPress={() => navigation.navigate('Category', { category: item })}
            />
          ))}
        </View>

        {/* Your top mixes */}
        {topMixes.length > 0 && (
          <View style={styles.section}>
            <SectionHeader 
              title="Your top mixes"
              onSeeAll={() => {}}
            />
            <FlatList
              horizontal
              data={topMixes}
              keyExtractor={(item, idx) => item.album_id || `mix-${idx}`}
              renderItem={({ item, index }) => (
                <MixCard 
                  item={{
                    ...item,
                    colors: index % 2 === 0 ? ['#274a78', '#1e3264'] : ['#503750', '#30223a']
                  }}
                  onPress={() => navigation.navigate('Album', { albumId: item.album_id })}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Recents */}
        {recents.length > 0 && (
          <View style={styles.section}>
            <SectionHeader 
              title="Recents"
              onSeeAll={() => navigation.navigate('Library')}
            />
            <FlatList
              horizontal
              data={recents}
              keyExtractor={(item, idx) => item.album_id || `recent-${idx}`}
              renderItem={({ item }) => (
                <RecentCard 
                  item={item}
                  onPress={() => navigation.navigate('Album', { albumId: item.album_id })}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        )}

        {/* Dynamic Sections */}
        {homeData?.sections?.map((section, idx) => {
          if (section.type === 'hero' || section.type === 'quick_access' || section.type === 'featured_albums') return null;
          const items = section.items || [];
          if (items.length === 0) return null;

          return (
            <View key={section.section_id || idx} style={styles.section}>
              <SectionHeader 
                title={section.title}
                subtitle={section.description}
                onSeeAll={items.length > 5 ? () => {} : null}
              />
              <FlatList
                horizontal
                data={items.slice(0, 10)}
                keyExtractor={(item) => item.album_id}
                renderItem={({ item }) => (
                  <AlbumCard 
                    album={item}
                    size={idx % 2 === 0 ? 'medium' : 'small'}
                    onPress={() => navigation.navigate('Album', { albumId: item.album_id })}
                  />
                )}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              />
            </View>
          );
        })}

        {/* Additional Promotional Cards */}
        {homeData?.burners?.length > 1 && (
          <View style={styles.promosSection}>
            {homeData.burners.slice(1, 3).map((b, idx) => (
              <TouchableOpacity key={b.burner_id || idx} style={styles.promoCard}>
                <LinearGradient
                  colors={idx === 0 ? ['#1e3a5f', '#0a192f'] : ['#3d1a5f', '#1a0a2f']}
                  style={styles.promoGradient}
                >
                  <Text style={styles.promoTitle}>{b.headline}</Text>
                  <Text style={styles.promoSubtitle}>{b.subtitle}</Text>
                  <TouchableOpacity style={styles.promoCta}>
                    <Text style={styles.promoCtaText}>{b.cta_text || 'Explore'}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Mini Player */}
      {currentSong && <MiniPlayer navigation={navigation} onPress={handleNowPlaying} />}
    </View>
  );
}

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  headerSection: {
    paddingTop: 48,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  profileButton: {
    marginRight: 8,
  },
  profileGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  featuredCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  featuredGradient: {
    padding: 16,
  },
  featuredContent: {
    flex: 1,
  },
  featuredTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  featuredSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 12,
  },
  featuredActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  previewText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },
  addButton: {
    padding: 4,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 24,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  quickAccessCard: {
    width: (width - 40) / 2,
    height: 56,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  quickAccessImage: {
    width: 56,
    height: 56,
  },
  quickAccessImg: {
    width: '100%',
    height: '100%',
  },
  quickAccessGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickAccessText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 12,
    paddingHorizontal: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  seeAll: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  horizontalList: {
    paddingHorizontal: 16,
  },
  albumCard: {
    marginRight: 12,
  },
  albumImageContainer: {
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  albumImage: {
    width: '100%',
    height: '100%',
  },
  albumPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumTitle: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  albumArtist: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  mixCard: {
    width: width * 0.4,
    height: 200,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mixGradient: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  mixImage: {
    width: 80,
    height: 80,
    borderRadius: 4,
  },
  mixImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mixInfo: {
    marginTop: 8,
  },
  mixTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  mixSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  recentCard: {
    width: width * 0.32,
    marginRight: 12,
  },
  recentImageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  recentImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  recentSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  promosSection: {
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 8,
  },
  promoCard: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  promoGradient: {
    padding: 20,
  },
  promoTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  promoSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 16,
  },
  promoCta: {
    backgroundColor: COLORS.textPrimary,
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  promoCtaText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },
});
