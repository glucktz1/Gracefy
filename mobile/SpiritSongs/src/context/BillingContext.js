import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Linking, Alert, AppState } from 'react-native';
import { billingAPI } from '../services/api';
import { useAuth } from './AuthContext';

const BillingContext = createContext(null);

// Refresh interval in milliseconds (10 seconds for responsive billing changes)
const BILLING_REFRESH_INTERVAL = 10000;

export const BillingProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  
  // ============ CRITICAL DEFAULT STATES ============
  // Default to billing DISABLED - never block users before we confirm billing is ON
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [billingMode, setBillingMode] = useState('disabled'); // full, app_redirect, disabled
  const [appBillingEnabled, setAppBillingEnabled] = useState(false);
  const [webRedirectUrl, setWebRedirectUrl] = useState('https://www.gracefy.net');
  
  // Default to premium TRUE - never block users before we confirm billing is ON
  const [isPremium, setIsPremium] = useState(true);
  
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [premiumFeatures, setPremiumFeatures] = useState({
    downloads: true,
    playlists: true,
    skip_limit: 3,
    offline_mode: true,
    high_quality: true
  });
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [billingStatusChecked, setBillingStatusChecked] = useState(false);
  
  const [skipCount, setSkipCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(null);
  const refreshIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  /**
   * MASTER BILLING CHECK
   * This is the single source of truth for billing status.
   * It fetches from the backend and updates all billing-related states.
   */
  const checkBillingStatus = useCallback(async () => {
    try {
      console.log('[BillingContext] ========== CHECKING BILLING STATUS ==========');
      
      // Step 1: Get master billing status from backend
      const billingRes = await billingAPI.getBillingStatus().catch((err) => {
        console.log('[BillingContext] Failed to get billing status, defaulting to OFF:', err.message);
        return { data: { billing_enabled: false } };
      });
      
      const masterBillingEnabled = billingRes.data?.billing_enabled === true;
      
      console.log(`[BillingContext] Master billing enabled from server: ${masterBillingEnabled}`);
      console.log(`[BillingContext] User authenticated: ${isAuthenticated}`);
      console.log(`[BillingContext] User ID: ${user?.user_id || 'none'}`);
      
      // Step 2: Update billing mode settings
      setBillingEnabled(masterBillingEnabled);
      setBillingMode(billingRes.data?.billing_mode || 'disabled');
      setAppBillingEnabled(billingRes.data?.app_billing_enabled === true);
      setWebRedirectUrl(billingRes.data?.web_redirect_url || 'https://www.gracefy.net');
      setPremiumFeatures(billingRes.data?.premium_features || {
        downloads: true,
        playlists: true,
        skip_limit: 3,
        offline_mode: true,
        high_quality: true
      });
      
      // Step 3: Determine premium status based on billing
      if (!masterBillingEnabled) {
        // ============ BILLING IS OFF ============
        // Everyone gets premium access - no restrictions
        console.log('[BillingContext] BILLING OFF - All users are premium, no restrictions');
        setIsPremium(true);
        setSubscription({ status: 'free_access', plan_name: 'Bure' });
        
        // Still fetch plans for display purposes (if admin wants to show them)
        try {
          const plansRes = await billingAPI.getPlans();
          setPlans(plansRes.data?.plans || []);
        } catch (e) {
          setPlans([]);
        }
      } else {
        // ============ BILLING IS ON ============
        console.log('[BillingContext] BILLING ON - Checking user subscription status');
        
        // Get plans
        try {
          const plansRes = await billingAPI.getPlans();
          setPlans(plansRes.data?.plans || []);
        } catch (e) {
          setPlans([]);
        }
        
        // Check user subscription if logged in
        if (user?.user_id && isAuthenticated) {
          try {
            const subRes = await billingAPI.getUserSubscription(user.user_id);
            const userIsPremium = subRes.data?.is_premium === true;
            console.log(`[BillingContext] User subscription: is_premium=${userIsPremium}`);
            setIsPremium(userIsPremium);
            setSubscription(subRes.data?.subscription || null);
          } catch (err) {
            console.log('[BillingContext] Failed to get subscription, defaulting to not premium');
            setIsPremium(false);
            setSubscription(null);
          }
        } else {
          // Not logged in and billing is ON - NOT premium
          console.log('[BillingContext] User NOT logged in, billing ON - NOT premium');
          setIsPremium(false);
          setSubscription(null);
        }
      }
      
      setBillingStatusChecked(true);
      setLastRefresh(Date.now());
      console.log(`[BillingContext] Final state: billingEnabled=${masterBillingEnabled}, isPremium=${masterBillingEnabled ? (user?.user_id ? 'checking...' : false) : true}`);
      console.log('[BillingContext] ========== BILLING CHECK COMPLETE ==========');
      
    } catch (error) {
      console.error('[BillingContext] Critical error in billing check:', error);
      // On any error, default to billing disabled to avoid blocking users
      setBillingEnabled(false);
      setIsPremium(true);
      setBillingStatusChecked(true);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id, isAuthenticated]);

  // Initial billing check on mount
  useEffect(() => {
    checkBillingStatus();
  }, [checkBillingStatus]);

  // Periodic refresh of billing status
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      console.log('[BillingContext] Periodic billing refresh');
      checkBillingStatus();
    }, BILLING_REFRESH_INTERVAL);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [checkBillingStatus]);

  // Refresh billing when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[BillingContext] App came to foreground, refreshing billing status');
        checkBillingStatus();
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [checkBillingStatus]);

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

  /**
   * Check if a feature is available
   * CRITICAL: If billing is OFF, ALL features are available
   */
  const canAccessFeature = useCallback((featureName) => {
    // If billing status not yet checked, allow access (don't block during load)
    if (!billingStatusChecked) return true;
    
    // If billing is OFF, all features are available
    if (!billingEnabled) return true;
    
    // If user is premium, all features are available
    if (isPremium) return true;
    
    // Free features available to everyone
    const freeFeatures = ['play', 'search', 'browse', 'view_albums', 'view_churches', 'radio'];
    if (freeFeatures.includes(featureName)) return true;
    
    // Premium features require subscription when billing is ON
    return false;
  }, [billingStatusChecked, billingEnabled, isPremium]);

  /**
   * Check if user can skip (with limit enforcement)
   */
  const canSkip = useCallback(() => {
    if (!billingStatusChecked || !billingEnabled || isPremium) return true;
    return skipCount < (premiumFeatures.skip_limit || 3);
  }, [billingStatusChecked, billingEnabled, isPremium, skipCount, premiumFeatures.skip_limit]);

  /**
   * Record a skip attempt
   */
  const recordSkip = useCallback(() => {
    if (!billingStatusChecked || !billingEnabled || isPremium) return true;
    
    if (skipCount >= (premiumFeatures.skip_limit || 3)) {
      return false;
    }
    setSkipCount(prev => prev + 1);
    return true;
  }, [billingStatusChecked, billingEnabled, isPremium, skipCount, premiumFeatures.skip_limit]);

  /**
   * Get remaining skips
   */
  const getRemainingSkips = useCallback(() => {
    if (!billingStatusChecked || !billingEnabled || isPremium) return Infinity;
    return Math.max(0, (premiumFeatures.skip_limit || 3) - skipCount);
  }, [billingStatusChecked, billingEnabled, isPremium, skipCount, premiumFeatures.skip_limit]);

  /**
   * Prompt user to subscribe
   * Returns 'show_plans' or 'redirect' based on billing mode
   */
  const promptSubscription = useCallback((featureName = 'premium') => {
    const featureNames = {
      download: 'Kupakua nyimbo',
      playlist: 'Kuunda playlist',
      skip: 'Kuruka nyimbo zaidi',
      offline: 'Kusikiliza bila mtandao',
      high_quality: 'Ubora wa juu',
      like: 'Kupenda nyimbo',
      background_play: 'Kusikiliza nje ya app'
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
  }, [appBillingEnabled, billingMode, webRedirectUrl]);

  /**
   * Manually refresh billing data
   */
  const refreshBilling = useCallback(async () => {
    await checkBillingStatus();
  }, [checkBillingStatus]);

  /**
   * Check if we should show payment prompts
   * CRITICAL: Only returns true if billing is ON AND user is NOT premium
   */
  const shouldPromptPayment = useCallback(() => {
    // Never prompt if billing status not checked yet
    if (!billingStatusChecked) return false;
    
    // Never prompt if billing is OFF
    if (!billingEnabled) return false;
    
    // Never prompt if user is premium
    if (isPremium) return false;
    
    // Billing is ON and user is NOT premium - should prompt
    return true;
  }, [billingStatusChecked, billingEnabled, isPremium]);

  const value = {
    // Billing state
    billingEnabled,
    billingMode,
    appBillingEnabled,
    webRedirectUrl,
    isPremium,
    plans,
    subscription,
    premiumFeatures,
    
    // Loading states
    loading,
    billingStatusChecked,
    
    // Skip tracking
    skipCount,
    lastRefresh,
    
    // Methods
    canAccessFeature,
    canSkip,
    recordSkip,
    getRemainingSkips,
    promptSubscription,
    refreshBilling,
    shouldPromptPayment,
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
    // Return safe defaults if not within provider
    // CRITICAL: Default to billing disabled and premium true
    return {
      billingEnabled: false,
      billingMode: 'disabled',
      appBillingEnabled: false,
      webRedirectUrl: 'https://www.gracefy.net',
      isPremium: true,
      plans: [],
      subscription: null,
      premiumFeatures: {},
      loading: false,
      billingStatusChecked: false,
      skipCount: 0,
      canAccessFeature: () => true,
      canSkip: () => true,
      recordSkip: () => true,
      getRemainingSkips: () => Infinity,
      promptSubscription: () => 'show_plans',
      refreshBilling: () => {},
      shouldPromptPayment: () => false,
    };
  }
  return context;
};

export default BillingContext;
