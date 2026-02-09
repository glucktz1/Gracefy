import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, StatusBar, Platform } from 'react-native';
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
import { advertisingAPI } from './src/services/api';

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
  const { currentTrack } = usePlayer();
  const { guestPlayCount, shouldPromptLogin, dismissLoginPrompt, isAuthenticated } = useAuth();
  const navigationRef = React.useRef();
  const [currentRoute, setCurrentRoute] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const insets = useSafeAreaInsets();

  // Hide mini player on NowPlaying screen
  const showMiniPlayer = currentTrack && currentRoute !== 'NowPlaying';
  
  // Calculate bottom offset for mini player (directly above tab bar, minimal gap)
  const tabBarHeight = 60 + Math.max(insets.bottom, 8);
  const miniPlayerBottom = tabBarHeight + 4; // 4px gap above tab bar

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
    setShowLoginModal(false);
    dismissLoginPrompt();
  }, [dismissLoginPrompt]);

  const handleLoginSuccess = useCallback(() => {
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
          visible={showLoginModal}
          onClose={handleCloseLoginModal}
          onSuccess={handleLoginSuccess}
          songsPlayed={guestPlayCount}
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
