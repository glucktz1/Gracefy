import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Image,
  StyleSheet, FlatList, Dimensions, ActivityIndicator, StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { contentService } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import MiniPlayer from '../components/MiniPlayer';

const { width } = Dimensions.get('window');

// Song Item
const SongItem = ({ song, index, onPress, isPlaying, isActive }) => (
  <TouchableOpacity style={styles.songItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.songThumb}>
      {song.album_thumbnail || song.thumbnail ? (
        <Image source={{ uri: song.album_thumbnail || song.thumbnail }} style={styles.songThumbImage} />
      ) : (
        <View style={styles.songThumbPlaceholder}>
          <Ionicons name="musical-notes" size={16} color="#52525b" />
        </View>
      )}
    </View>
    <View style={styles.songInfo}>
      <Text style={[styles.songTitle, isActive && styles.songTitleActive]} numberOfLines={1}>
        {song.title}
      </Text>
      <Text style={styles.songArtist} numberOfLines={1}>
        {song.artist_name || 'Unknown Artist'}
      </Text>
    </View>
    {isActive && isPlaying && (
      <View style={styles.playingIndicator}>
        <View style={[styles.bar, { height: 8 }]} />
        <View style={[styles.bar, { height: 14 }]} />
        <View style={[styles.bar, { height: 10 }]} />
      </View>
    )}
  </TouchableOpacity>
);

// Album Card
const AlbumCard = ({ album, onPress }) => (
  <TouchableOpacity style={styles.albumCard} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.albumImageContainer}>
      {album.thumbnail ? (
        <Image source={{ uri: album.thumbnail }} style={styles.albumImage} />
      ) : (
        <LinearGradient colors={['#7c3aed', '#10b981']} style={styles.albumPlaceholder}>
          <Ionicons name="musical-notes" size={32} color="rgba(255,255,255,0.4)" />
        </LinearGradient>
      )}
    </View>
    <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
    <Text style={styles.albumArtist} numberOfLines={1}>{album.artist_name}</Text>
  </TouchableOpacity>
);

// Artist Card
const ArtistCard = ({ artist }) => (
  <View style={styles.artistCard}>
    <View style={styles.artistImage}>
      {artist.photo ? (
        <Image source={{ uri: artist.photo }} style={styles.artistImg} />
      ) : (
        <View style={styles.artistPlaceholder}>
          <Ionicons name="person" size={32} color="#52525b" />
        </View>
      )}
    </View>
    <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
    <Text style={styles.artistLabel}>Artist</Text>
  </View>
);

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const { currentSong, isPlaying, playSong } = usePlayer();

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await contentService.search(query);
        setResults(data);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  const loadCategories = async () => {
    try {
      const data = await contentService.getCategories();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handlePlaySong = (song, index) => {
    const queue = results.songs.map(s => ({ 
      song: s, 
      album: { thumbnail: s.album_thumbnail, artist_name: s.artist_name } 
    }));
    playSong(song, { thumbnail: song.album_thumbnail, artist_name: song.artist_name }, queue, index);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Search Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#71717a" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="What do you want to listen to?"
            placeholderTextColor="#71717a"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#71717a" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, currentSong && { paddingBottom: 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#10b981" />
          </View>
        )}

        {/* Search Results */}
        {results && !loading && (
          <>
            {/* Songs */}
            {results.songs?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Songs</Text>
                {results.songs.slice(0, 5).map((song, idx) => (
                  <SongItem
                    key={song.song_id}
                    song={song}
                    index={idx}
                    onPress={() => handlePlaySong(song, idx)}
                    isActive={currentSong?.song_id === song.song_id}
                    isPlaying={isPlaying}
                  />
                ))}
              </View>
            )}

            {/* Albums */}
            {results.albums?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Albums</Text>
                <FlatList
                  horizontal
                  data={results.albums}
                  keyExtractor={(item) => item.album_id}
                  renderItem={({ item }) => (
                    <AlbumCard 
                      album={item} 
                      onPress={() => navigation.navigate('Album', { albumId: item.album_id })}
                    />
                  )}
                  showsHorizontalScrollIndicator={false}
                />
              </View>
            )}

            {/* Artists */}
            {results.artists?.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Artists</Text>
                <FlatList
                  horizontal
                  data={results.artists}
                  keyExtractor={(item) => item.singer_id}
                  renderItem={({ item }) => <ArtistCard artist={item} />}
                  showsHorizontalScrollIndicator={false}
                />
              </View>
            )}
          </>
        )}

        {/* Browse Categories (when no search) */}
        {!results && !loading && (
          <View style={styles.browseSection}>
            <Text style={styles.sectionTitle}>Browse All</Text>
            <View style={styles.categoryGrid}>
              {categories.map((cat, idx) => (
                <TouchableOpacity 
                  key={cat.category_id || idx}
                  style={styles.categoryCard}
                  onPress={() => navigation.navigate('Category', { category: cat })}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={getCategoryColors(idx)}
                    style={styles.categoryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.categoryName}>{cat.name}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {currentSong && <MiniPlayer navigation={navigation} />}
    </View>
  );
}

// Get category gradient colors
const getCategoryColors = (index) => {
  const colors = [
    ['#7c3aed', '#a855f7'],
    ['#10b981', '#34d399'],
    ['#f59e0b', '#fbbf24'],
    ['#3b82f6', '#60a5fa'],
    ['#ef4444', '#f87171'],
    ['#ec4899', '#f472b6'],
    ['#06b6d4', '#22d3ee'],
    ['#84cc16', '#a3e635'],
  ];
  return colors[index % colors.length];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#18181b',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    color: '#fff',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  songThumb: {
    width: 48,
    height: 48,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  songThumbImage: {
    width: '100%',
    height: '100%',
  },
  songThumbPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  songTitleActive: {
    color: '#10b981',
  },
  songArtist: {
    color: '#71717a',
    fontSize: 13,
    marginTop: 2,
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  bar: {
    width: 3,
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  albumCard: {
    width: width * 0.4,
    marginRight: 12,
  },
  albumImageContainer: {
    width: '100%',
    aspectRatio: 1,
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
  artistCard: {
    alignItems: 'center',
    marginRight: 16,
  },
  artistImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 8,
  },
  artistImg: {
    width: '100%',
    height: '100%',
  },
  artistPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artistName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  artistLabel: {
    color: '#71717a',
    fontSize: 12,
  },
  browseSection: {
    marginTop: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: (width - 44) / 2,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },
  categoryGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'flex-end',
  },
  categoryName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
