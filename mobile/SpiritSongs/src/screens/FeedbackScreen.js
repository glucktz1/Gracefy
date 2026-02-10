import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { feedbackAPI } from '../services/api';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

const FEEDBACK_TYPES = [
  { id: 'bug_report', label: 'Bug Report', icon: 'bug', color: '#ef4444' },
  { id: 'feature_request', label: 'Feature Request', icon: 'bulb', color: '#eab308' },
  { id: 'general', label: 'General Feedback', icon: 'chatbubble', color: '#3b82f6' },
  { id: 'complaint', label: 'Complaint', icon: 'warning', color: '#f97316' },
  { id: 'praise', label: 'Praise', icon: 'heart', color: '#22c55e' },
];

const CATEGORIES = [
  { id: 'app', label: 'App General' },
  { id: 'music', label: 'Music & Playback' },
  { id: 'bible', label: 'Bible & Teachings' },
  { id: 'payment', label: 'Payments & Subscription' },
  { id: 'account', label: 'Account & Profile' },
  { id: 'other', label: 'Other' },
];

export default function FeedbackScreen({ navigation }) {
  const [selectedType, setSelectedType] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getDeviceInfo = () => {
    return `${Device.brand} ${Device.modelName} | ${Platform.OS} ${Platform.Version}`;
  };

  const getAppVersion = () => {
    return Constants.expoConfig?.version || '1.0.0';
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedType) {
      Alert.alert('Required', 'Please select a feedback type');
      return;
    }
    if (!subject.trim()) {
      Alert.alert('Required', 'Please enter a subject');
      return;
    }
    if (!message.trim() || message.length < 10) {
      Alert.alert('Required', 'Please enter a detailed message (at least 10 characters)');
      return;
    }

    setSubmitting(true);
    try {
      const feedbackData = {
        type: selectedType,
        subject: subject.trim(),
        message: message.trim(),
        category: selectedCategory,
        device_info: getDeviceInfo(),
        app_version: getAppVersion(),
        contact_email: email.trim() || null,
      };

      const response = await feedbackAPI.submit(feedbackData);
      
      if (response.data.success) {
        Alert.alert(
          'Thank You!',
          'Your feedback has been submitted successfully. We appreciate your input!',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Feedback</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Feedback Type Selection */}
          <Text style={styles.sectionTitle}>What type of feedback?</Text>
          <View style={styles.typeGrid}>
            {FEEDBACK_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[
                  styles.typeCard,
                  selectedType === type.id && { borderColor: type.color, borderWidth: 2 }
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <Ionicons name={type.icon} size={24} color={type.color} />
                <Text style={styles.typeLabel}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Category Selection */}
          <Text style={styles.sectionTitle}>Category (Optional)</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.id && styles.categoryChipSelected
                ]}
                onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              >
                <Text style={[
                  styles.categoryChipText,
                  selectedCategory === cat.id && styles.categoryChipTextSelected
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Subject Input */}
          <Text style={styles.sectionTitle}>Subject *</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief summary of your feedback"
            placeholderTextColor="#666"
            value={subject}
            onChangeText={setSubject}
            maxLength={200}
          />

          {/* Message Input */}
          <Text style={styles.sectionTitle}>Message *</Text>
          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder="Please describe your feedback in detail..."
            placeholderTextColor="#666"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={5000}
          />
          <Text style={styles.charCount}>{message.length}/5000</Text>

          {/* Email Input */}
          <Text style={styles.sectionTitle}>Email (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com (for follow-up)"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Device Info */}
          <View style={styles.deviceInfo}>
            <Ionicons name="phone-portrait-outline" size={16} color="#666" />
            <Text style={styles.deviceInfoText}>
              {getDeviceInfo()} • App v{getAppVersion()}
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Feedback</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
    marginTop: 16,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeCard: {
    width: '31%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeLabel: {
    fontSize: 11,
    color: '#fff',
    marginTop: 6,
    textAlign: 'center',
  },
  categoryScroll: {
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#8b5cf6',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  categoryChipTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  messageInput: {
    minHeight: 120,
    paddingTop: 14,
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  deviceInfoText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
