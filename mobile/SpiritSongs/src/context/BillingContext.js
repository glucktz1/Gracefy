import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { billingAPI } from '../services/api';
import { useAuth } from './AuthContext';

const BillingContext = createContext(null);

export const BillingProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load billing settings and user subscription
  const loadBillingData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get billing settings
      const settingsRes = await billingAPI.getSettings().catch(() => ({ data: {} }));
      const settings = settingsRes.data || {};
      setBillingEnabled(settings.subscription_enabled || settings.billing_enabled || false);
      
      // Get plans
      const plansRes = await billingAPI.getPlans().catch(() => ({ data: { plans: [] } }));
      setPlans(plansRes.data?.plans || []);
      
      // Get user subscription if authenticated
      if (isAuthenticated && user) {
        const subRes = await billingAPI.getUserSubscription().catch(() => ({ data: null }));
        if (subRes.data) {
          setSubscription(subRes.data);
          // Check if subscription is active
          const isActive = subRes.data.status === 'active' && 
            new Date(subRes.data.expires_at) > new Date();
          setIsPremium(isActive);
        } else {
          // Check user object for subscription status
          setIsPremium(user.subscription_status === 'active' || user.is_premium === true);
        }
      }
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  // Check if a feature is available
  const canAccessFeature = (featureName) => {
    // If billing is not enabled, all features are available
    if (!billingEnabled) return true;
    
    // If user is premium, all features are available
    if (isPremium) return true;
    
    // Free features available to everyone
    const freeFeatures = ['play', 'search', 'browse', 'view_albums', 'view_churches'];
    if (freeFeatures.includes(featureName)) return true;
    
    // Premium features require subscription
    return false;
  };

  // Refresh billing data
  const refreshBilling = async () => {
    await loadBillingData();
  };

  const value = {
    billingEnabled,
    isPremium,
    plans,
    subscription,
    loading,
    canAccessFeature,
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
    return {
      billingEnabled: false,
      isPremium: false,
      plans: [],
      subscription: null,
      loading: false,
      canAccessFeature: () => true,
      refreshBilling: () => {},
    };
  }
  return context;
};

export default BillingContext;
