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

const { width } = Dimensions.get('window');

// Format greeting based on time
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Quick Access Card
const QuickAccessCard = ({ item, onPress }) => (
  <TouchableOpacity style={styles.quickAccessCard} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.quickAccessImage}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={styles.quickAccessImg} />
      ) : (
        <LinearGradient colors={['#10b981', '#047857']} style={styles.quickAccessGradient}>
          <Ionicons name="musical-notes" size={20} color="#fff" />
        </LinearGradient>
      )}
    </View>
    <Text style={styles.quickAccessText} numberOfLines={1}>{item.name || item.title}</Text>
  </TouchableOpacity>
);

// Album Card
const AlbumCard = ({ album, onPress, size = 'medium' }) => {
  const cardWidth = size === 'large' ? width * 0.6 : size === 'small' ? width * 0.35 : width * 0.4;
  
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
          <LinearGradient colors={['#7c3aed', '#10b981']} style={styles.albumPlaceholder}>
            <Ionicons name="musical-notes" size={cardWidth * 0.3} color="rgba(255,255,255,0.4)" />
          </LinearGradient>
        )}
      </View>
      <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
      <Text style={styles.albumArtist} numberOfLines={1}>{album.artist_name || 'Various Artists'}</Text>
    </TouchableOpacity>
  );
};

// Wide Album Card (for featured)
const WideAlbumCard = ({ album, onPress }) => (
  <TouchableOpacity style={styles.wideCard} onPress={onPress} activeOpacity={0.8}>
    {album.thumbnail ? (
      <Image source={{ uri: album.thumbnail }} style={styles.wideCardImage} />
    ) : (
      <LinearGradient colors={['#7c3aed', '#10b981']} style={styles.wideCardImage}>
        <Ionicons name="musical-notes" size={48} color="rgba(255,255,255,0.4)" />
      </LinearGradient>
    )}
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.wideCardOverlay}>
      <Text style={styles.wideCardTitle} numberOfLines={1}>{album.title}</Text>
      <Text style={styles.wideCardArtist} numberOfLines={1}>{album.artist_name}</Text>
    </LinearGradient>
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
        <Text style={styles.seeAll}>See all</Text>
      </TouchableOpacity>
    )}
  </View>
);

export default function HomeScreen({ navigation }) {
  const [homeData, setHomeData] = useState(null);
  const [categories, setCategories] = useState([]);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const burner = homeData?.burners?.[0];
  const quickAccess = categories.slice(0, 6);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, currentSong && { paddingBottom: 90 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        {burner && (
          <LinearGradient
            colors={['#1e3a5f', '#0f172a', '#000']}
            style={styles.heroSection}
          >
            <Text style={styles.heroTitle}>{burner.headline || 'Discover Sacred Music'}</Text>
            <Text style={styles.heroSubtitle}>{burner.subtitle || 'Stream Christian songs and hymns'}</Text>
            <TouchableOpacity style={styles.heroCta}>
              <Text style={styles.heroCtaText}>{burner.cta_text || 'Start Listening'}</Text>
            </TouchableOpacity>
          </LinearGradient>
        )}

        {/* Greeting + Quick Access */}
        <View style={styles.content}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          
          <View style={styles.quickAccessGrid}>
            {quickAccess.map((item, index) => (
              <QuickAccessCard 
                key={item.category_id || index}
                item={item}
                onPress={() => navigation.navigate('Category', { category: item })}
              />
            ))}
          </View>

          {/* Dynamic Sections */}
          {homeData?.sections?.map((section, idx) => {
            if (section.type === 'hero' || section.type === 'quick_access') return null;
            const items = section.items || [];
            if (items.length === 0) return null;

            return (
              <View key={section.section_id || idx} style={styles.section}>
                <SectionHeader 
                  title={section.title}
                  subtitle={section.description}
                  onSeeAll={items.length > 5 ? () => {} : null}
                />
                
                {section.type === 'featured_albums' ? (
                  <FlatList
                    horizontal
                    data={items.slice(0, 5)}
                    keyExtractor={(item) => item.album_id}
                    renderItem={({ item }) => (
                      <WideAlbumCard 
                        album={item} 
                        onPress={() => navigation.navigate('Album', { albumId: item.album_id })}
                      />
                    )}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalList}
                  />
                ) : (
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
                )}
              </View>
            );
          })}

          {/* Additional Burners */}
          {homeData?.burners?.length > 1 && (
            <View style={styles.burnersSection}>
              {homeData.burners.slice(1, 3).map((b, idx) => (
                <LinearGradient
                  key={b.burner_id || idx}
                  colors={['#1e1b4b', '#312e81']}
                  style={styles.smallBurner}
                >
                  <Text style={styles.smallBurnerTitle}>{b.headline}</Text>
                  <Text style={styles.smallBurnerSubtitle}>{b.subtitle}</Text>
                  <TouchableOpacity style={styles.smallBurnerCta}>
                    <Text style={styles.smallBurnerCtaText}>{b.cta_text || 'Explore'}</Text>
                  </TouchableOpacity>
                </LinearGradient>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {currentSong && <MiniPlayer navigation={navigation} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  heroSection: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    marginBottom: 20,
  },
  heroCta: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 50,
  },
  heroCtaText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    marginTop: 8,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  quickAccessCard: {
    width: (width - 40) / 2,
    height: 56,
    backgroundColor: '#27272a',
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
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    paddingHorizontal: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 2,
  },
  seeAll: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  horizontalList: {
    paddingRight: 16,
  },
  albumCard: {
    marginRight: 12,
  },
  albumImageContainer: {
    borderRadius: 8,
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
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  albumArtist: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 2,
  },
  wideCard: {
    width: width * 0.7,
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
    position: 'relative',
  },
  wideCardImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wideCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  wideCardTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  wideCardArtist: {
    color: '#d4d4d8',
    fontSize: 13,
  },
  burnersSection: {
    gap: 12,
    marginTop: 8,
  },
  smallBurner: {
    padding: 16,
    borderRadius: 8,
  },
  smallBurnerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  smallBurnerSubtitle: {
    color: '#a1a1aa',
    fontSize: 13,
    marginBottom: 12,
  },
  smallBurnerCta: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 50,
  },
  smallBurnerCtaText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
