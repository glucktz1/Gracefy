import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './AuthContext';
import { API_URL } from '../config';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const SubscriptionContext = createContext(null);

// Navigation ref for global navigation
let navigationRef = null;
export const setNavigationRef = (ref) => {
  navigationRef = ref;
};

// Default feature restrictions for free users
const DEFAULT_FREE_FEATURES = {
  play_songs: 'preview',
  preview_duration_seconds: 30,
  album_playback: 'shuffle_only',
  song_selection: false,
  skips_per_hour: 6,
  shuffle_control: false,
  show_ads: true,
  premium_content_access: false,
  downloads_allowed: false,
  create_playlists: false,
  add_to_favorites: true,
  audio_quality: 'standard',
  background_play: 'limited',
  offline_mode: false,
};

const DEFAULT_PREMIUM_FEATURES = {
  play_songs: 'full',
  preview_duration_seconds: 0,
  album_playback: 'all',
  song_selection: true,
  skips_per_hour: -1,
  shuffle_control: true,
  show_ads: false,
  premium_content_access: true,
  downloads_allowed: true,
  create_playlists: true,
  add_to_favorites: true,
  audio_quality: 'high',
  background_play: 'full',
  offline_mode: true,
};

// Feature display names for user-friendly messages
const FEATURE_NAMES = {
  download: 'Download songs for offline listening',
  create_playlist: 'Create custom playlists',
  select_song: 'Choose specific songs to play',
  shuffle_control: 'Control shuffle mode',
  premium_content: 'Access premium content',
  skip: 'Unlimited song skips',
  full_playback: 'Listen to full songs',
  background_play: 'Background playback',
  offline: 'Offline listening',
  high_quality: 'High quality audio',
};

export const SubscriptionProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [trialInfo, setTrialInfo] = useState(null);
  const [features, setFeatures] = useState(DEFAULT_FREE_FEATURES);
  const [loading, setLoading] = useState(true);
  const [skipsUsed, setSkipsUsed] = useState(0);
  const [lastSkipReset, setLastSkipReset] = useState(Date.now());
  const [subscriptionExpiry, setSubscriptionExpiry] = useState(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [billingEnabled, setBillingEnabled] = useState(true);
  const upgradeCallbackRef = useRef(null);

  // Set the callback for navigating to upgrade screen
  const setUpgradeCallback = useCallback((callback) => {
    upgradeCallbackRef.current = callback;
  }, []);

  // Fetch subscription status and features
  const fetchSubscriptionStatus = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('user_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.get(`${API_URL}/user/subscription-status`, { headers });
      const data = response.data;
      
      setIsPremium(data.is_premium || false);
      setIsTrial(data.is_trial || false);
      setTrialInfo(data.trial || null);
      setSubscriptionInfo(data.subscription || null);
      setFeatures(data.features || (data.is_premium ? DEFAULT_PREMIUM_FEATURES : DEFAULT_FREE_FEATURES));
      setSubscriptionExpiry(data.subscription?.expires_at || data.trial?.expires_at || null);
      setBillingEnabled(data.billing_enabled !== false); // Default to true if not specified
      
    } catch (error) {
      console.log('Error fetching subscription status:', error.message);
      // Default to free tier on error
      setIsPremium(false);
      setIsTrial(false);
      setTrialInfo(null);
      setFeatures(DEFAULT_FREE_FEATURES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [isAuthenticated]);

  // Reset skip counter every hour
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastSkipReset >= 3600000) { // 1 hour
        setSkipsUsed(0);
        setLastSkipReset(now);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [lastSkipReset]);

  // Check if user can perform an action
  const canPerformAction = (action) => {
    switch (action) {
      case 'download':
        return features.downloads_allowed;
      case 'create_playlist':
        return features.create_playlists;
      case 'select_song':
        return features.song_selection;
      case 'shuffle_control':
        return features.shuffle_control;
      case 'premium_content':
        return features.premium_content_access;
      case 'offline':
        return features.offline_mode;
      case 'background_play':
        return features.background_play === 'full';
      default:
        return true;
    }
  };

  // Check if user can skip
  const canSkip = () => {
    if (features.skips_per_hour === -1) return true; // Unlimited
    return skipsUsed < features.skips_per_hour;
  };

  // Use a skip
  const useSkip = () => {
    if (canSkip()) {
      setSkipsUsed(prev => prev + 1);
      return true;
    }
    return false;
  };

  // Get remaining skips
  const getRemainingSkips = () => {
    if (features.skips_per_hour === -1) return -1; // Unlimited
    return Math.max(0, features.skips_per_hour - skipsUsed);
  };

  // Show upgrade prompt with navigation to subscription screen
  const showUpgradePrompt = (feature, onUpgrade) => {
    const featureName = FEATURE_NAMES[feature] || 'This feature';

    Alert.alert(
      'Premium Feature',
      `${featureName} is only available for premium subscribers.\n\nUpgrade now to unlock this and all other premium features!`,
      [
        { text: 'Maybe Later', style: 'cancel' },
        { 
          text: 'Upgrade Now', 
          onPress: () => {
            // Use provided callback or stored callback
            if (onUpgrade) {
              onUpgrade(feature);
            } else if (upgradeCallbackRef.current) {
              upgradeCallbackRef.current(feature);
            }
          },
          style: 'default'
        },
      ]
    );
  };

  // Check if premium content access is needed
  const isPremiumContent = (content) => {
    if (!content) return false;
    return content.monetization_type === 'premium' || content.is_premium === true;
  };

  // Check playback mode for free users
  const getPlaybackMode = () => {
    return features.play_songs || 'preview';
  };

  // Get preview duration in seconds
  const getPreviewDurationSeconds = () => {
    return features.preview_duration_seconds || 30;
  };

  // Check if shuffle is forced (free users)
  const isShuffleForced = () => {
    return features.album_playback === 'shuffle_only';
  };

  // Get preview duration for free users
  const getPreviewDuration = () => {
    return features.preview_duration_seconds || 30;
  };

  // Check if ads should be shown
  const shouldShowAds = () => {
    return features.show_ads;
  };

  // Get audio quality setting
  const getAudioQuality = () => {
    return features.audio_quality || 'standard';
  };

  // Get trial days remaining
  const getTrialDaysRemaining = () => {
    if (!trialInfo || trialInfo.status !== 'active') return 0;
    return trialInfo.days_remaining || 0;
  };

  // Check if trial is expiring soon (within 2 days)
  const isTrialExpiringSoon = () => {
    if (!isTrial || !trialInfo) return false;
    return trialInfo.days_remaining <= 2;
  };

  const value = {
    isPremium,
    isTrial,
    trialInfo,
    subscriptionInfo,
    features,
    loading,
    subscriptionExpiry,
    canPerformAction,
    canSkip,
    useSkip,
    getRemainingSkips,
    showUpgradePrompt,
    getPreviewDuration,
    getPreviewDurationSeconds,
    shouldShowAds,
    getAudioQuality,
    refresh: fetchSubscriptionStatus,
    setUpgradeCallback,
    isPremiumContent,
    getPlaybackMode,
    isShuffleForced,
    getTrialDaysRemaining,
    isTrialExpiringSoon,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export default SubscriptionContext;
