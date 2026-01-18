import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, 
  Dimensions, ActivityIndicator, Alert, Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, API_URL } from '../config';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');

// Feature comparison data
const FEATURE_COMPARISON = [
  { feature: 'Play songs', free: 'Preview / limited play', paid: 'Full songs', icon: 'play-circle' },
  { feature: 'Album playback', free: 'Random play only', paid: 'Play in order or shuffle', icon: 'albums' },
  { feature: 'Song selection', free: 'Cannot choose specific', paid: 'Choose any song', icon: 'musical-note' },
  { feature: 'Skips', free: 'Limited skips', paid: 'Unlimited skips', icon: 'play-skip-forward' },
  { feature: 'Shuffle control', free: 'Always on', paid: 'On / Off', icon: 'shuffle' },
  { feature: 'Ads', free: 'Ads shown', paid: 'No ads', icon: 'megaphone' },
  { feature: 'Premium content', free: 'Locked', paid: 'Full access', icon: 'lock-open' },
  { feature: 'Downloads', free: 'Not allowed', paid: 'Offline downloads', icon: 'download' },
  { feature: 'Add to list', free: 'Like / save only', paid: 'Save + playlists', icon: 'heart' },
  { feature: 'Own playlists', free: 'Not allowed', paid: 'Create & manage', icon: 'list' },
  { feature: 'Audio quality', free: 'Standard', paid: 'High quality', icon: 'volume-high' },
  { feature: 'Background play', free: 'Limited', paid: 'Full background play', icon: 'headset' },
];

const FeatureRow = ({ feature, free, paid, icon, isPremium }) => (
  <View style={styles.featureRow}>
    <View style={styles.featureNameCol}>
      <Ionicons name={icon} size={18} color={COLORS.textSecondary} />
      <Text style={styles.featureName}>{feature}</Text>
    </View>
    <View style={[styles.featureValueCol, !isPremium && styles.featureValueActive]}>
      <Text style={[styles.featureValue, !isPremium && styles.featureValueActiveText]}>
        {free}
      </Text>
    </View>
    <View style={[styles.featureValueCol, isPremium && styles.featureValueActive]}>
      <Text style={[styles.featureValue, isPremium && styles.featureValueActiveText]}>
        {paid}
      </Text>
    </View>
  </View>
);

