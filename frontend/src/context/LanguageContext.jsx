import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Default translations for both languages
const defaultTranslations = {
  sw: {
    // Navigation
    "nav.home": "Nyumbani",
    "nav.search": "Tafuta",
    "nav.library": "Maktaba",
    "nav.profile": "Wasifu",
    
    // Home Screen
    "home.featured": "ILIYOANGAZIWA",
    "home.playNow": "Cheza Sasa",
    "home.forYou": "Kwako Wewe",
    "home.continuePlaying": "Endelea Kusikiliza",
    "home.popularAlbums": "Albamu Maarufu",
    "home.topPicks": "Chaguo Bora",
    "home.newReleases": "Mpya",
    "home.bestselling": "Zinazouzwa Zaidi",
    "home.churches": "Makanisa",
    "home.sermons": "Mahubiri na Tafakari",
    "home.teachings": "Mafundisho na Katekesi",
    "home.lentSongs": "Nyimbo za Kwaresima",
    "home.quickAccess": "Ufikiaji Haraka",
    "home.all": "Zote",
    
    // Library Screen
    "library.yourLibrary": "Maktaba Yako",
    "library.likedSongs": "Nyimbo Unazopenda",
    "library.downloads": "Vilivyopakuliwa",
    "library.playlists": "Orodha za Nyimbo",
    "library.recentlyPlayed": "Zilizochezwa Hivi Karibuni",
    "library.songs": "nyimbo",
    "library.albums": "Albamu",
    "library.artists": "Wasanii",
    "library.myLibrary": "Maktaba Yangu",
    
    // Player
    "player.nowPlaying": "Inacheza Sasa",
    "player.playingFrom": "INACHEZA KUTOKA",
    "player.queue": "Foleni",
    "player.nextInQueue": "Ijayo Katika Foleni",
    "player.noMoreSongs": "Hakuna nyimbo zaidi kwenye foleni",
    "player.shuffle": "Changanya",
    "player.repeat": "Rudia",
    "player.repeatOne": "Rudia Moja",
    
    // Actions
    "action.play": "Cheza",
    "action.playAll": "Cheza Zote",
    "action.pause": "Simamisha",
    "action.like": "Penda",
    "action.liked": "Imependwa",
    "action.download": "Pakua",
    "action.downloading": "Inapakua...",
    "action.downloaded": "Imepakuliwa",
    "action.saved": "Imehifadhiwa",
    "action.share": "Shiriki",
    "action.addToPlaylist": "Ongeza kwenye Orodha",
    "action.createPlaylist": "Tengeneza Orodha",
    "action.newPlaylist": "Orodha Mpya",
    "action.remove": "Ondoa",
    "action.clearAll": "Futa Zote",
    "action.follow": "Fuata",
    "action.following": "Unafuata",
    "action.subscribe": "Jiandikishe",
    
    // Search
    "search.placeholder": "Tafuta nyimbo, albamu, wasanii...",
    "search.recent": "Utafutaji wa Hivi Karibuni",
    "search.trending": "Zinazopanda",
    "search.noResults": "Hakuna matokeo",
    "search.tryDifferent": "Jaribu maneno mengine",
    "search.browseCategories": "Vinjari Aina",
    
    // Auth
    "auth.loginRequired": "Ingia Kwanza",
    "auth.pleaseLogin": "Tafadhali ingia ili uendelee",
    "auth.login": "Ingia",
    "auth.logout": "Toka",
    "auth.signUp": "Jisajili",
    "auth.signIn": "Ingia",
    "auth.email": "Barua pepe",
    "auth.password": "Nywila",
    "auth.forgotPassword": "Umesahau Nywila?",
    "auth.continueWithGoogle": "Endelea na Google",
    
    // Profile/Settings
    "settings.settings": "Mipangilio",
    "settings.language": "Lugha",
    "settings.kiswahili": "Kiswahili",
    "settings.english": "Kiingereza",
    "settings.changeLanguage": "Badilisha Lugha",
    "settings.account": "Akaunti",
    "settings.notifications": "Arifa",
    "settings.privacy": "Faragha",
    "settings.help": "Msaada",
    "settings.about": "Kuhusu",
    "settings.version": "Toleo",
    
    // Subscription
    "subscription.upgrade": "Boresha",
    "subscription.premium": "Premium",
    "subscription.free": "Bila Malipo",
    "subscription.monthly": "Kila Mwezi",
    "subscription.yearly": "Kila Mwaka",
    "subscription.subscribe": "Jiandikishe Sasa",
    
    // Common
    "common.seeAll": "Ona Zote",
    "common.noContent": "Hakuna maudhui bado",
    "common.pullToRefresh": "Vuta kushuka kuonyesha upya",
    "common.loading": "Inapakia...",
    "common.error": "Hitilafu",
    "common.retry": "Jaribu Tena",
    "common.cancel": "Ghairi",
    "common.close": "Funga",
    "common.save": "Hifadhi",
    "common.success": "Imefanikiwa",
    "common.confirm": "Thibitisha",
    "common.delete": "Futa",
    "common.edit": "Hariri",
    "common.done": "Imekamilika",
    "common.next": "Endelea",
    "common.back": "Rudi",
    "common.skip": "Ruka",
    "common.ok": "Sawa",
    "common.yes": "Ndiyo",
    "common.no": "Hapana",
    
    // Empty States
    "empty.noLikedSongs": "Hakuna Nyimbo Unazopenda",
    "empty.noDownloads": "Hakuna Vilivyopakuliwa",
    "empty.noPlaylists": "Hakuna Orodha za Nyimbo",
    "empty.tapHeartToAdd": "Gusa ikoni ya moyo kwenye wimbo wowote kuuongeza hapa",
    "empty.downloadToListen": "Pakua nyimbo kusikiliza bila mtandao",
    "empty.createPlaylistsToOrganize": "Tengeneza orodha kupanga muziki wako",
    "empty.noSearchResults": "Hakuna matokeo ya utafutaji",
    
    // Errors
    "error.networkError": "Hitilafu ya mtandao. Tafadhali angalia muunganisho wako.",
    "error.somethingWentWrong": "Kitu kimeenda vibaya",
    "error.tryAgain": "Tafadhali jaribu tena",
    
    // Greetings
    "greeting.morning": "Habari ya asubuhi",
    "greeting.afternoon": "Habari ya mchana",
    "greeting.evening": "Habari ya jioni",
  },
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.search": "Search",
    "nav.library": "Library",
    "nav.profile": "Profile",
    
    // Home Screen
    "home.featured": "FEATURED",
    "home.playNow": "Play Now",
    "home.forYou": "For You",
    "home.continuePlaying": "Continue Playing",
    "home.popularAlbums": "Popular Albums",
    "home.topPicks": "Top Picks",
    "home.newReleases": "New Releases",
    "home.bestselling": "Bestselling",
    "home.churches": "Churches",
    "home.sermons": "Sermons & Reflections",
    "home.teachings": "Teachings & Catechesis",
    "home.lentSongs": "Lent Songs",
    "home.quickAccess": "Quick Access",
    "home.all": "All",
    
    // Library Screen
    "library.yourLibrary": "Your Library",
    "library.likedSongs": "Liked Songs",
    "library.downloads": "Downloads",
    "library.playlists": "Playlists",
    "library.recentlyPlayed": "Recently Played",
    "library.songs": "songs",
    "library.albums": "Albums",
    "library.artists": "Artists",
    "library.myLibrary": "My Library",
    
    // Player
    "player.nowPlaying": "Now Playing",
    "player.playingFrom": "PLAYING FROM",
    "player.queue": "Queue",
    "player.nextInQueue": "Next in Queue",
    "player.noMoreSongs": "No more songs in queue",
    "player.shuffle": "Shuffle",
    "player.repeat": "Repeat",
    "player.repeatOne": "Repeat One",
    
    // Actions
    "action.play": "Play",
    "action.playAll": "Play All",
    "action.pause": "Pause",
    "action.like": "Like",
    "action.liked": "Liked",
    "action.download": "Download",
    "action.downloading": "Downloading...",
    "action.downloaded": "Downloaded",
    "action.saved": "Saved",
    "action.share": "Share",
    "action.addToPlaylist": "Add to Playlist",
    "action.createPlaylist": "Create Playlist",
    "action.newPlaylist": "New Playlist",
    "action.remove": "Remove",
    "action.clearAll": "Clear All",
    "action.follow": "Follow",
    "action.following": "Following",
    "action.subscribe": "Subscribe",
    
    // Search
    "search.placeholder": "Search songs, albums, artists...",
    "search.recent": "Recent Searches",
    "search.trending": "Trending",
    "search.noResults": "No results found",
    "search.tryDifferent": "Try different keywords",
    "search.browseCategories": "Browse Categories",
    
    // Auth
    "auth.loginRequired": "Login Required",
    "auth.pleaseLogin": "Please log in to continue",
    "auth.login": "Log In",
    "auth.logout": "Log Out",
    "auth.signUp": "Sign Up",
    "auth.signIn": "Sign In",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.forgotPassword": "Forgot Password?",
    "auth.continueWithGoogle": "Continue with Google",
    
    // Profile/Settings
    "settings.settings": "Settings",
    "settings.language": "Language",
    "settings.kiswahili": "Kiswahili",
    "settings.english": "English",
    "settings.changeLanguage": "Change Language",
    "settings.account": "Account",
    "settings.notifications": "Notifications",
    "settings.privacy": "Privacy",
    "settings.help": "Help & Support",
    "settings.about": "About",
    "settings.version": "Version",
    
    // Subscription
    "subscription.upgrade": "Upgrade",
    "subscription.premium": "Premium",
    "subscription.free": "Free",
    "subscription.monthly": "Monthly",
    "subscription.yearly": "Yearly",
    "subscription.subscribe": "Subscribe Now",
    
    // Common
    "common.seeAll": "See All",
    "common.noContent": "No content available yet",
    "common.pullToRefresh": "Pull down to refresh",
    "common.loading": "Loading...",
    "common.error": "Error",
    "common.retry": "Retry",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.save": "Save",
    "common.success": "Success",
    "common.confirm": "Confirm",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.done": "Done",
    "common.next": "Next",
    "common.back": "Back",
    "common.skip": "Skip",
    "common.ok": "OK",
    "common.yes": "Yes",
    "common.no": "No",
    
    // Empty States
    "empty.noLikedSongs": "No Liked Songs",
    "empty.noDownloads": "No Downloads",
    "empty.noPlaylists": "No Playlists",
    "empty.tapHeartToAdd": "Tap the heart icon on any song to add it here",
    "empty.downloadToListen": "Download songs to listen offline",
    "empty.createPlaylistsToOrganize": "Create playlists to organize your music",
    "empty.noSearchResults": "No search results",
    
    // Errors
    "error.networkError": "Network error. Please check your connection.",
    "error.somethingWentWrong": "Something went wrong",
    "error.tryAgain": "Please try again",
    
    // Greetings
    "greeting.morning": "Good morning",
    "greeting.afternoon": "Good afternoon",
    "greeting.evening": "Good evening",
  }
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('app_language') || 'sw';
  });
  const [customTranslations, setCustomTranslations] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Fetch custom translations from API
  const fetchTranslations = useCallback(async (lang) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/translations?lang=${lang}`);
      if (response.data?.translations) {
        setCustomTranslations(response.data.translations);
      }
    } catch (error) {
      console.log('Using default translations for', lang);
      setCustomTranslations({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTranslations(language);
  }, [language, fetchTranslations]);

  const changeLanguage = useCallback((newLanguage) => {
    if (newLanguage !== language) {
      setLanguage(newLanguage);
      localStorage.setItem('app_language', newLanguage);
    }
  }, [language]);

  // Translation function - gets from custom first, then defaults
  const t = useCallback((key, fallback) => {
    // First check custom translations from API
    if (customTranslations[key]) {
      return customTranslations[key];
    }
    // Then check default translations for current language
    if (defaultTranslations[language]?.[key]) {
      return defaultTranslations[language][key];
    }
    // Then check English defaults
    if (defaultTranslations.en?.[key]) {
      return defaultTranslations.en[key];
    }
    // Return fallback or key
    return fallback || key;
  }, [language, customTranslations]);

  // Get greeting based on time of day
  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('greeting.morning');
    if (hour < 18) return t('greeting.afternoon');
    return t('greeting.evening');
  }, [t]);

  const value = {
    language,
    changeLanguage,
    t,
    getGreeting,
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
    // Return a default context for components outside the provider
    return {
      language: 'sw',
      changeLanguage: () => {},
      t: (key, fallback) => defaultTranslations.sw[key] || defaultTranslations.en[key] || fallback || key,
      getGreeting: () => 'Habari',
      isLoading: false,
      availableLanguages: []
    };
  }
  return context;
};

export default LanguageContext;
