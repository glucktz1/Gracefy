// Spirit Songs - Expo Snack Version
// Copy this entire code to https://snack.expo.dev/

import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, TextInput,
  StyleSheet, Dimensions, FlatList, StatusBar, ActivityIndicator,
  Modal, Animated, Share
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');

// ============ CONFIG ============
const API_URL = 'https://spiritsongs-app.preview.emergentagent.com/api';
const COLORS = {
  primary: '#1DB954',
  background: '#121212',
  backgroundLight: '#181818',
  backgroundCard: '#282828',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#7f7f7f',
};

// ============ CONTEXTS ============
const PlayerContext = createContext(null);
const SAMPLE_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

const PlayerProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const soundRef = useRef(null);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    });
    return () => { if (soundRef.current) soundRef.current.unloadAsync(); };
  }, []);

  const playSong = async (song, album) => {
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      const { sound } = await Audio.Sound.createAsync(
        { uri: song.audio_url || SAMPLE_AUDIO },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis / 1000);
            setDuration(status.durationMillis / 1000 || 0);
            setIsPlaying(status.isPlaying);
          }
        }
      );
      soundRef.current = sound;
      setCurrentSong(song);
      setCurrentAlbum(album);
    } catch (e) { console.error(e); }
  };

  const togglePlay = async () => {
    if (!soundRef.current) return;
    if (isPlaying) await soundRef.current.pauseAsync();
    else await soundRef.current.playAsync();
  };

  const seekTo = async (sec) => {
    if (soundRef.current) await soundRef.current.setPositionAsync(sec * 1000);
  };

  return (
    <PlayerContext.Provider value={{ currentSong, currentAlbum, isPlaying, position, duration, playSong, togglePlay, seekTo }}>
      {children}
    </PlayerContext.Provider>
  );
};

const usePlayer = () => useContext(PlayerContext);

// ============ ANIMATED BARS ============
const AnimatedBars = ({ isPlaying, size = 'small' }) => {
  const bars = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.5)).current, 
                useRef(new Animated.Value(0.7)).current, useRef(new Animated.Value(0.4)).current];
  const h = size === 'large' ? 24 : 12;

  useEffect(() => {
    if (isPlaying) {
      const anims = bars.map((b, i) => Animated.loop(Animated.sequence([
        Animated.timing(b, { toValue: 1, duration: 300 + i * 50, useNativeDriver: false }),
        Animated.timing(b, { toValue: 0.2, duration: 250 + i * 40, useNativeDriver: false }),
      ])));
      anims.forEach(a => a.start());
      return () => anims.forEach(a => a.stop());
    }
  }, [isPlaying]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: h, gap: 2 }}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{ width: size === 'large' ? 4 : 2, backgroundColor: COLORS.primary, borderRadius: 1,
          height: b.interpolate({ inputRange: [0, 1], outputRange: [h * 0.2, h] }) }} />
      ))}
    </View>
  );
};

// ============ MINI PLAYER ============
const MiniPlayer = ({ onPress }) => {
  const { currentSong, currentAlbum, isPlaying, togglePlay, position, duration } = usePlayer();
  if (!currentSong) return null;
  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <TouchableOpacity style={styles.miniPlayer} onPress={onPress} activeOpacity={0.95}>
      <View style={styles.miniProgress}><View style={[styles.miniProgressBar, { width: `${progress}%` }]} /></View>
      <View style={styles.miniContent}>
        <View style={styles.miniArt}>
          {currentAlbum?.thumbnail ? <Image source={{ uri: currentAlbum.thumbnail }} style={styles.miniArtImg} /> :
            <LinearGradient colors={['#7c3aed', '#10b981']} style={styles.miniArtImg}>
              <Ionicons name="musical-notes" size={20} color="rgba(255,255,255,0.6)" />
            </LinearGradient>}
        </View>
        <View style={styles.miniInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isPlaying && <AnimatedBars isPlaying={isPlaying} />}
            <Text style={styles.miniTitle} numberOfLines={1}>{currentSong.title}</Text>
          </View>
          <Text style={styles.miniArtist} numberOfLines={1}>{currentAlbum?.artist_name || 'Unknown'}</Text>
        </View>
        <TouchableOpacity onPress={togglePlay} style={{ padding: 8 }}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// ============ HOME SCREEN ============
const HomeScreen = ({ navigation }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currentSong } = usePlayer();

  useEffect(() => {
    fetch(`${API_URL}/user/home`).then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={[styles.scroll, currentSong && { paddingBottom: 140 }]}>
        <LinearGradient colors={['#1e3a5f', '#121212']} style={styles.hero}>
          <Text style={styles.heroTitle}>Spirit Songs</Text>
          <Text style={styles.heroSub}>Stream Christian music</Text>
          <TouchableOpacity style={styles.heroCta}><Text style={styles.heroCtaText}>Start Listening</Text></TouchableOpacity>
        </LinearGradient>
        
        <Text style={styles.greeting}>{greeting}</Text>
        
        {data?.sections?.filter(s => s.items?.length > 0).map((section, idx) => (
          <View key={section.section_id || idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <FlatList horizontal data={section.items.slice(0, 6)} keyExtractor={i => i.album_id}
              showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.albumCard} onPress={() => navigation.navigate('Album', { album: item })}>
                  <View style={styles.albumArt}>
                    {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.albumImg} /> :
                      <LinearGradient colors={['#535353', '#121212']} style={styles.albumImg}>
                        <Ionicons name="musical-notes" size={40} color="rgba(255,255,255,0.3)" />
                      </LinearGradient>}
                  </View>
                  <Text style={styles.albumTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.albumArtist} numberOfLines={1}>{item.artist_name || 'Various'}</Text>
                </TouchableOpacity>
              )} />
          </View>
        ))}
      </ScrollView>
      <MiniPlayer onPress={() => navigation.navigate('NowPlaying')} />
    </View>
  );
};

