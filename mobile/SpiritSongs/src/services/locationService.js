/**
 * Location Service for SpiritSongs
 * Captures GPS location and sends to analytics
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import api from './api';

const LOCATION_KEY = '@user_location';
const LOCATION_PERMISSION_ASKED = '@location_permission_asked';
const LOCATION_UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

class LocationService {
  constructor() {
    this.lastLocation = null;
    this.userId = null;
  }

  /**
   * Initialize location service with user ID
   */
  async init(userId) {
    this.userId = userId;
    
    // Check if we should request location
    const permissionAsked = await AsyncStorage.getItem(LOCATION_PERMISSION_ASKED);
    const lastLocation = await this.getStoredLocation();
    
    // If location is recent (less than 24 hours), don't update
    if (lastLocation && lastLocation.timestamp) {
      const timeSinceUpdate = Date.now() - lastLocation.timestamp;
      if (timeSinceUpdate < LOCATION_UPDATE_INTERVAL) {
        this.lastLocation = lastLocation;
        return lastLocation;
      }
    }
    
    // Request location if not asked before or location is stale
    if (!permissionAsked || !lastLocation) {
      return await this.requestLocation();
    }
    
    return lastLocation;
  }

  /**
   * Request location permission and get current location
   */
  async requestLocation() {
    try {
      // Mark that we've asked for permission
      await AsyncStorage.setItem(LOCATION_PERMISSION_ASKED, 'true');
      
      // Check current permission status
      let { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        // Request permission
        const response = await Location.requestForegroundPermissionsAsync();
        status = response.status;
      }
      
      if (status !== 'granted') {
        console.log('[Location] Permission denied');
        return null;
      }
      
      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 100
      });
      
      // Reverse geocode to get city/country
      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      const locationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        country: geocode?.country || 'Unknown',
        region: geocode?.region || geocode?.subregion || '',
        city: geocode?.city || geocode?.district || geocode?.subregion || '',
        timestamp: Date.now()
      };
      
      // Store locally
      await this.storeLocation(locationData);
      this.lastLocation = locationData;
      
      // Send to analytics API
      await this.trackLocationToServer(locationData);
      
      console.log('[Location] Updated:', locationData.city, locationData.country);
      
      return locationData;
    } catch (error) {
      console.error('[Location] Error getting location:', error);
      return null;
    }
  }

  /**
   * Store location locally
   */
  async storeLocation(location) {
    try {
      await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(location));
    } catch (error) {
      console.error('[Location] Error storing location:', error);
    }
  }

  /**
   * Get stored location
   */
  async getStoredLocation() {
    try {
      const stored = await AsyncStorage.getItem(LOCATION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('[Location] Error getting stored location:', error);
      return null;
    }
  }

  /**
   * Send location to analytics server
   */
  async trackLocationToServer(location) {
    try {
      await api.post('/analytics/track-location', {
        user_id: this.userId,
        latitude: location.latitude,
        longitude: location.longitude,
        country: location.country,
        region: location.region,
        city: location.city,
        accuracy: location.accuracy,
        platform: Platform.OS
      });
      console.log('[Location] Tracked to server');
    } catch (error) {
      console.error('[Location] Error tracking to server:', error);
    }
  }

  /**
   * Get current location (cached or fresh)
   */
  async getCurrentLocation() {
    if (this.lastLocation) {
      return this.lastLocation;
    }
    return await this.getStoredLocation();
  }

  /**
   * Force refresh location
   */
  async refreshLocation() {
    return await this.requestLocation();
  }

  /**
   * Get country code for geo-filtering
   */
  async getCountryCode() {
    const location = await this.getCurrentLocation();
    if (!location) return null;
    
    // Convert country name to code
    const countryMap = {
      'Tanzania': 'TZ',
      'Kenya': 'KE',
      'Uganda': 'UG',
      'Rwanda': 'RW',
      'Burundi': 'BI',
      'Democratic Republic of the Congo': 'CD',
      'DRC': 'CD'
    };
    
    return countryMap[location.country] || null;
  }
}

export default new LocationService();
