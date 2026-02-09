import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

// Guest play limit - number of songs before requiring login
const GUEST_PLAY_LIMIT = 3;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return safe defaults instead of throwing
    console.warn('useAuth called outside AuthProvider - returning defaults');
    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      guestPlayCount: 0,
      shouldPromptLogin: false,
      login: async () => ({ success: false }),
      logout: async () => {},
      register: async () => ({ success: false }),
      updateProfile: async () => ({ success: false }),
      refreshUser: async () => {},
      incrementGuestPlayCount: () => false,
      resetGuestPlayCount: () => {},
      dismissLoginPrompt: () => {},
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [guestPlayCount, setGuestPlayCount] = useState(0);
  const [shouldPromptLogin, setShouldPromptLogin] = useState(false);

  // Restore auth state from storage on mount
  const restoreAuthState = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const cachedUserData = await SecureStore.getItemAsync('user_data');
      const savedPlayCount = await SecureStore.getItemAsync('guest_play_count');
      
      console.log('Restoring auth state - Token exists:', !!token, 'Cached user:', !!cachedUserData);
      
      // Restore guest play count
      if (savedPlayCount) {
        setGuestPlayCount(parseInt(savedPlayCount, 10) || 0);
      }
      
      if (!token) {
        // No token - user is not logged in
        setUser(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      
      // Token exists - restore user from cache immediately for instant UI
      if (cachedUserData) {
        try {
          const userData = JSON.parse(cachedUserData);
          setUser(userData);
          setIsAuthenticated(true);
          console.log('Restored user from cache:', userData.user_id || userData.email);
        } catch (parseError) {
          console.log('Failed to parse cached user data');
        }
      }
      
      // Then validate token with server in background (don't block UI)
      validateTokenWithServer(token);
      
    } catch (e) {
      console.log('Error restoring auth state:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Validate token with server - updates user data if successful, clears only on explicit 401
  const validateTokenWithServer = async (token) => {
    try {
      const response = await authAPI.getMe();
      if (response.data) {
        setUser(response.data);
        setIsAuthenticated(true);
        // Update cache with fresh data
        await SecureStore.setItemAsync('user_data', JSON.stringify(response.data));
        console.log('Token validated successfully');
      }
    } catch (error) {
      const status = error?.response?.status;
      console.log('Token validation failed - Status:', status);
      
      // Only clear auth on explicit 401 Unauthorized (token invalid/expired)
      if (status === 401) {
        console.log('Token invalid/expired - clearing auth');
        await clearAuthData();
      }
      // For network errors, server errors (5xx), or 404 - keep user logged in with cached data
      // User can continue using the app offline or until server is back
    }
  };

  // Clear all auth data
  const clearAuthData = async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user_id');
      await SecureStore.deleteItemAsync('user_data');
    } catch (e) {
      console.log('Error clearing auth data:', e);
    }
    setUser(null);
    setIsAuthenticated(false);
  };

  // Initialize on mount
  useEffect(() => {
    restoreAuthState();
  }, [restoreAuthState]);

  // Handle app state changes (coming back from background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground - check if we have a token and validate
        const token = await SecureStore.getItemAsync('auth_token');
        if (token && !isAuthenticated) {
          // We have a token but not authenticated - restore
          restoreAuthState();
        }
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [isAuthenticated, restoreAuthState]);

  const login = async (token, userData) => {
    try {
      // Store token first
      await SecureStore.setItemAsync('auth_token', token);
      
      // Store user ID if available
      if (userData?.user_id) {
        await SecureStore.setItemAsync('user_id', userData.user_id);
      }
      
      // Store full user data for offline access
      if (userData) {
        await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
      }
      
      setUser(userData);
      setIsAuthenticated(true);
      
      // Reset guest play count on successful login
      setGuestPlayCount(0);
      setShouldPromptLogin(false);
      await SecureStore.deleteItemAsync('guest_play_count');
      
      console.log('Login successful:', userData?.email || userData?.user_id);
    } catch (e) {
      console.log('Error during login:', e);
      throw e;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {
      // Ignore logout API errors - still clear local state
    }
    await clearAuthData();
    console.log('Logged out');
  };

  const checkAuth = useCallback(async () => {
    await restoreAuthState();
  }, [restoreAuthState]);

  // Increment guest play count - returns true if should show login prompt
  const incrementGuestPlayCount = useCallback(async () => {
    if (isAuthenticated) {
      return false; // Logged in users don't have limits
    }
    
    const newCount = guestPlayCount + 1;
    setGuestPlayCount(newCount);
    
    try {
      await SecureStore.setItemAsync('guest_play_count', newCount.toString());
    } catch (e) {
      console.log('Error saving play count:', e);
    }
    
    if (newCount >= GUEST_PLAY_LIMIT) {
      setShouldPromptLogin(true);
      return true;
    }
    
    return false;
  }, [isAuthenticated, guestPlayCount]);

  // Reset guest play count (after login)
  const resetGuestPlayCount = useCallback(async () => {
    setGuestPlayCount(0);
    setShouldPromptLogin(false);
    try {
      await SecureStore.deleteItemAsync('guest_play_count');
    } catch (e) {}
  }, []);

  // Dismiss login prompt temporarily (user clicks "later")
  const dismissLoginPrompt = useCallback(() => {
    setShouldPromptLogin(false);
  }, []);

  const value = {
    user,
    isLoading,
    isAuthenticated,
    guestPlayCount,
    shouldPromptLogin,
    login,
    logout,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
