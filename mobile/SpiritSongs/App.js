import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, StatusBar, Platform, Linking, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Context Providers
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PlayerProvider, usePlayer, setShowLoginPromptCallback, clearShowLoginPromptCallback } from './src/context/PlayerContext';
import { BillingProvider } from './src/context/BillingContext';
import { DownloadProvider } from './src/context/DownloadContext';

// Components
import ErrorBoundary from './src/components/ErrorBoundary';
import GuestPlayLimitModal from './src/components/GuestPlayLimitModal';
import AdPlayer from './src/components/AdPlayer';

// API
import { advertisingAPI, authAPI } from './src/services/api';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import AlbumScreen from './src/screens/AlbumScreen';
import BibleScreen from './src/screens/BibleScreen';
import ChurchesScreen from './src/screens/ChurchesScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LeaderContentScreen from './src/screens/LeaderContentScreen';
import SubscriptionPlansScreen from './src/screens/SubscriptionPlansScreen';
import MafundishoDetailScreen from './src/screens/MafundishoDetailScreen';
import SeeAllScreen from './src/screens/SeeAllScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import ChatScreen from './src/screens/ChatScreen';
import RadioScreen from './src/screens/RadioScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';

// Components
import MiniPlayer from './src/components/MiniPlayer';
import { ToastProvider } from './src/components/Toast';

// Theme
import { COLORS } from './src/config/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Wrapped screen components - defined outside TabNavigator to prevent recreation on every render
const SafeHomeScreen = (props) => (
  <ErrorBoundary fallbackMessage="Imeshindwa kupakia ukurasa wa nyumbani. Jaribu tena.">
    <HomeScreen {...props} />
  </ErrorBoundary>
);

const SafeSearchScreen = (props) => (
  <ErrorBoundary fallbackMessage="Imeshindwa kupakia ukurasa wa kutafuta. Jaribu tena.">
    <SearchScreen {...props} />
  </ErrorBoundary>
);

const SafeLibraryScreen = (props) => (
  <ErrorBoundary fallbackMessage="Imeshindwa kupakia maktaba. Jaribu tena.">
    <LibraryScreen {...props} />
  </ErrorBoundary>
);

// Tab Navigator with safe area padding
const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Library') {
            iconName = focused ? 'library' : 'library-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 0,
          paddingTop: 8,
          // Add safe area padding at bottom to avoid phone navigation buttons
          paddingBottom: Math.max(insets.bottom, 8),
          height: 60 + Math.max(insets.bottom, 8),
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
          marginBottom: 2,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={SafeHomeScreen} />
      <Tab.Screen name="Search" component={SafeSearchScreen} />
      <Tab.Screen name="Library" component={SafeLibraryScreen} />
    </Tab.Navigator>
  );
};

