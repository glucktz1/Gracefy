/**
 * Firebase Login Screen for Gracefy
 * Provides Email/Password and Google Sign-In via Firebase Auth
 */

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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';

// Firebase imports
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { firebaseConfig } from '../config/firebase';
import { initializeApp, getApps, getApp } from 'firebase/app';
import * as SecureStore from 'expo-secure-store';
import { firebaseAuthAPI, authAPI } from '../services/api';

// Complete any pending auth sessions
WebBrowser.maybeCompleteAuthSession();

// Initialize Firebase
let firebaseApp;
try {
  firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
} catch (error) {
  console.log('Firebase init error:', error);
}

const auth = getAuth(firebaseApp);

const FirebaseLoginScreen = ({ navigation }) => {
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
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

  // Google Sign-In with Expo Auth Session
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: '478977168051-8iat7t5rgqkqmr8ra1ufqlbd6pcqsl8p.apps.googleusercontent.com',
    webClientId: '478977168051-701oerhk4inc4fk1tgf7iu67qkbq1mso.apps.googleusercontent.com',
    expoClientId: '478977168051-701oerhk4inc4fk1tgf7iu67qkbq1mso.apps.googleusercontent.com',
  });

  // Fetch available auth methods on mount
  useEffect(() => {
    const fetchAuthMethods = async () => {
      try {
        const response = await authAPI.getAuthMethods();
        if (response.data) {
          setAuthMethods(response.data);
        }
      } catch (error) {
        console.log('Using default auth methods');
      }
    };
    fetchAuthMethods();
  }, []);

  // Handle Google Sign-In response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleCredential(id_token);
    }
  }, [response]);

  const handleGoogleCredential = async (idToken) => {
    setGoogleLoading(true);
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      await syncWithBackend(userCredential.user);
    } catch (error) {
      console.error('Google sign-in error:', error);
      Alert.alert('Kosa', 'Imeshindikana kuingia na Google. Jaribu tena.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const syncWithBackend = async (firebaseUser) => {
    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await firebaseAuthAPI.verifyToken(idToken);
      
      if (response.data?.success) {
        const { token, user } = response.data;
        await SecureStore.setItemAsync('auth_token', token);
        await SecureStore.setItemAsync('user_data', JSON.stringify(user));
        
        Alert.alert('Karibu!', 'Umefanikiwa kuingia', [
          { text: 'Sawa', onPress: () => navigation.goBack() }
        ]);
      } else {
        throw new Error('Backend sync failed');
      }
    } catch (error) {
      console.error('Backend sync error:', error);
      Alert.alert('Kosa', 'Imeshindikana kusawazisha. Jaribu tena.');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Kosa', 'Tafadhali jaza email na password');
      return;
    }
    
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await syncWithBackend(userCredential.user);
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Imeshindikana kuingia';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Akaunti haijapatikana. Jisajili kwanza.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Password si sahihi';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email si sahihi';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Majaribio mengi sana. Jaribu baadaye.';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Email au password si sahihi';
      }
      
      Alert.alert('Kosa', errorMessage);
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
    if (password.length < 6) {
      Alert.alert('Kosa', 'Password lazima iwe na herufi 6 au zaidi');
      return;
    }
    
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name
      await updateProfile(userCredential.user, { displayName: name });
      
      await syncWithBackend(userCredential.user);
    } catch (error) {
      console.error('Register error:', error);
      let errorMessage = 'Imeshindikana kusajili';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Email imetumika tayari. Ingia badala yake.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password ni dhaifu sana';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email si sahihi';
      }
      
      Alert.alert('Kosa', errorMessage);
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
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        'Imefanikiwa', 
        'Link ya kubadilisha password imetumwa kwenye email yako.',
        [{ text: 'Sawa', onPress: () => setAuthMode('login') }]
      );
    } catch (error) {
      console.error('Reset password error:', error);
      let errorMessage = 'Imeshindikana kutuma email';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Email haijapatikana';
      }
      
      Alert.alert('Kosa', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch (error) {
      console.error('Google prompt error:', error);
      Alert.alert('Kosa', 'Imeshindikana kufungua Google login');
    } finally {
      setGoogleLoading(false);
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

      case 'forgot':
        return (
          <>
            <Text style={styles.title}>Umesahau Password?</Text>
            <Text style={styles.subtitle}>Weka email yako kupokea link ya kubadilisha password</Text>
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
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Tuma Link</Text>}
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
            
            {/* Email/Password Login */}
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
            
            {/* Divider */}
            {authMethods.email_password && authMethods.google && (
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>au</Text>
                <View style={styles.dividerLine} />
              </View>
            )}
            
            {/* Google Login */}
            {authMethods.google && (
              <TouchableOpacity 
                style={styles.googleButton} 
                onPress={handleGoogleLogin} 
                disabled={googleLoading || !request}
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
            
            {/* Registration Link */}
            {authMethods.registration_enabled && (
              <TouchableOpacity onPress={() => setAuthMode('register')}>
                <Text style={styles.linkText}>Huna akaunti? Sajili sasa</Text>
              </TouchableOpacity>
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
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/gracefy-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>Gracefy</Text>
          </View>
          
          <View style={styles.formContainer}>
            {renderForm()}
          </View>
          
          {/* Firebase Badge */}
          <View style={styles.firebaseBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#4CAF50" />
            <Text style={styles.firebaseBadgeText}>Powered by Firebase</Text>
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
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  linkText: {
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  firebaseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xl,
    opacity: 0.6,
  },
  firebaseBadgeText: {
    color: '#4CAF50',
    fontSize: 12,
    marginLeft: 4,
  },
});

export default FirebaseLoginScreen;
