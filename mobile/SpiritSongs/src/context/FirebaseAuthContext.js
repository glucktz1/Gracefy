/**
 * Firebase Authentication Context for Gracefy
 * Provides Firebase Auth (Email/Password + Google Sign-In)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { AppState, Platform } from 'react-native';
import { 
  initializeApp, 
  getApps, 
  getApp 
} from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  sendPasswordResetEmail
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { firebaseConfig } from '../config/firebase';
import { firebaseAuthAPI, trackingAPI } from './api';
import locationService from './locationService';

// Complete any pending auth sessions
WebBrowser.maybeCompleteAuthSession();

const FirebaseAuthContext = createContext(null);

// Initialize Firebase
let firebaseApp;
try {
  firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
  console.log('Firebase init error:', error);
  firebaseApp = initializeApp(firebaseConfig);
}

const auth = getAuth(firebaseApp);

// Guest limits configuration
const GUEST_PLAY_LIMIT = 3;
const GUEST_SKIP_LIMIT = 3;
const GUEST_TIME_LIMIT_MINUTES = 10;
const MAX_PROMPT_ATTEMPTS = 3;

export const useFirebaseAuth = () => {
  const context = useContext(FirebaseAuthContext);
  if (!context) {
    console.warn('useFirebaseAuth called outside FirebaseAuthProvider - returning defaults');
    return {
      user: null,
      firebaseUser: null,
      isLoading: false,
      isAuthenticated: false,
      guestPlayCount: 0,
      guestSkipCount: 0,
      guestListenMinutes: 0,
      promptAttempts: 0,
      shouldPromptLogin: false,
      isAppLocked: false,
      loginPromptMessage: '',
      signInWithEmail: async () => ({ success: false }),
      signUpWithEmail: async () => ({ success: false }),
      signInWithGoogle: async () => ({ success: false }),
      logout: async () => {},
      resetPassword: async () => ({ success: false }),
      refreshUser: async () => {},
      incrementGuestPlayCount: () => false,
      incrementGuestSkipCount: () => false,
      updateGuestListenTime: () => {},
      resetGuestStats: () => {},
      dismissLoginPrompt: () => {},
      checkGuestLimits: () => ({ shouldPrompt: false, isLocked: false }),
    };
  }
  return context;
};

export const FirebaseAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Backend user data
  const [firebaseUser, setFirebaseUser] = useState(null); // Firebase user object
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Guest tracking state
  const [guestPlayCount, setGuestPlayCount] = useState(0);
  const [guestSkipCount, setGuestSkipCount] = useState(0);
  const [guestListenMinutes, setGuestListenMinutes] = useState(0);
  const [promptAttempts, setPromptAttempts] = useState(0);
  const [shouldPromptLogin, setShouldPromptLogin] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [loginPromptMessage, setLoginPromptMessage] = useState('');

  // Timer for tracking listen time
  const listenStartTimeRef = useRef(null);
  const listenTimerRef = useRef(null);

  // Google Sign-In configuration
  const [request, response, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId: '478977168051-8iat7t5rgqkqmr8ra1ufqlbd6pcqsl8p.apps.googleusercontent.com',
    webClientId: '478977168051-701oerhk4inc4fk1tgf7iu67qkbq1mso.apps.googleusercontent.com',
  });

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        
        // Get ID token and verify with backend
        try {
          const idToken = await fbUser.getIdToken();
          const response = await firebaseAuthAPI.verifyToken(idToken);
          
          if (response.data?.success) {
            const { token, user: userData } = response.data;
            
            // Save token for API calls
            await SecureStore.setItemAsync('auth_token', token);
            await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
            
            setUser(userData);
            setIsAuthenticated(true);
            
            // Reset guest stats
            await resetGuestStats();
            
            // Track device
            if (userData?.user_id) {
              trackDeviceInfo(userData.user_id);
              try {
                await locationService.init(userData.user_id);
              } catch (locErr) {
                console.log('Location init error:', locErr);
              }
            }
            
            console.log('Firebase auth verified:', userData.email);
          }
        } catch (error) {
          console.error('Backend verification failed:', error);
          // Still authenticated with Firebase, but backend sync failed
          setFirebaseUser(fbUser);
        }
      } else {
        // User signed out
        setFirebaseUser(null);
        setUser(null);
        setIsAuthenticated(false);
        await clearAuthData();
      }
      setIsLoading(false);
    });

    // Restore guest stats
    restoreGuestStats();
    startListenTimeTracking();

    return () => {
      unsubscribe();
      if (listenTimerRef.current) {
        clearInterval(listenTimerRef.current);
      }
    };
  }, []);

  // Handle Google Sign-In response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleCredential(id_token);
    }
  }, [response]);

  const restoreGuestStats = async () => {
    try {
      const savedPlayCount = await SecureStore.getItemAsync('guest_play_count');
      const savedSkipCount = await SecureStore.getItemAsync('guest_skip_count');
      const savedListenMinutes = await SecureStore.getItemAsync('guest_listen_minutes');
      const savedPromptAttempts = await SecureStore.getItemAsync('guest_prompt_attempts');
      
      if (savedPlayCount) setGuestPlayCount(parseInt(savedPlayCount, 10) || 0);
      if (savedSkipCount) setGuestSkipCount(parseInt(savedSkipCount, 10) || 0);
      if (savedListenMinutes) setGuestListenMinutes(parseFloat(savedListenMinutes) || 0);
      if (savedPromptAttempts) {
        const attempts = parseInt(savedPromptAttempts, 10) || 0;
        setPromptAttempts(attempts);
        if (attempts >= MAX_PROMPT_ATTEMPTS) {
          setIsAppLocked(true);
          setLoginPromptMessage('Tafadhali jisajili au ingia sasa');
        }
      }
    } catch (e) {
      console.log('Error restoring guest stats:', e);
    }
  };

  const startListenTimeTracking = () => {
    listenStartTimeRef.current = Date.now();
    listenTimerRef.current = setInterval(async () => {
      if (!isAuthenticated) {
        const minutesListened = (Date.now() - listenStartTimeRef.current) / 60000;
        const totalMinutes = guestListenMinutes + minutesListened;
        if (totalMinutes >= GUEST_TIME_LIMIT_MINUTES) {
          checkAndTriggerPrompt('time');
        }
      }
    }, 60000);
  };

  const clearAuthData = async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_data');
    } catch (e) {}
  };

  const trackDeviceInfo = async (userId) => {
    try {
      const deviceData = {
        user_id: userId,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        device_type: Platform.OS,
        device_manufacturer: Device.manufacturer || 'Unknown',
        device_model: Device.modelName || Device.modelId || 'Unknown',
        os_version: `${Platform.OS} ${Device.osVersion || Platform.Version}`,
        app_version: Application.nativeApplicationVersion || '1.0.0',
        device_info: {
          brand: Device.brand,
          designName: Device.designName,
          modelName: Device.modelName,
          osVersion: Device.osVersion,
          platformApiLevel: Device.platformApiLevel,
          totalMemory: Device.totalMemory,
          isDevice: Device.isDevice,
        }
      };
      await trackingAPI.trackDevice(deviceData);
    } catch (error) {
      console.log('Device tracking error:', error.message);
    }
  };

  // Email/Password Sign In
  const signInWithEmail = async (email, password) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Auth state listener will handle the rest
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('Sign in error:', error);
      let errorMessage = 'Imeshindikana kuingia';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Akaunti haijapatikana';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Password si sahihi';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email si sahihi';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Majaribio mengi sana. Jaribu baadaye.';
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Email/Password Sign Up
  const signUpWithEmail = async (email, password, name) => {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name
      if (name) {
        await updateProfile(userCredential.user, { displayName: name });
      }
      
      // Auth state listener will handle backend sync
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error('Sign up error:', error);
      let errorMessage = 'Imeshindikana kusajili';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email imetumika tayari';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password ni dhaifu sana';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email si sahihi';
      }
      
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign In
  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      // Use Expo Google provider
      await promptGoogleAsync();
      // Response will be handled in useEffect
      return { success: true };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { success: false, error: 'Imeshindikana kuingia na Google' };
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleCredential = async (idToken) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
      // Auth state listener will handle the rest
    } catch (error) {
      console.error('Google credential error:', error);
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Remove FCM token
      if (user?.user_id) {
        try {
          await firebaseAuthAPI.removeFcmToken(user.user_id);
        } catch (e) {}
      }
      
      await signOut(auth);
      await clearAuthData();
      setUser(null);
      setFirebaseUser(null);
      setIsAuthenticated(false);
      console.log('Logged out');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Password Reset
  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      return { success: false, error: 'Imeshindikana kutuma email ya kubadilisha password' };
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    if (firebaseUser) {
      try {
        const idToken = await firebaseUser.getIdToken(true);
        const response = await firebaseAuthAPI.verifyToken(idToken);
        if (response.data?.success) {
          setUser(response.data.user);
          await SecureStore.setItemAsync('user_data', JSON.stringify(response.data.user));
        }
      } catch (error) {
        console.log('Refresh user error:', error);
      }
    }
  };

  // Guest limit functions
  const getPromptMessage = (attempt) => {
    if (attempt === 0) {
      return 'Kufurahia huduma hii jisajili au ingia kwenye Gracefy';
    } else if (attempt === 1) {
      return 'Jisajili sasa kupata muziki zaidi na vipengele vyote!';
    } else if (attempt >= 2) {
      return 'Tafadhali jisajili au ingia sasa';
    }
    return 'Kufurahia huduma hii jisajili au ingia kwenye Gracefy';
  };

  const checkAndTriggerPrompt = useCallback((reason = 'play') => {
    if (isAuthenticated) return { shouldPrompt: false, isLocked: false };
    
    if (promptAttempts >= MAX_PROMPT_ATTEMPTS) {
      setIsAppLocked(true);
      setLoginPromptMessage('Tafadhali jisajili au ingia sasa');
      setShouldPromptLogin(true);
      return { shouldPrompt: true, isLocked: true };
    }
    
    setLoginPromptMessage(getPromptMessage(promptAttempts));
    setShouldPromptLogin(true);
    return { shouldPrompt: true, isLocked: false };
  }, [isAuthenticated, promptAttempts]);

  const incrementGuestPlayCount = useCallback(async () => {
    if (isAuthenticated) return false;
    
    const newCount = guestPlayCount + 1;
    setGuestPlayCount(newCount);
    
    try {
      await SecureStore.setItemAsync('guest_play_count', newCount.toString());
    } catch (e) {}
    
    if (newCount >= GUEST_PLAY_LIMIT) {
      checkAndTriggerPrompt('play');
      return true;
    }
    return false;
  }, [isAuthenticated, guestPlayCount, checkAndTriggerPrompt]);

  const incrementGuestSkipCount = useCallback(async () => {
    if (isAuthenticated) return false;
    
    const newCount = guestSkipCount + 1;
    setGuestSkipCount(newCount);
    
    try {
      await SecureStore.setItemAsync('guest_skip_count', newCount.toString());
    } catch (e) {}
    
    if (newCount >= GUEST_SKIP_LIMIT) {
      checkAndTriggerPrompt('skip');
      return true;
    }
    return false;
  }, [isAuthenticated, guestSkipCount, checkAndTriggerPrompt]);

  const updateGuestListenTime = useCallback(async (additionalMinutes) => {
    if (isAuthenticated) return;
    
    const newMinutes = guestListenMinutes + additionalMinutes;
    setGuestListenMinutes(newMinutes);
    
    try {
      await SecureStore.setItemAsync('guest_listen_minutes', newMinutes.toString());
    } catch (e) {}
    
    if (newMinutes >= GUEST_TIME_LIMIT_MINUTES) {
      checkAndTriggerPrompt('time');
    }
  }, [isAuthenticated, guestListenMinutes, checkAndTriggerPrompt]);

  const resetGuestStats = useCallback(async () => {
    setGuestPlayCount(0);
    setGuestSkipCount(0);
    setGuestListenMinutes(0);
    setPromptAttempts(0);
    setShouldPromptLogin(false);
    setIsAppLocked(false);
    listenStartTimeRef.current = Date.now();
    
    try {
      await SecureStore.deleteItemAsync('guest_play_count');
      await SecureStore.deleteItemAsync('guest_skip_count');
      await SecureStore.deleteItemAsync('guest_listen_minutes');
      await SecureStore.deleteItemAsync('guest_prompt_attempts');
    } catch (e) {}
  }, []);

  const dismissLoginPrompt = useCallback(async () => {
    const newAttempts = promptAttempts + 1;
    setPromptAttempts(newAttempts);
    setShouldPromptLogin(false);
    
    try {
      await SecureStore.setItemAsync('guest_prompt_attempts', newAttempts.toString());
    } catch (e) {}
    
    if (newAttempts >= MAX_PROMPT_ATTEMPTS) {
      setIsAppLocked(true);
      setLoginPromptMessage('Tafadhali jisajili au ingia sasa');
      setShouldPromptLogin(true);
    }
  }, [promptAttempts]);

  const checkGuestLimits = useCallback(() => {
    if (isAuthenticated) {
      return { shouldPrompt: false, isLocked: false };
    }
    
    const hasReachedLimit = 
      guestPlayCount >= GUEST_PLAY_LIMIT ||
      guestSkipCount >= GUEST_SKIP_LIMIT ||
      guestListenMinutes >= GUEST_TIME_LIMIT_MINUTES;
    
    const isLocked = promptAttempts >= MAX_PROMPT_ATTEMPTS;
    
    return { shouldPrompt: hasReachedLimit, isLocked };
  }, [isAuthenticated, guestPlayCount, guestSkipCount, guestListenMinutes, promptAttempts]);

  const value = {
    user,
    firebaseUser,
    isLoading,
    isAuthenticated,
    guestPlayCount,
    guestSkipCount,
    guestListenMinutes,
    promptAttempts,
    shouldPromptLogin,
    isAppLocked,
    loginPromptMessage,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    logout,
    resetPassword,
    refreshUser,
    incrementGuestPlayCount,
    incrementGuestSkipCount,
    updateGuestListenTime,
    resetGuestStats,
    dismissLoginPrompt,
    checkGuestLimits,
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
};

export default FirebaseAuthContext;
