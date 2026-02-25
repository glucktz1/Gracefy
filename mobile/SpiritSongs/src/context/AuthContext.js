import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { AppState, Platform } from 'react-native';
import { authAPI, trackingAPI } from '../services/api';
import locationService from '../services/locationService';

const AuthContext = createContext(null);

// Guest limits configuration
const GUEST_PLAY_LIMIT = 3;           // Songs played
const GUEST_SKIP_LIMIT = 3;           // Songs skipped
const GUEST_TIME_LIMIT_MINUTES = 10;  // Minutes of listening
const MAX_PROMPT_ATTEMPTS = 3;        // Lock after this many dismissals

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.warn('useAuth called outside AuthProvider - returning defaults');
    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      guestPlayCount: 0,
      guestSkipCount: 0,
      guestListenMinutes: 0,
      promptAttempts: 0,
      shouldPromptLogin: false,
      isAppLocked: false,
      loginPromptMessage: '',
      login: async () => ({ success: false }),
      logout: async () => {},
      register: async () => ({ success: false }),
      updateProfile: async () => ({ success: false }),
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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
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

  // Restore auth state from storage on mount
  const restoreAuthState = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const cachedUserData = await SecureStore.getItemAsync('user_data');
      const savedPlayCount = await SecureStore.getItemAsync('guest_play_count');
      const savedSkipCount = await SecureStore.getItemAsync('guest_skip_count');
      const savedListenMinutes = await SecureStore.getItemAsync('guest_listen_minutes');
      const savedPromptAttempts = await SecureStore.getItemAsync('guest_prompt_attempts');
      
      console.log('Restoring auth state - Token exists:', !!token, 'Cached user:', !!cachedUserData);
      
      // Restore guest stats
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
      
      if (!token) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      if (cachedUserData) {
        try {
          const userData = JSON.parse(cachedUserData);
          setUser(userData);
          setIsAuthenticated(true);
          console.log('Restored user from cache:', userData.email);
        } catch (e) {
          console.log('Failed to parse cached user data');
        }
      }

      try {
        const response = await authAPI.getProfile();
        if (response.data) {
          const freshUserData = response.data.user || response.data;
          setUser(freshUserData);
          setIsAuthenticated(true);
          await SecureStore.setItemAsync('user_data', JSON.stringify(freshUserData));
          console.log('Refreshed user data from API');
        }
      } catch (error) {
        console.log('Failed to refresh user from API:', error.message);
        if (error.response?.status === 401) {
          await clearAuthData();
        }
      }
    } catch (error) {
      console.error('Error restoring auth state:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreAuthState();
    
    // Start listen time tracking
    startListenTimeTracking();
    
    return () => {
      if (listenTimerRef.current) {
        clearInterval(listenTimerRef.current);
      }
    };
  }, [restoreAuthState]);

  // Track listen time for guest users
  const startListenTimeTracking = () => {
    listenStartTimeRef.current = Date.now();
    
    // Check every minute
    listenTimerRef.current = setInterval(async () => {
      if (!isAuthenticated) {
        const minutesListened = (Date.now() - listenStartTimeRef.current) / 60000;
        const totalMinutes = guestListenMinutes + minutesListened;
        
        if (totalMinutes >= GUEST_TIME_LIMIT_MINUTES) {
          checkAndTriggerPrompt('time');
        }
      }
    }, 60000); // Check every minute
  };

  const clearAuthData = async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_data');
    } catch (e) {}
    setUser(null);
    setIsAuthenticated(false);
  };

  // Track device information for analytics
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
      console.log('Device info tracked:', deviceData.device_model);
    } catch (error) {
      console.log('Device tracking error (non-critical):', error.message);
    }
  };

  const login = async (token, userData) => {
    try {
      await SecureStore.setItemAsync('auth_token', token);
      if (userData) {
        await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
      }
      setUser(userData);
      setIsAuthenticated(true);
      
      // Reset all guest stats on successful login
      await resetGuestStats();
      setIsAppLocked(false);
      setShouldPromptLogin(false);
      
      // Track device info for analytics
      if (userData?.user_id) {
        trackDeviceInfo(userData.user_id);
        
        // Initialize location tracking
        try {
          await locationService.init(userData.user_id);
        } catch (locErr) {
          console.log('Location init error (non-critical):', locErr);
        }
      }
      
      console.log('Login successful:', userData?.email || userData?.user_id);
    } catch (e) {
      console.log('Error during login:', e);
      throw e;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {}
    await clearAuthData();
    console.log('Logged out');
  };

  const checkAuth = useCallback(async () => {
    await restoreAuthState();
  }, [restoreAuthState]);

  // Get appropriate message based on prompt attempts
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

  // Check and trigger login prompt
  const checkAndTriggerPrompt = useCallback(async (reason = 'play') => {
    if (isAuthenticated) return { shouldPrompt: false, isLocked: false };
    
    const currentAttempts = promptAttempts;
    
    if (currentAttempts >= MAX_PROMPT_ATTEMPTS) {
      setIsAppLocked(true);
      setLoginPromptMessage('Tafadhali jisajili au ingia sasa');
      setShouldPromptLogin(true);
      return { shouldPrompt: true, isLocked: true };
    }
    
    setLoginPromptMessage(getPromptMessage(currentAttempts));
    setShouldPromptLogin(true);
    return { shouldPrompt: true, isLocked: false };
  }, [isAuthenticated, promptAttempts]);

  // Increment play count - returns true if should show prompt
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

  // Increment skip count - returns true if should show prompt
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

  // Update guest listen time
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

  // Reset all guest stats (after login)
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

  // Dismiss login prompt (user clicked "later")
  const dismissLoginPrompt = useCallback(async () => {
    const newAttempts = promptAttempts + 1;
    setPromptAttempts(newAttempts);
    setShouldPromptLogin(false);
    
    try {
      await SecureStore.setItemAsync('guest_prompt_attempts', newAttempts.toString());
    } catch (e) {}
    
    // Check if should lock
    if (newAttempts >= MAX_PROMPT_ATTEMPTS) {
      setIsAppLocked(true);
      setLoginPromptMessage('Tafadhali jisajili au ingia sasa');
      setShouldPromptLogin(true);
    }
  }, [promptAttempts]);

  // Check all guest limits
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
    isLoading,
    isAuthenticated,
    guestPlayCount,
    guestSkipCount,
    guestListenMinutes,
    promptAttempts,
    shouldPromptLogin,
    isAppLocked,
    loginPromptMessage,
    login,
    logout,
    checkAuth,
    incrementGuestPlayCount,
    incrementGuestSkipCount,
    updateGuestListenTime,
    resetGuestStats,
    dismissLoginPrompt,
    checkGuestLimits,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
