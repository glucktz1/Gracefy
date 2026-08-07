import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Linking, Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { billingAPI, API_BASE_URL } from '../services/api';
import { useAuth } from './AuthContext';

const BillingContext = createContext(null);

// Refresh interval in milliseconds (5 seconds for real-time billing changes)
const BILLING_REFRESH_INTERVAL = 5000;

// ============ MONETIZATION PERSISTENCE ============
// Skip / preview counters persist across app restarts and auto-reset at
// midnight local time. Mirrors the web app's `gracefy_monetization`
// localStorage pattern so both platforms enforce identical limits.
const MONETIZATION_STORE_KEY = 'gracefy_monetization';
const todayKey = () => new Date().toDateString();

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
  
  // Spotify-style tiered monetization config (fetched from /api/app-settings)
  // soft_skip_limit  -> show contribution prompt
  // hard_skip_limit  -> enforce preview-mode (each song plays only preview_duration_seconds)
  const [monetization, setMonetization] = useState({
    soft_skip_limit: 5,
    hard_skip_limit: 8,
    preview_duration_seconds: 35,
    prompt_message_sw: 'Maudhui haya ni bure lakini teknolojia hii ina gharama. Changia kidogo kuwezesha iwafikie watu wengi zaidi.',
    prompt_message_en: 'This content is free but the technology has costs. Contribute a little to help reach more people.',
  });
  const [previewModeActive, setPreviewModeActive] = useState(false);

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
      
      // Step 2b: Fetch monetization config (admin-configurable Spotify-style enforcement)
      try {
        const settingsRes = await axios.get(`${API_BASE_URL}/app-settings`, { timeout: 10000 });
        if (settingsRes?.data?.monetization) {
          setMonetization(prev => ({ ...prev, ...settingsRes.data.monetization }));
          console.log('[BillingContext] Monetization config loaded:', settingsRes.data.monetization);
        }
      } catch (e) {
        console.log('[BillingContext] Failed to fetch monetization config (using defaults)');
      }
      
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

  // ============ HYDRATE + PERSIST SKIP/PREVIEW COUNTERS ============
  // Load persisted counters ONCE on mount. If the stored `date` doesn't
  // match today's local-date-string, the counters reset to 0 automatically
  // (daily rollover). Runs before any UI can trigger a skip.
  const monetizationHydratedRef = useRef(false);
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(MONETIZATION_STORE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.date === todayKey()) {
            if (typeof parsed.skipCount === 'number') setSkipCount(parsed.skipCount);
            if (typeof parsed.previewModeActive === 'boolean') setPreviewModeActive(parsed.previewModeActive);
          }
        }
      } catch (e) {
        // AsyncStorage read error — start fresh (safe default)
      } finally {
        monetizationHydratedRef.current = true;
      }
    })();
  }, []);

  // Persist counters on any change (only after hydration so we don't
  // overwrite the store with the initial default 0 before load completes).
  useEffect(() => {
    if (!monetizationHydratedRef.current) return;
    AsyncStorage.setItem(MONETIZATION_STORE_KEY, JSON.stringify({
      date: todayKey(),
      skipCount,
      previewModeActive,
    })).catch(() => { /* quota / disk error — best-effort */ });
  }, [skipCount, previewModeActive]);

  // Midnight rollover watcher: while the app stays open, re-check every
  // 60s whether the local date has changed. If it has, zero the counters.
  // Fires alongside the AppState listener below so freshly-foregrounded
  // apps also see the reset.
  useEffect(() => {
    const lastDateRef = { current: todayKey() };
    const checkRollover = () => {
      const now = todayKey();
      if (now !== lastDateRef.current) {
        console.log('[BillingContext] Date rollover detected — resetting skip counters');
        lastDateRef.current = now;
        setSkipCount(0);
        setPreviewModeActive(false);
      }
    };
    const timer = setInterval(checkRollover, 60_000);
    // Also check when app returns to foreground (device may have slept overnight)
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') checkRollover();
    });
    return () => {
      clearInterval(timer);
      sub?.remove?.();
    };
  }, []);
  
  // When user becomes premium, clear enforcement (and wipe persisted counters).
  useEffect(() => {
    if (isPremium) {
      setPreviewModeActive(false);
      setSkipCount(0);
      AsyncStorage.removeItem(MONETIZATION_STORE_KEY).catch(() => {});
    }
  }, [isPremium]);

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
   * Check if user can skip (with limit enforcement).
   * Tiered: free until hard_skip_limit, then preview-mode enforces 30s caps but skips still allowed.
   */
  const canSkip = useCallback(() => {
    if (!billingStatusChecked || !billingEnabled || isPremium) return true;
    // Allow skipping until soft prompt (we only show contribution prompt at soft, never block skip itself)
    return skipCount < (monetization.hard_skip_limit || 8);
  }, [billingStatusChecked, billingEnabled, isPremium, skipCount, monetization.hard_skip_limit]);

  /**
   * Record a skip attempt. Returns:
   *   { allowed: true, promptSoft: bool, promptHard: bool }
   * The caller decides whether to show the contribution modal based on the flags.
   */
  const recordSkip = useCallback(() => {
    if (!billingStatusChecked || !billingEnabled || isPremium) {
      return { allowed: true, promptSoft: false, promptHard: false };
    }
    
    const next = skipCount + 1;
    setSkipCount(next);
    const soft = monetization.soft_skip_limit || 5;
    const hard = monetization.hard_skip_limit || 8;
    
    let promptSoft = false;
    let promptHard = false;
    
    if (next === soft) {
      promptSoft = true;
    }
    if (next >= hard) {
      promptHard = true;
      setPreviewModeActive(true);
    }
    
    return { allowed: true, promptSoft, promptHard };
  }, [billingStatusChecked, billingEnabled, isPremium, skipCount, monetization.soft_skip_limit, monetization.hard_skip_limit]);

  /**
   * Get remaining skips before hard preview-mode kicks in
   */
  const getRemainingSkips = useCallback(() => {
    if (!billingStatusChecked || !billingEnabled || isPremium) return Infinity;
    return Math.max(0, (monetization.hard_skip_limit || 8) - skipCount);
  }, [billingStatusChecked, billingEnabled, isPremium, skipCount, monetization.hard_skip_limit]);

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
    
    // Spotify-style tiered monetization
    monetization,
    previewModeActive,
    setPreviewModeActive,
    
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
