/**
 * GuestPlayLimitModal - Prompts guest users to login after 3 songs
 * 
 * Features:
 * - Friendly but enforceful prompt
 * - Google login option
 * - Email/password login
 * - Register option
 * - Choir join/login link
 */

import React, { useState } from 'react';
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
  Platform,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { authAPI, API_BASE_URL } from '../services/api';

const GOOGLE_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/google";

const GuestPlayLimitModal = ({ visible, onClose, onSuccess, songsPlayed = 3 }) => {
  const [mode, setMode] = useState('main'); // 'main', 'login', 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      setError('');
      
      const callbackUrl = `${API_BASE_URL}/user/auth/google-callback`;
      const mobileRedirect = Linking.createURL('auth');
      const authUrl = `${GOOGLE_AUTH_URL}?redirect_uri=${encodeURIComponent(callbackUrl)}&mobile_redirect=${encodeURIComponent(mobileRedirect)}&platform=mobile`;
      
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'gracefy://');
      
      if (result.type === 'success' && result.url) {
        const url = result.url;
        let sessionId = null;
        
        try {
          const urlObj = new URL(url.replace('gracefy://', 'https://temp.com/'));
          sessionId = urlObj.searchParams.get('session_id');
        } catch {}
        
        if (!sessionId && url.includes('session_id=')) {
          sessionId = url.split('session_id=')[1]?.split('&')[0]?.split('#')[0];
        }
        
        if (sessionId) {
          const response = await authAPI.googleCallback(sessionId);
          if (response.data?.token) {
            await login(response.data.token, response.data.user);
            onSuccess?.();
            onClose();
          }
        }
      }
    } catch (error) {
      setError('Imeshindikana kuingia na Google. Jaribu tena.');
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
        await login(response.data.token, response.data.user);
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Email au password si sahihi');
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
        await login(response.data.token, response.data.user);
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Imeshindikana kuunda akaunti');
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

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
    setError('');
    setMode('main');
  };

  const renderMainContent = () => (
    <>
      {/* Illustration */}
      <View style={styles.illustrationContainer}>
        <LinearGradient
          colors={['#3498DB', '#1abc9c']}
          style={styles.illustrationGradient}
        >
          <Ionicons name="musical-notes" size={48} color="#fff" />
        </LinearGradient>
      </View>

      {/* Title */}
      <Text style={styles.title}>Unapenda muziki wetu! 🎵</Text>
      
      {/* Message */}
      <Text style={styles.message}>
        Umesikiliza nyimbo {songsPlayed} bure. Ingia au jisajili kuendelea kusikiliza bila kikomo!
      </Text>

      {/* Benefits */}
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

      {/* Skip for now (limited) */}
      <TouchableOpacity style={styles.skipButton} onPress={onClose}>
        <Text style={styles.skipButtonText}>Baadaye</Text>
      </TouchableOpacity>
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
      onRequestClose={onClose}
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
  message: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
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
  // Choir section styles
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
