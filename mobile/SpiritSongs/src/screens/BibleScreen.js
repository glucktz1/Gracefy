import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { bibleAPI } from '../services/api';

const BibleScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [testamentFilter, setTestamentFilter] = useState('all');
  
  // TTS State
  const [playingVerse, setPlayingVerse] = useState(null);
  const [loadingTTS, setLoadingTTS] = useState(null);
  const [sound, setSound] = useState(null);
  const soundRef = useRef(null);

  useEffect(() => {
    loadBooks();
    return () => {
      // Cleanup audio on unmount
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const loadBooks = async () => {
    try {
      const response = await bibleAPI.getBooks('sw');
      setBooks(response.data?.books || []);
    } catch (error) {
      console.error('Error loading books:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChapters = async (book) => {
    try {
      setSelectedBook(book);
      setSelectedChapter(null);
      setVerses([]);
      const response = await bibleAPI.getChapters(book.name);
      setChapters(response.data?.chapters || []);
    } catch (error) {
      console.error('Error loading chapters:', error);
    }
  };

  const loadVerses = async (chapter) => {
    try {
      setSelectedChapter(chapter);
      const response = await bibleAPI.getVerses(selectedBook.name, chapter);
      setVerses(response.data?.verses || []);
    } catch (error) {
      console.error('Error loading verses:', error);
    }
  };

  const goBack = () => {
    // Stop any playing audio
    stopAudio();
    
    if (selectedChapter) {
      setSelectedChapter(null);
      setVerses([]);
    } else if (selectedBook) {
      setSelectedBook(null);
      setChapters([]);
    } else {
      navigation.goBack();
    }
  };

  const stopAudio = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.log('Error stopping audio:', e);
      }
      soundRef.current = null;
    }
    setPlayingVerse(null);
  };

  const playVerseTTS = async (verse) => {
    try {
      // Stop any currently playing audio
      await stopAudio();

      // If clicking the same verse that was playing, just stop
      if (playingVerse === verse.verse) {
        return;
      }

      setLoadingTTS(verse.verse);
      setPlayingVerse(null);

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Request TTS audio from backend
      const response = await bibleAPI.generateTTS({
        book: selectedBook.name,
        chapter: selectedChapter,
        verse: verse.verse,
        voice: 'sw-TZ-female', // Swahili female voice
      });

      if (response.data?.audio_base64) {
        // Create audio from base64
        const audioUri = `data:audio/mp3;base64,${response.data.audio_base64}`;
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        
        soundRef.current = newSound;
        setSound(newSound);
        setPlayingVerse(verse.verse);
      } else {
        Alert.alert('Kosa', 'Imeshindikana kupata sauti. Tafadhali jaribu tena.');
      }
    } catch (error) {
      console.error('TTS Error:', error);
      Alert.alert('Kosa', 'Imeshindikana kusoma aya. Tafadhali jaribu tena.');
    } finally {
      setLoadingTTS(null);
    }
  };

  const playChapterTTS = async () => {
    if (verses.length === 0) return;
    
    try {
      await stopAudio();
      setLoadingTTS('chapter');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // Request TTS for entire passage
      const response = await bibleAPI.generatePassageTTS({
        book: selectedBook.name,
        chapter: selectedChapter,
        start_verse: 1,
        end_verse: verses.length,
        voice: 'sw-TZ-female',
      });

      if (response.data?.audio_base64) {
        const audioUri = `data:audio/mp3;base64,${response.data.audio_base64}`;
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        
        soundRef.current = newSound;
        setSound(newSound);
        setPlayingVerse('chapter');
      } else {
        Alert.alert('Kosa', 'Imeshindikana kupata sauti. Tafadhali jaribu tena.');
      }
    } catch (error) {
      console.error('TTS Error:', error);
      Alert.alert('Kosa', 'Imeshindikana kusoma sura. Tafadhali jaribu tena.');
    } finally {
      setLoadingTTS(null);
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.didJustFinish) {
      setPlayingVerse(null);
    }
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.name_localized && book.name_localized.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTestament = testamentFilter === 'all' || book.testament === testamentFilter;
    return matchesSearch && matchesTestament;
  });

  const getTitle = () => {
    if (selectedChapter) return `${selectedBook.name_localized || selectedBook.name} ${selectedChapter}`;
    if (selectedBook) return selectedBook.name_localized || selectedBook.name;
    return 'Biblia';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{getTitle()}</Text>
        {selectedChapter && (
          <TouchableOpacity 
            style={styles.playAllButton} 
            onPress={playChapterTTS}
            disabled={loadingTTS === 'chapter'}
          >
            {loadingTTS === 'chapter' ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : playingVerse === 'chapter' ? (
              <Ionicons name="stop" size={24} color={COLORS.primary} />
            ) : (
              <Ionicons name="headset" size={24} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        )}
        {!selectedChapter && <View style={{ width: 40 }} />}
      </View>

      {/* Books View */}
      {!selectedBook && (
        <>
          {/* Testament Filter */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterButton, testamentFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setTestamentFilter('all')}
            >
              <Text style={[styles.filterText, testamentFilter === 'all' && styles.filterTextActive]}>
                Yote
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, testamentFilter === 'old' && styles.filterButtonActive]}
              onPress={() => setTestamentFilter('old')}
            >
              <Text style={[styles.filterText, testamentFilter === 'old' && styles.filterTextActive]}>
                Agano la Kale
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, testamentFilter === 'new' && styles.filterButtonActive]}
              onPress={() => setTestamentFilter('new')}
            >
              <Text style={[styles.filterText, testamentFilter === 'new' && styles.filterTextActive]}>
                Agano Jipya
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tafuta kitabu..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Books Grid */}
          <FlatList
            data={filteredBooks}
            numColumns={2}
            keyExtractor={(item) => item.book_id || item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.bookCard, item.testament === 'old' && styles.bookCardOld]}
                onPress={() => loadChapters(item)}
              >
                <Text style={styles.bookName}>{item.name_localized || item.name}</Text>
                <Text style={styles.bookTestament}>
                  {item.testament === 'old' ? 'Agano la Kale' : 'Agano Jipya'}
                </Text>
                <View style={styles.bookMeta}>
                  <Ionicons name="headset-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.bookMetaText}> TTS</Text>
                </View>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.booksGrid}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="book-outline" size={48} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>Hakuna kitabu kilichopatikana</Text>
              </View>
            }
          />
        </>
      )}

      {/* Chapters View */}
      {selectedBook && !selectedChapter && (
        <FlatList
          data={chapters}
          numColumns={5}
          keyExtractor={(item) => item.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chapterButton}
              onPress={() => loadVerses(item)}
            >
              <Text style={styles.chapterText}>{item}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.chaptersGrid}
          ListHeaderComponent={
            <View style={styles.chapterHeader}>
              <Text style={styles.chapterHeaderText}>Chagua Sura</Text>
            </View>
          }
        />
      )}

      {/* Verses View with TTS */}
      {selectedChapter && (
        <ScrollView style={styles.versesContainer}>
          {/* TTS Instructions */}
          <View style={styles.ttsInstructions}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.ttsInstructionsText}>
              Bofya kitufe cha sauti kusikia aya kwa Kiswahili
            </Text>
          </View>

          {verses.map((verse) => (
            <View key={verse.verse} style={styles.verseItem}>
              <View style={styles.verseContent}>
                <Text style={styles.verseNumber}>{verse.verse}</Text>
                <Text style={styles.verseText}>{verse.text}</Text>
              </View>
              <TouchableOpacity 
                style={[
                  styles.verseTTSButton,
                  playingVerse === verse.verse && styles.verseTTSButtonActive
                ]}
                onPress={() => playVerseTTS(verse)}
                disabled={loadingTTS === verse.verse}
              >
                {loadingTTS === verse.verse ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : playingVerse === verse.verse ? (
                  <Ionicons name="stop" size={20} color={COLORS.primary} />
                ) : (
                  <Ionicons name="volume-high" size={20} color={COLORS.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    padding: SPACING.xs,
  },
  title: {
    flex: 1,
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },
  playAllButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.full,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  filterButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.card,
    marginRight: SPACING.sm,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  filterTextActive: {
    color: COLORS.background,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  searchInput: {
    flex: 1,
    height: 44,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  booksGrid: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: 100,
  },
  bookCard: {
    flex: 1,
    margin: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  bookCardOld: {
    borderLeftColor: '#8b5cf6',
  },
  bookName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  bookTestament: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  bookMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
  },
  bookMetaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
  },
  chapterHeader: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  chapterHeaderText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  chaptersGrid: {
    paddingHorizontal: SPACING.md,
  },
  chapterButton: {
    width: 56,
    height: 56,
    margin: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chapterText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  versesContainer: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  ttsInstructions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  ttsInstructionsText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  verseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  verseContent: {
    flex: 1,
    flexDirection: 'row',
  },
  verseNumber: {
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginRight: SPACING.sm,
    minWidth: 24,
  },
  verseText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 24,
  },
  verseTTSButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.full,
    marginLeft: SPACING.sm,
  },
  verseTTSButtonActive: {
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
});

export default BibleScreen;