// ============ SEARCH SCREEN ============
const SearchScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const { currentSong } = usePlayer();

  const search = async (q) => {
    setQuery(q);
    if (q.length < 2) { setResults(null); return; }
    try {
      const r = await fetch(`${API_URL}/user/search?q=${encodeURIComponent(q)}`);
      setResults(await r.json());
    } catch (e) { console.error(e); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchHeader}>
        <Text style={styles.headerTitle}>Search</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={COLORS.background} />
          <TextInput style={styles.searchInput} placeholder="What do you want to listen to?" 
            placeholderTextColor={COLORS.textMuted} value={query} onChangeText={search} />
          {query.length > 0 && <TouchableOpacity onPress={() => { setQuery(''); setResults(null); }}>
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} /></TouchableOpacity>}
        </View>
      </View>
      <ScrollView contentContainerStyle={currentSong && { paddingBottom: 100 }}>
        {results?.albums?.map(album => (
          <TouchableOpacity key={album.album_id} style={styles.searchItem} onPress={() => navigation.navigate('Album', { album })}>
            <View style={styles.searchThumb}>
              {album.thumbnail ? <Image source={{ uri: album.thumbnail }} style={styles.searchThumbImg} /> :
                <LinearGradient colors={['#535353', '#121212']} style={styles.searchThumbImg}>
                  <Ionicons name="musical-notes" size={24} color="rgba(255,255,255,0.3)" /></LinearGradient>}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.searchItemTitle}>{album.title}</Text>
              <Text style={styles.searchItemSub}>Album • {album.artist_name}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {results && !results.albums?.length && <Text style={styles.noResults}>No results for "{query}"</Text>}
      </ScrollView>
      <MiniPlayer onPress={() => navigation.navigate('NowPlaying')} />
    </View>
  );
};

// ============ LIBRARY SCREEN ============
const LibraryScreen = ({ navigation }) => {
  const { currentSong } = usePlayer();
  return (
    <View style={styles.container}>
      <View style={styles.libHeader}>
        <Text style={styles.headerTitle}>Your Library</Text>
      </View>
      <View style={[styles.center, { flex: 1 }]}>
        <Ionicons name="library-outline" size={64} color={COLORS.textMuted} />
        <Text style={styles.emptyTitle}>Your Library</Text>
        <Text style={styles.emptySub}>Login to see your saved music</Text>
        <TouchableOpacity style={styles.loginBtn}><Text style={styles.loginBtnText}>Log In</Text></TouchableOpacity>
      </View>
      <MiniPlayer onPress={() => navigation.navigate('NowPlaying')} />
    </View>
  );
};

