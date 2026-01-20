import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import api from '../services/api';

const COLORS = {
  background: '#0A0A1A',
  card: '#1a1a2e',
  cardBorder: '#2d2d44',
  primary: '#3498DB',
  primaryDark: '#1A295E',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  text: '#ffffff',
  textSecondary: '#9ca3af',
};

// Gateway logos fallback
const GATEWAY_LOGOS = {
  mpesa: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/M-PESA_LOGO-01.svg/512px-M-PESA_LOGO-01.svg.png',
  tigopesa: 'https://www.tigo.co.tz/sites/default/files/2020-01/tigo-pesa-logo.png',
  airtel: 'https://www.airtel.co.tz/assets/images/airtel-money-logo.png',
  halopesa: 'https://www.hfrbank.co.tz/assets/images/halopesa-logo.png',
  stripe: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/512px-Stripe_Logo%2C_revised_2016.svg.png',
  paypal: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/512px-PayPal.svg.png',
};

export default function CheckoutScreen({ route, navigation }) {
  const { plan } = route.params || {};
  const { user, isAuthenticated } = useAuth();
  const { refresh } = useSubscription();
  
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [gateways, setGateways] = useState({ mobile_money: [], card: [] });
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('mobile_money'); // mobile_money or card
  const [phoneNumber, setPhoneNumber] = useState('');
  const [transactionId, setTransactionId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);

  // Subscription plans
  const plans = {
    monthly: {
      id: 'monthly',
      name: 'Premium Monthly',
      price: 'TZS 5,000',
      priceUsd: '$2.99',
      duration: '1 month',
      features: ['Unlimited songs', 'No ads', 'Offline downloads', 'High quality audio']
    },
    yearly: {
      id: 'yearly',
      name: 'Premium Yearly',
      price: 'TZS 50,000',
      priceUsd: '$29.99',
      duration: '12 months',
      features: ['Unlimited songs', 'No ads', 'Offline downloads', 'High quality audio', '2 months FREE']
    }
  };

  const selectedPlan = plans[plan?.id] || plans.monthly;

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      // First sync defaults
      await api.post('/payment/gateways/sync-defaults');
      
      const response = await api.get('/payment/gateways');
      setGateways({
        mobile_money: response.data.mobile_money || [],
        card: response.data.card || []
      });
      
      // Auto-select first gateway
      if (response.data.mobile_money?.length > 0) {
        setSelectedGateway(response.data.mobile_money[0]);
      }
    } catch (error) {
      console.error('Error fetching gateways:', error);
      Alert.alert('Error', 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedGateway) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    if (paymentMethod === 'mobile_money' && !phoneNumber) {
      Alert.alert('Error', 'Please enter your mobile money number');
      return;
    }

    // Validate phone number format for Tanzania
    if (paymentMethod === 'mobile_money') {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 9 || cleanPhone.length > 12) {
        Alert.alert('Error', 'Please enter a valid phone number');
        return;
      }
    }

    setProcessing(true);

    try {
      const response = await api.post('/payment/initiate', {
        user_id: user?.user_id,
        plan_id: selectedPlan.id,
        gateway_code: selectedGateway.code,
        phone_number: phoneNumber
      });

      setTransactionId(response.data.transaction_id);
      setPaymentStatus('pending');

      if (selectedGateway.gateway_type === 'mobile_money') {
        // Show instructions for mobile money
        Alert.alert(
          'Payment Initiated',
          `Please complete the payment on your phone.\n\nAmount: ${selectedPlan.price}\nGateway: ${selectedGateway.name}\n\nYou will receive a prompt on your phone.`,
          [
            { text: 'Check Status', onPress: () => checkPaymentStatus(response.data.transaction_id) },
            { text: 'OK' }
          ]
        );
      } else {
        // For card payments, would redirect to gateway
        Alert.alert('Redirecting', 'You will be redirected to complete payment...');
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Payment initiation failed');
    } finally {
      setProcessing(false);
    }
  };

  const checkPaymentStatus = async (txnId) => {
    try {
      const response = await api.get(`/payment/status/${txnId || transactionId}`);
      setPaymentStatus(response.data.status);

      if (response.data.status === 'completed') {
        Alert.alert(
          'Payment Successful!',
          'Your subscription is now active. Enjoy unlimited music!',
          [{ text: 'OK', onPress: () => {
            refresh();
            navigation.navigate('Home');
          }}]
        );
      } else if (response.data.status === 'failed') {
        Alert.alert('Payment Failed', response.data.failure_reason || 'Please try again');
      } else {
        Alert.alert('Payment Pending', 'Your payment is still being processed. Please check again in a moment.');
      }
    } catch (error) {
      console.error('Status check error:', error);
    }
  };

  // Simulate payment completion for testing
  const simulatePayment = async () => {
    if (!transactionId) return;
    
    try {
      await api.post(`/payment/confirm/${transactionId}`, {
        status: 'completed',
        external_ref: `SIM_${Date.now()}`
      });
      checkPaymentStatus(transactionId);
    } catch (error) {
      console.error('Simulation error:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Checkout</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Plan Summary */}
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark]}
            style={styles.planCard}
          >
            <View style={styles.planHeader}>
              <Ionicons name="musical-notes" size={32} color="#fff" />
              <View style={styles.planInfo}>
                <Text style={styles.planName}>{selectedPlan.name}</Text>
                <Text style={styles.planDuration}>{selectedPlan.duration}</Text>
              </View>
            </View>
            <View style={styles.planPriceRow}>
              <Text style={styles.planPrice}>{selectedPlan.price}</Text>
              <Text style={styles.planPriceUsd}>({selectedPlan.priceUsd})</Text>
            </View>
            <View style={styles.planFeatures}>
              {selectedPlan.features.map((feature, idx) => (
                <View key={idx} style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {/* Payment Method Tabs */}
          <View style={styles.methodTabs}>
            <TouchableOpacity
              style={[styles.methodTab, paymentMethod === 'mobile_money' && styles.methodTabActive]}
              onPress={() => {
                setPaymentMethod('mobile_money');
                setSelectedGateway(gateways.mobile_money[0] || null);
              }}
            >
              <Ionicons name="phone-portrait" size={20} color={paymentMethod === 'mobile_money' ? '#fff' : COLORS.textSecondary} />
              <Text style={[styles.methodTabText, paymentMethod === 'mobile_money' && styles.methodTabTextActive]}>
                Mobile Money
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodTab, paymentMethod === 'card' && styles.methodTabActive]}
              onPress={() => {
                setPaymentMethod('card');
                setSelectedGateway(gateways.card[0] || null);
              }}
            >
              <Ionicons name="card" size={20} color={paymentMethod === 'card' ? '#fff' : COLORS.textSecondary} />
              <Text style={[styles.methodTabText, paymentMethod === 'card' && styles.methodTabTextActive]}>
                Card / Bank
              </Text>
            </TouchableOpacity>
          </View>

          {/* Gateway Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {paymentMethod === 'mobile_money' ? 'Select Operator' : 'Select Payment Gateway'}
            </Text>
            
            <View style={styles.gatewayGrid}>
              {(paymentMethod === 'mobile_money' ? gateways.mobile_money : gateways.card).map((gw) => (
                <TouchableOpacity
                  key={gw.gateway_id}
                  style={[
                    styles.gatewayCard,
                    selectedGateway?.gateway_id === gw.gateway_id && styles.gatewayCardSelected
                  ]}
                  onPress={() => setSelectedGateway(gw)}
                >
                  <Image
                    source={{ uri: gw.logo_url || GATEWAY_LOGOS[gw.code] }}
                    style={styles.gatewayLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.gatewayName}>{gw.name}</Text>
                  {selectedGateway?.gateway_id === gw.gateway_id && (
                    <View style={styles.gatewayCheck}>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Mobile Money Phone Input */}
          {paymentMethod === 'mobile_money' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Mobile Number</Text>
              <View style={styles.phoneInputContainer}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+255</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="7XX XXX XXX"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  maxLength={10}
                />
              </View>
              <Text style={styles.phoneHint}>
                Enter the phone number registered with {selectedGateway?.name || 'mobile money'}
              </Text>
            </View>
          )}

          {/* Transaction Status */}
          {transactionId && (
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Text style={styles.statusTitle}>Transaction Status</Text>
                <TouchableOpacity onPress={() => checkPaymentStatus()}>
                  <Ionicons name="refresh" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>ID:</Text>
                <Text style={styles.statusValue}>{transactionId}</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Status:</Text>
                <View style={[
                  styles.statusBadge,
                  paymentStatus === 'completed' && styles.statusBadgeSuccess,
                  paymentStatus === 'failed' && styles.statusBadgeError,
                ]}>
                  <Text style={styles.statusBadgeText}>
                    {paymentStatus?.toUpperCase() || 'PENDING'}
                  </Text>
                </View>
              </View>
              
              {/* Dev only: Simulate payment */}
              {__DEV__ && paymentStatus === 'pending' && (
                <TouchableOpacity style={styles.simulateBtn} onPress={simulatePayment}>
                  <Text style={styles.simulateBtnText}>Simulate Success (Dev)</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Pay Button */}
          <TouchableOpacity
            style={[styles.payButton, processing && styles.payButtonDisabled]}
            onPress={handlePayment}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={20} color="#fff" />
                <Text style={styles.payButtonText}>
                  Pay {selectedPlan.price}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
            <Text style={styles.securityText}>
              Your payment is secure and encrypted
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  planCard: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  planInfo: {
    marginLeft: 12,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  planDuration: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  planPriceUsd: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 8,
  },
  planFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 6,
  },
  methodTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 4,
  },
  methodTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  methodTabActive: {
    backgroundColor: COLORS.primary,
  },
  methodTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  methodTabTextActive: {
    color: '#fff',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  gatewayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gatewayCard: {
    width: '47%',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gatewayCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
  },
  gatewayLogo: {
    width: 60,
    height: 40,
    marginBottom: 8,
  },
  gatewayName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  gatewayCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  phonePrefix: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  phonePrefixText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#fff',
    letterSpacing: 1,
  },
  phoneHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  statusCard: {
    margin: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  statusValue: {
    fontSize: 13,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeSuccess: {
    backgroundColor: COLORS.success,
  },
  statusBadgeError: {
    backgroundColor: COLORS.error,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  simulateBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  simulateBtnText: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 32,
  },
  securityText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});
