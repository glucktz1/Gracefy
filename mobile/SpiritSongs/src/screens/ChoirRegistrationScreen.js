/**
 * Choir Registration Screen
 * Allows choirs/artists/bands to register through the mobile app
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { COLORS, API_URL } from '../config';

const ACCOUNT_TYPES = [
  { id: 'choir', name: 'Choir', icon: 'people', description: 'Church choirs and vocal groups' },
  { id: 'artist', name: 'Solo Artist', icon: 'mic', description: 'Individual singers and musicians' },
  { id: 'band', name: 'Band/Group', icon: 'musical-notes', description: 'Music bands and ensembles' },
];

export default function ChoirRegistrationScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    type: 'choir',
    description: '',
  });
  
  const [errors, setErrors] = useState({});

  const validateStep1 = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (form.phone && !/^\+?[0-9]{9,15}$/.test(form.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Invalid phone format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!form.password) newErrors.password = 'Password is required';
    else if (form.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!form.type) newErrors.type = 'Please select your account type';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/choir/register`, {
        name: form.name,
        email: form.email,
        phone: form.phone || null,
        password: form.password,
        type: form.type,
        description: form.description,
      });
      setSuccess(true);
    } catch (error) {
      const msg = error.response?.data?.detail || 'Registration failed. Please try again.';
      Alert.alert('Registration Failed', msg);
      if (msg.includes('already registered')) {
        setErrors({ email: msg });
        setStep(1);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Success Screen
  if (success) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1e3a5f', '#121212', '#121212']}
          style={styles.gradient}
        >
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={80} color={COLORS.primary} />
            </View>
            <Text style={styles.successTitle}>Registration Submitted!</Text>
            <Text style={styles.successText}>
              Your application has been received. Our team will review it and get back to you within 2-3 business days.
            </Text>
            <Text style={styles.successNote}>
              You'll receive an email notification once your account is approved.
            </Text>
            <TouchableOpacity 
              style={styles.doneBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

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
              style={styles.backBtn}
              onPress={step > 1 ? handleBack : () => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Join as Creator</Text>
              <Text style={styles.headerSubtitle}>Step {step} of 2</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${step * 50}%` }]} />
          </View>

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <Ionicons name="person-circle-outline" size={48} color={COLORS.primary} />
                <Text style={styles.stepTitle}>Basic Information</Text>
                <Text style={styles.stepSubtitle}>Tell us about yourself or your group</Text>
              </View>

              {/* Name Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Name / Group Name *</Text>
                <View style={[styles.inputWrapper, errors.name && styles.inputError]}>
                  <Ionicons name="people-outline" size={20} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your name or group name"
                    placeholderTextColor={COLORS.textMuted}
                    value={form.name}
                    onChangeText={(val) => updateForm('name', val)}
                  />
                </View>
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address *</Text>
                <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
                  <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor={COLORS.textMuted}
                    value={form.email}
                    onChangeText={(val) => updateForm('email', val)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              {/* Phone Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number (Optional)</Text>
                <View style={[styles.inputWrapper, errors.phone && styles.inputError]}>
                  <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your phone number"
                    placeholderTextColor={COLORS.textMuted}
                    value={form.phone}
                    onChangeText={(val) => updateForm('phone', val)}
                    keyboardType="phone-pad"
                  />
                </View>
                {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
              </View>

              <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#000" />
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Account Type & Password */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeader}>
                <Ionicons name="shield-checkmark-outline" size={48} color={COLORS.primary} />
                <Text style={styles.stepTitle}>Account Setup</Text>
                <Text style={styles.stepSubtitle}>Choose your account type and set your password</Text>
              </View>

              {/* Account Type Selection */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Account Type *</Text>
                <View style={styles.typeGrid}>
                  {ACCOUNT_TYPES.map(type => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.typeCard,
                        form.type === type.id && styles.typeCardSelected
                      ]}
                      onPress={() => updateForm('type', type.id)}
                    >
                      <Ionicons 
                        name={type.icon} 
                        size={28} 
                        color={form.type === type.id ? COLORS.primary : COLORS.textSecondary} 
                      />
                      <Text style={[
                        styles.typeCardTitle,
                        form.type === type.id && styles.typeCardTitleSelected
                      ]}>
                        {type.name}
                      </Text>
                      <Text style={styles.typeCardDesc}>{type.description}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Tell us about yourself (Optional)</Text>
                <View style={styles.textAreaWrapper}>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Describe your music, ministry, or background..."
                    placeholderTextColor={COLORS.textMuted}
                    value={form.description}
                    onChangeText={(val) => updateForm('description', val)}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password *</Text>
                <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                  <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Create a password (min 6 characters)"
                    placeholderTextColor={COLORS.textMuted}
                    value={form.password}
                    onChangeText={(val) => updateForm('password', val)}
                    secureTextEntry
                  />
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm Password *</Text>
                <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
                  <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    placeholderTextColor={COLORS.textMuted}
                    value={form.confirmPassword}
                    onChangeText={(val) => updateForm('confirmPassword', val)}
                    secureTextEntry
                  />
                </View>
                {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
              </View>

              <TouchableOpacity 
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Submit Application</Text>
                    <Ionicons name="checkmark-circle" size={20} color="#000" />
                  </>
                )}
              </TouchableOpacity>

              {/* Terms Notice */}
              <Text style={styles.termsText}>
                By submitting, you agree to our Terms of Service and confirm that you have the rights to upload and distribute your music on Spirit Songs.
              </Text>
            </View>
          )}
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
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 24,
    borderRadius: 2,
    marginBottom: 24,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  stepContainer: {
    paddingHorizontal: 24,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  stepSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  textAreaWrapper: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    color: COLORS.textPrimary,
    fontSize: 16,
    padding: 16,
    minHeight: 100,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    paddingVertical: 16,
    marginTop: 16,
    gap: 8,
  },
  nextBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  typeGrid: {
    gap: 12,
  },
  typeCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  typeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  typeCardTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  typeCardTitleSelected: {
    color: COLORS.primary,
  },
  typeCardDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
    position: 'absolute',
    bottom: 8,
    left: 60,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    paddingVertical: 16,
    marginTop: 16,
    gap: 8,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  termsText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  // Success Screen
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  successText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  successNote: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  doneBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
