import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES } from '../config/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../services/api';

const LANGUAGE_KEY = '@gracefy_language';

const LegalScreen = ({ navigation, route }) => {
  const { type } = route.params; // 'terms', 'privacy', or 'about'
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(null);
  const [language, setLanguage] = useState('sw');

  const titles = {
    terms: { en: 'Terms of Service', sw: 'Masharti ya Huduma' },
    privacy: { en: 'Privacy Policy', sw: 'Sera ya Faragha' },
    about: { en: 'About', sw: 'Kuhusu' },
  };

  const pageTypeMap = {
    terms: 'terms_of_service',
    privacy: 'privacy_policy',
    about: 'about',
  };

  useEffect(() => {
    loadLanguage();
  }, []);

  useEffect(() => {
    if (language) {
      fetchContent();
    }
  }, [language, type]);

  const loadLanguage = async () => {
    try {
      const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
      setLanguage(savedLang || 'sw');
    } catch (e) {
      setLanguage('sw');
    }
  };

  const fetchContent = async () => {
    try {
      setLoading(true);
      const pageId = pageTypeMap[type] || type;
      const res = await axios.get(`${API_BASE_URL}/legal/${pageId}?lang=${language}`);
      setContent(res.data);
    } catch (error) {
      console.error('Error fetching legal content:', error);
      // Set default content if API fails
      setContent({
        title: titles[type]?.[language] || titles[type]?.['sw'],
        content: language === 'sw' 
          ? 'Samahani, maudhui hayapatikani kwa sasa. Tafadhali jaribu tena baadaye.'
          : 'Sorry, content is not available at the moment. Please try again later.',
        updated_at: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const renderContent = (text) => {
    if (!text) return null;
    
    return text.split('\n').map((line, i) => {
      if (line.startsWith('# ')) {
        return <Text key={i} style={styles.heading1}>{line.slice(2)}</Text>;
      }
      if (line.startsWith('## ')) {
        return <Text key={i} style={styles.heading2}>{line.slice(3)}</Text>;
      }
      if (line.startsWith('### ')) {
        return <Text key={i} style={styles.heading3}>{line.slice(4)}</Text>;
      }
      if (line.startsWith('- ')) {
        return (
          <View key={i} style={styles.bulletItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>{line.slice(2)}</Text>
          </View>
        );
      }
      if (line.trim() === '') {
        return <View key={i} style={styles.spacer} />;
      }
      return <Text key={i} style={styles.paragraph}>{line}</Text>;
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {titles[type]?.[language] || titles[type]?.['sw'] || 'Legal'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {content?.title && (
            <Text style={styles.title}>{content.title}</Text>
          )}
          
          <View style={styles.contentBox}>
            {renderContent(content?.content)}
          </View>
          
          {content?.updated_at && (
            <Text style={styles.updatedAt}>
              {language === 'sw' ? 'Imesasishwa' : 'Last updated'}: {new Date(content.updated_at).toLocaleDateString()}
            </Text>
          )}
          
          <View style={{ height: 50 }} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  contentBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
  },
  heading1: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  heading2: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  heading3: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  paragraph: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.xs,
  },
  bulletItem: {
    flexDirection: 'row',
    marginLeft: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  bullet: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    marginRight: SPACING.xs,
  },
  bulletText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  spacer: {
    height: SPACING.sm,
  },
  updatedAt: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

export default LegalScreen;
