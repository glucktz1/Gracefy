import React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Contexts
import { AuthProvider } from './src/context/AuthContext';
import { PlayerProvider } from './src/context/PlayerContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import AlbumScreen from './src/screens/AlbumScreen';
import CategoryScreen from './src/screens/CategoryScreen';
import NowPlayingScreen from './src/screens/NowPlayingScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import ChoirRegistrationScreen from './src/screens/ChoirRegistrationScreen';
import PlaylistDetailScreen from './src/screens/PlaylistDetailScreen';
import ChurchDetailScreen from './src/screens/ChurchDetailScreen';

// Components
import MiniPlayer from './src/components/MiniPlayer';

// Config
import { COLORS } from './src/config';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator with Profile
function TabNavigator() {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          ...styles.tabBar,
          // Add bottom padding for navigation buttons
          paddingBottom: Math.max(insets.bottom, 12),
          height: 60 + Math.max(insets.bottom, 12),
        },
        tabBarActiveTintColor: '#e91e63',
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Search') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Library') {
            iconName = focused ? 'library' : 'library-outline';
          } else if (route.name === 'ProfileTab') {
            iconName = focused ? 'person' : 'person-outline';
          }
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

// Main Stack Navigator
const MainNavigator = React.forwardRef((props, ref) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0a0a1a' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Album" component={AlbumScreen} />
      <Stack.Screen name="Category" component={CategoryScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen 
        name="Subscription" 
        component={SubscriptionScreen}
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      />
      <Stack.Screen 
        name="NowPlaying" 
        component={NowPlayingScreen}
        options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
      />
      <Stack.Screen 
        name="ChoirRegistration" 
        component={ChoirRegistrationScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="Playlist" 
        component={PlaylistDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen 
        name="ChurchDetail" 
        component={ChurchDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
});

// Navigation state context for tracking current route
const NavigationStateContext = React.createContext({ currentRoute: '' });

// App Container with MiniPlayer - hide when on NowPlaying
function AppContainer() {
  const { currentRoute } = React.useContext(NavigationStateContext);
  
  return (
    <View style={styles.appContainer}>
      <MainNavigator />
      {/* Mini Player - hide when on NowPlaying screen */}
      {currentRoute !== 'NowPlaying' && <MiniPlayer />}
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <PlayerProvider>
              <NavigationContainer>
                <StatusBar style="light" />
                <AppContainer />
              </NavigationContainer>
            </PlayerProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  appContainer: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  tabBar: {
    backgroundColor: '#0a0a1a',
    borderTopWidth: 0,
    elevation: 0,
    paddingTop: 8,
    // Height and paddingBottom are now set dynamically with safe area insets
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
});
