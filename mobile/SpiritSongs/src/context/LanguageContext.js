/**
 * Language Context - Global language state management for the mobile app
 * Stores and shares language preference across all screens
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = '@gracefy_language';

// Default translations
const translations = {
  sw: {
    // Common
    loading: 'Inapakia...',
    error: 'Kosa',
    success: 'Imefanikiwa',
    cancel: 'Ghairi',
    save: 'Hifadhi',
    delete: 'Futa',
    edit: 'Hariri',
    close: 'Funga',
    ok: 'Sawa',
    yes: 'Ndiyo',
    no: 'Hapana',
    
    // Navigation
    home: 'Nyumbani',
    search: 'Tafuta',
    library: 'Maktaba',
    profile: 'Wasifu',
    
    // Profile
    language: 'Lugha',
    languageChanged: 'Lugha Imebadilishwa',
    languageChangedMsg: 'Sasa programu itatumia',
    settings: 'Mipangilio',
    logout: 'Toka',
    
    // Library
    playlists: 'Orodha za Nyimbo',
    downloads: 'Vipakuaji',
    liked: 'Unazopenda',
    createPlaylist: 'Tengeneza Playlist',
    playlistCreated: 'Playlist imetengenezwa',
    playlistCreateFailed: 'Imeshindikana kutengeneza playlist',
    
    // Player
    nowPlaying: 'Inacheza Sasa',
    shuffle: 'Changanya',
    repeat: 'Rudia',
    
    // Auth
    login: 'Ingia',
    register: 'Jisajili',
    email: 'Barua pepe',
    password: 'Nenosiri',
  },
  en: {
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    ok: 'OK',
    yes: 'Yes',
    no: 'No',
    
    // Navigation
    home: 'Home',
    search: 'Search',
    library: 'Library',
    profile: 'Profile',
    
    // Profile
    language: 'Language',
    languageChanged: 'Language Changed',
    languageChangedMsg: 'App will now use',
    settings: 'Settings',
    logout: 'Logout',
    
    // Library
    playlists: 'Playlists',
    downloads: 'Downloads',
    liked: 'Liked',
    createPlaylist: 'Create Playlist',
    playlistCreated: 'Playlist created',
    playlistCreateFailed: 'Failed to create playlist',
    
    // Player
    nowPlaying: 'Now Playing',
    shuffle: 'Shuffle',
    repeat: 'Repeat',
    
    // Auth
    login: 'Login',
    register: 'Register',
    email: 'Email',
    password: 'Password',
  },
};

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('sw'); // Default to Swahili
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (savedLang && (savedLang === 'sw' || savedLang === 'en')) {
          setLanguage(savedLang);
        }
      } catch (error) {
        console.log('[Language] Error loading saved language:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLanguage();
  }, []);

  // Change language and persist
  const changeLanguage = useCallback(async (newLang) => {
    if (newLang !== language && (newLang === 'sw' || newLang === 'en')) {
      try {
        await AsyncStorage.setItem(LANGUAGE_KEY, newLang);
        setLanguage(newLang);
        console.log('[Language] Changed to:', newLang);
        return true;
      } catch (error) {
        console.error('[Language] Error saving language:', error);
        return false;
      }
    }
    return false;
  }, [language]);

  // Toggle between languages
  const toggleLanguage = useCallback(async () => {
    const newLang = language === 'sw' ? 'en' : 'sw';
    return await changeLanguage(newLang);
  }, [language, changeLanguage]);

  // Translation function
  const t = useCallback((key, fallback) => {
    const langTranslations = translations[language] || translations.sw;
    return langTranslations[key] || fallback || key;
  }, [language]);

  const value = {
    language,
    changeLanguage,
    toggleLanguage,
    t,
    isLoading,
    isSwahili: language === 'sw',
    isEnglish: language === 'en',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