// App Content with Navigation and Mini Player
const AppContent = () => {
  const { currentTrack, pausePlayback, resumePlayback } = usePlayer();
  const { 
    shouldPromptLogin, 
    dismissLoginPrompt, 
    isAuthenticated, 
    isAppLocked,
    user,
    login: authLogin
  } = useAuth();
  const navigationRef = React.useRef();
  const [currentRoute, setCurrentRoute] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const insets = useSafeAreaInsets();

  // Ad state
  const [showAd, setShowAd] = useState(false);
  const [currentAd, setCurrentAd] = useState(null);
  const [adSettings, setAdSettings] = useState(null);
  const [songsPlayedCount, setSongsPlayedCount] = useState(0);
  const [lastAdTime, setLastAdTime] = useState(null);
  const deviceIdRef = useRef(`mobile_${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`);

  // Hide mini player on NowPlaying screen
  const showMiniPlayer = currentTrack && currentRoute !== 'NowPlaying';
  
  // Calculate bottom offset for mini player (directly above tab bar, minimal gap)
  const tabBarHeight = 60 + Math.max(insets.bottom, 8);
  const miniPlayerBottom = tabBarHeight + 4; // 4px gap above tab bar

  // Handle deep links for Google OAuth callback
  useEffect(() => {
    const handleDeepLink = async (event) => {
      const url = event.url || event;
      if (url && url.startsWith('gracefy://auth')) {
        try {
          // Parse token from URL
          let token = null;
          let userId = null;
          
          try {
            const urlObj = new URL(url.replace('gracefy://', 'https://temp.com/'));
            token = urlObj.searchParams.get('token');
            userId = urlObj.searchParams.get('user_id');
          } catch (e) {}
          
          // Fallback parsing
          if (!token && url.includes('token=')) {
            token = url.split('token=')[1]?.split('&')[0]?.split('#')[0];
          }
          
          if (token) {
            // Fetch user data and login
            const userResponse = await authAPI.getMe(token);
            const userData = userResponse.data || { user_id: userId };
            await authLogin(token, userData);
            setShowLoginModal(false);
          }
        } catch (error) {
          Alert.alert('Kosa', 'Imeshindikana kukamilisha uingiaji. Jaribu tena.');
        }
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [authLogin]);

  // Load ad settings on mount
  useEffect(() => {
    loadAdSettings();
  }, []);

  // Check for ad when song changes
  useEffect(() => {
    if (currentTrack && !isAuthenticated) {
      // Increment songs played for free users
      const newCount = songsPlayedCount + 1;
      setSongsPlayedCount(newCount);
      checkAndShowAd(newCount);
    }
  }, [currentTrack?.song_id]);

  const loadAdSettings = async () => {
    try {
      const response = await advertisingAPI.getSettings();
      setAdSettings(response.data);
    } catch (e) {
      console.log('[App] Failed to load ad settings');
    }
  };

  const checkAndShowAd = async (playCount) => {
    if (!adSettings?.enabled) return;
    if (isAuthenticated && adSettings?.free_users_only) return;

    try {
      const response = await advertisingAPI.getNextAd({
        user_id: user?.user_id,
        platform: 'mobile',
        songs_played: playCount,
        last_ad_time: lastAdTime?.toISOString()
      });

      if (response.data?.should_play_ad && response.data?.ad) {
        // Pause current music
        await pausePlayback();
        
        setCurrentAd(response.data.ad);
        setAdSettings(prev => ({ ...prev, ...response.data.settings }));
        setShowAd(true);
      }
    } catch (e) {
      console.log('[App] Ad check error:', e.message);
    }
  };

  const handleAdComplete = useCallback(async () => {
    setShowAd(false);
    setCurrentAd(null);
    setLastAdTime(new Date());
    // Resume music after ad
    await resumePlayback();
  }, [resumePlayback]);

  const handleAdSkip = useCallback(async () => {
    setShowAd(false);
    setCurrentAd(null);
    setLastAdTime(new Date());
    // Resume music after skip
    await resumePlayback();
  }, [resumePlayback]);

  // Setup callback for showing login modal from PlayerContext
  useEffect(() => {
    setShowLoginPromptCallback(() => {
      setShowLoginModal(true);
    });
    return () => {
      clearShowLoginPromptCallback();
    };
  }, []);

  // Also show modal when shouldPromptLogin becomes true
  useEffect(() => {
    if (shouldPromptLogin && !isAuthenticated) {
      setShowLoginModal(true);
    }
  }, [shouldPromptLogin, isAuthenticated]);

  const handleCloseLoginModal = useCallback(() => {
    // Only dismiss if NOT locked - if locked, user must login
    if (!isAppLocked) {
      setShowLoginModal(false);
      dismissLoginPrompt();
    }
  }, [dismissLoginPrompt, isAppLocked]);

  const handleLoginSuccess = useCallback(() => {
    // Just close the modal - AuthContext's login() already resets isAppLocked
    setShowLoginModal(false);
  }, []);

  return (
    <NavigationContainer 
      ref={navigationRef}
      onStateChange={() => {
        const route = navigationRef.current?.getCurrentRoute();
        setCurrentRoute(route?.name || '');
      }}
    >
      <View style={styles.container}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.background },
          }}
        >
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen 
            name="NowPlaying" 
            component={NowPlayingScreen}
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen name="Album" component={AlbumScreen} />
          <Stack.Screen name="Bible" component={BibleScreen} />
          <Stack.Screen name="Churches" component={ChurchesScreen} />
          <Stack.Screen name="Playlist" component={AlbumScreen} />
          <Stack.Screen name="LeaderContent" component={LeaderContentScreen} />
          <Stack.Screen name="MafundishoDetail" component={MafundishoDetailScreen} />
          <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansScreen} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} />
          <Stack.Screen name="SeeAll" component={SeeAllScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Feedback" component={FeedbackScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Radio" component={RadioScreen} />
          <Stack.Screen name="Subscription" component={SubscriptionScreen} />
        </Stack.Navigator>

        {/* Mini Player - Positioned directly above tab bar */}
        {showMiniPlayer && (
          <View style={[styles.miniPlayerContainer, { bottom: miniPlayerBottom }]}>
            <MiniPlayer 
              onPress={() => navigationRef.current?.navigate('NowPlaying')} 
            />
          </View>
        )}

        {/* Guest Play Limit Modal */}
        <GuestPlayLimitModal
          visible={showLoginModal || isAppLocked}
          onClose={handleCloseLoginModal}
          onSuccess={handleLoginSuccess}
        />

        {/* Ad Player Modal */}
        <AdPlayer
          visible={showAd}
          ad={currentAd}
          settings={adSettings}
          onComplete={handleAdComplete}
          onSkip={handleAdSkip}
          deviceId={deviceIdRef.current}
          userId={user?.user_id}
        />
      </View>
    </NavigationContainer>
  );
};

// Root App Component
export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      setShowOnboarding(hasSeenOnboarding !== 'true');
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setShowOnboarding(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  // Show nothing while loading
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} translucent={false} />
      </View>
    );
  }

  // Show onboarding if first launch
  if (showOnboarding) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <OnboardingScreen onComplete={handleOnboardingComplete} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} translucent={false} />
        <AuthProvider>
          <BillingProvider>
            <DownloadProvider>
              <PlayerProvider>
                <ToastProvider>
                  <AppContent />
                </ToastProvider>
              </PlayerProvider>
            </DownloadProvider>
          </BillingProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  miniPlayerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
