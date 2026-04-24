import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { billingAPI } from '../services/api';
import { useBilling } from '../context/BillingContext';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';

const SubscriptionScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  
  const { 
    billingEnabled, 
    billingMode, 
    appBillingEnabled, 
    webRedirectUrl,
    isPremium, 
    subscription, 
    refreshBilling 
  } = useBilling();
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await billingAPI.getPlans();
      setPlans(response.data?.plans || []);
    } catch (error) {
      console.error('Error loading plans:', error);
      showToast('Imeshindwa kupakia mipango', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    refreshBilling();
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
  };

  const handleSelectPlan = (plan) => {
    console.log('[SubscriptionScreen] Plan selected:', plan.display_name || plan.name);
    console.log('[SubscriptionScreen] appBillingEnabled:', appBillingEnabled);
    console.log('[SubscriptionScreen] billingMode:', billingMode);
    console.log('[SubscriptionScreen] user:', user?.user_id || 'not logged in');
    
    // Check if user is logged in first
    if (!user?.user_id) {
      Alert.alert(
        'Ingia Kwanza',
        'Tafadhali ingia kwenye akaunti yako ili kuendelea na malipo.',
        [
          { text: 'Baadaye', style: 'cancel' },
          { text: 'Ingia', onPress: () => navigation.navigate('Login') }
        ]
      );
      return;
    }
    
    if (!appBillingEnabled || billingMode === 'app_redirect') {
      // Redirect to web
      Alert.alert(
        'Jiandikishe kwenye Tovuti',
        'Tafadhali tembelea tovuti yetu ili kukamilisha usajili wako.',
        [
          { text: 'Baadaye', style: 'cancel' },
          { text: 'Fungua Tovuti', onPress: () => Linking.openURL(webRedirectUrl) }
        ]
      );
      return;
    }
    
    setSelectedPlan(plan);
    setShowPayment(true);
    console.log('[SubscriptionScreen] showPayment set to true');
  };

  const handlePayment = async () => {
    if (!phoneNumber || phoneNumber.length < 9) {
      showToast('Tafadhali weka nambari sahihi ya simu', 'error');
      return;
    }

    setProcessing(true);
    try {
      const response = await billingAPI.initiateAzamPay(
        user?.user_id,
        selectedPlan.plan_id,
        phoneNumber
      );

      if (response.data?.success) {
        showToast(response.data.message || 'Thibitisha malipo kwenye simu yako', 'success');
        setShowPayment(false);
        
        // Poll for payment status
        pollPaymentStatus(response.data.transaction_id);
      } else {
        showToast('Imeshindwa kuanza malipo', 'error');
      }
    } catch (error) {
      console.error('Payment error:', error);
      showToast('Hitilafu ya malipo. Jaribu tena.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const pollPaymentStatus = async (transactionId) => {
    let attempts = 0;
    const maxAttempts = 30;
    
    const checkStatus = async () => {
      try {
        const response = await billingAPI.getPaymentStatus(transactionId);
        const status = response.data?.status;
        
        if (status === 'completed') {
          showToast('Malipo yamekamilika! Umejisajili Premium.', 'success');
          refreshBilling();
          return;
        } else if (status === 'failed') {
          showToast('Malipo yameshindwa. Jaribu tena.', 'error');
          return;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000);
        }
      } catch (error) {
        console.error('Status check error:', error);
      }
    };
    
    checkStatus();
  };

  const formatPrice = (price, currency = 'TZS') => {
    return `${currency} ${price?.toLocaleString() || 0}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('sw-TZ', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Inapakia...</Text>
      </View>
    );
  }

  // If billing is disabled, show free access message
  if (!billingEnabled) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vifurushi</Text>
        </View>
        
        <View style={styles.freeAccessContainer}>
          <LinearGradient colors={['#00A8E8', '#0077B6']} style={styles.freeAccessBadge}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.text} />
          </LinearGradient>
          <Text style={styles.freeAccessTitle}>Huduma ni Bure!</Text>
          <Text style={styles.freeAccessText}>
            Furahia muziki wote, pakua, na uunde playlist bila malipo yoyote.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vifurushi Vyangu</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Current Subscription */}
        {isPremium && subscription ? (
          <View style={styles.currentSubscription}>
            <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.premiumBadge}>
              <Ionicons name="star" size={24} color={COLORS.text} />
              <Text style={styles.premiumLabel}>PREMIUM</Text>
            </LinearGradient>
            <Text style={styles.subscriptionTitle}>Usajili Wako</Text>
            <View style={styles.subscriptionDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Mpango:</Text>
                <Text style={styles.detailValue}>{subscription.plan_name || 'Premium'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Umeanza:</Text>
                <Text style={styles.detailValue}>{formatDate(subscription.started_at)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Utaisha:</Text>
                <Text style={[styles.detailValue, { color: '#F59E0B' }]}>
                  {formatDate(subscription.expires_at)}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noSubscription}>
            <View style={styles.noSubIcon}>
              <Ionicons name="gift-outline" size={48} color={COLORS.textMuted} />
            </View>
            <Text style={styles.noSubTitle}>Bado Hujachangia</Text>
            <Text style={styles.noSubText}>
              Maudhui haya ni bure lakini teknolojia hii inagharama. Changia kidogo kuwezesha iwafikie watu wengi zaidi.
            </Text>
          </View>
        )}

        {/* Premium Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Huduma Utakazopata</Text>
          <View style={styles.featuresGrid}>
            {[
              { icon: 'download-outline', text: 'Pakua nyimbo' },
              { icon: 'cloud-offline-outline', text: 'Sikiliza offline' },
              { icon: 'list-outline', text: 'Unda playlist' },
              { icon: 'play-skip-forward-outline', text: 'Ruka bila kikomo' },
              { icon: 'musical-notes-outline', text: 'Ubora wa juu' },
              { icon: 'star-outline', text: 'Bila matangazo' },
              { icon: 'lock-open-outline', text: 'Endelea kusikiliza simu ikilock' },
            ].map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons name={feature.icon} size={24} color="#8B5CF6" />
                <Text style={styles.featureText}>{feature.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Available Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chagua unavyotaka kuchangia</Text>
          {plans.length === 0 ? (
            <View style={styles.noPlans}>
              <Text style={styles.noPlansText}>Hakuna mipango inapopatikana kwa sasa</Text>
            </View>
          ) : (
            plans.map((plan) => (
              <TouchableOpacity
                key={plan.plan_id}
                style={[
                  styles.planCard,
                  plan.is_featured && styles.planCardFeatured,
                  selectedPlan?.plan_id === plan.plan_id && styles.planCardSelected
                ]}
                onPress={() => handleSelectPlan(plan)}
              >
                {plan.is_featured && (
                  <View style={styles.featuredTag}>
                    <Text style={styles.featuredTagText}>MAARUFU</Text>
                  </View>
                )}
                <View style={styles.planHeader}>
                  <Text style={styles.planName}>{plan.display_name || plan.name}</Text>
                  <Text style={styles.planPrice}>{formatPrice(plan.price, plan.currency)}</Text>
                </View>
                <Text style={styles.planDuration}>
                  {plan.duration_days === 1 ? 'Siku 1' : 
                   plan.duration_days === 7 ? 'Wiki 1' :
                   plan.duration_days === 30 ? 'Mwezi 1' :
                   plan.duration_days === 365 ? 'Mwaka 1' :
                   `Siku ${plan.duration_days}`}
                </Text>
                {plan.features?.length > 0 && (
                  <View style={styles.planFeatures}>
                    {plan.features.slice(0, 3).map((feature, idx) => (
                      <View key={idx} style={styles.planFeatureRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#00A8E8" />
                        <Text style={styles.planFeatureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Web redirect notice */}
        {(!appBillingEnabled || billingMode === 'app_redirect') && (
          <View style={styles.webNotice}>
            <Ionicons name="globe-outline" size={24} color="#F59E0B" />
            <Text style={styles.webNoticeText}>
              Malipo yanafanywa kupitia tovuti yetu. Bonyeza mpango wowote ili kuendelea.
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Payment Modal */}
      {showPayment && selectedPlan && appBillingEnabled && billingMode !== 'app_redirect' && (
        <View style={styles.paymentOverlay}>
          <View style={styles.paymentModal}>
            <View style={styles.paymentHeader}>
              <Text style={styles.paymentTitle}>Kamilisha Malipo</Text>
              <TouchableOpacity onPress={() => setShowPayment(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.paymentPlanInfo}>
              <Text style={styles.paymentPlanName}>{selectedPlan.display_name}</Text>
              <Text style={styles.paymentPlanPrice}>
                {formatPrice(selectedPlan.price, selectedPlan.currency)}
              </Text>
            </View>

            <View style={styles.paymentInput}>
              <Text style={styles.inputLabel}>Nambari ya Simu (M-Pesa/Tigo Pesa)</Text>
              <View style={styles.phoneInputContainer}>
                <Text style={styles.phonePrefix}>+255</Text>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="7XXXXXXXX"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  maxLength={9}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.payButton, processing && styles.payButtonDisabled]}
              onPress={handlePayment}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <>
                  <Ionicons name="card-outline" size={20} color={COLORS.text} />
                  <Text style={styles.payButtonText}>Changia Sasa</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.paymentNote}>
              Utapokea ujumbe wa USSD kwenye simu yako ili kuthibitisha malipo.
            </Text>
          </View>
        </View>
      )}

      {/* Toast */}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.md,
  },
  freeAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  freeAccessBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  freeAccessTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  freeAccessText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  currentSubscription: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.md,
  },
  premiumLabel: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: FONT_SIZES.sm,
    marginLeft: SPACING.xs,
  },
  subscriptionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  subscriptionDetails: {
    gap: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
  },
  detailValue: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  noSubscription: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  noSubIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  noSubTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  noSubText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    minHeight: 48,
  },
  featureText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    marginLeft: SPACING.sm,
    flex: 1,
    flexWrap: 'wrap',
  },
  planCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planCardFeatured: {
    borderColor: '#8B5CF6',
    borderWidth: 2,
  },
  planCardSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  featuredTag: {
    position: 'absolute',
    top: -10,
    right: SPACING.md,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  featuredTagText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  planName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  planPrice: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  planDuration: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  planFeatures: {
    gap: SPACING.xs,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planFeatureText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.sm,
    marginLeft: SPACING.xs,
  },
  noPlans: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  noPlansText: {
    color: COLORS.textMuted,
  },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  webNoticeText: {
    flex: 1,
    color: '#F59E0B',
    fontSize: FONT_SIZES.sm,
  },
  paymentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  paymentModal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  paymentTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  paymentPlanInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.lg,
  },
  paymentPlanName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  paymentPlanPrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  paymentInput: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  phonePrefix: {
    paddingHorizontal: SPACING.md,
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
  },
  phoneInput: {
    flex: 1,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  paymentNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});

export default SubscriptionScreen;
