import React, { useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { authAPI, API_BASE_URL } from '../services/api';

// Emergent OAuth URL - same as admin panel
const GOOGLE_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/google";

const LoginScreen = ({ navigation }) => {
  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'phone', 'otp', 'forgot', 'forgot-otp', 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { login } = useAuth();

  // Handle deep link for Google OAuth callback
  useEffect(() => {
    const handleUrl = async (event) => {
      const url = event.url;
      if (url && url.includes('session_id=')) {
        const sessionId = url.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          await handleGoogleCallback(sessionId);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    
    // Check if app was opened via URL
    Linking.getInitialURL().then((url) => {
      if (url && url.includes('session_id=')) {
        const sessionId = url.split('session_id=')[1]?.split('&')[0];
        if (sessionId) {
          handleGoogleCallback(sessionId);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleGoogleCallback = async (sessionId, directToken = null) => {
    try {
      setGoogleLoading(true);
      
      if (directToken) {
        // If we have a direct token, use it
        const userResponse = await authAPI.getMe(directToken);
        if (userResponse.data) {
          await login(directToken, userResponse.data);
          Alert.alert('Karibu!', 'Umefanikiwa kuingia na Google', [
            { text: 'Sawa', onPress: () => navigation.goBack() }
          ]);
        }
      } else if (sessionId) {
        // Exchange session_id for token
        const response = await authAPI.googleCallback(sessionId);
        if (response.data?.token) {
          await login(response.data.token, response.data.user);
          Alert.alert('Karibu!', 'Umefanikiwa kuingia na Google', [
            { text: 'Sawa', onPress: () => navigation.goBack() }
          ]);
        } else {
          throw new Error('No token received');
        }
      } else {
        throw new Error('No session ID or token');
      }
    } catch (error) {
      console.error('Google auth error:', error);
      Alert.alert('Kosa', 'Imeshindikana kuingia na Google. Jaribu tena.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      
      // For mobile, we use the backend's Google OAuth endpoint
      // which will redirect back to the app with a session_id
      const callbackUrl = `${API_BASE_URL}/user/auth/google-callback`;
      const mobileRedirect = Linking.createURL('auth');
      
      // Build the OAuth URL - pass both callback and mobile redirect
      const authUrl = `${GOOGLE_AUTH_URL}?redirect_uri=${encodeURIComponent(callbackUrl)}&mobile_redirect=${encodeURIComponent(mobileRedirect)}&platform=mobile`;
      
      console.log('Opening Google Auth:', authUrl);
      
      // Open auth in browser with the mobile scheme as the return URL
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'gracefy://');
      
      console.log('Auth result:', result);
      
      if (result.type === 'success' && result.url) {
        const url = result.url;
        console.log('Callback URL:', url);
        
        // Extract session_id from callback URL
        let sessionId = null;
        
        // Try different URL parameter formats
        const urlObj = new URL(url.replace('gracefy://', 'https://temp.com/'));
        sessionId = urlObj.searchParams.get('session_id');
        
        if (!sessionId && url.includes('session_id=')) {
          sessionId = url.split('session_id=')[1]?.split('&')[0]?.split('#')[0];
        }
        
        console.log('Extracted Session ID:', sessionId);
        
        if (sessionId) {
          await handleGoogleCallback(sessionId);
        } else {
          // Try to get token directly if present
          const token = urlObj.searchParams.get('token');
          if (token) {
            await handleGoogleCallback(null, token);
          } else {
            Alert.alert('Kosa', 'Hakuna session ID. Jaribu tena.');
          }
        }
      } else if (result.type === 'cancel') {
        console.log('User cancelled auth');
      } else if (result.type === 'dismiss') {
        console.log('Browser dismissed');
      }
    } catch (error) {
      console.error('Google login error:', error);
      Alert.alert('Kosa', 'Imeshindikana kufungua Google login. ' + (error.message || 'Jaribu tena'));
    } finally {
      setGoogleLoading(false);
    }
  };

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
    if (!name || !email || !password) {
      Alert.alert('Kosa', 'Tafadhali jaza jina, email na password');
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
        phone: phone || undefined,
      });
      if (response.data?.token) {
        await login(response.data.token, response.data.user);
        const trialMsg = response.data.trial_started 
          ? `\n\nUmepata siku ${response.data.trial_days} za majaribio bure!`
          : '';
        Alert.alert('Karibu!', `Akaunti yako imeundwa${trialMsg}`, [
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
    const phoneNum = phone.startsWith('+') ? phone : `+255${phone.replace(/^0/, '')}`;
    
    if (!phone || phone.length < 9) {
      Alert.alert('Kosa', 'Tafadhali weka nambari ya simu sahihi');
      return;
    }

    try {
      setLoading(true);
      await authAPI.sendOTP(phoneNum);
      setAuthMode('otp');
      Alert.alert('Imefanikiwa', 'Nambari ya OTP imetumwa kwenye simu yako');
    } catch (error) {
      console.error('OTP error:', error);
      const message = error.response?.data?.detail || 'Imeshindikana kutuma OTP';
      Alert.alert('Kosa', message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 4) {
      Alert.alert('Kosa', 'Tafadhali weka nambari ya OTP');
      return;
    }

    const phoneNum = phone.startsWith('+') ? phone : `+255${phone.replace(/^0/, '')}`;

    try {
      setLoading(true);
      const response = await authAPI.verifyOTP(phoneNum, otp);
      if (response.data?.token) {
        await login(response.data.token, response.data.user);
        Alert.alert('Karibu!', 'Umefanikiwa kuingia', [
          { text: 'Sawa', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('OTP verify error:', error);
      const message = error.response?.data?.detail || 'OTP si sahihi';
      Alert.alert('Kosa', message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSend = async () => {
    if (!email) {
      Alert.alert('Kosa', 'Tafadhali weka email yako');
      return;
    }

    try {
      setLoading(true);
      await authAPI.forgotPasswordSend(email);
      setAuthMode('forgot-otp');
      Alert.alert('Imefanikiwa', 'Nambari ya OTP imetumwa kwenye email yako');
    } catch (error) {
      console.error('Forgot password error:', error);
      const message = error.response?.data?.detail || 'Imeshindikana kutuma OTP';
      Alert.alert('Kosa', message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordVerify = async () => {
    if (!otp || otp.length < 4) {
      Alert.alert('Kosa', 'Tafadhali weka nambari ya OTP');
      return;
    }

    try {
      setLoading(true);
      await authAPI.forgotPasswordVerify(email, otp);
      setAuthMode('reset');
      Alert.alert('Imefanikiwa', 'Sasa weka password mpya');
    } catch (error) {
      console.error('Verify OTP error:', error);
      const message = error.response?.data?.detail || 'OTP si sahihi';
      Alert.alert('Kosa', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Kosa', 'Password iwe na herufi 6 au zaidi');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Kosa', 'Password hazifanani');
      return;
    }

    try {
      setLoading(true);
      await authAPI.forgotPasswordReset(email, otp, newPassword);
      Alert.alert('Imefanikiwa', 'Password imebadilishwa. Sasa unaweza kuingia.', [
        { text: 'Sawa', onPress: () => setAuthMode('login') }
      ]);
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Reset password error:', error);
      const message = error.response?.data?.detail || 'Imeshindikana kubadilisha password';
      Alert.alert('Kosa', message);
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerWithUs = () => {
    Linking.openURL('mailto:partners@gracefy.com?subject=Ombi%20la%20Ushirikiano&body=Jina:%0ANambari%20ya%20Simu:%0AJina%20la%20Kanisa/Kwaya:%0AMaelezo%20Zaidi:');
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
          autoCorrect={false}
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

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setAuthMode('phone')}
      >
        <Ionicons name="phone-portrait-outline" size={20} color={COLORS.primary} />
        <Text style={styles.secondaryButtonText}>Ingia kwa nambari ya simu</Text>
      </TouchableOpacity>
    </>
  );

  const renderRegisterForm = () => (
    <>
      <View style={styles.inputContainer}>
        <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Jina lako kamili *"
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
          placeholder="Email *"
          placeholderTextColor={COLORS.textMuted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
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
          placeholder="Password *"
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
          placeholder="Rudia Password *"
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

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setAuthMode('phone')}
      >
        <Ionicons name="phone-portrait-outline" size={20} color={COLORS.primary} />
        <Text style={styles.secondaryButtonText}>Jisajili kwa nambari ya simu</Text>
      </TouchableOpacity>
    </>
  );

  const renderPhoneForm = () => (
    <>
      <Text style={styles.formTitle}>Ingia kwa Simu</Text>
      <Text style={styles.formSubtitle}>
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
        style={styles.backButton}
        onPress={() => setAuthMode('login')}
      >
        <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
        <Text style={styles.backButtonText}>Rudi kuingia kwa email</Text>
      </TouchableOpacity>
    </>
  );

  const renderOTPForm = () => (
    <>
      <Text style={styles.formTitle}>Weka OTP</Text>
      <Text style={styles.formSubtitle}>
        Weka nambari iliyotumwa kwenye +255{phone}
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
        style={styles.backButton}
        onPress={() => { setAuthMode('phone'); setOtp(''); }}
      >
        <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
        <Text style={styles.backButtonText}>Badilisha nambari</Text>
      </TouchableOpacity>
    </>
  );

  const renderForgotForm = () => (
    <>
      <Text style={styles.formTitle}>Umesahau Password?</Text>
      <Text style={styles.formSubtitle}>
        Weka email yako na tutakutumia OTP kubadilisha password
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
        onPress={handleForgotPasswordSend}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.submitButtonText}>Tuma OTP</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setAuthMode('login')}
      >
        <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
        <Text style={styles.backButtonText}>Rudi kuingia</Text>
      </TouchableOpacity>
    </>
  );

  const renderForgotOTPForm = () => (
    <>
      <Text style={styles.formTitle}>Weka OTP</Text>
      <Text style={styles.formSubtitle}>
        Weka nambari iliyotumwa kwenye {email}
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
        onPress={handleForgotPasswordVerify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.submitButtonText}>Thibitisha</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => { setAuthMode('forgot'); setOtp(''); }}
      >
        <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
        <Text style={styles.backButtonText}>Rudi</Text>
      </TouchableOpacity>
    </>
  );

  const renderResetForm = () => (
    <>
      <Text style={styles.formTitle}>Password Mpya</Text>
      <Text style={styles.formSubtitle}>
        Weka password yako mpya
      </Text>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Password mpya"
          placeholderTextColor={COLORS.textMuted}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showPassword}
        />
      </View>

      <View style={styles.inputContainer}>
        <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Rudia password mpya"
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
        onPress={handleResetPassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.submitButtonText}>Badilisha Password</Text>
        )}
      </TouchableOpacity>
    </>
  );

  const renderGoogleButton = () => (
    <TouchableOpacity 
      style={[styles.googleButton, googleLoading && styles.submitButtonDisabled]}
      onPress={handleGoogleLogin}
      disabled={googleLoading}
    >
      {googleLoading ? (
        <ActivityIndicator color={COLORS.text} />
      ) : (
        <>
          <Ionicons name="logo-google" size={24} color="#EA4335" />
          <Text style={styles.googleButtonText}>Endelea na Google</Text>
        </>
      )}
    </TouchableOpacity>
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
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#3498DB', '#1abc9c']}
              style={styles.logoGradient}
            >
              <Ionicons name="musical-notes" size={48} color="#fff" />
            </LinearGradient>
            <Text style={styles.logoText}>Gracefy</Text>
            <Text style={styles.logoSubtext}>Muziki wa Kikristo</Text>
          </View>

          {/* Tab Switcher - Only for login/register */}
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
            {authMode === 'forgot' && renderForgotForm()}
            {authMode === 'forgot-otp' && renderForgotOTPForm()}
            {authMode === 'reset' && renderResetForm()}
          </View>

          {/* Social Login - Only for login/register */}
          {(authMode === 'login' || authMode === 'register') && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>au</Text>
                <View style={styles.dividerLine} />
              </View>

              {renderGoogleButton()}
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

          {/* Choir Portal Link */}
          <View style={styles.choirSection}>
            <View style={styles.choirDivider} />
            <Text style={styles.choirTitle}>Una kwaya? / Are you a choir?</Text>
            <View style={styles.choirButtons}>
              <TouchableOpacity 
                style={styles.choirButton} 
                onPress={() => Linking.openURL(`${API_BASE_URL.replace('/api', '')}/choir-login`)}
              >
                <Ionicons name="log-in-outline" size={18} color="#10B981" />
                <Text style={styles.choirButtonText}>Choir Login</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.choirButton} 
                onPress={() => Linking.openURL(`${API_BASE_URL.replace('/api', '')}/choir-register`)}
              >
                <Ionicons name="person-add-outline" size={18} color="#10B981" />
                <Text style={styles.choirButtonText}>Register Choir</Text>
              </TouchableOpacity>
            </View>
          </View>

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
  closeButton: {
    padding: SPACING.xs,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
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
  formTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  formSubtitle: {
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
    color: COLORS.text,
    marginRight: SPACING.xs,
    fontWeight: '500',
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
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    letterSpacing: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
  },
  forgotPasswordText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  secondaryButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    marginLeft: SPACING.sm,
    fontWeight: '500',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
  },
  backButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  resendText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '500',
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
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  googleButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.md,
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
    marginTop: SPACING.md,
  },
  termsLink: {
    color: COLORS.primary,
  },
});

export default LoginScreen;
