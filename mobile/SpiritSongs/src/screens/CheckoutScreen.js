import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { billingAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useBilling } from '../context/BillingContext';
import { showToast } from '../components/Toast';

const MNO_INFO = {
  'Vodacom': { name: 'M-Pesa', color: '#E60000', prefixes: ['74', '75', '76'] },
  'Tigo': { name: 'Tigo Pesa', color: '#00A0D2', prefixes: ['65', '67', '71'] },
  'Airtel': { name: 'Airtel Money', color: '#FF0000', prefixes: ['68', '69', '78', '79'] },
  'Halotel': { name: 'Halo Pesa', color: '#FFA500', prefixes: ['62'] },
  'Zantel': { name: 'Ezy Pesa', color: '#008000', prefixes: ['77'] },
};

const CheckoutScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { refreshBilling } = useBilling();
  const { plan } = route.params || {};
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [detectedMNO, setDetectedMNO] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [transactionId, setTransactionId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);
  
  const pollingRef = useRef(null);

  useEffect(() => {
    // Pre-fill phone number from user profile if available
    if (user?.phone) {
      setPhoneNumber(user.phone.replace('+255', '0'));
    }
    
    return () => {
      // Cleanup polling on unmount
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [user]);

  // Detect MNO from phone number
  useEffect(() => {
    if (phoneNumber.length >= 4) {
      const normalized = phoneNumber.startsWith('0') ? phoneNumber : `0${phoneNumber}`;
      const prefix = normalized.substring(1, 3);
      
      for (const [mno, info] of Object.entries(MNO_INFO)) {
        if (info.prefixes.includes(prefix)) {
          setDetectedMNO({ mno, ...info });
          return;
        }
      }
    }
    setDetectedMNO(null);
  }, [phoneNumber]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('sw-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const normalizePhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('255')) return `+${cleaned}`;
    if (cleaned.startsWith('0')) return `+255${cleaned.substring(1)}`;
    return `+255${cleaned}`;
  };

  const validatePhone = () => {
    const normalized = normalizePhone(phoneNumber);
    if (normalized.length !== 13) {
      showToast('Nambari ya simu si sahihi', 'error');
      return false;
    }
    if (!detectedMNO) {
      showToast('Mtandao wa simu haujulikani', 'error');
      return false;
    }
    return true;
  };

  const startPolling = (txnId) => {
    setPollingActive(true);
    let attempts = 0;
    const maxAttempts = 60; // Poll for 5 minutes max (every 5 seconds)

    pollingRef.current = setInterval(async () => {
      attempts++;
      
      if (attempts > maxAttempts) {
        clearInterval(pollingRef.current);
        setPollingActive(false);
        setPaymentStatus('timeout');
        return;
      }

      try {
        const response = await billingAPI.getPaymentStatus(txnId);
        const status = response.data?.status;
        
        if (status === 'completed') {
          clearInterval(pollingRef.current);
          setPollingActive(false);
          setPaymentStatus('completed');
          refreshBilling();
          
          Alert.alert(
            'Malipo Yamefanikiwa!',
            'Asante kwa kulipia. Akaunti yako imefunguliwa.',
            [{ text: 'Sawa', onPress: () => navigation.navigate('Home') }]
          );
        } else if (status === 'failed') {
          clearInterval(pollingRef.current);
          setPollingActive(false);
          setPaymentStatus('failed');
        }
      } catch (error) {
        console.log('Polling error:', error);
      }
    }, 5000);
  };

  const handlePayment = async () => {
    Keyboard.dismiss();
    
    if (!plan) {
      showToast('Tafadhali chagua mpango kwanza', 'error');
      navigation.goBack();
      return;
    }

    if (!user) {
      showToast('Tafadhali ingia kwanza', 'warning');
      navigation.navigate('Login');
      return;
    }

    if (!validatePhone()) return;

    setProcessing(true);
    setPaymentStatus(null);

    try {
      const response = await billingAPI.initiateAzamPay(
        user.user_id,
        plan.plan_id,
        normalizePhone(phoneNumber)
      );

      if (response.data?.success) {
        setTransactionId(response.data.transaction_id);
        setPaymentStatus('pending');
        showToast(response.data.message || 'Thibitisha malipo kwenye simu yako', 'info');
        
        // Start polling for payment status
        startPolling(response.data.transaction_id);
      } else {
        showToast('Imeshindikana kuanzisha malipo', 'error');
      }
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error.response?.data?.detail || 'Imeshindikana kulipia. Jaribu tena';
      showToast(errorMessage, 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!transactionId) return;
    
    try {
      const response = await billingAPI.getPaymentStatus(transactionId);
      const status = response.data?.status;
      
      if (status === 'completed') {
        setPaymentStatus('completed');
        refreshBilling();
        Alert.alert(
          'Malipo Yamefanikiwa!',
          'Asante kwa kulipia. Akaunti yako imefunguliwa.',
          [{ text: 'Sawa', onPress: () => navigation.navigate('Home') }]
        );
      } else if (status === 'failed') {
        setPaymentStatus('failed');
        showToast('Malipo yameshindikana', 'error');
      } else {
        showToast('Malipo bado yanasubiri kuthibitishwa', 'info');
      }
    } catch (error) {
      console.error('Status check error:', error);
    }
  };

  // Test mode: Simulate payment confirmation
  const handleTestConfirm = async () => {
    if (!transactionId) return;
    
    setProcessing(true);
    try {
      const response = await billingAPI.testConfirmPayment(transactionId, 'confirm');
      
      if (response.data?.success) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setPollingActive(false);
        setPaymentStatus('completed');
        refreshBilling();
        
        Alert.alert(
          'Malipo Yamefanikiwa!',
          response.data.message || 'Akaunti yako imefunguliwa.',
          [{ text: 'Sawa', onPress: () => navigation.navigate('Home') }]
        );
      } else {
        showToast('Imeshindikana kuthibitisha malipo', 'error');
      }
    } catch (error) {
      console.error('Test confirm error:', error);
      showToast(error.response?.data?.detail || 'Kosa limetokea', 'error');
    } finally {
      setProcessing(false);
    }
  };

  if (!plan) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={60} color={COLORS.error} />
        <Text style={styles.errorText}>Mpango haujapatikana</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Rudi Nyuma</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerBackBtn}
            onPress={() => navigation.goBack()}
            disabled={pollingActive}
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lipa kwa Simu</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Order Summary */}
          <View style={styles.orderSummary}>
            <Text style={styles.sectionTitle}>Muhtasari wa Oda</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Mpango</Text>
                <Text style={styles.summaryValue}>{plan.display_name || plan.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Muda</Text>
                <Text style={styles.summaryValue}>
                  {plan.duration_days === 1 ? 'Siku 1' : 
                   plan.duration_days === 7 ? 'Wiki 1' :
                   plan.duration_days === 30 ? 'Mwezi 1' :
                   plan.duration_days === 365 ? 'Mwaka 1' :
                   `Siku ${plan.duration_days}`}
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Jumla</Text>
                <Text style={styles.totalValue}>{formatPrice(plan.price)}</Text>
              </View>
            </View>
          </View>

          {/* Phone Input */}
          <View style={styles.phoneSection}>
            <Text style={styles.sectionTitle}>Nambari ya Simu</Text>
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>🇹🇿 +255</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="7XX XXX XXX"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                maxLength={10}
                editable={!pollingActive}
              />
            </View>
            
            {/* MNO Detection */}
            {detectedMNO && (
              <View style={[styles.mnoTag, { backgroundColor: detectedMNO.color + '20' }]}>
                <View style={[styles.mnoDot, { backgroundColor: detectedMNO.color }]} />
                <Text style={[styles.mnoText, { color: detectedMNO.color }]}>
                  {detectedMNO.name} ({detectedMNO.mno})
                </Text>
              </View>
            )}

            <Text style={styles.phoneHint}>
              Utapokea ujumbe wa USSD kwenye simu yako kuthibitisha malipo
            </Text>
          </View>

          {/* Payment Status */}
          {paymentStatus && (
            <View style={styles.statusSection}>
              {paymentStatus === 'pending' && (
                <View style={styles.statusCard}>
                  <ActivityIndicator size="large" color={COLORS.warning} />
                  <Text style={styles.statusTitle}>Inasubiri Uthibitisho</Text>
                  <Text style={styles.statusText}>
                    Thibitisha malipo kwenye simu yako ya {detectedMNO?.name || 'mobile money'}
                  </Text>
                  {pollingActive && (
                    <Text style={styles.pollingText}>Inakagua hali ya malipo...</Text>
                  )}
                </View>
              )}
              
              {paymentStatus === 'completed' && (
                <View style={[styles.statusCard, styles.successCard]}>
                  <Ionicons name="checkmark-circle" size={60} color={COLORS.primary} />
                  <Text style={styles.statusTitle}>Malipo Yamefanikiwa!</Text>
                  <Text style={styles.statusText}>Akaunti yako imefunguliwa kikamilifu</Text>
                </View>
              )}
              
              {paymentStatus === 'failed' && (
                <View style={[styles.statusCard, styles.errorCard]}>
                  <Ionicons name="close-circle" size={60} color={COLORS.error} />
                  <Text style={styles.statusTitle}>Malipo Yameshindikana</Text>
                  <Text style={styles.statusText}>Tafadhali jaribu tena</Text>
                </View>
              )}
              
              {paymentStatus === 'timeout' && (
                <View style={[styles.statusCard, styles.warningCard]}>
                  <Ionicons name="time" size={60} color={COLORS.warning} />
                  <Text style={styles.statusTitle}>Muda Umeisha</Text>
                  <Text style={styles.statusText}>Kagua hali ya malipo au jaribu tena</Text>
                </View>
              )}
            </View>
          )}

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
            <Text style={styles.securityText}>
              Malipo salama kupitia Azam Pay. Hatuhifadhi taarifa za malipo yako.
            </Text>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomBar}>
          {!paymentStatus || paymentStatus === 'failed' || paymentStatus === 'timeout' ? (
            <TouchableOpacity
              style={[
                styles.payButton,
                (!phoneNumber || phoneNumber.length < 9 || processing) && styles.payButtonDisabled
              ]}
              onPress={handlePayment}
              disabled={!phoneNumber || phoneNumber.length < 9 || processing || pollingActive}
            >
              {processing ? (
                <ActivityIndicator color={COLORS.background} />
              ) : (
                <>
                  <Ionicons name="phone-portrait" size={20} color={COLORS.background} style={{ marginRight: 8 }} />
                  <Text style={styles.payButtonText}>
                    Lipia {formatPrice(plan.price)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : paymentStatus === 'pending' ? (
            <TouchableOpacity
              style={styles.checkStatusButton}
              onPress={handleCheckStatus}
            >
              <Ionicons name="refresh" size={20} color={COLORS.text} style={{ marginRight: 8 }} />
              <Text style={styles.checkStatusText}>Kagua Hali ya Malipo</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => navigation.navigate('Home')}
            >
              <Text style={styles.doneButtonText}>Maliza</Text>
            </TouchableOpacity>
          )}
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBackBtn: {
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.full,
  },
  backButtonText: {
    color: COLORS.background,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  orderSummary: {
    marginBottom: SPACING.xl,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
    paddingTop: SPACING.md,
  },
  totalLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  phoneSection: {
    marginBottom: SPACING.xl,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  countryCode: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
  },
  countryCodeText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.lg,
    color: COLORS.text,
    letterSpacing: 1,
  },
  mnoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  mnoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  mnoText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  phoneHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    lineHeight: 18,
  },
  statusSection: {
    marginBottom: SPACING.xl,
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  successCard: {
    backgroundColor: COLORS.primary + '10',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  errorCard: {
    backgroundColor: COLORS.error + '10',
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  warningCard: {
    backgroundColor: COLORS.warning + '10',
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
  },
  statusTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  statusText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  pollingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
    marginTop: SPACING.md,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  securityText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
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
  payButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  payButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
  },
  checkStatusButton: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  checkStatusText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.background,
  },
});

export default CheckoutScreen;