// ============ ALBUM SCREEN ============
const AlbumScreen = ({ route, navigation }) => {
  const { album } = route.params;
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { playSong, currentSong, isPlaying } = usePlayer();

  useEffect(() => {
    fetch(`${API_URL}/user/album/${album.album_id}`).then(r => r.json())
      .then(d => setSongs(d.songs || [])).catch(console.error).finally(() => setLoading(false));
  }, [album.album_id]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={currentSong && { paddingBottom: 100 }}>
        <LinearGradient colors={['#404040', COLORS.background]} style={styles.albumHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginBottom: 16 }}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.albumHeaderArt}>
            {album.thumbnail ? <Image source={{ uri: album.thumbnail }} style={styles.albumHeaderImg} /> :
              <LinearGradient colors={['#535353', '#121212']} style={styles.albumHeaderImg}>
                <Ionicons name="musical-notes" size={60} color="rgba(255,255,255,0.3)" /></LinearGradient>}
          </View>
          <Text style={styles.albumHeaderTitle}>{album.title}</Text>
          <Text style={styles.albumHeaderArtist}>{album.artist_name}</Text>
        </LinearGradient>

        <View style={styles.albumActions}>
          <TouchableOpacity style={styles.playAllBtn} onPress={() => songs.length && playSong(songs[0], album)}>
            <Ionicons name="play" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} /> :
          songs.map((song, idx) => (
            <TouchableOpacity key={song.song_id} style={styles.songItem} onPress={() => playSong(song, album)}>
              <View style={{ width: 32, alignItems: 'center' }}>
                {currentSong?.song_id === song.song_id && isPlaying ? 
                  <AnimatedBars isPlaying={true} /> : <Text style={styles.songIdx}>{idx + 1}</Text>}
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.songTitle, currentSong?.song_id === song.song_id && { color: COLORS.primary }]}>{song.title}</Text>
                <Text style={styles.songArtist}>{album.artist_name}</Text>
              </View>
              <TouchableOpacity style={{ padding: 8 }}><Ionicons name="ellipsis-vertical" size={20} color={COLORS.textSecondary} /></TouchableOpacity>
            </TouchableOpacity>
          ))}
      </ScrollView>
      <MiniPlayer onPress={() => navigation.navigate('NowPlaying')} />
    </View>
  );
};

// ============ NOW PLAYING SCREEN ============
const NowPlayingScreen = ({ navigation }) => {
  const { currentSong, currentAlbum, isPlaying, position, duration, togglePlay, seekTo } = usePlayer();
  const formatTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const progress = duration > 0 ? position / duration : 0;

  if (!currentSong) return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.emptySub}>No song playing</Text>
      <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.loginBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1e3a5f', '#121212', '#121212']} style={{ flex: 1, paddingTop: 48 }}>
        <View style={styles.npHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="chevron-down" size={28} color={COLORS.textPrimary} /></TouchableOpacity>
          <Text style={styles.npAlbum} numberOfLines={1}>{currentAlbum?.title}</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.npArtContainer}>
          {currentAlbum?.thumbnail ? <Image source={{ uri: currentAlbum.thumbnail }} style={styles.npArt} /> :
            <LinearGradient colors={['#7c3aed', '#10b981']} style={styles.npArt}>
              <Ionicons name="musical-notes" size={80} color="rgba(255,255,255,0.4)" /></LinearGradient>}
          {isPlaying && <View style={styles.npBars}><AnimatedBars isPlaying={true} size="large" /></View>}
        </View>

        <View style={styles.npInfo}>
          <Text style={styles.npTitle}>{currentSong.title}</Text>
          <Text style={styles.npArtist}>{currentAlbum?.artist_name}</Text>
        </View>

        <View style={styles.npProgress}>
          <TouchableOpacity style={styles.npProgressTrack} onPress={(e) => seekTo((e.nativeEvent.locationX / (width - 64)) * duration)}>
            <View style={[styles.npProgressBar, { width: `${progress * 100}%` }]} />
          </TouchableOpacity>
          <View style={styles.npTime}><Text style={styles.npTimeText}>{formatTime(position)}</Text><Text style={styles.npTimeText}>{formatTime(duration)}</Text></View>
        </View>

        <View style={styles.npControls}>
          <TouchableOpacity><Ionicons name="shuffle" size={24} color={COLORS.textSecondary} /></TouchableOpacity>
          <TouchableOpacity><Ionicons name="play-skip-back" size={32} color={COLORS.textPrimary} /></TouchableOpacity>
          <TouchableOpacity style={styles.npPlayBtn} onPress={togglePlay}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity><Ionicons name="play-skip-forward" size={32} color={COLORS.textPrimary} /></TouchableOpacity>
          <TouchableOpacity><Ionicons name="repeat" size={24} color={COLORS.textSecondary} /></TouchableOpacity>
        </View>

        <View style={styles.npSecondary}>
          <TouchableOpacity style={styles.npSecBtn}><Ionicons name="heart-outline" size={24} color={COLORS.textSecondary} /><Text style={styles.npSecText}>Like</Text></TouchableOpacity>
          <TouchableOpacity style={styles.npSecBtn} onPress={() => Share.share({ message: `Check out "${currentSong.title}" on Spirit Songs!` })}>
            <Ionicons name="share-outline" size={24} color={COLORS.textSecondary} /><Text style={styles.npSecText}>Share</Text></TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
};

// ============ NAVIGATION ============
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNav = () => (
  <Tab.Navigator screenOptions={({ route }) => ({
    headerShown: false,
    tabBarStyle: { backgroundColor: COLORS.background, borderTopWidth: 0, height: 60, paddingBottom: 8 },
    tabBarActiveTintColor: COLORS.textPrimary,
    tabBarInactiveTintColor: COLORS.textMuted,
    tabBarIcon: ({ color }) => <Ionicons name={route.name === 'Home' ? 'home' : route.name === 'Search' ? 'search' : 'library'} size={24} color={color} />
  })}>
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Search" component={SearchScreen} />
    <Tab.Screen name="Library" component={LibraryScreen} />
  </Tab.Navigator>
);

