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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { bibleAPI } from '../services/api';
import { usePlayer, setStopExternalAudioCallback, clearStopExternalAudioCallback } from '../context/PlayerContext';
import Toast from '../components/Toast';

const BibleScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [testamentFilter, setTestamentFilter] = useState('all');
  
  // Verse range selection
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [startVerse, setStartVerse] = useState('1');
  const [endVerse, setEndVerse] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('female'); // 'male' or 'female'
  
  // TTS State
  const [playingAudio, setPlayingAudio] = useState(null);
  const [generatingAudio, setGeneratingAudio] = useState(null);
  const [wasCached, setWasCached] = useState(false);
  const soundRef = useRef(null);
  const wasMusicPlayingRef = useRef(false);
  
  // Toast
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const { isPlaying: isMusicPlaying, pausePlayback, resumePlayback } = usePlayer();

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    loadBooks();
    
    setStopExternalAudioCallback(async () => {
      await cleanupAudio();
      setPlayingAudio(null);
    });
    
    return () => {
      cleanupAudio();
      clearStopExternalAudioCallback();
    };
  }, []);

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
      // Set default end verse to last verse
      setEndVerse(versesData.length.toString());
      setStartVerse('1');
    } catch (error) {
      console.error('Error loading verses:', error);
      showToast('Imeshindwa kupakia aya', 'error');
    }
  };

  const goBack = () => {
    cleanupAudio();
    setPlayingAudio(null);
    
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

  // Generate reference string (e.g., "Mathayo 5:21-29")
  const getReference = (start, end) => {
    const bookName = selectedBook?.name_localized || selectedBook?.name || '';
    if (start === end) {
      return `${bookName} ${selectedChapter}:${start}`;
    }
    return `${bookName} ${selectedChapter}:${start}-${end}`;
  };

  // Play a single verse
  const handleReadVerse = async (verse) => {
    if (playingAudio === verse.verse) {
      await cleanupAudio();
      setPlayingAudio(null);
      return;
    }

    try {
      if (isMusicPlaying) {
        wasMusicPlayingRef.current = true;
        await pausePlayback?.();
      }

      await cleanupAudio();
      setGeneratingAudio(verse.verse);
      setPlayingAudio(null);
      setWasCached(false);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      const response = await bibleAPI.generateTTS({
        book: selectedBook.name,
        chapter: selectedChapter,
        verse: verse.verse,
        language: 'sw',
        voice: selectedVoice
      });

      if (response.data?.audio_base64) {
        setWasCached(response.data.cached || false);
        
        const audioUri = `data:audio/mp3;base64,${response.data.audio_base64}`;
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          (status) => {
            if (status.didJustFinish) {
              setPlayingAudio(null);
              if (wasMusicPlayingRef.current) {
                wasMusicPlayingRef.current = false;
                resumePlayback?.();
              }
            }
          }
        );
        
        soundRef.current = newSound;
        setPlayingAudio(verse.verse);
        
        if (response.data.cached) {
          showToast('Sauti iliyohifadhiwa', 'info');
        }
      } else {
        showToast('Imeshindikana kupata sauti', 'error');
        if (wasMusicPlayingRef.current) {
          wasMusicPlayingRef.current = false;
          resumePlayback?.();
        }
      }
    } catch (error) {
      console.error('TTS Error:', error);
      showToast('Imeshindikana kusoma aya', 'error');
      if (wasMusicPlayingRef.current) {
        wasMusicPlayingRef.current = false;
        resumePlayback?.();
      }
    } finally {
      setGeneratingAudio(null);
    }
  };

  // Play verse range from modal
  const handlePlayRange = async () => {
    const start = parseInt(startVerse) || 1;
    const end = parseInt(endVerse) || verses.length;
    
    if (start > end || start < 1 || end > verses.length) {
      showToast('Tafadhali weka aya sahihi', 'warning');
      return;
    }
    
    setShowRangeModal(false);
    
    // If range is playing, stop it
    if (playingAudio === 'range') {
      await cleanupAudio();
      setPlayingAudio(null);
      return;
    }
    
    try {
      if (isMusicPlaying) {
        wasMusicPlayingRef.current = true;
        await pausePlayback?.();
      }

      await cleanupAudio();
      setGeneratingAudio('range');
      setPlayingAudio(null);
      setWasCached(false);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      showToast(`Inaandaa: ${getReference(start, end)}...`, 'info');

      const response = await bibleAPI.generatePassageTTS({
        book: selectedBook.name,
        chapter: selectedChapter,
        start_verse: start,
        end_verse: end,
        language: 'sw',
        voice: selectedVoice
      });

      if (response.data?.audio_base64) {
        setWasCached(response.data.cached || false);
        
        const audioUri = `data:audio/mp3;base64,${response.data.audio_base64}`;
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          (status) => {
            if (status.didJustFinish) {
              setPlayingAudio(null);
              if (wasMusicPlayingRef.current) {
                wasMusicPlayingRef.current = false;
                resumePlayback?.();
              }
            }
          }
        );
        
        soundRef.current = newSound;
        setPlayingAudio('range');
        
        const cacheMsg = response.data.cached 
          ? ' (Sauti iliyohifadhiwa)' 
          : ' (Sauti mpya - imehifadhiwa)';
        showToast(`Inasoma: ${getReference(start, end)}${cacheMsg}`, 'success');
      } else {
        showToast('Imeshindikana kupata sauti', 'error');
      }
    } catch (error) {
      console.error('TTS Error:', error);
      showToast('Imeshindikana kusoma aya', 'error');
    } finally {
      setGeneratingAudio(null);
    }
  };

  // Play entire chapter
  const handlePlayChapter = async () => {
    if (verses.length === 0) return;
    
    if (playingAudio === 'chapter') {
      await cleanupAudio();
      setPlayingAudio(null);
      return;
    }
    
    try {
      if (isMusicPlaying) {
        wasMusicPlayingRef.current = true;
        await pausePlayback?.();
      }

      await cleanupAudio();
      setGeneratingAudio('chapter');
      setPlayingAudio(null);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      showToast(`Inaandaa sura nzima...`, 'info');

      const response = await bibleAPI.generatePassageTTS({
        book: selectedBook.name,
        chapter: selectedChapter,
        start_verse: 1,
        end_verse: verses.length,
        language: 'sw',
        voice: selectedVoice
      });

      if (response.data?.audio_base64) {
        const audioUri = `data:audio/mp3;base64,${response.data.audio_base64}`;
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true },
          (status) => {
            if (status.didJustFinish) {
              setPlayingAudio(null);
              if (wasMusicPlayingRef.current) {
                wasMusicPlayingRef.current = false;
                resumePlayback?.();
              }
            }
          }
        );
        
        soundRef.current = newSound;
        setPlayingAudio('chapter');
        
        const cacheMsg = response.data.cached ? ' (Iliyohifadhiwa)' : '';
        showToast(`Inasoma sura${cacheMsg}`, 'success');
      } else {
        showToast('Imeshindikana kupata sauti', 'error');
      }
    } catch (error) {
      console.error('TTS Error:', error);
      showToast('Imeshindikana kusoma sura', 'error');
    } finally {
      setGeneratingAudio(null);
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
    return 'Biblia Takatifu';
  };

  // Render verse range selection modal
  const renderRangeModal = () => (
    <Modal
      visible={showRangeModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowRangeModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chagua Aya za Kusoma</Text>
            <TouchableOpacity onPress={() => setShowRangeModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Reference Preview */}
          <View style={styles.referencePreview}>
            <Ionicons name="book" size={20} color={COLORS.primary} />
            <Text style={styles.referenceText}>
              {getReference(parseInt(startVerse) || 1, parseInt(endVerse) || verses.length)}
            </Text>
          </View>

          {/* Verse Range Inputs */}
          <View style={styles.rangeInputs}>
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

          {/* Quick Select Buttons */}
          <View style={styles.quickSelectContainer}>
            <Text style={styles.quickSelectLabel}>Chagua Haraka:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity 
                style={styles.quickSelectButton}
                onPress={() => { setStartVerse('1'); setEndVerse('5'); }}
              >
                <Text style={styles.quickSelectText}>1-5</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickSelectButton}
                onPress={() => { setStartVerse('1'); setEndVerse('10'); }}
              >
                <Text style={styles.quickSelectText}>1-10</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickSelectButton}
                onPress={() => { setStartVerse('1'); setEndVerse(verses.length.toString()); }}
              >
                <Text style={styles.quickSelectText}>Sura Nzima</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Voice Selection */}
          <View style={styles.voiceSelection}>
            <Text style={styles.voiceLabel}>Sauti:</Text>
            <View style={styles.voiceButtons}>
              <TouchableOpacity 
                style={[styles.voiceButton, selectedVoice === 'female' && styles.voiceButtonActive]}
                onPress={() => setSelectedVoice('female')}
              >
                <Ionicons 
                  name="woman" 
                  size={20} 
                  color={selectedVoice === 'female' ? COLORS.background : COLORS.text} 
                />
                <Text style={[
                  styles.voiceButtonText,
                  selectedVoice === 'female' && styles.voiceButtonTextActive
                ]}>Kike</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.voiceButton, selectedVoice === 'male' && styles.voiceButtonActive]}
                onPress={() => setSelectedVoice('male')}
              >
                <Ionicons 
                  name="man" 
                  size={20} 
                  color={selectedVoice === 'male' ? COLORS.background : COLORS.text} 
                />
                <Text style={[
                  styles.voiceButtonText,
                  selectedVoice === 'male' && styles.voiceButtonTextActive
                ]}>Kiume</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Info about caching */}
          <View style={styles.cacheInfo}>
            <Ionicons name="cloud-done-outline" size={16} color={COLORS.textMuted} />
            <Text style={styles.cacheInfoText}>
              Sauti itahifadhiwa ili kupunguza gharama kwa watumiaji wengine
            </Text>
          </View>

          {/* Play Button */}
          <TouchableOpacity 
            style={styles.playRangeButton}
            onPress={handlePlayRange}
            disabled={generatingAudio === 'range'}
          >
            {generatingAudio === 'range' ? (
              <ActivityIndicator size="small" color={COLORS.background} />
            ) : (
              <>
                <Ionicons name="play-circle" size={24} color={COLORS.background} />
                <Text style={styles.playRangeButtonText}>
                  Soma {getReference(parseInt(startVerse) || 1, parseInt(endVerse) || verses.length)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

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
        {selectedChapter ? (
          <View style={styles.headerActions}>
            {/* Range Selection Button */}
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => setShowRangeModal(true)}
            >
              <Ionicons name="options" size={22} color={COLORS.primary} />
            </TouchableOpacity>
            {/* Play All Button */}
            <TouchableOpacity 
              style={[styles.headerButton, playingAudio === 'chapter' && styles.headerButtonActive]} 
              onPress={handlePlayChapter}
              disabled={generatingAudio === 'chapter'}
            >
              {generatingAudio === 'chapter' ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : playingAudio === 'chapter' ? (
                <Ionicons name="stop" size={22} color={COLORS.primary} />
              ) : (
                <Ionicons name="headset" size={22} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Now Playing Indicator */}
      {playingAudio === 'range' && (
        <TouchableOpacity 
          style={styles.nowPlayingBar}
          onPress={() => { cleanupAudio(); setPlayingAudio(null); }}
        >
          <View style={styles.nowPlayingContent}>
            <Ionicons name="volume-high" size={18} color={COLORS.primary} />
            <Text style={styles.nowPlayingText} numberOfLines={1}>
              Inasoma: {getReference(parseInt(startVerse) || 1, parseInt(endVerse) || verses.length)}
            </Text>
            {wasCached && (
              <View style={styles.cachedBadge}>
                <Text style={styles.cachedBadgeText}>Iliyohifadhiwa</Text>
              </View>
            )}
          </View>
          <Ionicons name="stop-circle" size={24} color={COLORS.error} />
        </TouchableOpacity>
      )}

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
              Bofya 🔊 kusikia aya moja. Bofya ⚙️ kuchagua aya nyingi (mfano: 21-29).
            </Text>
          </View>

          {verses.map((verse) => (
            <View 
              key={verse.verse} 
              style={[
                styles.verseItem,
                playingAudio === verse.verse && styles.verseItemPlaying
              ]}
            >
              <View style={styles.verseContent}>
                <Text style={[
                  styles.verseNumber,
                  playingAudio === verse.verse && styles.verseNumberPlaying
                ]}>
                  {verse.verse}
                </Text>
                <Text style={styles.verseText}>{verse.text}</Text>
              </View>
              <TouchableOpacity 
                style={[
                  styles.verseTTSButton,
                  playingAudio === verse.verse && styles.verseTTSButtonActive
                ]}
                onPress={() => handleReadVerse(verse)}
                disabled={generatingAudio === verse.verse}
              >
                {generatingAudio === verse.verse ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : playingAudio === verse.verse ? (
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

      {/* Range Selection Modal */}
      {renderRangeModal()}

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
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.full,
  },
  headerButtonActive: {
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
  },
  nowPlayingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  nowPlayingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  nowPlayingText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  cachedBadge: {
    backgroundColor: COLORS.primary + '30',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  cachedBadgeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
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
    marginBottom: 4,
  },
  bookTestament: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  bookMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookMetaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
  },
  chaptersGrid: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100,
  },
  chapterHeader: {
    marginBottom: SPACING.md,
  },
  chapterHeaderText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  chapterButton: {
    width: '18%',
    aspectRatio: 1,
    margin: '1%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
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
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  ttsInstructionsText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  verseItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.card,
  },
  verseItemPlaying: {
    backgroundColor: COLORS.primary + '15',
    marginHorizontal: -SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderBottomWidth: 0,
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
  verseNumberPlaying: {
    color: COLORS.primary,
  },
  verseText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 24,
  },
  verseTTSButton: {
    padding: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  verseTTSButtonActive: {
    backgroundColor: COLORS.primary + '20',
    borderRadius: BORDER_RADIUS.full,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  referencePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  referenceText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.primary,
  },
  rangeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  inputGroup: {
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.xs,
  },
  rangeInput: {
    width: 80,
    height: 50,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    textAlign: 'center',
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  rangeSeparator: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    marginTop: SPACING.lg,
  },
  quickSelectContainer: {
    marginBottom: SPACING.lg,
  },
  quickSelectLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  quickSelectButton: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.sm,
  },
  quickSelectText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  voiceSelection: {
    marginBottom: SPACING.lg,
  },
  voiceLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  voiceButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  voiceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  voiceButtonActive: {
    backgroundColor: COLORS.primary,
  },
  voiceButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  voiceButtonTextActive: {
    color: COLORS.background,
  },
  cacheInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    padding: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.sm,
  },
  cacheInfoText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  playRangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  playRangeButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
  },
});

export default BibleScreen;
