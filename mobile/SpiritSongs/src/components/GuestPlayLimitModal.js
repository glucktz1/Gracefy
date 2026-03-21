/**
 * GuestPlayLimitModal - Prompts guest users to login
 * 
 * Triggers:
 * - After 3 songs played
 * - After 3 songs skipped
 * - After 10 minutes of listening
 * 
 * Behavior:
 * - Title: "Ingia ili kuendelea"
 * - Message: "Kuendelea kufurahia kusikiliza kwa uhuru. Jiandikishe (register) au Ingia kama tayari ulishajiandikisha."
 * - After 3 dismissals: Lock app - must sign in
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Image,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { authAPI, API_BASE_URL } from '../services/api';

const GuestPlayLimitModal = ({ visible, onClose, onSuccess }) => {
  const [mode, setMode] = useState('main'); // 'main', 'login', 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [supportEmail, setSupportEmail] = useState('support@gracefy.life');

  const { 
    login, 
    isAppLocked, 
    loginPromptMessage, 
    promptAttempts,
    guestPlayCount,
    guestSkipCount,
    guestListenMinutes
  } = useAuth();

  // Fetch support email from admin settings
  useEffect(() => {
    const fetchSupportEmail = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/admin/settings`);
        const data = await response.json();
        if (data?.support_email) {
          setSupportEmail(data.support_email);
        }
      } catch (error) {
        console.log('Using default support email');
      }
    };
    fetchSupportEmail();
  }, []);

  // Handle Google Sign-In using Emergent Auth (same as LoginScreen)
  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setError('');
      
      // Mobile deep link for callback
      const mobileRedirect = 'gracefy://auth';
      
      // Backend callback URL that will handle the OAuth response and redirect to mobile app
      const backendCallback = `${API_BASE_URL}/user/auth/google-callback?mobile_redirect=${encodeURIComponent(mobileRedirect)}`;
      
      // Open Google OAuth flow using Emergent Auth
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(backendCallback)}`;
      
      console.log('[GuestModal] Opening Google Auth URL:', authUrl);
      
      // Use Linking.openURL to open in external browser
      // This avoids WebView issues with Google account picker
      const canOpen = await Linking.canOpenURL(authUrl);
      if (canOpen) {
        await Linking.openURL(authUrl);
        // The user will be redirected back via the gracefy:// deep link
        // The deep link handler in App.js will complete the login
        // Note: Don't close the modal here - let the deep link handler close it after successful auth
      } else {
        setError('Imeshindikana kufungua browser.');
      }
    } catch (error) {
      console.error('[GuestModal] Google login error:', error);
      setError('Imeshindikana kufungua Google login. Jaribu tena baadaye.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError('Tafadhali jaza email na password');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await authAPI.login(email, password);
      
      if (response.data?.token) {
        // Clear form first
        setEmail('');
        setPassword('');
        setMode('main');
        
        // Then login
        await login(response.data.token, response.data.user);
        
        // Notify success and close
        onSuccess?.();
        onClose();
      } else {
        setError('Jibu halikuwa sahihi. Jaribu tena.');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Email au password si sahihi';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Tafadhali jaza jina, email na password');
      return;
    }
    if (password !== confirmPassword) {
      setError('Password hazifanani');
      return;
    }
    if (password.length < 6) {
      setError('Password iwe na herufi 6 au zaidi');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await authAPI.register({ email, password, name });
      
      if (response.data?.token) {
        // Clear form first
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setMode('main');
        
        // Then login
        await login(response.data.token, response.data.user);
        
        // Notify success and close
        onSuccess?.();
        onClose();
      } else {
        setError('Jibu halikuwa sahihi. Jaribu tena.');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || 'Imeshindikana kuunda akaunti';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const openChoirPortal = () => {
    Linking.openURL(`${API_BASE_URL.replace('/api', '')}/choir-login`);
  };

  const openChoirRegister = () => {
    Linking.openURL(`${API_BASE_URL.replace('/api', '')}/choir-register`);
  };

  // Get display message based on state - improved Swahili text
  const getDisplayMessage = () => {
    if (loginPromptMessage) {
      return loginPromptMessage;
    }
    return 'Kuendelea kufurahia kusikiliza kwa uhuru. Jiandikishe (register) au Ingia kama tayari ulishajiandikisha.';
  };

  // Get stats message
  const getStatsMessage = () => {
    const parts = [];
    if (guestPlayCount > 0) parts.push(`nyimbo ${guestPlayCount}`);
    if (guestSkipCount > 0) parts.push(`skip ${guestSkipCount}`);
    if (guestListenMinutes >= 1) parts.push(`dakika ${Math.floor(guestListenMinutes)}`);
    
    if (parts.length === 0) return null;
    return `Umesikiliza ${parts.join(', ')} bure`;
  };

  const renderMainContent = () => (
    <>
      {/* Logo */}
      <View style={styles.illustrationContainer}>
        <Image
          source={{ uri: 'https://gracefy-cdn.b-cdn.net/branding/icon_6d883800.png' }}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      {/* Title */}
      <Text style={[styles.title, isAppLocked && styles.lockedTitle]}>
        {isAppLocked ? 'Tafadhali Ingia Sasa' : 'Ingia ili kuendelea'}
      </Text>
      
      {/* Main Message */}
      <Text style={styles.message}>
        {getDisplayMessage()}
      </Text>

      {/* Stats Message */}
      {getStatsMessage() && (
        <Text style={styles.statsMessage}>
          {getStatsMessage()}
        </Text>
      )}

      {/* Benefits */}
      {!isAppLocked && (
        <View style={styles.benefitsContainer}>
          <View style={styles.benefitItem}>
            <Ionicons name="infinite" size={20} color={COLORS.primary} />
            <Text style={styles.benefitText}>Sikiliza bila kikomo</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="heart" size={20} color="#E74C3C" />
            <Text style={styles.benefitText}>Hifadhi nyimbo unazopenda</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="list" size={20} color="#9B59B6" />
            <Text style={styles.benefitText}>Tengeneza playlist zako</Text>
          </View>
        </View>
      )}

      {/* Google Login Button */}
      <TouchableOpacity
        style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
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

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>au</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Email Login / Register Buttons */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setMode('login')}
      >
        <Ionicons name="mail" size={20} color={COLORS.background} />
        <Text style={styles.primaryButtonText}>Ingia na Email</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setMode('register')}
      >
        <Text style={styles.secondaryButtonText}>Sina akaunti? Jisajili</Text>
      </TouchableOpacity>

      {/* Skip button - only if not locked */}
      {!isAppLocked && (
        <TouchableOpacity style={styles.skipButton} onPress={onClose}>
          <Text style={styles.skipButtonText}>
            Baadaye ({3 - promptAttempts} {promptAttempts === 2 ? 'mara iliyobaki' : 'mara zilizobaki'})
          </Text>
        </TouchableOpacity>
      )}

      {/* Lock warning with help text */}
      {isAppLocked && (
        <View style={styles.lockWarning}>
          <Text style={styles.lockWarningText}>
            Ingia ili kuendelea kutumia app
          </Text>
          <Text style={styles.helpText}>
            Una tatizo? Wasiliana nasi:{'\n'}{supportEmail}
          </Text>
        </View>
      )}
    </>
  );

  const renderLoginForm = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={() => { setMode('main'); setError(''); }}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <Text style={styles.formTitle}>Ingia</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={handleEmailLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.primaryButtonText}>Ingia</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.switchModeButton} onPress={() => { setMode('register'); setError(''); }}>
        <Text style={styles.switchModeText}>Sina akaunti? <Text style={styles.switchModeLink}>Jisajili</Text></Text>
      </TouchableOpacity>
    </>
  );

  const renderRegisterForm = () => (
    <>
      <TouchableOpacity style={styles.backButton} onPress={() => { setMode('main'); setError(''); }}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <Text style={styles.formTitle}>Jisajili</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.inputContainer}>
        <Ionicons name="person-outline" size={20} color={COLORS.textSecondary} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Jina lako"
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
          <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.primaryButtonText}>Jisajili</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.switchModeButton} onPress={() => { setMode('login'); setError(''); }}>
        <Text style={styles.switchModeText}>Una akaunti? <Text style={styles.switchModeLink}>Ingia</Text></Text>
      </TouchableOpacity>
    </>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isAppLocked ? undefined : onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.modalContainer}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {mode === 'main' && renderMainContent()}
              {mode === 'login' && renderLoginForm()}
              {mode === 'register' && renderRegisterForm()}

              {/* Choir Portal Link - Always visible */}
              <View style={styles.choirSection}>
                <View style={styles.choirDivider} />
                <Text style={styles.choirTitle}>Una kwaya?</Text>
                <View style={styles.choirButtons}>
                  <TouchableOpacity style={styles.choirButton} onPress={openChoirPortal}>
                    <Ionicons name="log-in-outline" size={18} color="#10B981" />
                    <Text style={styles.choirButtonText}>Ingia Choir Portal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.choirButton} onPress={openChoirRegister}>
                    <Ionicons name="person-add-outline" size={18} color="#10B981" />
                    <Text style={styles.choirButtonText}>Sajili Kwaya</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  keyboardView: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  scrollContent: {
    padding: SPACING.xl,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 20,
  },
  illustrationGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  lockedTitle: {
    color: '#E74C3C',
  },
  message: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  statsMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    fontStyle: 'italic',
  },
  benefitsContainer: {
    marginBottom: SPACING.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  benefitText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  googleButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SPACING.md,
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
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.md,
  },
  primaryButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.background,
    marginLeft: SPACING.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  secondaryButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '500',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  skipButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  lockWarning: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderRadius: BORDER_RADIUS.md,
  },
  lockWarningText: {
    fontSize: FONT_SIZES.sm,
    color: '#E74C3C',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  helpText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: SPACING.sm,
    zIndex: 10,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
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
  input: {
    flex: 1,
    height: 50,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: '#E74C3C',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  switchModeButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  switchModeText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  switchModeLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  choirSection: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
  },
  choirDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  choirTitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  choirButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  choirButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  choirButtonText: {
    fontSize: FONT_SIZES.sm,
    color: '#10B981',
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
});

export default GuestPlayLimitModal;
