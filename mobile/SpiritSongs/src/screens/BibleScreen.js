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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { bibleAPI } from '../services/api';
import { usePlayer, setStopExternalAudioCallback, clearStopExternalAudioCallback } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import { FullScreenLoader } from '../components/GracefyLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.lg * 3) / 2;

const BibleScreen = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [testamentFilter, setTestamentFilter] = useState('all');
  
  // View state: 'home', 'books', 'chapters', 'verses'
  const [viewState, setViewState] = useState('home');
  
  // Featured snippets
  const [featuredSnippets, setFeaturedSnippets] = useState([]);
  const [currentSnippet, setCurrentSnippet] = useState(null);
  
  // Verse range selection
  const [startVerse, setStartVerse] = useState('1');
  const [endVerse, setEndVerse] = useState('');
  
  // TTS Settings from admin
  const [ttsSettings, setTtsSettings] = useState({
    default_voice: 'sw-KE-Zuri-Female',
    default_speed: 1.0
  });
  
  // TTS State
  const [playingAudio, setPlayingAudio] = useState(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [wasCached, setWasCached] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackStartTime, setPlaybackStartTime] = useState(null);
  const soundRef = useRef(null);
  const wasMusicPlayingRef = useRef(false);
  
  // Toast
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  
  // Incoming snippet from navigation params
  const incomingSnippet = route?.params?.snippet;

  const { isPlaying: isMusicPlaying, pausePlayback, resumePlayback } = usePlayer();
  const { user } = useAuth();

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    loadBooks();
    loadFeaturedSnippets();
    loadTtsSettings();
    
    setStopExternalAudioCallback(async () => {
      await cleanupAudio();
      setPlayingAudio(null);
    });
    
    return () => {
      cleanupAudio();
      clearStopExternalAudioCallback();
    };
  }, []);
  
  // Handle incoming snippet from HomeScreen navigation
  useEffect(() => {
    if (incomingSnippet && books.length > 0 && !loading) {
      handleSnippetPlay(incomingSnippet);
    }
  }, [incomingSnippet, books, loading]);

  const loadFeaturedSnippets = async () => {
    try {
      const response = await bibleAPI.getFeaturedSnippets();
      const snippets = response.data?.snippets || [];
      setFeaturedSnippets(snippets);
      if (snippets.length > 0) {
        setCurrentSnippet(snippets[0]);
      }
    } catch (error) {
      console.log('Error loading snippets:', error);
    }
  };

  const loadTtsSettings = async () => {
    try {
      const response = await bibleAPI.getTtsSettings();
      if (response.data) {
        setTtsSettings({
          default_voice: response.data.default_voice || 'sw-KE-Zuri-Female',
          default_speed: response.data.default_speed || 1.0
        });
      }
    } catch (error) {
      console.log('Error loading TTS settings, using defaults:', error);
    }
  };

  const cleanupAudio = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        console.log('Error cleaning up audio:', e);
      }
      soundRef.current = null;
    }
    if (wasMusicPlayingRef.current) {
      wasMusicPlayingRef.current = false;
      await resumePlayback?.();
    }
  };

  const loadBooks = async () => {
    try {
      const response = await bibleAPI.getBooks('sw');
      setBooks(response.data?.books || []);
    } catch (error) {
      console.error('Error loading books:', error);
      showToast('Imeshindwa kupakia vitabu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadChapters = async (book) => {
    try {
      await cleanupAudio();
      setPlayingAudio(null);
      setSelectedBook(book);
      setSelectedChapter(null);
      setVerses([]);
      const response = await bibleAPI.getChapters(book.name);
      setChapters(response.data?.chapters || []);
      setViewState('chapters');
    } catch (error) {
      console.error('Error loading chapters:', error);
      showToast('Imeshindwa kupakia sura', 'error');
    }
  };

  const loadVerses = async (chapter) => {
    try {
      await cleanupAudio();
      setPlayingAudio(null);
      setSelectedChapter(chapter);
      const response = await bibleAPI.getVerses(selectedBook.name, chapter);
      const versesData = response.data?.verses || [];
      setVerses(versesData);
      setEndVerse(versesData.length.toString());
      setStartVerse('1');
      setViewState('verses');
    } catch (error) {
      console.error('Error loading verses:', error);
      showToast('Imeshindwa kupakia aya', 'error');
    }
  };

  // Open Bible - go to books list
  const openBible = () => {
    setViewState('books');
  };

  // Handle featured snippet - play directly or navigate
  const handleSnippetPlay = async (snippet) => {
    if (!snippet) return;
    
    try {
      // Find the book - check multiple possible field names
      const snippetBookName = snippet.book || snippet.book_name || snippet.reference?.split(' ')[0];
      const book = books.find(b => 
        b.name === snippetBookName || 
        b.name_localized === snippetBookName ||
        b.name.toLowerCase() === snippetBookName?.toLowerCase()
      );
      
      if (book) {
        setSelectedBook(book);
        
        // Get chapter from snippet - check multiple field names
        const chapter = snippet.chapter_start || snippet.chapter || 1;
        
        // Load verses for the snippet
        const versesResponse = await bibleAPI.getVerses(book.name, chapter);
        const versesData = versesResponse.data?.verses || [];
        setVerses(versesData);
        setSelectedChapter(chapter);
        setViewState('verses');
        
        // Set verse range
        const start = snippet.verse_start || snippet.start_verse || 1;
        const end = snippet.verse_end || snippet.end_verse || versesData.length;
        setStartVerse(start.toString());
        setEndVerse(end.toString());
        
        // Start playing immediately
        await playPassage(book.name, chapter, start, end);
      } else {
        // If book not found, just navigate to Bible home
        showToast('Kitabu hakijapatikana, tafadhali chagua', 'info');
        setViewState('books');
      }
    } catch (error) {
      console.error('Error playing snippet:', error);
      showToast('Imeshindwa kucheza somo', 'error');
    }
  };

  const goBack = () => {
    cleanupAudio();
    setPlayingAudio(null);
    
    if (viewState === 'verses') {
      setSelectedChapter(null);
      setVerses([]);
      setViewState('chapters');
    } else if (viewState === 'chapters') {
      setSelectedBook(null);
      setChapters([]);
      setViewState('books');
    } else if (viewState === 'books') {
      setViewState('home');
    } else {
      navigation.goBack();
    }
  };

  const getTitle = () => {
    if (viewState === 'verses' && selectedBook && selectedChapter) {
      return `${selectedBook.name_localized || selectedBook.name} ${selectedChapter}`;
    }
    if (viewState === 'chapters' && selectedBook) {
      return selectedBook.name_localized || selectedBook.name;
    }
    if (viewState === 'books') {
      return 'Chagua Kitabu';
    }
    return 'Biblia na Masomo';
  };

  const getReference = (start, end) => {
    const bookName = selectedBook?.name_localized || selectedBook?.name || '';
    if (start === end || !end) {
      return `${bookName} ${selectedChapter}:${start}`;
    }
    return `${bookName} ${selectedChapter}:${start}-${end}`;
  };

  const quickSelect = (start, end) => {
    setStartVerse(start.toString());
    setEndVerse(end.toString());
  };

  const logListeningHistory = async (durationSeconds, cached, completed) => {
    try {
      const start = parseInt(startVerse) || 1;
      const end = parseInt(endVerse) || verses.length;
      
      await bibleAPI.logListeningHistory({
        user_id: user?.user_id || null,
        book: selectedBook?.name,
        chapter: selectedChapter,
        start_verse: start,
        end_verse: end,
        voice: ttsSettings.default_voice,
        duration_seconds: durationSeconds,
        was_cached: cached,
        completed: completed
      });
    } catch (error) {
      console.error('Failed to log listening history:', error);
    }
  };

  // Play passage with TTS
  const playPassage = async (book, chapter, start, end) => {
    try {
      console.log('playPassage called:', { book, chapter, start, end });
      
      if (isMusicPlaying) {
        wasMusicPlayingRef.current = true;
        await pausePlayback?.();
      }

      await cleanupAudio();
      setGeneratingAudio(true);
      setWasCached(false);
      setAudioDuration(0);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      showToast('Inaandaa sauti...', 'info');
      
      console.log('Calling TTS API with:', {
        book,
        chapter,
        start_verse: start,
        end_verse: end,
        voice: ttsSettings.default_voice,
        speed: ttsSettings.default_speed
      });

      const response = await bibleAPI.generatePassageTTS({
        book: book,
        chapter: chapter,
        start_verse: start,
        end_verse: end,
        language: 'sw',
        voice: ttsSettings.default_voice,
        speed: ttsSettings.default_speed
      });
      
      console.log('TTS API response received:', {
        hasAudio: !!response.data?.audio_base64,
        audioLength: response.data?.audio_base64?.length || 0,
        cached: response.data?.cached
      });

      if (response.data?.audio_base64) {
        const isCached = response.data.cached || false;
        setWasCached(isCached);
        
        const audioUri = `data:audio/mp3;base64,${response.data.audio_base64}`;
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          async (status) => {
            if (status.durationMillis && !audioDuration) {
              setAudioDuration(Math.floor(status.durationMillis / 1000));
            }
            
            if (status.didJustFinish) {
              const totalDuration = status.durationMillis 
                ? Math.floor(status.durationMillis / 1000) 
                : (playbackStartTime ? Math.floor((Date.now() - playbackStartTime) / 1000) : 0);
              
              if (totalDuration > 0) {
                logListeningHistory(totalDuration, isCached, true);
              }
              
              setPlayingAudio(null);
              setPlaybackStartTime(null);
              setGeneratingAudio(false);
              if (wasMusicPlayingRef.current) {
                wasMusicPlayingRef.current = false;
                resumePlayback?.();
              }
            }
          }
        );
        
        soundRef.current = newSound;
        setPlayingAudio('range');
        setPlaybackStartTime(Date.now());
        setGeneratingAudio(false);
        
        showToast('Inasoma...', 'success');
      } else {
        console.error('No audio_base64 in response:', response.data);
        throw new Error('No audio returned from server');
      }
    } catch (error) {
      console.error('Error generating TTS:', error.message || error);
      console.error('Full error:', JSON.stringify(error, null, 2));
      showToast('Imeshindwa kutengeneza sauti: ' + (error.message || 'Unknown error'), 'error');
      setGeneratingAudio(false);
    }
  };

  const handleListenNow = async () => {
    const start = parseInt(startVerse) || 1;
    const end = parseInt(endVerse) || verses.length;
    
    if (start > end || start < 1 || end > verses.length) {
      showToast('Tafadhali weka aya sahihi', 'warning');
      return;
    }
    
    if (playingAudio) {
      if (playbackStartTime) {
        const listenedSeconds = Math.floor((Date.now() - playbackStartTime) / 1000);
        if (listenedSeconds > 0) {
          logListeningHistory(listenedSeconds, wasCached, false);
        }
      }
      await cleanupAudio();
      setPlayingAudio(null);
      setPlaybackStartTime(null);
      return;
    }
    
    await playPassage(selectedBook.name, selectedChapter, start, end);
  };

  const filteredBooks = books.filter(book => {
    const matchesSearch = searchQuery === '' || 
      (book.name_localized || book.name).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTestament = testamentFilter === 'all' || book.testament === testamentFilter;
    return matchesSearch && matchesTestament;
  });

  // ===================== RENDER HOME VIEW =====================
  const renderHomeView = () => (
    <ScrollView style={styles.homeContainer} showsVerticalScrollIndicator={false}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconContainer}>
          <Ionicons name="book" size={24} color="#f97316" />
        </View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>Biblia na Masomo</Text>
          <Text style={styles.sectionSubtitle}>Sikiliza Neno la Mungu</Text>
        </View>
      </View>

      {/* Two Cards Row */}
      <View style={styles.cardsRow}>
        {/* Bible Card */}
        <TouchableOpacity 
          style={styles.bibleCard}
          onPress={openBible}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#ea580c', '#f97316', '#fb923c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardIconContainer}>
              <Ionicons name="book-outline" size={32} color="rgba(255,255,255,0.9)" />
            </View>
            <Text style={styles.cardTitle}>Biblia</Text>
            <Text style={styles.cardSubtitle}>Agano Jipya • Kiswahili</Text>
            <Text style={styles.cardDescription}>Soma na Sikiliza Neno la Mungu</Text>
            <View style={styles.cardButton}>
              <Ionicons name="headset" size={16} color="#333" />
              <Text style={styles.cardButtonText}>Fungua</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Featured Snippet Card */}
        {currentSnippet ? (
          <TouchableOpacity 
            style={styles.snippetCard}
            onPress={() => handleSnippetPlay(currentSnippet)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#7c3aed', '#8b5cf6', '#a78bfa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            >
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>FEATURED</Text>
              </View>
              <Text style={styles.snippetLabel}>SOMO LA LEO</Text>
              <Text style={styles.snippetTitle} numberOfLines={1}>
                {currentSnippet.reference || currentSnippet.title}
              </Text>
              <Text style={styles.snippetDescription} numberOfLines={2}>
                {currentSnippet.description}
              </Text>
              {currentSnippet.duration && (
                <Text style={styles.snippetDuration}>~{currentSnippet.duration}s</Text>
              )}
              <View style={styles.cardButton}>
                <Ionicons name="headset" size={16} color="#333" />
                <Text style={styles.cardButtonText}>
                  {generatingAudio ? 'Inaandaa...' : 'Sikiliza Sasa'}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.snippetCardPlaceholder}>
            <LinearGradient
              colors={['#7c3aed', '#8b5cf6', '#a78bfa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            >
              <View style={styles.cardIconContainer}>
                <Ionicons name="sparkles" size={32} color="rgba(255,255,255,0.9)" />
              </View>
              <Text style={styles.cardTitle}>Masomo</Text>
              <Text style={styles.cardSubtitle}>Mafundisho</Text>
              <Text style={styles.cardDescription}>Sikiliza mafundisho ya Biblia</Text>
            </LinearGradient>
          </View>
        )}
      </View>

      {/* More Featured Snippets */}
      {featuredSnippets.length > 1 && (
        <View style={styles.moreSnippetsSection}>
          <Text style={styles.moreSnippetsTitle}>Masomo Mengine</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.moreSnippetsScroll}
          >
            {featuredSnippets.slice(1).map((snippet) => (
              <TouchableOpacity
                key={snippet.snippet_id}
                style={styles.miniSnippetCard}
                onPress={() => {
                  setCurrentSnippet(snippet);
                  handleSnippetPlay(snippet);
                }}
              >
                <Text style={styles.miniSnippetTitle} numberOfLines={1}>
                  {snippet.reference || snippet.title}
                </Text>
                <Text style={styles.miniSnippetDesc} numberOfLines={2}>
                  {snippet.description}
                </Text>
                <View style={styles.miniSnippetButton}>
                  <Ionicons name="play-circle" size={20} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  // ===================== RENDER BOOKS VIEW =====================
  const renderBooksView = () => (
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
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
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
              <Ionicons name="headset-outline" size={12} color={COLORS.primary} />
              <Text style={styles.bookMetaText}> Sauti</Text>
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
  );

  // ===================== RENDER CHAPTERS VIEW =====================
  const renderChaptersView = () => (
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
  );

  // ===================== RENDER VERSES VIEW =====================
  const renderVersesView = () => {
    const start = parseInt(startVerse) || 1;
    const end = parseInt(endVerse) || verses.length;
    
    return (
      <ScrollView style={styles.chapterContent} showsVerticalScrollIndicator={false}>
        {/* Verse Range Selector */}
        <View style={styles.selectorContainer}>
          <View style={styles.selectorHeader}>
            <Ionicons name="book" size={20} color={COLORS.primary} />
            <Text style={styles.selectorTitle}>Chagua Aya za Kusoma</Text>
          </View>
          
          <View style={styles.referencePreview}>
            <Ionicons name="bookmark" size={18} color={COLORS.primary} />
            <Text style={styles.referenceText}>{getReference(start, end)}</Text>
          </View>
          
          <View style={styles.rangeInputsContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Aya ya Kwanza</Text>
              <TextInput
                style={styles.rangeInput}
                keyboardType="number-pad"
                value={startVerse}
                onChangeText={setStartVerse}
                placeholder="1"
                placeholderTextColor={COLORS.textMuted}
                maxLength={3}
              />
            </View>
            
            <Text style={styles.rangeSeparator}>hadi</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Aya ya Mwisho</Text>
              <TextInput
                style={styles.rangeInput}
                keyboardType="number-pad"
                value={endVerse}
                onChangeText={setEndVerse}
                placeholder={verses.length.toString()}
                placeholderTextColor={COLORS.textMuted}
                maxLength={3}
              />
            </View>
          </View>
          
          <View style={styles.quickSelectSection}>
            <Text style={styles.quickSelectLabel}>Chagua Haraka:</Text>
            <View style={styles.quickSelectButtons}>
              <TouchableOpacity 
                style={[styles.quickSelectButton, startVerse === '1' && endVerse === '5' && styles.quickSelectButtonActive]}
                onPress={() => quickSelect(1, Math.min(5, verses.length))}
              >
                <Text style={[styles.quickSelectText, startVerse === '1' && endVerse === '5' && styles.quickSelectTextActive]}>1-5</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickSelectButton, startVerse === '1' && endVerse === '10' && styles.quickSelectButtonActive]}
                onPress={() => quickSelect(1, Math.min(10, verses.length))}
              >
                <Text style={[styles.quickSelectText, startVerse === '1' && endVerse === '10' && styles.quickSelectTextActive]}>1-10</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickSelectButton, startVerse === '1' && endVerse === verses.length.toString() && styles.quickSelectButtonActive]}
                onPress={() => quickSelect(1, verses.length)}
              >
                <Text style={[styles.quickSelectText, startVerse === '1' && endVerse === verses.length.toString() && styles.quickSelectTextActive]}>Sura Nzima</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* TTS Settings Display */}
          <View style={styles.ttsSettingsDisplay}>
            <Ionicons name="mic-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.ttsSettingsText}>
              Sauti: {ttsSettings.default_voice.split('-').pop()} | Kasi: {ttsSettings.default_speed}x
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.listenNowButton, playingAudio && styles.listenNowButtonPlaying]}
            onPress={handleListenNow}
            disabled={generatingAudio}
          >
            {generatingAudio ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : playingAudio ? (
              <>
                <Ionicons name="stop" size={24} color={COLORS.background} />
                <Text style={styles.listenNowButtonText}>Simamisha</Text>
              </>
            ) : (
              <>
                <Ionicons name="play" size={24} color={COLORS.background} />
                <Text style={styles.listenNowButtonText}>Sikiliza Sasa</Text>
              </>
            )}
          </TouchableOpacity>
          
          {playingAudio && (
            <View style={styles.nowPlayingIndicator}>
              <Ionicons name="volume-high" size={16} color={COLORS.primary} />
              <Text style={styles.nowPlayingText}>Inasoma: {getReference(start, end)}</Text>
            </View>
          )}
        </View>
        
        {/* Verses Display */}
        <View style={styles.versesSection}>
          <Text style={styles.versesSectionTitle}>Aya</Text>
          {verses.map((verse) => (
            <View key={verse.verse} style={styles.verseItem}>
              <Text style={styles.verseNumber}>{verse.verse}</Text>
              <Text style={styles.verseText}>{verse.text}</Text>
            </View>
          ))}
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  if (loading) {
    return <FullScreenLoader text="Loading Bible..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{getTitle()}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Content based on view state */}
      {viewState === 'home' && renderHomeView()}
      {viewState === 'books' && renderBooksView()}
      {viewState === 'chapters' && renderChaptersView()}
      {viewState === 'verses' && renderVersesView()}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
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
  
  // ========== HOME VIEW STYLES ==========
  homeContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    paddingTop: SPACING.md,
  },
  sectionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  
  // Cards Row
  cardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  bibleCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  snippetCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  snippetCardPlaceholder: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    opacity: 0.7,
  },
  cardGradient: {
    padding: SPACING.md,
    minHeight: 200,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: SPACING.sm,
  },
  cardDescription: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: SPACING.md,
  },
  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 'auto',
  },
  cardButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  
  // Featured Badge
  featuredBadge: {
    backgroundColor: '#f97316',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  featuredBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  snippetLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  snippetTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  snippetDescription: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 16,
    marginBottom: 4,
  },
  snippetDuration: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: SPACING.sm,
  },
  
  // More Snippets
  moreSnippetsSection: {
    marginBottom: SPACING.xl,
  },
  moreSnippetsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  moreSnippetsScroll: {
    paddingRight: SPACING.lg,
  },
  miniSnippetCard: {
    width: 160,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.md,
    marginRight: SPACING.md,
  },
  miniSnippetTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  miniSnippetDesc: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginBottom: SPACING.sm,
  },
  miniSnippetButton: {
    alignSelf: 'flex-end',
  },
  
  // TTS Info Card
  ttsInfoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  ttsInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  ttsInfoTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  ttsInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  ttsInfoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  ttsInfoValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  
  // ========== BOOKS VIEW STYLES ==========
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
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  booksGrid: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  bookCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    margin: SPACING.xs,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  bookCardOld: {
    borderLeftColor: '#f59e0b',
  },
  bookName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  bookTestament: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  bookMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  bookMetaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
  },
  
  // ========== CHAPTERS VIEW STYLES ==========
  chaptersGrid: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  chapterHeader: {
    marginBottom: SPACING.md,
  },
  chapterHeaderText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  chapterButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: COLORS.card,
    margin: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chapterText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  
  // ========== VERSES VIEW STYLES ==========
  chapterContent: {
    flex: 1,
  },
  selectorContainer: {
    margin: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  selectorTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  referencePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  referenceText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  rangeInputsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  inputGroup: {
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  rangeInput: {
    width: 60,
    height: 44,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  rangeSeparator: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.md,
  },
  quickSelectSection: {
    marginBottom: SPACING.md,
  },
  quickSelectLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  quickSelectButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  quickSelectButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surface,
  },
  quickSelectButtonActive: {
    backgroundColor: COLORS.primary,
  },
  quickSelectText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  quickSelectTextActive: {
    color: COLORS.background,
    fontWeight: '600',
  },
  ttsSettingsDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  ttsSettingsText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginLeft: SPACING.xs,
  },
  listenNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  listenNowButtonPlaying: {
    backgroundColor: '#ef4444',
  },
  listenNowButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
    marginLeft: SPACING.sm,
  },
  nowPlayingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
  },
  nowPlayingText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  
  // Verses
  versesSection: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  versesSectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  verseItem: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  verseNumber: {
    width: 32,
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  verseText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 24,
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
});

export default BibleScreen;
