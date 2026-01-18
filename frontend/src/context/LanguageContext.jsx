import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Default translations (fallback if API fails)
const defaultTranslations = {
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
  
  // Library Screen
  "library.yourLibrary": "Maktaba Yako",
  "library.likedSongs": "Nyimbo Unazopenda",
  "library.downloads": "Vilivyopakuliwa",
  "library.playlists": "Orodha za Nyimbo",
  "library.recentlyPlayed": "Zilizochezwa Hivi Karibuni",
  "library.songs": "nyimbo",
  "library.albums": "Albamu",
  "library.artists": "Wasanii",
  
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
  
  // Auth
  "auth.loginRequired": "Ingia Kwanza",
  "auth.pleaseLogin": "Tafadhali ingia ili uendelee",
  "auth.login": "Ingia",
  "auth.logout": "Toka",
  "auth.signUp": "Jisajili",
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
  
  // PWA Specific
  "pwa.installApp": "Sakinisha Programu",
  "pwa.addToHomeScreen": "Ongeza kwenye Skrini ya Nyumbani",
  "pwa.offline": "Uko nje ya mtandao",
  "pwa.updateAvailable": "Sasisho linapatikana",
};

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('app_language') || 'sw';
  });
  const [translations, setTranslations] = useState(defaultTranslations);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch translations from API
  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        const response = await axios.get(`${API}/translations?lang=${language}`);
        if (response.data?.translations) {
          setTranslations(prev => ({
            ...prev,
            ...response.data.translations
          }));
        }
      } catch (error) {
        console.log('Using default translations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTranslations();
  }, [language]);

  const changeLanguage = (newLanguage) => {
    setLanguage(newLanguage);
    localStorage.setItem('app_language', newLanguage);
  };

  // Translation function
  const t = (key, fallback) => {
    return translations[key] || fallback || key;
  };

  const value = {
    language,
    changeLanguage,
    t,
    translations,
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
      t: (key, fallback) => fallback || key,
      translations: defaultTranslations,
      isLoading: false,
      availableLanguages: []
    };
  }
  return context;
};

export default LanguageContext;
