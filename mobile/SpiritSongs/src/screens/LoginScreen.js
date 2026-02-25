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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { authAPI, API_BASE_URL } from '../services/api';

// Complete any pending auth sessions
WebBrowser.maybeCompleteAuthSession();

// Use the SAME auth URL as web - this is the key!
const EMERGENT_AUTH_URL = "https://auth.emergentagent.com/";

const LoginScreen = ({ navigation }) => {
  const [authMode, setAuthMode] = useState('login');
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
  
  // Auth methods from admin settings
  const [authMethods, setAuthMethods] = useState({
    email_password: true,
    google: true,
    phone: false,
    guest: true,
    registration_enabled: true
  });
  const [loadingMethods, setLoadingMethods] = useState(true);

  const { login } = useAuth();

  // Fetch available auth methods on mount
  useEffect(() => {
    const fetchAuthMethods = async () => {
      try {
        const response = await authAPI.getAuthMethods();
        if (response.data) {
          setAuthMethods(response.data);
        }
      } catch (error) {
        console.log('Failed to fetch auth methods, using defaults:', error.message);
      } finally {
        setLoadingMethods(false);
      }
    };
    fetchAuthMethods();
  }, []);

  // Handle deep link for OAuth callback
  useEffect(() => {
    const handleUrl = async (event) => {
      const url = event.url;
      console.log('Deep link received:', url);
      if (url && url.includes('gracefy://')) {
        await processCallbackUrl(url);
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);
    
    // Check if app was opened with a URL
    Linking.getInitialURL().then((url) => {
      if (url && url.includes('gracefy://')) {
        console.log('Initial URL:', url);
        processCallbackUrl(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const processCallbackUrl = async (url) => {
    try {
      console.log('Processing callback URL:', url);
      
      // Extract parameters from URL
      let token = null;
      let sessionId = null;
      let error = null;

      // Parse URL parameters
      const queryString = url.split('?')[1] || url.split('#')[1] || '';
      const params = new URLSearchParams(queryString);
      
      token = params.get('token');
      sessionId = params.get('session_id');
      error = params.get('error');

      // Fallback regex extraction
      if (!token && url.includes('token=')) {
        const match = url.match(/token=([^&&#]+)/);
        token = match ? match[1] : null;
      }
      if (!sessionId && url.includes('session_id=')) {
        const match = url.match(/session_id=([^&&#]+)/);
        sessionId = match ? match[1] : null;
      }

      console.log('Extracted - Token:', token?.substring(0, 20), 'SessionId:', sessionId);

      if (error) {
        Alert.alert('Kosa', 'Imeshindikana kuingia na Google: ' + error);
        return;
      }

      if (token) {
        await handleGoogleToken(token);
      } else if (sessionId) {
        await handleGoogleSession(sessionId);
      }
    } catch (error) {
      console.error('Process callback error:', error);
      Alert.alert('Kosa', 'Imeshindikana kusoma data ya Google');
    }
  };

  const handleGoogleToken = async (token) => {
    try {
      setGoogleLoading(true);
      
      // Get user data with token
      const response = await authAPI.getMe(token);
      if (response.data) {
        await login(token, response.data);
        Alert.alert('Karibu!', 'Umefanikiwa kuingia na Google', [
          { text: 'Sawa', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      console.error('Get user error:', error);
      Alert.alert('Kosa', 'Imeshindikana kupata data ya mtumiaji');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSession = async (sessionId) => {
    try {
      setGoogleLoading(true);
      
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
    } catch (error) {
      console.error('Google callback error:', error);
      Alert.alert('Kosa', 'Imeshindikana kuingia na Google. Jaribu tena.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      
      // Mobile deep link for callback
      const mobileRedirect = 'gracefy://auth';
      
      // Backend callback URL that will handle the OAuth response and redirect to mobile app
      const backendCallback = `${API_BASE_URL}/user/auth/google-callback?mobile_redirect=${encodeURIComponent(mobileRedirect)}`;
      
      // Use Emergent Auth with 'redirect' parameter (same as web)
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(backendCallback)}`;
      
      // Use Linking.openURL to open in external browser
      // This avoids WebView issues with Google account picker
      const canOpen = await Linking.canOpenURL(authUrl);
      if (canOpen) {
        await Linking.openURL(authUrl);
        // The user will be redirected back via the gracefy:// deep link
        // The deep link handler in App.js will complete the login
      } else {
        Alert.alert('Kosa', 'Imeshindikana kufungua browser.');
      }
    } catch (error) {
      Alert.alert('Kosa', 'Imeshindikana kufungua Google login. Jaribu tena baadaye.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Kosa', 'Tafadhali jaza email na password');
      return;
    }
    setLoading(true);
    try {
      const response = await authAPI.login(email, password);
      if (response.data?.token) {
        await login(response.data.token, response.data.user);
        Alert.alert('Karibu!', 'Umefanikiwa kuingia', [
          { text: 'Sawa', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      Alert.alert('Kosa', error.response?.data?.detail || 'Imeshindikana kuingia');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !name) {
      Alert.alert('Kosa', 'Tafadhali jaza taarifa zote');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Kosa', 'Password hazifanani');
      return;
    }
    setLoading(true);
    try {
      const response = await authAPI.register(name, email, password);
      if (response.data?.token) {
        await login(response.data.token, response.data.user);
        Alert.alert('Karibu!', 'Akaunti imefunguliwa', [
          { text: 'Sawa', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      Alert.alert('Kosa', error.response?.data?.detail || 'Imeshindikana kusajili');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!phone) {
      Alert.alert('Kosa', 'Tafadhali weka nambari ya simu');
      return;
    }
    setLoading(true);
    try {
      await authAPI.sendOTP(phone);
      Alert.alert('Imefanikiwa', 'OTP imetumwa kwenye simu yako');
      setAuthMode('otp');
    } catch (error) {
      Alert.alert('Kosa', error.response?.data?.detail || 'Imeshindikana kutuma OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp) {
      Alert.alert('Kosa', 'Tafadhali weka OTP');
      return;
    }
    setLoading(true);
    try {
      const response = await authAPI.verifyOTP(phone, otp);
      if (response.data?.token) {
        await login(response.data.token, response.data.user);
        Alert.alert('Karibu!', 'Umefanikiwa kuingia', [
          { text: 'Sawa', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (error) {
      Alert.alert('Kosa', error.response?.data?.detail || 'OTP si sahihi');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Kosa', 'Tafadhali weka email');
      return;
    }
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      Alert.alert('Imefanikiwa', 'OTP imetumwa kwenye email yako');
      setAuthMode('forgot-otp');
    } catch (error) {
      Alert.alert('Kosa', error.response?.data?.detail || 'Imeshindikana kutuma OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp || !newPassword) {
      Alert.alert('Kosa', 'Tafadhali jaza OTP na password mpya');
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword(email, otp, newPassword);
      Alert.alert('Imefanikiwa', 'Password imebadilishwa. Ingia tena.');
      setAuthMode('login');
      setOtp('');
      setNewPassword('');
    } catch (error) {
      Alert.alert('Kosa', error.response?.data?.detail || 'Imeshindikana kubadilisha password');
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    switch (authMode) {
      case 'register':
        return (
          <>
            <Text style={styles.title}>Fungua Akaunti</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Jina lako"
                placeholderTextColor={COLORS.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={COLORS.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Thibitisha Password"
                placeholderTextColor={COLORS.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Sajili</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAuthMode('login')}>
              <Text style={styles.linkText}>Una akaunti? Ingia</Text>
            </TouchableOpacity>
          </>
        );

      case 'phone':
        return (
          <>
            <Text style={styles.title}>Ingia na Simu</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Nambari ya simu (07...)"
                placeholderTextColor={COLORS.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSendOTP} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Tuma OTP</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAuthMode('login')}>
              <Text style={styles.linkText}>Ingia na Email</Text>
            </TouchableOpacity>
          </>
        );

      case 'otp':
        return (
          <>
            <Text style={styles.title}>Weka OTP</Text>
            <Text style={styles.subtitle}>Tumetuma OTP kwenye {phone}</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="keypad-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Weka OTP"
                placeholderTextColor={COLORS.textSecondary}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOTP} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Thibitisha</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAuthMode('phone')}>
              <Text style={styles.linkText}>Rudi nyuma</Text>
            </TouchableOpacity>
          </>
        );

      case 'forgot':
        return (
          <>
            <Text style={styles.title}>Umesahau Password?</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Email yako"
                placeholderTextColor={COLORS.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={handleForgotPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Tuma OTP</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAuthMode('login')}>
              <Text style={styles.linkText}>Rudi kwenye Login</Text>
            </TouchableOpacity>
          </>
        );

      case 'forgot-otp':
      case 'reset':
        return (
          <>
            <Text style={styles.title}>Badilisha Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="keypad-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="OTP"
                placeholderTextColor={COLORS.textSecondary}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={styles.input}
                placeholder="Password mpya"
                placeholderTextColor={COLORS.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
              />
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={handleResetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Badilisha</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAuthMode('login')}>
              <Text style={styles.linkText}>Rudi kwenye Login</Text>
            </TouchableOpacity>
          </>
        );

      default: // login
        return (
          <>
            <Text style={styles.title}>Karibu Tena!</Text>
            
            {/* Email/Password Login - Only show if enabled */}
            {authMethods.email_password && (
              <>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={COLORS.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={COLORS.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setAuthMode('forgot')}>
                  <Text style={styles.forgotText}>Umesahau password?</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Ingia</Text>}
                </TouchableOpacity>
              </>
            )}
            
            {/* Divider - Show if there are multiple methods */}
            {authMethods.email_password && (authMethods.google || authMethods.phone) && (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>au</Text>
                <View style={styles.dividerLine} />
              </View>
            )}
            
            {/* Google Login - Only show if enabled */}
            {authMethods.google && (
              <TouchableOpacity 
                style={styles.googleButton} 
                onPress={handleGoogleLogin} 
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#fff" />
                    <Text style={styles.googleButtonText}>Ingia na Google</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            
            {/* Phone Login - Only show if enabled */}
            {authMethods.phone && (
              <TouchableOpacity style={styles.phoneButton} onPress={() => setAuthMode('phone')}>
                <Ionicons name="call-outline" size={20} color={COLORS.primary} />
                <Text style={styles.phoneButtonText}>Ingia na Simu</Text>
              </TouchableOpacity>
            )}
            
            {/* Registration Link - Only show if registration enabled */}
            {authMethods.registration_enabled && (
              <TouchableOpacity onPress={() => setAuthMode('register')}>
                <Text style={styles.linkText}>Huna akaunti? Sajili sasa</Text>
              </TouchableOpacity>
            )}
            
            {/* No login methods warning */}
            {!authMethods.email_password && !authMethods.google && !authMethods.phone && (
              <View style={styles.noMethodsWarning}>
                <Ionicons name="warning-outline" size={24} color="#f59e0b" />
                <Text style={styles.noMethodsText}>Hakuna njia ya kuingia inayopatikana kwa sasa</Text>
              </View>
            )}
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']}
        style={StyleSheet.absoluteFill}
      />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/gracefy-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Gracefy</Text>
          </View>
          
          <View style={styles.formContainer}>
            {renderForm()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  scrollContent: {
    flexGrow: 1,
    padding: SPACING.lg,
  },
  backButton: {
    marginBottom: SPACING.md,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  formContainer: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    height: 50,
    color: '#fff',
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.md,
  },
  forgotText: {
    color: COLORS.primary,
    textAlign: 'right',
    marginBottom: SPACING.lg,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dividerText: {
    color: COLORS.textSecondary,
    marginHorizontal: SPACING.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#db4437',
    borderRadius: BORDER_RADIUS.md,
    height: 50,
    marginBottom: SPACING.md,
    gap: 10,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 50,
    marginBottom: SPACING.lg,
    gap: 10,
  },
  phoneButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  linkText: {
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  noMethodsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    gap: 10,
  },
  noMethodsText: {
    color: '#f59e0b',
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    flex: 1,
  },
});

export default LoginScreen;
