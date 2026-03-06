import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Linking, Alert, AppState } from 'react-native';
import { billingAPI } from '../services/api';
import { useAuth } from './AuthContext';

const BillingContext = createContext(null);

// Refresh interval in milliseconds (15 seconds for faster response to billing changes)
const BILLING_REFRESH_INTERVAL = 15000;

export const BillingProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  // CRITICAL: Default billingEnabled to false and isPremium to true
  // This ensures users aren't blocked while billing data loads
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [billingMode, setBillingMode] = useState('full'); // full, app_redirect, disabled
  const [appBillingEnabled, setAppBillingEnabled] = useState(true);
  const [webRedirectUrl, setWebRedirectUrl] = useState('https://www.gracefy.net');
  const [isPremium, setIsPremium] = useState(true); // Default to true to avoid blocking users on load
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [premiumFeatures, setPremiumFeatures] = useState({
    downloads: true,
    playlists: true,
    skip_limit: 3,
    offline_mode: true,
    high_quality: true
  });
  const [loading, setLoading] = useState(true);
  const [billingDataLoaded, setBillingDataLoaded] = useState(false);
  const [skipCount, setSkipCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  const refreshIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Load billing settings and user subscription
  const loadBillingData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get billing status first - this is the master setting
      const billingRes = await billingAPI.getBillingStatus().catch(() => ({ data: { billing_enabled: false } }));
      const masterBillingEnabled = billingRes.data?.billing_enabled ?? false;
      
      console.log(`[BillingContext] Master billing enabled: ${masterBillingEnabled}`);
      
      // Set billing states from master settings
      setBillingEnabled(masterBillingEnabled);
      setBillingMode(billingRes.data?.billing_mode || 'full');
      setAppBillingEnabled(billingRes.data?.app_billing_enabled ?? true);
      setWebRedirectUrl(billingRes.data?.web_redirect_url || 'https://www.gracefy.net');
      setPremiumFeatures(billingRes.data?.premium_features || {
        downloads: true,
        playlists: true,
        skip_limit: 3,
        offline_mode: true,
        high_quality: true
      });
      
      // If billing is disabled, everyone is premium - no need to check user subscription
      if (!masterBillingEnabled) {
        console.log('[BillingContext] Billing OFF - setting isPremium=true for all users');
        setIsPremium(true);
        setSubscription({ status: 'free_access', plan_name: 'Bure' });
        // Still get plans for display purposes
        const plansRes = await billingAPI.getPlans().catch(() => ({ data: { plans: [] } }));
        setPlans(plansRes.data?.plans || []);
        setLoading(false);
        return;
      }
      
      // Billing is ON - check user subscription
      console.log('[BillingContext] Billing ON - checking user subscription');
      
      // Get plans
      const plansRes = await billingAPI.getPlans().catch(() => ({ data: { plans: [] } }));
      setPlans(plansRes.data?.plans || []);
      
      // Only check user subscription if billing is enabled
      if (user?.user_id) {
        const subRes = await billingAPI.getUserSubscription(user.user_id).catch(() => ({ 
          data: { is_premium: false } 
        }));
        if (subRes.data) {
          console.log(`[BillingContext] User subscription: is_premium=${subRes.data.is_premium}`);
          setIsPremium(subRes.data.is_premium || false);
          setSubscription(subRes.data.subscription || null);
        }
      } else {
        // Not logged in and billing is enabled - not premium
        console.log('[BillingContext] User not logged in, billing ON - setting isPremium=false');
        setIsPremium(false);
        setSubscription(null);
      }
      setLastRefresh(Date.now());
      setBillingDataLoaded(true);
    } catch (error) {
      console.error('Error loading billing data:', error);
      // On error, default to billing disabled (safer for users)
      setBillingEnabled(false);
      setIsPremium(true);
      setBillingDataLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  // Initial load
  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  // Set up periodic refresh of billing status (every 60 seconds)
  useEffect(() => {
    // Start interval for periodic refresh
    refreshIntervalRef.current = setInterval(() => {
      console.log('[BillingContext] Periodic billing refresh');
      loadBillingData();
    }, BILLING_REFRESH_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [loadBillingData]);

  // Refresh billing when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[BillingContext] App came to foreground, refreshing billing status');
        loadBillingData();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [loadBillingData]);

  // Reset skip count daily
  useEffect(() => {
    const resetSkipCount = () => {
      const today = new Date().toDateString();
      const lastReset = global.lastSkipReset || '';
      if (lastReset !== today) {
        setSkipCount(0);
        global.lastSkipReset = today;
      }
    };
    resetSkipCount();
  }, []);

  // Check if a feature is available
  const canAccessFeature = (featureName) => {
    // If billing is not enabled, all features are available
    if (!billingEnabled) return true;
    
    // If user is premium, all features are available
    if (isPremium) return true;
    
    // Free features available to everyone
    const freeFeatures = ['play', 'search', 'browse', 'view_albums', 'view_churches', 'radio'];
    if (freeFeatures.includes(featureName)) return true;
    
    // Premium features require subscription
    return false;
  };

  // Check if user can skip (with limit enforcement)
  const canSkip = () => {
    if (!billingEnabled || isPremium) return true;
    return skipCount < (premiumFeatures.skip_limit || 3);
  };

  // Record a skip attempt
  const recordSkip = () => {
    if (!billingEnabled || isPremium) return true;
    
    if (skipCount >= (premiumFeatures.skip_limit || 3)) {
      return false;
    }
    setSkipCount(prev => prev + 1);
    return true;
  };

  // Get remaining skips
  const getRemainingSkips = () => {
    if (!billingEnabled || isPremium) return Infinity;
    return Math.max(0, (premiumFeatures.skip_limit || 3) - skipCount);
  };

  // Prompt user to subscribe
  const promptSubscription = (featureName = 'premium') => {
    const featureNames = {
      download: 'Kupakua nyimbo',
      playlist: 'Kuunda playlist',
      skip: 'Kuruka nyimbo zaidi',
      offline: 'Kusikiliza bila mtandao',
      high_quality: 'Ubora wa juu'
    };
    
    const displayName = featureNames[featureName] || 'Huduma za Premium';
    
    // If app billing is disabled, redirect to web
    if (!appBillingEnabled || billingMode === 'app_redirect') {
      Alert.alert(
        'Jiandikishe Premium',
        `${displayName} inahitaji usajili wa Premium.\n\nTafadhali tembelea tovuti yetu ili kujiandikisha.`,
        [
          { text: 'Baadaye', style: 'cancel' },
          { 
            text: 'Fungua Tovuti', 
            onPress: () => Linking.openURL(webRedirectUrl)
          }
        ]
      );
      return 'redirect';
    }
    
    return 'show_plans';
  };

  // Refresh billing data
  const refreshBilling = async () => {
    await loadBillingData();
  };

  const value = {
    billingEnabled,
    billingMode,
    appBillingEnabled,
    webRedirectUrl,
    isPremium,
    plans,
    subscription,
    premiumFeatures,
    loading,
    skipCount,
    lastRefresh,
    canAccessFeature,
    canSkip,
    recordSkip,
    getRemainingSkips,
    promptSubscription,
    refreshBilling,
  };

  return (
    <BillingContext.Provider value={value}>
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (!context) {
    // Return default values if not within provider
    // CRITICAL: Default to billing disabled and premium true to avoid blocking users
    return {
      billingEnabled: false,
      billingMode: 'disabled',
      appBillingEnabled: false,
      webRedirectUrl: 'https://www.gracefy.net',
      isPremium: true, // Default to premium when no context - don't block users
      plans: [],
      subscription: null,
      premiumFeatures: {},
      loading: false,
      billingDataLoaded: false,
      skipCount: 0,
      canAccessFeature: () => true,
      canSkip: () => true,
      recordSkip: () => true,
      getRemainingSkips: () => Infinity,
      promptSubscription: () => 'show_plans',
      refreshBilling: () => {},
    };
  }
  return context;
};

export default BillingContext;
