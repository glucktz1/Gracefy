import React, { useState } from 'react';
import { StyleSheet, View, StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

// Context Providers
import { AuthProvider } from './src/context/AuthContext';
import { PlayerProvider, usePlayer } from './src/context/PlayerContext';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import AlbumScreen from './src/screens/AlbumScreen';
import BibleScreen from './src/screens/BibleScreen';
import ChurchesScreen from './src/screens/ChurchesScreen';

// Components
import MiniPlayer from './src/components/MiniPlayer';

// Theme
import { COLORS } from './src/config/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
    </Tab.Navigator>
  );
};

// App Content with Navigation and Mini Player
const AppContent = () => {
  const { currentTrack } = usePlayer();
  const navigationRef = React.useRef();
  const [currentRoute, setCurrentRoute] = useState('');
  const insets = useSafeAreaInsets();

  // Hide mini player on NowPlaying screen
  const showMiniPlayer = currentTrack && currentRoute !== 'NowPlaying';
  
  // Calculate bottom offset for mini player (directly above tab bar, minimal gap)
  const tabBarHeight = 60 + Math.max(insets.bottom, 8);
  const miniPlayerBottom = tabBarHeight + 4; // 4px gap above tab bar

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
      </View>
    </NavigationContainer>
  );
};

// Root App Component
export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} translucent={false} />
        <AuthProvider>
          <PlayerProvider>
            <AppContent />
          </PlayerProvider>
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
