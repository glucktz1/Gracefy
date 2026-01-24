import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data);
          setIsAuthenticated(true);
        } catch (apiError) {
          console.log('Auth API check failed:', apiError?.response?.status);
          // Only clear token on explicit authentication errors (401)
          // Keep token on network errors so user stays logged in offline
          if (apiError?.response?.status === 401) {
            await SecureStore.deleteItemAsync('auth_token');
            await SecureStore.deleteItemAsync('user_id');
            setUser(null);
            setIsAuthenticated(false);
          } else {
            // Network error or server error - keep user logged in with stored data
            const storedUserId = await SecureStore.getItemAsync('user_id');
            if (storedUserId) {
              setUser({ user_id: storedUserId });
              setIsAuthenticated(true);
            }
          }
        }
      }
    } catch (e) {
      console.log('Auth check error:', e);
      // Error reading from SecureStore - don't modify auth state
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (token, userData) => {
    await SecureStore.setItemAsync('auth_token', token);
    if (userData?.user_id) {
      await SecureStore.setItemAsync('user_id', userData.user_id);
    }
    // Store user data for offline access
    if (userData) {
      await SecureStore.setItemAsync('user_data', JSON.stringify(userData));
    }
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {
      // Ignore logout errors
    }
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('user_id');
    await SecureStore.deleteItemAsync('user_data');
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
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
