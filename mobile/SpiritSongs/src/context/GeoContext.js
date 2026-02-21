import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { geoAPI } from '../services/api';
import { useAuth } from './AuthContext';

const GeoContext = createContext(null);

export const GeoProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [userCountry, setUserCountry] = useState(null);
  const [countrySource, setCountrySource] = useState('detecting'); // detecting, ip, profile, override
  const [geoEnabled, setGeoEnabled] = useState(false); // Default to false until we check settings
  const [geoSettings, setGeoSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch geo settings first
  const loadGeoSettings = useCallback(async () => {
    try {
      const settingsRes = await geoAPI.getSettings().catch(() => null);
      if (settingsRes?.data) {
        setGeoSettings(settingsRes.data);
        setGeoEnabled(settingsRes.data.geo_filtering_enabled ?? false);
        return settingsRes.data;
      }
      return null;
    } catch (error) {
      console.error('Error loading geo settings:', error);
      return null;
    }
  }, []);

  // Detect user's country on mount
  const detectCountry = useCallback(async () => {
    try {
      setLoading(true);
      setCountrySource('detecting');
      
      // Load settings first
      const settings = await loadGeoSettings();
      
      // If geo filtering is disabled, don't bother detecting
      if (!settings?.geo_filtering_enabled) {
        setUserCountry('GLOBAL');
        setCountrySource('disabled');
        setLoading(false);
        return;
      }
      
      // First check if user has an override or profile country
      if (user?.user_id && settings?.allow_country_override) {
        const userCountryRes = await geoAPI.getUserCountry(user.user_id).catch(() => null);
        if (userCountryRes?.data) {
          setUserCountry(userCountryRes.data.country_code);
          setCountrySource(userCountryRes.data.source || 'profile');
          setLoading(false);
          return;
        }
      }
      
      // Fall back to IP detection if enabled
      if (settings?.auto_detect_country) {
        const detectRes = await geoAPI.detectCountry().catch(() => null);
        if (detectRes?.data) {
          setUserCountry(detectRes.data.country_code);
          setCountrySource('ip');
        } else {
          setUserCountry('GLOBAL');
          setCountrySource('default');
        }
      } else {
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
  }, [user?.user_id, loadGeoSettings]);

  useEffect(() => {
    detectCountry();
  }, [detectCountry]);

  // Allow user to manually override their country
  const setCountryOverride = async (countryCode) => {
    try {
      if (user?.user_id && countryCode && geoSettings?.allow_country_override) {
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
    geoSettings,
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