export default function SubscriptionScreen({ navigation, route }) {
  const { isPremium, isTrial, trialInfo, features, refresh, getTrialDaysRemaining } = useSubscription();
  const { isAuthenticated, user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  
  const lockedFeature = route.params?.lockedFeature;

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API_URL}/monetization/plans`);
      const activePlans = (response.data.plans || []).filter(p => p.is_active);
      setPlans(activePlans);
    } catch (error) {
      console.log('Error fetching plans:', error);
      // Use default plans
      setPlans([
        {
          plan_id: 'monthly',
          name: 'monthly',
          display_name: 'Monthly',
          price: 5000,
          duration_days: 30,
          features: ['Unlimited streaming', 'No ads', 'High quality', 'Offline downloads'],
          is_active: true,
        },
        {
          plan_id: 'yearly',
          name: 'yearly',
          display_name: 'Yearly',
          price: 50000,
          duration_days: 365,
          features: ['Unlimited streaming', 'No ads', 'High quality', 'Offline downloads', '2 months free'],
          is_active: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan) => {
    if (!isAuthenticated) {
      Alert.alert(
        'Login Required',
        'Please login to subscribe to a plan.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Login', onPress: () => navigation.navigate('Login') }
        ]
      );
      return;
    }

    setProcessing(true);
    setSelectedPlan(plan.plan_id);

    try {
      const token = await SecureStore.getItemAsync('user_token');
      
      // Call subscribe endpoint (this would integrate with real payment in production)
      const response = await axios.post(
        `${API_URL}/user/subscribe`,
        { plan_id: plan.plan_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.payment_url) {
        // Open payment URL
        await Linking.openURL(response.data.payment_url);
      } else if (response.data.success) {
        Alert.alert(
          'Success!',
          'Your subscription is now active. Enjoy premium features!',
          [{ text: 'OK', onPress: () => {
            refresh();
            navigation.goBack();
          }}]
        );
      } else {
        // Mock successful subscription for demo
        Alert.alert(
          'Payment Required',
          `To complete subscription to ${plan.display_name}, please make a payment of TZS ${plan.price.toLocaleString()}.\n\nPayment integration coming soon!`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.log('Subscribe error:', error);
      Alert.alert(
        'Payment Required',
        `To subscribe to ${plan.display_name}, please make a payment of TZS ${plan.price.toLocaleString()}.\n\nPayment integration coming soon!`,
        [{ text: 'OK' }]
      );
    } finally {
      setProcessing(false);
      setSelectedPlan(null);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a1a2e', '#0a0a1a']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <LinearGradient
            colors={['#3498DB', '#1A295E']}
            style={styles.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="musical-notes" size={48} color="#fff" />
            <Text style={styles.heroTitle}>Go Premium</Text>
            <Text style={styles.heroSubtitle}>
              {lockedFeature 
                ? `Unlock "${lockedFeature}" and all premium features`
                : 'Unlock all features and enjoy unlimited music'}
            </Text>
          </LinearGradient>

          {/* Current Status */}
          <View style={[styles.statusCard, isTrial && styles.trialStatusCard]}>
            <View style={[styles.statusIcon, isTrial && styles.trialStatusIcon]}>
              <Ionicons 
                name={isTrial ? 'time-outline' : (isPremium ? 'checkmark-circle' : 'alert-circle')} 
                size={24} 
                color={isTrial ? '#FF9800' : (isPremium ? '#4CAF50' : '#FF9800')} 
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {isTrial 
                  ? `Free Trial - ${getTrialDaysRemaining()} day${getTrialDaysRemaining() !== 1 ? 's' : ''} left`
                  : (isPremium ? 'Premium Active' : 'Free Account')
                }
              </Text>
              <Text style={styles.statusDesc}>
                {isTrial 
                  ? 'Enjoying all premium features. Subscribe before trial ends!'
                  : (isPremium 
                      ? 'You have full access to all features' 
                      : 'Upgrade to unlock all premium features')
                }
              </Text>
            </View>
          </View>

          {/* Trial Countdown Banner */}
          {isTrial && (
            <View style={styles.trialBanner}>
              <View style={styles.trialBannerLeft}>
                <Text style={styles.trialBannerDays}>{getTrialDaysRemaining()}</Text>
                <Text style={styles.trialBannerLabel}>days left</Text>
              </View>
              <View style={styles.trialBannerRight}>
                <Text style={styles.trialBannerTitle}>Don't lose your premium access!</Text>
                <Text style={styles.trialBannerDesc}>Subscribe now to continue enjoying all features</Text>
              </View>
            </View>
          )}

          {/* Subscription Plans */}
          {(!isPremium || isTrial) && (
            <View style={styles.plansSection}>
              <Text style={styles.sectionTitle}>Choose a Plan</Text>
              
              {loading ? (
                <ActivityIndicator size="large" color="#3498DB" />
              ) : (
                <View style={styles.plansContainer}>
                  {plans.map((plan) => (
                    <TouchableOpacity
                      key={plan.plan_id}
                      style={[
                        styles.planCard,
                        plan.name === 'yearly' && styles.planCardPopular
                      ]}
                      onPress={() => handleSubscribe(plan)}
                      disabled={processing}
                    >
                      {plan.name === 'yearly' && (
                        <View style={styles.popularBadge}>
                          <Text style={styles.popularBadgeText}>BEST VALUE</Text>
                        </View>
                      )}
                      <Text style={styles.planName}>{plan.display_name}</Text>
                      <View style={styles.planPriceRow}>
                        <Text style={styles.planPrice}>TZS {plan.price.toLocaleString()}</Text>
                        <Text style={styles.planDuration}>/ {plan.duration_days} days</Text>
                      </View>
                      <View style={styles.planFeatures}>
                        {plan.features?.slice(0, 4).map((feature, idx) => (
                          <View key={idx} style={styles.planFeatureRow}>
                            <Ionicons name="checkmark" size={16} color="#4CAF50" />
                            <Text style={styles.planFeatureText}>{feature}</Text>
                          </View>
                        ))}
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.subscribeBtn,
                          processing && selectedPlan === plan.plan_id && styles.subscribeBtnDisabled
                        ]}
                        onPress={() => handleSubscribe(plan)}
                        disabled={processing}
                      >
                        {processing && selectedPlan === plan.plan_id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.subscribeBtnText}>Subscribe</Text>
                        )}
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Feature Comparison Table */}
          <View style={styles.comparisonSection}>
            <Text style={styles.sectionTitle}>Feature Comparison</Text>
            
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={styles.featureNameCol}>
                <Text style={styles.tableHeaderText}>Feature</Text>
              </View>
              <View style={styles.featureValueCol}>
                <Text style={styles.tableHeaderText}>Free</Text>
              </View>
              <View style={styles.featureValueCol}>
                <Text style={styles.tableHeaderText}>Premium</Text>
              </View>
            </View>

            {/* Table Rows */}
            {FEATURE_COMPARISON.map((item, idx) => (
              <FeatureRow 
                key={idx} 
                {...item} 
                isPremium={isPremium}
              />
            ))}
          </View>

          {/* FAQ Section */}
          <View style={styles.faqSection}>
            <Text style={styles.sectionTitle}>FAQ</Text>
            
            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>How do I cancel my subscription?</Text>
              <Text style={styles.faqAnswer}>
                You can cancel anytime from your Profile settings. Your premium access will continue until the end of your billing period.
              </Text>
            </View>
            
            <View style={styles.faqItem}>
              <Text style={styles.faqQuestion}>What payment methods are accepted?</Text>
              <Text style={styles.faqAnswer}>
                We accept M-Pesa, Airtel Money, credit/debit cards, and more payment options.
              </Text>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  hero: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 8,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  trialStatusCard: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trialStatusIcon: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 16,
  },
  trialBannerLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trialBannerDays: {
    color: '#FF9800',
    fontSize: 28,
    fontWeight: '800',
  },
  trialBannerLabel: {
    color: '#FF9800',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  trialBannerRight: {
    flex: 1,
  },
  trialBannerTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  trialBannerDesc: {
    color: 'rgba(255, 152, 0, 0.8)',
    fontSize: 12,
  },
  plansSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  plansContainer: {
    gap: 12,
  },
  planCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  planCardPopular: {
    borderColor: '#3498DB',
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#3498DB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  planName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  planPrice: {
    color: '#3498DB',
    fontSize: 24,
    fontWeight: '800',
  },
  planDuration: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginLeft: 4,
  },
  planFeatures: {
    marginBottom: 16,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  planFeatureText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginLeft: 8,
  },
  subscribeBtn: {
    backgroundColor: '#3498DB',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
  },
  subscribeBtnDisabled: {
    opacity: 0.7,
  },
  subscribeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  comparisonSection: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 4,
  },
  tableHeaderText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  featureRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  featureNameCol: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureName: {
    color: COLORS.textPrimary,
    fontSize: 12,
    flex: 1,
  },
  featureValueCol: {
    flex: 1,
    paddingHorizontal: 4,
  },
  featureValueActive: {
    backgroundColor: 'rgba(233, 30, 99, 0.15)',
    borderRadius: 4,
    marginHorizontal: -4,
    paddingHorizontal: 8,
  },
  featureValue: {
    color: COLORS.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  featureValueActiveText: {
    color: '#3498DB',
    fontWeight: '600',
  },
  faqSection: {
    marginTop: 8,
  },
  faqItem: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  faqQuestion: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  faqAnswer: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 20,
  },
});