export default function App() {
  return (
    <PlayerProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
          <Stack.Screen name="Tabs" component={TabNav} />
          <Stack.Screen name="Album" component={AlbumScreen} />
          <Stack.Screen name="NowPlaying" component={NowPlayingScreen} options={{ animation: 'slide_from_bottom' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </PlayerProvider>
  );
}

// ============ STYLES ============
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingBottom: 20 },
  hero: { padding: 24, paddingTop: 60, alignItems: 'center' },
  heroTitle: { fontSize: 32, fontWeight: 'bold', color: COLORS.textPrimary },
  heroSub: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  heroCta: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 50, marginTop: 16 },
  heroCtaText: { color: '#000', fontWeight: 'bold' },
  greeting: { fontSize: 24, fontWeight: 'bold', color: COLORS.textPrimary, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, paddingHorizontal: 16, marginBottom: 12 },
  albumCard: { width: width * 0.4, marginRight: 12 },
  albumArt: { width: '100%', aspectRatio: 1, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  albumImg: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  albumTitle: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 14 },
  albumArtist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  miniPlayer: { position: 'absolute', bottom: 60, left: 8, right: 8, backgroundColor: COLORS.backgroundCard, borderRadius: 8, overflow: 'hidden' },
  miniProgress: { height: 2, backgroundColor: COLORS.backgroundLight },
  miniProgressBar: { height: '100%', backgroundColor: COLORS.primary },
  miniContent: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  miniArt: { width: 48, height: 48, borderRadius: 4, overflow: 'hidden' },
  miniArtImg: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  miniInfo: { flex: 1, marginLeft: 12 },
  miniTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
  miniArtist: { color: COLORS.textSecondary, fontSize: 12 },
  searchHeader: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.textPrimary, borderRadius: 4, paddingHorizontal: 12 },
  searchInput: { flex: 1, height: 48, color: COLORS.background, fontSize: 15, marginLeft: 8 },
  searchItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 16 },
  searchThumb: { width: 48, height: 48, borderRadius: 4, overflow: 'hidden' },
  searchThumbImg: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  searchItemTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '500' },
  searchItemSub: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  noResults: { color: COLORS.textMuted, textAlign: 'center', padding: 32 },
  libHeader: { paddingTop: 56, paddingHorizontal: 16 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: 'bold', marginTop: 16 },
  emptySub: { color: COLORS.textSecondary, marginTop: 8 },
  loginBtn: { backgroundColor: COLORS.textPrimary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 24, marginTop: 24 },
  loginBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  albumHeader: { paddingTop: 48, paddingHorizontal: 16, paddingBottom: 24, alignItems: 'center' },
  albumHeaderArt: { width: width * 0.6, height: width * 0.6, borderRadius: 4, overflow: 'hidden', marginBottom: 16 },
  albumHeaderImg: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  albumHeaderTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  albumHeaderArtist: { color: COLORS.textSecondary, fontSize: 14, marginTop: 8 },
  albumActions: { padding: 16, alignItems: 'flex-end' },
  playAllBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  songItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  songIdx: { color: COLORS.textSecondary, fontSize: 14 },
  songTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '500' },
  songArtist: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  npHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 24 },
  npAlbum: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'center' },
  npArtContainer: { alignItems: 'center', paddingHorizontal: 32, marginBottom: 32 },
  npArt: { width: width - 80, height: width - 80, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  npBars: { position: 'absolute', bottom: 16, right: 56 },
  npInfo: { paddingHorizontal: 32, marginBottom: 16 },
  npTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: 'bold' },
  npArtist: { color: COLORS.textSecondary, fontSize: 16, marginTop: 4 },
  npProgress: { paddingHorizontal: 32, marginBottom: 16 },
  npProgressTrack: { height: 4, backgroundColor: COLORS.backgroundLight, borderRadius: 2 },
  npProgressBar: { height: '100%', backgroundColor: COLORS.textPrimary, borderRadius: 2 },
  npTime: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  npTimeText: { color: COLORS.textSecondary, fontSize: 12 },
  npControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 24, marginBottom: 24 },
  npPlayBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.textPrimary, justifyContent: 'center', alignItems: 'center' },
  npSecondary: { flexDirection: 'row', justifyContent: 'center', gap: 48 },
  npSecBtn: { alignItems: 'center', gap: 4 },
  npSecText: { color: COLORS.textSecondary, fontSize: 12 },
});
