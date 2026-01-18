import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

// Translations - Kiswahili as default, English as option
const translations = {
  sw: {
    // App Name & Header
    appName: 'Nyimbo za Roho',
    
    // Navigation
    home: 'Nyumbani',
    search: 'Tafuta',
    library: 'Maktaba',
    profile: 'Wasifu',
    
    // Home Screen
    featured: 'ILIYOANGAZIWA',
    playNow: 'Cheza Sasa',
    forYou: 'Kwako Wewe',
    continuePlayingTitle: 'Endelea Kusikiliza',
    popularAlbums: 'Albamu Maarufu',
    topPicks: 'Chaguo Bora',
    newReleases: 'Mpya',
    bestselling: 'Zinazouzwa Zaidi',
    churches: 'Makanisa',
    
    // New Sections
    mahubirinaTafakari: 'Mahubiri na Tafakari',
    mafundishoNaKatekesi: 'Mafundisho na Katekesi',
    
    // Library Screen
    yourLibrary: 'Maktaba Yako',
    likedSongs: 'Nyimbo Unazopenda',
    downloads: 'Vilivyopakuliwa',
    playlists: 'Orodha za Nyimbo',
    recentlyPlayed: 'Zilizochezwa Hivi Karibuni',
    songs: 'nyimbo',
    
    // Player
    nowPlaying: 'Inacheza Sasa',
    playingFrom: 'INACHEZA KUTOKA',
    queue: 'Foleni',
    nextInQueue: 'Ijayo Katika Foleni',
    noMoreSongs: 'Hakuna nyimbo zaidi kwenye foleni',
    
    // Actions
    play: 'Cheza',
    playAll: 'Cheza Zote',
    pause: 'Simamisha',
    like: 'Penda',
    liked: 'Imependwa',
    download: 'Pakua',
    saved: 'Imehifadhiwa',
    share: 'Shiriki',
    addToPlaylist: 'Ongeza kwenye Orodha',
    createPlaylist: 'Tengeneza Orodha',
    newPlaylist: 'Orodha Mpya',
    remove: 'Ondoa',
    clearAll: 'Futa Zote',
    
    // Auth
    loginRequired: 'Ingia Kwanza',
    pleaseLogin: 'Tafadhali ingia ili uendelee',
    login: 'Ingia',
    logout: 'Toka',
    
    // Settings
    settings: 'Mipangilio',
    language: 'Lugha',
    kiswahili: 'Kiswahili',
    english: 'Kiingereza',
    changeLanguage: 'Badilisha Lugha',
    
    // Common
    seeAll: 'Ona Zote',
    noContent: 'Hakuna maudhui bado',
    pullToRefresh: 'Vuta kushuka kuonyesha upya',
    loading: 'Inapakia...',
    error: 'Hitilafu',
    retry: 'Jaribu Tena',
    cancel: 'Ghairi',
    close: 'Funga',
    save: 'Hifadhi',
    success: 'Imefanikiwa',
    
    // Subscription
    upgrade: 'Boresha',
    premium: 'Premium',
    
    // Empty States
    noLikedSongs: 'Hakuna Nyimbo Unazopenda',
    noDownloads: 'Hakuna Vilivyopakuliwa',
    noPlaylists: 'Hakuna Orodha za Nyimbo',
    tapHeartToAdd: 'Gusa ikoni ya moyo kwenye wimbo wowote kuuongeza hapa',
    downloadToListen: 'Pakua nyimbo kusikiliza bila mtandao',
    createPlaylistsToOrganize: 'Tengeneza orodha kupanga muziki wako',
  },
  en: {
    // App Name & Header
    appName: 'Spirit Songs',
    
    // Navigation
    home: 'Home',
    search: 'Search',
    library: 'Library',
    profile: 'Profile',
    
    // Home Screen
    featured: 'FEATURED',
    playNow: 'Play Now',
    forYou: 'For You',
    continuePlayingTitle: 'Continue Playing',
    popularAlbums: 'Popular Albums',
    topPicks: 'Top Picks',
    newReleases: 'New Releases',
    bestselling: 'Bestselling',
    churches: 'Churches',
    
    // New Sections
    mahubirinaTafakari: 'Sermons & Reflections',
    mafundishoNaKatekesi: 'Teachings & Catechesis',
    
    // Library Screen
    yourLibrary: 'Your Library',
    likedSongs: 'Liked Songs',
    downloads: 'Downloads',
    playlists: 'Playlists',
    recentlyPlayed: 'Recently Played',
    songs: 'songs',
    
    // Player
    nowPlaying: 'Now Playing',
    playingFrom: 'PLAYING FROM',
    queue: 'Queue',
    nextInQueue: 'Next in Queue',
    noMoreSongs: 'No more songs in queue',
    
    // Actions
    play: 'Play',
    playAll: 'Play All',
    pause: 'Pause',
    like: 'Like',
    liked: 'Liked',
    download: 'Download',
    saved: 'Saved',
    share: 'Share',
    addToPlaylist: 'Add to Playlist',
    createPlaylist: 'Create Playlist',
    newPlaylist: 'New Playlist',
    remove: 'Remove',
    clearAll: 'Clear All',
    
    // Auth
    loginRequired: 'Login Required',
    pleaseLogin: 'Please log in to continue',
    login: 'Log In',
    logout: 'Log Out',
    
    // Settings
    settings: 'Settings',
    language: 'Language',
    kiswahili: 'Kiswahili',
    english: 'English',
    changeLanguage: 'Change Language',
    
    // Common
    seeAll: 'See All',
    noContent: 'No content available yet',
    pullToRefresh: 'Pull down to refresh',
    loading: 'Loading...',
    error: 'Error',
    retry: 'Retry',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    success: 'Success',
    
    // Subscription
    upgrade: 'Upgrade',
    premium: 'Premium',
    
    // Empty States
    noLikedSongs: 'No Liked Songs',
    noDownloads: 'No Downloads',
    noPlaylists: 'No Playlists',
    tapHeartToAdd: 'Tap the heart icon on any song to add it here',
    downloadToListen: 'Download songs to listen offline',
    createPlaylistsToOrganize: 'Create playlists to organize your music',
  }
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  // Default to Kiswahili (sw)
  const [language, setLanguage] = useState('sw');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await SecureStore.getItemAsync('app_language');
      if (savedLanguage && translations[savedLanguage]) {
        setLanguage(savedLanguage);
      }
    } catch (error) {
      console.log('Error loading language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const changeLanguage = async (newLanguage) => {
    if (translations[newLanguage]) {
      setLanguage(newLanguage);
      try {
        await SecureStore.setItemAsync('app_language', newLanguage);
      } catch (error) {
        console.log('Error saving language:', error);
      }
    }
  };

  // Translation function
  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  // Get current translations object
  const strings = translations[language] || translations['en'];

  const value = {
    language,
    changeLanguage,
    t,
    strings,
    isLoading,
    availableLanguages: [
      { code: 'sw', name: 'Kiswahili', nativeName: 'Kiswahili' },
      { code: 'en', name: 'English', nativeName: 'English' }
    ]
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
