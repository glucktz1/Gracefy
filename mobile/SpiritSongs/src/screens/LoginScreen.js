import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

const LoginScreen = ({ navigation }) => {
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'phone', 'forgot', 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const { login } = useAuth();

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Kosa', 'Tafadhali jaza email na password');
      return;
    }

    try {
      setLoading(true);
      const response = await authAPI.login(email, password);
      if (response.data?.token) {
        await login(response.data.token, response.data.user);
        Alert.alert('Karibu!', 'Umefanikiwa kuingia', [
          { text: 'Sawa', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('Login error:', error);
      const message = error.response?.data?.detail || 'Email au password si sahihi';
      Alert.alert('Kosa', message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !name) {
      Alert.alert('Kosa', 'Tafadhali jaza taarifa zote zinazohitajika');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Kosa', 'Password hazifanani');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Kosa', 'Password iwe na herufi 6 au zaidi');
      return;
    }

    try {
      setLoading(true);
      const response = await authAPI.register({
        email,
        password,
        name,
        phone,
      });
      if (response.data?.token) {
        await login(response.data.token, response.data.user);
        Alert.alert('Karibu!', 'Akaunti yako imeundwa', [
          { text: 'Sawa', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('Register error:', error);
      const message = error.response?.data?.detail || 'Imeshindikana kuunda akaunti';
      Alert.alert('Kosa', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Kosa', 'Tafadhali weka nambari ya simu sahihi');
      return;
    }

    try {
      setLoading(true);
      await authAPI.sendOTP(phone);
      setOtpSent(true);
      setAuthMode('otp');
      Alert.alert('Imefanikiwa', 'Nambari ya OTP imetumwa kwenye simu yako');
    } catch (error) {
      console.error('OTP error:', error);
      Alert.alert('Kosa', 'Imeshindikana kutuma OTP. Jaribu tena.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 4) {
      Alert.alert('Kosa', 'Tafadhali weka nambari ya OTP');
      return;
    }

    try {
      setLoading(true);
      const response = await authAPI.verifyOTP(phone, otp);
      if (response.data?.token) {
        await login(response.data.token, response.data.user);
        Alert.alert('Karibu!', 'Umefanikiwa kuingia', [
          { text: 'Sawa', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('OTP verify error:', error);
      Alert.alert('Kosa', 'OTP si sahihi. Jaribu tena.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Kosa', 'Tafadhali weka email yako');
      return;
    }

    try {
      setLoading(true);
      await authAPI.forgotPassword?.(email) || Alert.alert('Kosa', 'Huduma haijapatikana');
      Alert.alert('Imefanikiwa', 'Maelekezo ya kubadilisha password yametumwa kwenye email yako');
      setAuthMode('login');
    } catch (error) {
      console.error('Forgot password error:', error);
      Alert.alert('Kosa', 'Imeshindikana. Hakikisha email ni sahihi.');
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerWithUs = () => {
    // Open partner registration page or email
    Linking.openURL('mailto:partners@gracefy.com?subject=Partnership%20Inquiry');
  };

  const renderLoginForm = () => (
    <>
      <View style={styles.inputContainer}>
        <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={COLORS.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons 
            name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
            size={20} 
            color={COLORS.textSecondary} 
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.forgotPassword}
        onPress={() => setAuthMode('forgot')}
      >
        <Text style={styles.forgotPasswordText}>Umesahau password?</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleEmailLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.submitButtonText}>Ingia</Text>
        )}
      </TouchableOpacity>

      {/* Phone Login Option */}
      <TouchableOpacity
        style={styles.phoneLoginButton}
        onPress={() => setAuthMode('phone')}
      >
        <Ionicons name="phone-portrait-outline" size={20} color={COLORS.primary} />
        <Text style={styles.phoneLoginText}>Ingia kwa nambari ya simu</Text>
      </TouchableOpacity>
    </>
  );

  const renderRegisterForm = () => (
    <>
      <View style={styles.inputContainer}>
        <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Jina lako kamili"
          placeholderTextColor={COLORS.textMuted}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Nambari ya simu (si lazima)"
          placeholderTextColor={COLORS.textMuted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={COLORS.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Rudia Password"
          placeholderTextColor={COLORS.textMuted}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons 
            name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
            size={20} 
            color={COLORS.textSecondary} 
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.submitButtonText}>Jisajili</Text>
        )}
      </TouchableOpacity>

      {/* Phone Registration Option */}
      <TouchableOpacity
        style={styles.phoneLoginButton}
        onPress={() => setAuthMode('phone')}
      >
        <Ionicons name="phone-portrait-outline" size={20} color={COLORS.primary} />
        <Text style={styles.phoneLoginText}>Jisajili kwa nambari ya simu</Text>
      </TouchableOpacity>
    </>
  );

  const renderPhoneForm = () => (
    <>
      <Text style={styles.phoneTitle}>Ingia kwa Nambari ya Simu</Text>
      <Text style={styles.phoneSubtitle}>
        Tutakutumia nambari ya OTP kwenye simu yako
      </Text>

      <View style={styles.inputContainer}>
        <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <Text style={styles.phonePrefix}>+255</Text>
        <TextInput
          style={styles.input}
          placeholder="712 345 678"
          placeholderTextColor={COLORS.textMuted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={10}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSendOTP}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.submitButtonText}>Tuma OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backToEmailButton}
        onPress={() => setAuthMode('login')}
      >
        <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
        <Text style={styles.backToEmailText}>Rudi kwa email</Text>
      </TouchableOpacity>
    </>
  );

  const renderOTPForm = () => (
    <>
      <Text style={styles.phoneTitle}>Weka OTP</Text>
      <Text style={styles.phoneSubtitle}>
        Weka nambari iliyotumwa kwenye {phone}
      </Text>

      <View style={styles.otpContainer}>
        <TextInput
          style={styles.otpInput}
          placeholder="• • • • • •"
          placeholderTextColor={COLORS.textMuted}
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleVerifyOTP}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.submitButtonText}>Thibitisha</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resendButton}
        onPress={handleSendOTP}
        disabled={loading}
      >
        <Text style={styles.resendText}>Haukupata? Tuma tena</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backToEmailButton}
        onPress={() => { setAuthMode('phone'); setOtpSent(false); }}
      >
        <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
        <Text style={styles.backToEmailText}>Badilisha nambari</Text>
      </TouchableOpacity>
    </>
  );

  const renderForgotPasswordForm = () => (
    <>
      <Text style={styles.phoneTitle}>Umesahau Password?</Text>
      <Text style={styles.phoneSubtitle}>
        Weka email yako na tutakutumia maelekezo ya kubadilisha password
      </Text>

      <View style={styles.inputContainer}>
        <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={COLORS.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleForgotPassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.submitButtonText}>Tuma Maelekezo</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backToEmailButton}
        onPress={() => setAuthMode('login')}
      >
        <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
        <Text style={styles.backToEmailText}>Rudi kuingia</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={[COLORS.primary, '#1ed760']}
              style={styles.logoGradient}
            >
              <Ionicons name="musical-notes" size={48} color={COLORS.background} />
            </LinearGradient>
            <Text style={styles.logoText}>Gracefy</Text>
            <Text style={styles.logoSubtext}>Muziki wa Kikristo</Text>
          </View>

          {/* Tab Switcher - Only show for login/register */}
          {(authMode === 'login' || authMode === 'register') && (
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, authMode === 'login' && styles.tabActive]}
                onPress={() => setAuthMode('login')}
              >
                <Text style={[styles.tabText, authMode === 'login' && styles.tabTextActive]}>Ingia</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, authMode === 'register' && styles.tabActive]}
                onPress={() => setAuthMode('register')}
              >
                <Text style={[styles.tabText, authMode === 'register' && styles.tabTextActive]}>Jisajili</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            {authMode === 'login' && renderLoginForm()}
            {authMode === 'register' && renderRegisterForm()}
            {authMode === 'phone' && renderPhoneForm()}
            {authMode === 'otp' && renderOTPForm()}
            {authMode === 'forgot' && renderForgotPasswordForm()}
          </View>

          {/* Social Login - Only show for login/register */}
          {(authMode === 'login' || authMode === 'register') && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>au</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity style={styles.socialButton}>
                <Ionicons name="logo-google" size={24} color={COLORS.text} />
                <Text style={styles.socialButtonText}>Endelea na Google</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.socialButton}>
                <Ionicons name="logo-apple" size={24} color={COLORS.text} />
                <Text style={styles.socialButtonText}>Endelea na Apple</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Partner With Us */}
          <TouchableOpacity 
            style={styles.partnerButton}
            onPress={handlePartnerWithUs}
          >
            <Ionicons name="people-outline" size={20} color={COLORS.primary} />
            <Text style={styles.partnerText}>Shiriki nasi kama msanii au kanisa</Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.terms}>
            Kwa kuendelea, unakubali{' '}
            <Text style={styles.termsLink}>Masharti ya Huduma</Text>
            {' '}na{' '}
            <Text style={styles.termsLink}>Sera ya Faragha</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingVertical: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  logoSubtext: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.full,
    padding: 4,
    marginBottom: SPACING.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.full,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.background,
  },
  form: {
    marginBottom: SPACING.lg,
  },
  phoneTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  phoneSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  phonePrefix: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginRight: SPACING.xs,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  otpContainer: {
    marginBottom: SPACING.lg,
  },
  otpInput: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    height: 60,
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
  },
  forgotPasswordText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  phoneLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  phoneLoginText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  backToEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  backToEmailText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  resendText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    paddingHorizontal: SPACING.md,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  socialButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  partnerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  partnerText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
  },
  terms: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: SPACING.lg,
  },
  termsLink: {
    color: COLORS.primary,
  },
});

export default LoginScreen;
