import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../config';

export default function LoginScreen({ navigation }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' or 'phone'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();

  const handleSubmit = async () => {
    // Validation
    if (mode === 'register' && !name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }
    
    if (loginMethod === 'email' && !email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    
    if (loginMethod === 'phone' && !phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }
    
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(
          loginMethod === 'email' ? email : null,
          loginMethod === 'phone' ? phone : null,
          password
        );
      } else {
        await register(
          name,
          loginMethod === 'email' ? email : null,
          loginMethod === 'phone' ? phone : null,
          password
        );
      }
      navigation.goBack();
    } catch (error) {
      console.error('Auth error:', error);
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#1e3a5f', '#121212', '#121212']}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.closeBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Logo */}
          <View style={styles.logoContainer}>
            <LinearGradient 
              colors={[COLORS.primary, '#065f46']} 
              style={styles.logo}
            >
              <Ionicons name="musical-notes" size={40} color="#fff" />
            </LinearGradient>
            <Text style={styles.appName}>Spirit Songs</Text>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity 
              style={[styles.modeBtn, mode === 'login' && styles.modeBtnActive]}
              onPress={() => setMode('login')}
            >
              <Text style={[styles.modeBtnText, mode === 'login' && styles.modeBtnTextActive]}>
                Log In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modeBtn, mode === 'register' && styles.modeBtnActive]}
              onPress={() => setMode('register')}
            >
              <Text style={[styles.modeBtnText, mode === 'register' && styles.modeBtnTextActive]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name (for registration) */}
            {mode === 'register' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor={COLORS.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            {/* Login Method Toggle */}
            <View style={styles.methodToggle}>
              <TouchableOpacity 
                style={[styles.methodBtn, loginMethod === 'email' && styles.methodBtnActive]}
                onPress={() => setLoginMethod('email')}
              >
                <Ionicons 
                  name="mail-outline" 
                  size={18} 
                  color={loginMethod === 'email' ? COLORS.primary : COLORS.textSecondary} 
                />
                <Text style={[styles.methodBtnText, loginMethod === 'email' && styles.methodBtnTextActive]}>
                  Email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.methodBtn, loginMethod === 'phone' && styles.methodBtnActive]}
                onPress={() => setLoginMethod('phone')}
              >
                <Ionicons 
                  name="call-outline" 
                  size={18} 
                  color={loginMethod === 'phone' ? COLORS.primary : COLORS.textSecondary} 
                />
                <Text style={[styles.methodBtnText, loginMethod === 'phone' && styles.methodBtnTextActive]}>
                  Phone
                </Text>
              </TouchableOpacity>
            </View>

            {/* Email or Phone */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>
                {loginMethod === 'email' ? 'Email' : 'Phone'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={loginMethod === 'email' ? 'Enter your email' : 'Enter your phone number'}
                placeholderTextColor={COLORS.textMuted}
                value={loginMethod === 'email' ? email : phone}
                onChangeText={loginMethod === 'email' ? setEmail : setPhone}
                keyboardType={loginMethod === 'email' ? 'email-address' : 'phone-pad'}
                autoCapitalize="none"
              />
            </View>

            {/* Password */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity 
                  style={styles.showPasswordBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                    size={22} 
                    color={COLORS.textSecondary} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {mode === 'login' ? 'Log In' : 'Sign Up'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login */}
            <TouchableOpacity style={styles.socialBtn}>
              <Ionicons name="logo-google" size={20} color={COLORS.textPrimary} />
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    paddingTop: 48,
    alignItems: 'flex-start',
  },
  closeBtn: {
    padding: 4,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeBtnActive: {
    backgroundColor: COLORS.backgroundLight,
  },
  modeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: COLORS.textPrimary,
  },
  form: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 8,
    padding: 16,
    color: COLORS.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  showPasswordBtn: {
    padding: 16,
  },
  methodToggle: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  methodBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  methodBtnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  methodBtnTextActive: {
    color: COLORS.primary,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginHorizontal: 16,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingVertical: 14,
    gap: 12,
  },
  socialBtnText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 18,
  },
});
