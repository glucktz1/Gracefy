import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { billingAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/Toast';

const PLAN_COLORS = {
  daily: ['#f97316', '#ea580c'],
  weekly: ['#8b5cf6', '#7c3aed'],
  monthly: ['#06b6d4', '#0891b2'],
  yearly: ['#10b981', '#059669'],
};

const PLAN_ICONS = {
  daily: 'flash',
  weekly: 'calendar',
  monthly: 'star',
  yearly: 'diamond',
};

const SubscriptionPlansScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [billingEnabled, setBillingEnabled] = useState(true);
  
  const featurePrompt = route.params?.featurePrompt || 'Fungua vipengele vyote vya Gracefy';

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await billingAPI.getPlans();
      
      // Check if billing is enabled
      if (response.data?.billing_enabled === false) {
        setBillingEnabled(false);
        setPlans([]);
        return;
      }
      
      if (response.data?.plans) {
        setPlans(response.data.plans.filter(p => p.is_active));
        setBillingEnabled(true);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      showToast('Imeshindikana kupakia mipango', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('sw-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) {
      showToast('Tafadhali chagua mpango', 'warning');
      return;
    }

    if (!user) {
      showToast('Tafadhali ingia kwanza', 'warning');
      navigation.navigate('Login');
      return;
    }

    // Navigate to Checkout screen with selected plan
    navigation.navigate('Checkout', { plan: selectedPlan });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Changia Kidogo</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Billing Disabled Message */}
        {!billingEnabled && (
          <View style={styles.billingDisabledContainer}>
            <Ionicons name="gift-outline" size={80} color={COLORS.primary} />
            <Text style={styles.billingDisabledTitle}>Gracefy Premium Bure!</Text>
            <Text style={styles.billingDisabledText}>
              Kwa sasa vipengele vyote vya premium vinapatikana bure. Furahia muziki wako!
            </Text>
            <TouchableOpacity 
              style={styles.goBackButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.goBackButtonText}>Rudi Nyumbani</Text>
            </TouchableOpacity>
          </View>
        )}

        {billingEnabled && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.lockIconContainer}>
              <Ionicons name="lock-open" size={40} color={COLORS.warning} />
            </View>
            <Text style={styles.heroTitle}>Fungua Gracefy Premium</Text>
            <Text style={styles.heroSubtitle}>{featurePrompt}</Text>
          </View>

          {/* Features List */}
          <View style={styles.featuresSection}>
            <Text style={styles.featuresTitle}>Utapata:</Text>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              <Text style={styles.featureText}>Pakua nyimbo bila kikomo</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              <Text style={styles.featureText}>Tengeneza playlist zako</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              <Text style={styles.featureText}>Sikiliza bila matangazo</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              <Text style={styles.featureText}>Sikiliza hata simu ikiwa locked</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
              <Text style={styles.featureText}>Ubora wa juu wa sauti</Text>
            </View>
          </View>

          {/* Plans */}
          <View style={styles.plansSection}>
            <Text style={styles.plansTitle}>Chagua Mpango</Text>
            
            {plans.map((plan) => {
              const isSelected = selectedPlan?.plan_id === plan.plan_id;
              const planKey = plan.name?.toLowerCase() || 'monthly';
              const colors = PLAN_COLORS[planKey] || PLAN_COLORS.monthly;
              const icon = PLAN_ICONS[planKey] || 'star';
              
              return (
                <TouchableOpacity
                  key={plan.plan_id}
                  style={[styles.planCard, isSelected && styles.planCardSelected]}
                  onPress={() => handleSelectPlan(plan)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isSelected ? colors : ['#27272a', '#18181b']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.planGradient}
                  >
                    <View style={styles.planHeader}>
                      <View style={[styles.planIconContainer, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors[0] + '30' }]}>
                        <Ionicons name={icon} size={24} color={isSelected ? '#fff' : colors[0]} />
                      </View>
                      <View style={styles.planInfo}>
                        <Text style={[styles.planName, isSelected && styles.planNameSelected]}>
                          {plan.display_name || plan.name}
                        </Text>
                        <Text style={[styles.planDuration, isSelected && styles.planDurationSelected]}>
                          {plan.duration_days === 1 ? 'Siku 1' : 
                           plan.duration_days === 7 ? 'Wiki 1' :
                           plan.duration_days === 30 ? 'Mwezi 1' :
                           plan.duration_days === 365 ? 'Mwaka 1' :
                           `Siku ${plan.duration_days}`}
                        </Text>
                      </View>
                      <View style={styles.planPriceContainer}>
                        <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                          {formatPrice(plan.price)}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Plan features */}
                    {plan.features && plan.features.length > 0 && (
                      <View style={styles.planFeatures}>
                        {plan.features.slice(0, 2).map((feature, idx) => (
                          <View key={idx} style={styles.planFeatureItem}>
                            <Ionicons 
                              name="checkmark" 
                              size={14} 
                              color={isSelected ? '#fff' : COLORS.textSecondary} 
                            />
                            <Text style={[styles.planFeatureText, isSelected && styles.planFeatureTextSelected]}>
                              {feature}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Selection indicator */}
                    <View style={[styles.selectionIndicator, isSelected && styles.selectionIndicatorSelected]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Payment Info */}
          <View style={styles.paymentInfo}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.textSecondary} />
            <Text style={styles.paymentInfoText}>
              Malipo salama kupitia Azam Pay
            </Text>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Subscribe Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.subscribeButton, !selectedPlan && styles.subscribeButtonDisabled]}
            onPress={handleSubscribe}
            disabled={!selectedPlan || processing}
          >
            {processing ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <>
                <Ionicons name="card" size={20} color={COLORS.background} style={{ marginRight: 8 }} />
                <Text style={styles.subscribeButtonText}>
                  {selectedPlan ? `Lipia ${formatPrice(selectedPlan.price)}` : 'Chagua Mpango'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        </>
        )}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  billingDisabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  billingDisabledTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  billingDisabledText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.xl,
  },
  goBackButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 25,
  },
  goBackButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresSection: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  featuresTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  featureText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  plansSection: {
    marginBottom: SPACING.lg,
  },
  plansTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  planCard: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: {
    borderColor: COLORS.primary,
  },
  planGradient: {
    padding: SPACING.lg,
    position: 'relative',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  planName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  planNameSelected: {
    color: '#fff',
  },
  planDuration: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  planDurationSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  planPriceContainer: {
    alignItems: 'flex-end',
  },
  planPrice: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  planPriceSelected: {
    color: '#fff',
  },
  planFeatures: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  planFeatureText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
  planFeatureTextSelected: {
    color: 'rgba(255,255,255,0.9)',
  },
  selectionIndicator: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicatorSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  paymentInfoText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  subscribeButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  subscribeButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
  },
});

export default SubscriptionPlansScreen;
