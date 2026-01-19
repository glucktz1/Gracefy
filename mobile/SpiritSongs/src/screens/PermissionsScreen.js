import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as SecureStore from 'expo-secure-store';

const PERMISSIONS_CHECKED_KEY = 'permissions_setup_complete';

const PermissionsScreen = ({ onComplete }) => {
  const [storageGranted, setStorageGranted] = useState(false);
  const [mediaGranted, setMediaGranted] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkExistingPermissions();
  }, []);

  const checkExistingPermissions = async () => {
    try {
      // Check if we've already completed setup
      const setupComplete = await SecureStore.getItemAsync(PERMISSIONS_CHECKED_KEY);
      if (setupComplete === 'true') {
        onComplete();
        return;
      }

      // Check media library permission
      const { status } = await MediaLibrary.getPermissionsAsync();
      if (status === 'granted') {
        setMediaGranted(true);
        setStorageGranted(true);
      }
    } catch (e) {
      console.log('Error checking permissions:', e);
    } finally {
      setChecking(false);
    }
  };

  const requestPermissions = async () => {
    try {
      // Request media library permission (includes storage on Android)
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status === 'granted') {
        setMediaGranted(true);
        setStorageGranted(true);
        
        // Mark setup as complete
        await SecureStore.setItemAsync(PERMISSIONS_CHECKED_KEY, 'true');
        
        // Continue to app
        setTimeout(() => {
          onComplete();
        }, 500);
      } else {
        Alert.alert(
          'Permission Required',
          'Storage permission is needed to download songs for offline listening. You can enable it later in Settings.',
          [
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
            {
              text: 'Skip for Now',
              style: 'cancel',
              onPress: async () => {
                await SecureStore.setItemAsync(PERMISSIONS_CHECKED_KEY, 'true');
                onComplete();
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Could not request permissions. Please try again.');
    }
  };

  const skipPermissions = async () => {
    await SecureStore.setItemAsync(PERMISSIONS_CHECKED_KEY, 'true');
    onComplete();
  };

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="musical-notes" size={48} color="#10b981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="musical-notes" size={48} color="#10b981" />
          </View>
          <Text style={styles.appName}>Gracefy</Text>
          <Text style={styles.tagline}>Christian Music Streaming</Text>
        </View>

        {/* Permission Cards */}
        <View style={styles.cardsContainer}>
          <Text style={styles.sectionTitle}>App Permissions</Text>
          <Text style={styles.sectionSubtitle}>
            To provide the best experience, Gracefy needs the following permissions:
          </Text>

          {/* Storage Permission */}
          <View style={[styles.permissionCard, storageGranted && styles.permissionCardGranted]}>
            <View style={styles.permissionIcon}>
              <Ionicons 
                name={storageGranted ? "checkmark-circle" : "folder-outline"} 
                size={32} 
                color={storageGranted ? "#10b981" : "#f59e0b"} 
              />
            </View>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Storage Access</Text>
              <Text style={styles.permissionDesc}>
                Required to download songs for offline listening
              </Text>
            </View>
            {storageGranted && (
              <Ionicons name="checkmark" size={24} color="#10b981" />
            )}
          </View>

          {/* Audio Permission Info */}
          <View style={styles.permissionCard}>
            <View style={styles.permissionIcon}>
              <Ionicons name="volume-high-outline" size={32} color="#8b5cf6" />
            </View>
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Background Audio</Text>
              <Text style={styles.permissionDesc}>
                Music continues playing when app is in background
              </Text>
            </View>
            <Ionicons name="checkmark" size={24} color="#10b981" />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={requestPermissions}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Grant Permissions</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={skipPermissions}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Skip for Now</Text>
          </TouchableOpacity>

          <Text style={styles.privacyNote}>
            <Ionicons name="lock-closed" size={12} color="#6b7280" />
            {' '}Your data is secure. We only use permissions for app functionality.
          </Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#9ca3af',
  },
  cardsContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  permissionCardGranted: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  permissionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  permissionDesc: {
    fontSize: 13,
    color: '#9ca3af',
  },
  buttonsContainer: {
    paddingBottom: 32,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  privacyNote: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default PermissionsScreen;
