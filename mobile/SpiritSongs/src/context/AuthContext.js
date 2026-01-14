import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const savedToken = await SecureStore.getItemAsync('user_token');
      if (savedToken) {
        setToken(savedToken);
        const profile = await authService.getProfile();
        setUser(profile);
        setFavorites(profile.favorites || []);
        await SecureStore.setItemAsync('user_id', profile.user_id);
      }
    } catch (error) {
      console.log('Not authenticated');
      await SecureStore.deleteItemAsync('user_token');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, phone, password) => {
    const result = await authService.login({ 
      email: email || undefined, 
      phone: phone || undefined, 
      password 
    });
    
    await SecureStore.setItemAsync('user_token', result.token);
    await SecureStore.setItemAsync('user_id', result.user.user_id);
    setToken(result.token);
    setUser(result.user);
    setFavorites(result.user.favorites || []);
    
    return result;
  };

  const register = async (name, email, phone, password) => {
    const result = await authService.register({ 
      name,
      email: email || undefined, 
      phone: phone || undefined, 
      password 
    });
    
    await SecureStore.setItemAsync('user_token', result.token);
    await SecureStore.setItemAsync('user_id', result.user.user_id);
    setToken(result.token);
    setUser(result.user);
    
    return result;
  };

  const logout = async () => {
    await authService.logout();
    setToken(null);
    setUser(null);
    setFavorites([]);
  };

  const isFavorite = (id) => {
    return favorites.some(f => f.id === id);
  };

  const addFavorite = (type, id) => {
    setFavorites(prev => [...prev, { type, id }]);
  };

  const removeFavorite = (id) => {
    setFavorites(prev => prev.filter(f => f.id !== id));
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      favorites,
      login,
      register,
      logout,
      isFavorite,
      addFavorite,
      removeFavorite,
      isAuthenticated: !!token,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
