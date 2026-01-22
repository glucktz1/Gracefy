import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

  useEffect(() => {
    loadBooks();
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

  const filteredBooks = books.filter(book => {
    const matchesSearch = book.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (book.name_localized && book.name_localized.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesTestament = testamentFilter === 'all' || book.testament === testamentFilter;
    return matchesSearch && matchesTestament;
  });

  const getTitle = () => {
    if (selectedChapter) return `${selectedBook.name} ${selectedChapter}`;
    if (selectedBook) return selectedBook.name;
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
        <Text style={styles.title}>{getTitle()}</Text>
        <View style={{ width: 40 }} />
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
            keyExtractor={(item) => item.book_id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.bookCard, item.testament === 'old' && styles.bookCardOld]}
                onPress={() => loadChapters(item)}
              >
                <Text style={styles.bookName}>{item.name_localized || item.name}</Text>
                <Text style={styles.bookTestament}>
                  {item.testament === 'old' ? 'Agano la Kale' : 'Agano Jipya'}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.booksGrid}
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
        />
      )}

      {/* Verses View */}
      {selectedChapter && (
        <ScrollView style={styles.versesContainer}>
          {verses.map((verse) => (
            <View key={verse.verse} style={styles.verseItem}>
              <Text style={styles.verseNumber}>{verse.verse}</Text>
              <Text style={styles.verseText}>{verse.text}</Text>
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
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
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
  verseItem: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
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
});

export default BibleScreen;
