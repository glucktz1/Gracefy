import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  FlatList,
  Modal,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as SecureStore from 'expo-secure-store';
import { useLanguage } from '../context/LanguageContext';
import api from '../services/api';

const COLORS = {
  background: '#0A0A1A',
  card: '#1a1a2e',
  cardBorder: '#2d2d44',
  primary: '#f59e0b',
  primaryDark: '#d97706',
  text: '#ffffff',
  textSecondary: '#9ca3af',
  accent: '#8b5cf6',
  donation: '#10b981',
  donationDark: '#059669',
};

const BibleScreen = ({ navigation }) => {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [snippets, setSnippets] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const [sound, setSound] = useState(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  
  // Book search
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  
  // Testament filter
  const [testamentFilter, setTestamentFilter] = useState('all'); // 'all', 'old', 'new'
  
  // Range reader modal
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [rangeBook, setRangeBook] = useState('');
  const [rangeBookSearch, setRangeBookSearch] = useState('');
  const [rangeChapter, setRangeChapter] = useState('1');
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState('5');
  const [rangeGender, setRangeGender] = useState('female');
  const [rangeLoading, setRangeLoading] = useState(false);
  
  // Filter books based on search query and testament filter
  const filteredBooks = books.filter(book => {
    const matchesSearch = book.name.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      (book.name_localized && book.name_localized.toLowerCase().includes(bookSearchQuery.toLowerCase()));
    const matchesTestament = testamentFilter === 'all' || book.testament === testamentFilter;
    return matchesSearch && matchesTestament;
  });
  
  // Filter books for range modal
  const filteredRangeBooks = books.filter(book => 
    book.name.toLowerCase().includes(rangeBookSearch.toLowerCase()) ||
    (book.name_localized && book.name_localized.toLowerCase().includes(rangeBookSearch.toLowerCase()))
  );

  // Listening limit state
  const [listeningStatus, setListeningStatus] = useState(null);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [remainingTime, setRemainingTime] = useState(-1);
  const listeningStartTime = useRef(null);
  const trackingInterval = useRef(null);
  const userId = useRef(null);

  // Get user ID on mount
  useEffect(() => {
    const getUserId = async () => {
      try {
        const id = await SecureStore.getItemAsync('user_id');
        userId.current = id;
      } catch (e) {
        console.log('Error getting user ID:', e);
      }
    };
    getUserId();
  }, []);

  // Fetch listening status
  const fetchListeningStatus = useCallback(async () => {
    try {
      const userIdParam = userId.current ? `?user_id=${userId.current}` : '';
      const res = await api.get(`/bible/listening-status${userIdParam}`);
      setListeningStatus(res.data);
      if (res.data.remaining_seconds >= 0) {
        setRemainingTime(res.data.remaining_seconds);
      }
      return res.data;
    } catch (error) {
      console.error('Error fetching listening status:', error);
      return null;
    }
  }, []);

  // Track listening time
  const trackListeningTime = useCallback(async (seconds) => {
    try {
      await api.post('/bible/listening-track', {
        user_id: userId.current,
        seconds: seconds
      });
    } catch (error) {
      console.error('Error tracking listening time:', error);
    }
  }, []);

  // Record prompt shown
  const recordPromptShown = useCallback(async () => {
    try {
      await api.post('/bible/prompt-shown', {
        user_id: userId.current
      });
    } catch (error) {
      console.error('Error recording prompt:', error);
    }
  }, []);

  // Check if user can listen and handle limit
  const checkListeningLimit = useCallback(async () => {
    const status = await fetchListeningStatus();
    if (!status || !status.limits_active) return true;
    
    if (status.remaining_seconds === 0) {
      // Stop any playing audio
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
        setPlayingId(null);
      }
      
      // Show donation modal
      await recordPromptShown();
      setShowDonationModal(true);
      return false;
    }
    
    return true;
  }, [fetchListeningStatus, recordPromptShown, sound]);

  // Start tracking when audio plays
  const startListeningTracking = useCallback(() => {
    listeningStartTime.current = Date.now();
    
    // Update remaining time every second
    if (trackingInterval.current) {
      clearInterval(trackingInterval.current);
    }
    
    trackingInterval.current = setInterval(async () => {
      if (listeningStatus?.limits_active && remainingTime > 0) {
        setRemainingTime(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            // Time's up - trigger limit check
            checkListeningLimit();
          }
          return newTime;
        });
      }
    }, 1000);
  }, [listeningStatus, remainingTime, checkListeningLimit]);

  // Stop tracking and sync time
  const stopListeningTracking = useCallback(async () => {
    if (trackingInterval.current) {
      clearInterval(trackingInterval.current);
      trackingInterval.current = null;
    }
    
    if (listeningStartTime.current) {
      const listenedSeconds = Math.round((Date.now() - listeningStartTime.current) / 1000);
      if (listenedSeconds > 0) {
        await trackListeningTime(listenedSeconds);
      }
      listeningStartTime.current = null;
    }
  }, [trackListeningTime]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [booksRes, snippetsRes] = await Promise.all([
          api.get(`/bible/books?language=${language}`),
          api.get(`/bible/featured-snippets?language=${language}&limit=10`),
          fetchListeningStatus()
        ]);
        setBooks(booksRes.data.books || []);
        setSnippets(snippetsRes.data.snippets || []);
      } catch (error) {
        console.error('Error fetching Bible data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [language, fetchListeningStatus]);

  // Fetch chapters when book selected
  useEffect(() => {
    if (selectedBook) {
      api.get(`/bible/books/${selectedBook.name}/chapters?language=${language}`)
        .then(res => setChapters(res.data.chapters || []))
        .catch(() => setChapters([]));
    }
  }, [selectedBook, language]);

  // Fetch verses when chapter selected
  useEffect(() => {
    if (selectedBook && selectedChapter) {
      api.get(`/bible/books/${selectedBook.name}/chapters/${selectedChapter}?language=${language}`)
        .then(res => setVerses(res.data.verses || []))
        .catch(() => setVerses([]));
    }
  }, [selectedBook, selectedChapter, language]);

  // Cleanup sound and tracking on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      stopListeningTracking();
    };
  }, [sound, stopListeningTracking]);

  // Play snippet audio
  const playSnippet = async (snippet) => {
    try {
      // Check listening limit before playing
      const canListen = await checkListeningLimit();
      if (!canListen) return;

      if (playingId === snippet.snippet_id) {
        // Stop playing
        if (sound) {
          await sound.stopAsync();
          await sound.unloadAsync();
          await stopListeningTracking();
        }
        setPlayingId(null);
        setSound(null);
        return;
      }

      setPlayingId(snippet.snippet_id);
      const res = await api.get(`/bible/snippets/${snippet.snippet_id}`);
      
      if (sound) {
        await sound.unloadAsync();
        await stopListeningTracking();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${res.data.audio_base64}` },
        { shouldPlay: true }
      );
      
      startListeningTracking();
      
      newSound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          await stopListeningTracking();
          setPlayingId(null);
          setSound(null);
          // Refresh listening status after playback
          fetchListeningStatus();
        }
      });
      
      setSound(newSound);
    } catch (error) {
      console.error('Error playing snippet:', error);
      Alert.alert('Error', 'Failed to play audio');
      setPlayingId(null);
    }
  };

  // Generate verse audio
  const playVerse = async (verse) => {
    try {
      // Check listening limit before playing
      const canListen = await checkListeningLimit();
      if (!canListen) return;

      setGeneratingAudio(true);
      setPlayingId(`verse_${verse.verse}`);
      
      const res = await api.post('/bible/tts/verse', {
        book_name: selectedBook.name,
        chapter: selectedChapter,
        verse: verse.verse,
        language: language,
        gender: rangeGender
      });

      if (sound) {
        await sound.unloadAsync();
        await stopListeningTracking();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${res.data.audio_base64}` },
        { shouldPlay: true }
      );
      
      startListeningTracking();
      
      newSound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          await stopListeningTracking();
          setPlayingId(null);
          setSound(null);
          fetchListeningStatus();
        }
      });
      
      setSound(newSound);
    } catch (error) {
      console.error('Error generating verse audio:', error);
      Alert.alert('Error', 'Failed to generate audio');
      setPlayingId(null);
    } finally {
      setGeneratingAudio(false);
    }
  };

  // Generate range audio
  const playRange = async () => {
    if (!rangeBook || !rangeChapter || !rangeStart || !rangeEnd) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    // Check listening limit before playing
    const canListen = await checkListeningLimit();
    if (!canListen) return;

    // Pause music player if playing
    await pauseMusicIfPlaying();

    try {
      setRangeLoading(true);
      
      const res = await api.post('/bible/tts/passage-range', {
        book_name: rangeBook,
        chapter: parseInt(rangeChapter),
        start_verse: parseInt(rangeStart),
        end_verse: parseInt(rangeEnd),
        language: language,
        gender: rangeGender
      });

      if (sound) {
        await sound.unloadAsync();
        await stopListeningTracking();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mp3;base64,${res.data.audio_base64}` },
        { shouldPlay: true }
      );
      
      startListeningTracking();
      
      newSound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          await stopListeningTracking();
          setPlayingId(null);
          setSound(null);
          fetchListeningStatus();
        }
      });
      
      setSound(newSound);
      setPlayingId(`range_${rangeBook}_${rangeChapter}`);
      setShowRangeModal(false);
    } catch (error) {
      console.error('Error generating range audio:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to generate audio');
    } finally {
      setRangeLoading(false);
    }
  };

  // Handle donation modal dismiss
  const handleDismissDonation = async () => {
    setShowDonationModal(false);
    // Refresh status to get additional minutes
    await fetchListeningStatus();
  };

  // Handle go to payment
  const handleGoToPayment = () => {
    setShowDonationModal(false);
    navigation.navigate('Subscription');
  };

  // Format time for display
  const formatTime = (seconds) => {
    if (seconds < 0) return '∞';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render remaining time indicator
  const renderTimeIndicator = () => {
    if (!listeningStatus?.limits_active || remainingTime < 0) return null;
    
    const isLow = remainingTime < 60;
    
    return (
      <View style={[styles.timeIndicator, isLow && styles.timeIndicatorLow]}>
        <Ionicons name="time-outline" size={14} color={isLow ? '#ef4444' : COLORS.textSecondary} />
        <Text style={[styles.timeIndicatorText, isLow && styles.timeIndicatorTextLow]}>
          {formatTime(remainingTime)}
        </Text>
      </View>
    );
  };

  // Render donation modal
  const renderDonationModal = () => (
    <Modal visible={showDonationModal} animationType="fade" transparent>
      <View style={styles.donationOverlay}>
        <View style={styles.donationContent}>
          <View style={styles.donationIcon}>
            <Ionicons name="heart" size={48} color={COLORS.donation} />
          </View>
          
          <Text style={styles.donationTitle}>
            {language === 'sw' ? 'Muda Umekwisha' : 'Time Limit Reached'}
          </Text>
          
          <Text style={styles.donationMessage}>
            {listeningStatus?.prompt_message_sw || 
              'Kusikiliza biblia ni bure lakini teknolojia hii ina gharama, changia kidogo kuwezesha uendelee kufurahia'}
          </Text>
          
          <TouchableOpacity
            style={styles.donationButton}
            onPress={handleGoToPayment}
          >
            <Ionicons name="gift" size={20} color="#fff" />
            <Text style={styles.donationButtonText}>
              {language === 'sw' ? 'Changia Sasa' : 'Donate Now'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismissDonation}
          >
            <Text style={styles.dismissButtonText}>
              {language === 'sw' ? 'Baadaye' : 'Later'}
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.donationNote}>
            {language === 'sw' 
              ? 'Utapata dakika chache za ziada ukibonyeza "Baadaye"'
              : 'You will get a few extra minutes by pressing "Later"'}
          </Text>
        </View>
      </View>
    </Modal>
  );

  // Render featured snippets section
  const renderSnippets = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('bible.featuredSnippets', 'Vifungu Maarufu')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {snippets.map((snippet, idx) => (
          <TouchableOpacity
            key={snippet.snippet_id}
            style={[styles.snippetCard, { backgroundColor: getCardColor(idx) }]}
            onPress={() => playSnippet(snippet)}
          >
            {snippet.is_featured && (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredText}>FEATURED</Text>
              </View>
            )}
            <Text style={styles.snippetHeading}>
              {snippet.heading || 'SOMO'}
            </Text>
            <Text style={styles.snippetReference}>{snippet.reference}</Text>
            <Text style={styles.snippetSubtitle} numberOfLines={2}>
              {snippet.subtitle || snippet.description}
            </Text>
            <View style={styles.snippetFooter}>
              <Text style={styles.snippetDuration}>
                ~{Math.round(snippet.duration_estimate || 30)}s
              </Text>
              <View style={[styles.playButton, playingId === snippet.snippet_id && styles.playButtonActive]}>
                <Ionicons 
                  name={playingId === snippet.snippet_id ? "pause" : "headset"} 
                  size={16} 
                  color={playingId === snippet.snippet_id ? "#000" : "#fff"} 
                />
                <Text style={[styles.playButtonText, playingId === snippet.snippet_id && styles.playButtonTextActive]}>
                  {playingId === snippet.snippet_id ? 'Simamisha' : 'Sikiliza'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const getCardColor = (idx) => {
    const colors = ['#4c1d95', '#065f46', '#831843', '#1e3a5f'];
    return colors[idx % colors.length];
  };

  // Main content based on selection state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  // Book list view
  if (!selectedBook) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="book" size={28} color={COLORS.primary} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>{t('bible.title', 'Biblia')}</Text>
                <Text style={styles.headerSubtitle}>{t('bible.listenToWord', 'Sikiliza Neno la Mungu')}</Text>
              </View>
              {renderTimeIndicator()}
            </View>

            {/* Range Reader Button */}
            <TouchableOpacity 
            style={styles.rangeButton}
            onPress={() => setShowRangeModal(true)}
          >
            <Ionicons name="mic" size={24} color="#fff" />
            <View style={styles.rangeButtonText}>
              <Text style={styles.rangeButtonTitle}>{t('bible.readRange', 'Soma Mistari')}</Text>
              <Text style={styles.rangeButtonSubtitle}>{t('bible.enterRange', 'Chagua mistari kusoma')}</Text>
            </View>
          </TouchableOpacity>

          {/* Featured Snippets */}
          {snippets.length > 0 && renderSnippets()}

          {/* Book List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('bible.selectBook', 'Chagua Kitabu')}</Text>
            
            {/* Testament Filter Tabs */}
            <View style={styles.testamentFilter}>
              <TouchableOpacity
                style={[styles.testamentTab, testamentFilter === 'all' && styles.testamentTabActive]}
                onPress={() => setTestamentFilter('all')}
              >
                <Text style={[styles.testamentTabText, testamentFilter === 'all' && styles.testamentTabTextActive]}>
                  {language === 'sw' ? 'Yote' : 'All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.testamentTab, testamentFilter === 'old' && styles.testamentTabActive]}
                onPress={() => setTestamentFilter('old')}
              >
                <Text style={[styles.testamentTabText, testamentFilter === 'old' && styles.testamentTabTextActive]}>
                  {language === 'sw' ? 'Agano la Kale' : 'Old Testament'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.testamentTab, testamentFilter === 'new' && styles.testamentTabActive]}
                onPress={() => setTestamentFilter('new')}
              >
                <Text style={[styles.testamentTabText, testamentFilter === 'new' && styles.testamentTabTextActive]}>
                  {language === 'sw' ? 'Agano Jipya' : 'New Testament'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Book Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('bible.searchBook', 'Tafuta kitabu...')}
                placeholderTextColor={COLORS.textSecondary}
                value={bookSearchQuery}
                onChangeText={setBookSearchQuery}
                autoCorrect={false}
              />
              {bookSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setBookSearchQuery('')} style={styles.searchClear}>
                  <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.bookGrid}>
              {filteredBooks.map(book => (
                <TouchableOpacity
                  key={book.book_id}
                  style={[styles.bookCard, book.testament === 'old' && styles.bookCardOld]}
                  onPress={() => setSelectedBook(book)}
                >
                  <Text style={styles.bookName}>
                    {language === 'sw' && book.name_localized ? book.name_localized : book.name}
                  </Text>
                  <Text style={styles.bookTestament}>
                    {book.testament === 'old' 
                      ? (language === 'sw' ? 'Agano la Kale' : 'Old Testament')
                      : (language === 'sw' ? 'Agano Jipya' : 'New Testament')}
                  </Text>
                </TouchableOpacity>
              ))}
              {filteredBooks.length === 0 && (
                <View style={styles.noResults}>
                  <Ionicons name="search-outline" size={32} color={COLORS.textSecondary} />
                  <Text style={styles.noResultsText}>
                    {t('bible.noBookFound', 'Hakuna kitabu kilichopatikana')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>

        {/* Range Reader Modal */}
        <Modal visible={showRangeModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('bible.readRange', 'Soma Mistari')}</Text>
                <TouchableOpacity onPress={() => setShowRangeModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Book Selection with Search */}
              <Text style={styles.inputLabel}>{t('bible.book', 'Kitabu')}</Text>
              <View style={styles.rangeBookSearchContainer}>
                <Ionicons name="search" size={16} color={COLORS.textSecondary} style={styles.rangeSearchIcon} />
                <TextInput
                  style={styles.rangeSearchInput}
                  placeholder={t('bible.searchBook', 'Tafuta kitabu...')}
                  placeholderTextColor={COLORS.textSecondary}
                  value={rangeBookSearch}
                  onChangeText={setRangeBookSearch}
                  autoCorrect={false}
                />
                {rangeBookSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setRangeBookSearch('')}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bookPicker}>
                {filteredRangeBooks.map(book => (
                  <TouchableOpacity
                    key={book.book_id}
                    style={[styles.bookPickerItem, rangeBook === book.name && styles.bookPickerItemActive]}
                    onPress={() => {
                      setRangeBook(book.name);
                      setRangeBookSearch('');
                    }}
                  >
                    <Text style={[styles.bookPickerText, rangeBook === book.name && styles.bookPickerTextActive]}>
                      {book.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Chapter and Verse Inputs */}
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('bible.chapter', 'Sura')}</Text>
                  <TextInput
                    style={styles.input}
                    value={rangeChapter}
                    onChangeText={setRangeChapter}
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('bible.startVerse', 'Mstari Kuanzia')}</Text>
                  <TextInput
                    style={styles.input}
                    value={rangeStart}
                    onChangeText={setRangeStart}
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{t('bible.endVerse', 'Mstari Mwisho')}</Text>
                  <TextInput
                    style={styles.input}
                    value={rangeEnd}
                    onChangeText={setRangeEnd}
                    keyboardType="numeric"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Gender Selection */}
              <Text style={styles.inputLabel}>{t('bible.voice', 'Sauti')}</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity
                  style={[styles.genderButton, rangeGender === 'female' && styles.genderButtonActive]}
                  onPress={() => setRangeGender('female')}
                >
                  <Text style={[styles.genderText, rangeGender === 'female' && styles.genderTextActive]}>
                    ♀ Kike
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.genderButton, rangeGender === 'male' && styles.genderButtonActive]}
                  onPress={() => setRangeGender('male')}
                >
                  <Text style={[styles.genderText, rangeGender === 'male' && styles.genderTextActive]}>
                    ♂ Kiume
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Reference Preview */}
              {rangeBook && (
                <View style={styles.referencePreview}>
                  <Text style={styles.referencePreviewText}>
                    {rangeBook} {rangeChapter}:{rangeStart}-{rangeEnd}
                  </Text>
                </View>
              )}

              {/* Play Button */}
              <TouchableOpacity
                style={[styles.playRangeButton, rangeLoading && styles.playRangeButtonDisabled]}
                onPress={playRange}
                disabled={rangeLoading}
              >
                {rangeLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="volume-high" size={20} color="#000" />
                    <Text style={styles.playRangeButtonText}>{t('bible.listenNow', 'Sikiliza Sasa')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Donation Modal */}
        {renderDonationModal()}
      </SafeAreaView>
    );
  }

  // Chapter list view
  if (!selectedChapter) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.navHeader}>
          <TouchableOpacity onPress={() => setSelectedBook(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.navTitle}>{selectedBook.name}</Text>
          {renderTimeIndicator()}
        </View>
        <ScrollView contentContainerStyle={styles.chapterGrid}>
          {chapters.map(ch => (
            <TouchableOpacity
              key={ch}
              style={styles.chapterButton}
              onPress={() => setSelectedChapter(ch)}
            >
              <Text style={styles.chapterText}>{ch}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {renderDonationModal()}
      </SafeAreaView>
    );
  }

  // Verses view
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => setSelectedChapter(null)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{selectedBook.name} {selectedChapter}</Text>
        <View style={styles.navRight}>
          {renderTimeIndicator()}
          <Text style={styles.verseCount}>{verses.length} mistari</Text>
        </View>
      </View>
      <FlatList
        data={verses}
        keyExtractor={(item) => item.verse_id}
        contentContainerStyle={styles.verseList}
        renderItem={({ item: verse }) => (
          <View style={styles.verseItem}>
            <Text style={styles.verseNumber}>{verse.verse}</Text>
            <Text style={styles.verseText}>{verse.text}</Text>
            <TouchableOpacity
              style={[styles.versePlayButton, playingId === `verse_${verse.verse}` && styles.versePlayButtonActive]}
              onPress={() => playVerse(verse)}
              disabled={generatingAudio}
            >
              {generatingAudio && playingId === `verse_${verse.verse}` ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons 
                  name={playingId === `verse_${verse.verse}` ? "pause" : "volume-high"} 
                  size={18} 
                  color={playingId === `verse_${verse.verse}` ? "#000" : COLORS.primary} 
                />
              )}
            </TouchableOpacity>
          </View>
        )}
      />
      {renderDonationModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  // Time indicator styles
  timeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  timeIndicatorLow: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  timeIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  timeIndicatorTextLow: {
    color: '#ef4444',
  },
  // Donation modal styles
  donationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  donationContent: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  donationIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  donationTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  donationMessage: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  donationButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.donation,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  donationButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  dismissButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 12,
  },
  dismissButtonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  donationNote: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  rangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryDark,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  rangeButtonText: {
    flex: 1,
  },
  rangeButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  rangeButtonSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  snippetCard: {
    width: 280,
    padding: 16,
    borderRadius: 16,
    marginRight: 12,
  },
  featuredBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  featuredText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  snippetHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  snippetReference: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  snippetSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  snippetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  snippetDuration: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  playButtonActive: {
    backgroundColor: '#fff',
  },
  playButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  playButtonTextActive: {
    color: '#000',
  },
  // Search styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: COLORS.text,
  },
  searchClear: {
    padding: 4,
  },
  noResults: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  noResultsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  // Testament filter styles
  testamentFilter: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  testamentTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  testamentTabActive: {
    backgroundColor: COLORS.primary,
  },
  testamentTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  testamentTabTextActive: {
    color: '#000',
  },
  // Range book search styles
  rangeBookSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    height: 40,
  },
  rangeSearchIcon: {
    marginRight: 6,
  },
  rangeSearchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  bookGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bookCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  bookCardOld: {
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  bookName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  bookTestament: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backButton: {
    marginRight: 16,
  },
  navTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verseCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  chapterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 8,
  },
  chapterButton: {
    width: 56,
    height: 56,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  chapterText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  verseList: {
    padding: 16,
  },
  verseItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  verseNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
    width: 32,
  },
  verseText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },
  versePlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  versePlayButtonActive: {
    backgroundColor: COLORS.primary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  inputLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  bookPicker: {
    maxHeight: 40,
  },
  bookPickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    marginRight: 8,
  },
  bookPickerItemActive: {
    backgroundColor: COLORS.primary,
  },
  bookPickerText: {
    fontSize: 14,
    color: COLORS.text,
  },
  bookPickerTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: COLORS.primary,
  },
  genderText: {
    fontSize: 14,
    color: COLORS.text,
  },
  genderTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  referencePreview: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  referencePreviewText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
  playRangeButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  playRangeButtonDisabled: {
    opacity: 0.6,
  },
  playRangeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
});

export default BibleScreen;
