import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { geoAPI } from '../services/api';
import { useAuth } from './AuthContext';

const GeoContext = createContext(null);

export const GeoProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [userCountry, setUserCountry] = useState(null);
  const [countrySource, setCountrySource] = useState('detecting'); // detecting, ip, profile, override
  const [geoEnabled, setGeoEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  // Detect user's country on mount
  const detectCountry = useCallback(async () => {
    try {
      setLoading(true);
      setCountrySource('detecting');
      
      // First check if user has an override or profile country
      if (user?.user_id) {
        const userCountryRes = await geoAPI.getUserCountry(user.user_id).catch(() => null);
        if (userCountryRes?.data) {
          setUserCountry(userCountryRes.data.country_code);
          setCountrySource(userCountryRes.data.source || 'profile');
          setLoading(false);
          return;
        }
      }
      
      // Fall back to IP detection
      const detectRes = await geoAPI.detectCountry().catch(() => null);
      if (detectRes?.data) {
        setUserCountry(detectRes.data.country_code);
        setCountrySource('ip');
      } else {
        // Default to GLOBAL if detection fails
        setUserCountry('GLOBAL');
        setCountrySource('default');
      }
    } catch (error) {
      console.error('Error detecting country:', error);
      setUserCountry('GLOBAL');
      setCountrySource('default');
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => {
    detectCountry();
  }, [detectCountry]);

  // Allow user to manually override their country
  const setCountryOverride = async (countryCode) => {
    try {
      if (user?.user_id && countryCode) {
        await geoAPI.setCountryOverride(user.user_id, countryCode);
      }
      setUserCountry(countryCode);
      setCountrySource('override');
      return true;
    } catch (error) {
      console.error('Error setting country override:', error);
      return false;
    }
  };

  // Clear override and re-detect
  const clearOverride = async () => {
    try {
      if (user?.user_id) {
        await geoAPI.setCountryOverride(user.user_id, '');
      }
      await detectCountry();
      return true;
    } catch (error) {
      console.error('Error clearing override:', error);
      return false;
    }
  };

  // Toggle geo-filtering (admin can disable for testing)
  const toggleGeoFiltering = (enabled) => {
    setGeoEnabled(enabled);
  };

  const value = {
    userCountry,
    countrySource,
    geoEnabled,
    loading,
    detectCountry,
    setCountryOverride,
    clearOverride,
    toggleGeoFiltering,
  };

  return (
    <GeoContext.Provider value={value}>
      {children}
    </GeoContext.Provider>
  );
};

export const useGeo = () => {
  const context = useContext(GeoContext);
  if (!context) {
    // Return default values if not within provider
    return {
      userCountry: 'GLOBAL',
      countrySource: 'default',
      geoEnabled: false,
      loading: false,
      detectCountry: () => {},
      setCountryOverride: () => false,
      clearOverride: () => false,
      toggleGeoFiltering: () => {},
    };
  }
  return context;
};
