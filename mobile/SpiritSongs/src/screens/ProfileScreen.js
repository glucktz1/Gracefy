import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import { useBilling } from '../context/BillingContext';
import { useDownloads } from '../context/DownloadContext';
import { userAPI, libraryAPI, billingAPI, getImageUrl } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_KEY = '@gracefy_language';
const THEME_KEY = '@gracefy_theme';

const ProfileScreen = ({ navigation }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { billingEnabled, isPremium, subscription, refreshBilling } = useBilling();
  const { 
    downloadCount, 
    getDownloadedSongs, 
    getTotalDownloadSize,
    clearAllDownloads 
  } = useDownloads();
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    playlists: 0,
    liked_songs: 0,
    downloads: 0,
    following: 0,
  });
  const [downloadSize, setDownloadSize] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState('sw');
  const [currentTheme, setCurrentTheme] = useState('dark');
  const [transactions, setTransactions] = useState([]);

  // Update download stats when downloadCount changes
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      downloads: downloadCount
    }));
    setDownloadSize(getTotalDownloadSize());
  }, [downloadCount, getTotalDownloadSize]);

  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
      loadSettings();
      loadTransactions();
      setEditedName(user?.name || '');
      setEditedPhone(user?.phone || '');
    }
  }, [isAuthenticated, user]);

  const loadSettings = async () => {
    try {
      const [lang, theme] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_KEY),
        AsyncStorage.getItem(THEME_KEY),
      ]);
      if (lang) setCurrentLanguage(lang);
      if (theme) setCurrentTheme(theme);
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  const loadStats = async () => {
    try {
      const [playlistsRes, likesRes] = await Promise.all([
        libraryAPI.getPlaylists().catch(() => ({ data: [] })),
        libraryAPI.getLikedSongs().catch(() => ({ data: [] })),
      ]);
      
      const playlistsData = playlistsRes.data?.playlists || playlistsRes.data || [];
      const likesData = likesRes.data?.songs || likesRes.data || [];
      
      setStats(prev => ({
        playlists: playlistsData.length,
        liked_songs: likesData.length,
        downloads: prev.downloads, // Keep download count from context
        following: 0,
      }));
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    await loadSettings();
    setDownloadSize(getTotalDownloadSize());
    await loadTransactions();
    await refreshBilling();
    setRefreshing(false);
  };

  const loadTransactions = async () => {
    try {
      const res = await billingAPI.getUserTransactions();
      setTransactions(res.data?.transactions || []);
    } catch (error) {
      console.log('Error loading transactions:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('sw-TZ', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('sw-TZ', {
      style: 'currency',
      currency: 'TZS',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleLogout = () => {
    Alert.alert(
      'Toka',
      'Una uhakika unataka kutoka?',
      [
        { text: 'Hapana', style: 'cancel' },
        { 
          text: 'Ndio', 
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.goBack();
          }
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      await userAPI.updateProfile({
        name: editedName,
        phone: editedPhone,
      });
      setEditMode(false);
      Alert.alert('Umefanikiwa', 'Taarifa zimesasishwa');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Kosa', 'Imeshindikana kusasisha taarifa');
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = async () => {
    const newLang = currentLanguage === 'sw' ? 'en' : 'sw';
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, newLang);
      setCurrentLanguage(newLang);
      Alert.alert(
        newLang === 'sw' ? 'Lugha Imebadilishwa' : 'Language Changed',
        newLang === 'sw' 
          ? 'Sasa programu itatumia Kiswahili' 
          : 'App will now use English'
      );
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const handleThemeChange = () => {
    Alert.alert(
      'Mandhari',
      'Chagua mandhari unayopenda',
      [
        { text: 'Giza (Dark)', onPress: () => saveTheme('dark') },
        { text: 'Mwanga (Light)', onPress: () => saveTheme('light') },
        { text: 'Kufuata Mfumo', onPress: () => saveTheme('system') },
        { text: 'Ghairi', style: 'cancel' },
      ]
    );
  };

  const saveTheme = async (theme) => {
    try {
      await AsyncStorage.setItem(THEME_KEY, theme);
      setCurrentTheme(theme);
      Alert.alert('Umefanikiwa', 'Mandhari imebadilishwa');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const handleClearDownloads = () => {
    if (downloadCount === 0) {
      Alert.alert('Hakuna Downloads', 'Huna nyimbo zilizopakuliwa');
      return;
    }
    Alert.alert(
      'Futa Downloads',
      `Una uhakika unataka kufuta nyimbo ${downloadCount} zilizopakuliwa?`,
      [
        { text: 'Hapana', style: 'cancel' },
        { 
          text: 'Futa Zote', 
          style: 'destructive',
          onPress: async () => {
            await clearAllDownloads();
            Alert.alert('Umefanikiwa', 'Downloads zote zimefutwa');
          }
        },
      ]
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getThemeName = () => {
    switch (currentTheme) {
      case 'light': return 'Mwanga';
      case 'system': return 'Mfumo';
      default: return 'Giza';
    }
  };

  // If not authenticated, show login prompt
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Wasifu</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.loginPrompt}>
          <LinearGradient
            colors={[COLORS.primary, '#1ed760']}
            style={styles.loginIcon}
          >
            <Ionicons name="person" size={48} color={COLORS.background} />
          </LinearGradient>
          <Text style={styles.loginTitle}>Karibu Gracefy</Text>
          <Text style={styles.loginSubtitle}>
            Ingia ili kuona wasifu wako, playlist zako, na nyimbo unazopenda
          </Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Ingia / Jisajili</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Wasifu</Text>
          <TouchableOpacity onPress={() => setEditMode(!editMode)}>
            <Ionicons 
              name={editMode ? 'close' : 'create-outline'} 
              size={24} 
              color={COLORS.text} 
            />
          </TouchableOpacity>
        </View>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.avatar ? (
              <Image source={{ uri: getImageUrl(user.avatar) }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[COLORS.primary, '#1ed760']}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
            {editMode && (
              <TouchableOpacity style={styles.avatarEdit}>
                <Ionicons name="camera" size={16} color={COLORS.text} />
              </TouchableOpacity>
            )}
          </View>

          {editMode ? (
            <View style={styles.editForm}>
              <TextInput
                style={styles.editInput}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Jina lako"
                placeholderTextColor={COLORS.textMuted}
              />
              <TextInput
                style={styles.editInput}
                value={editedPhone}
                onChangeText={setEditedPhone}
                placeholder="Nambari ya simu"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
              />
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleSaveProfile}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.background} />
                ) : (
                  <Text style={styles.saveButtonText}>Hifadhi</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.profileName}>{user?.name || 'Mtumiaji'}</Text>
              <Text style={styles.profileEmail}>{user?.email}</Text>
              {user?.phone && (
                <Text style={styles.profilePhone}>{user.phone}</Text>
              )}
            </>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => navigation.navigate('Library', { tab: 'playlists' })}
          >
            <Text style={styles.statNumber}>{stats.playlists}</Text>
            <Text style={styles.statLabel}>Playlists</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => navigation.navigate('Library', { tab: 'liked' })}
          >
            <Text style={styles.statNumber}>{stats.liked_songs}</Text>
            <Text style={styles.statLabel}>Pendwa</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity 
            style={styles.statItem}
            onPress={() => navigation.navigate('Library', { tab: 'downloads' })}
          >
            <Text style={styles.statNumber}>{stats.downloads}</Text>
            <Text style={styles.statLabel}>Downloads</Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Section - Only show if billing is enabled */}
        {billingEnabled && (
          <View style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>Usajili</Text>
            
            {isPremium ? (
              <View style={styles.premiumCard}>
                <LinearGradient
                  colors={[COLORS.primary, '#1ed760']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.premiumGradient}
                >
                  <View style={styles.premiumHeader}>
                    <Ionicons name="star" size={24} color="#FFD700" />
                    <Text style={styles.premiumTitle}>Premium Amilifu</Text>
                  </View>
                  <Text style={styles.premiumPlan}>{subscription?.plan_name || 'Premium'}</Text>
                  <Text style={styles.premiumExpiry}>
                    {subscription?.expires_at 
                      ? `Inaisha: ${formatDate(subscription.expires_at)}`
                      : 'Usajili wako upo sawa'}
                  </Text>
                </LinearGradient>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.upgradeBanner}
                onPress={() => navigation.navigate('Subscription')}
              >
                <View style={styles.upgradeContent}>
                  <Ionicons name="star" size={24} color={COLORS.warning} />
                  <View style={styles.upgradeText}>
                    <Text style={styles.upgradeTitle}>Pata Gracefy Premium</Text>
                    <Text style={styles.upgradeSubtitle}>Fungua vipengele vyote bila kikomo</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={24} color={COLORS.text} />
              </TouchableOpacity>
            )}

            {/* Recent Transactions */}
            {transactions.length > 0 && (
              <View style={styles.transactionsContainer}>
                <Text style={styles.transactionsTitle}>Historia ya Malipo</Text>
                {transactions.slice(0, 3).map((txn, index) => (
                  <View key={txn.transaction_id || index} style={styles.transactionItem}>
                    <View style={styles.transactionIcon}>
                      <Ionicons 
                        name={txn.status === 'completed' ? 'checkmark-circle' : 
                              txn.status === 'pending' ? 'time' : 'close-circle'} 
                        size={20} 
                        color={txn.status === 'completed' ? COLORS.primary : 
                               txn.status === 'pending' ? COLORS.warning : COLORS.error} 
                      />
                    </View>
                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionPlan}>{txn.plan_name}</Text>
                      <Text style={styles.transactionDate}>{formatDate(txn.initiated_at)}</Text>
                    </View>
                    <View style={styles.transactionAmount}>
                      <Text style={styles.transactionPrice}>{formatPrice(txn.amount)}</Text>
                      <Text style={[
                        styles.transactionStatus,
                        { color: txn.status === 'completed' ? COLORS.primary : 
                                 txn.status === 'pending' ? COLORS.warning : COLORS.error }
                      ]}>
                        {txn.status === 'completed' ? 'Imekamilika' : 
                         txn.status === 'pending' ? 'Inasubiri' : 'Imeshindikana'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Akaunti</Text>
          
          {/* Subscription/Plans - Only show if billing is enabled */}
          {billingEnabled && (
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => navigation.navigate('Subscription')}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                <Ionicons name="gift" size={20} color="#8B5CF6" />
              </View>
              <Text style={styles.menuItemText}>Vifurushi Vyangu</Text>
              {isPremium && <View style={styles.premiumBadgeSmall}><Text style={styles.premiumBadgeText}>PREMIUM</Text></View>}
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('Library', { tab: 'liked' })}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="heart" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Nyimbo Unazopenda</Text>
            <Text style={styles.menuItemCount}>{stats.liked_songs}</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('Library', { tab: 'playlists' })}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="list" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Playlists Zako</Text>
            <Text style={styles.menuItemCount}>{stats.playlists}</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('Library', { tab: 'downloads' })}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="download" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.menuItemTextContainer}>
              <Text style={styles.menuItemText}>Downloads</Text>
              {downloadSize > 0 && (
                <Text style={styles.menuItemSubtext}>{formatFileSize(downloadSize)}</Text>
              )}
            </View>
            <Text style={styles.menuItemCount}>{stats.downloads}</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleClearDownloads}>
            <View style={[styles.menuIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </View>
            <Text style={styles.menuItemText}>Futa Downloads Zote</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Mipangilio</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="notifications" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Arifa</Text>
            <View style={styles.menuItemBadge}>
              <Text style={styles.menuItemBadgeText}>Zimewezeshwa</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="musical-notes" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Ubora wa Sauti</Text>
            <View style={styles.menuItemBadge}>
              <Text style={styles.menuItemBadgeText}>Hali ya Juu</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleThemeChange}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="moon" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Mandhari</Text>
            <View style={styles.menuItemBadge}>
              <Text style={styles.menuItemBadgeText}>{getThemeName()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleLanguageChange}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="language" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Lugha</Text>
            <View style={styles.menuItemBadge}>
              <Text style={styles.menuItemBadgeText}>
                {currentLanguage === 'sw' ? 'Kiswahili' : 'English'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Msaada</Text>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('Chat')}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="chatbubbles" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Pata Msaada</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('Feedback')}
          >
            <View style={styles.menuIconContainer}>
              <Ionicons name="chatbox-ellipses" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Tuma Maoni</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="document-text" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Masharti ya Huduma</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Sera ya Faragha</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Ionicons name="information-circle" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.menuItemText}>Kuhusu</Text>
            <View style={styles.menuItemBadge}>
              <Text style={styles.menuItemBadgeText}>v1.0.65</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutButtonText}>Toka</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  loginPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  loginIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  loginTitle: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  loginSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  loginButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  avatarEdit: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  profilePhone: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  editForm: {
    width: '100%',
    paddingHorizontal: SPACING.xl,
  },
  editInput: {
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.background,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.xl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  menuSection: {
    marginBottom: SPACING.xl,
  },
  menuSectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: 1,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  menuItemTextContainer: {
    flex: 1,
  },
  menuItemText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  menuItemSubtext: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  menuItemCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
    marginRight: SPACING.sm,
  },
  menuItemBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
  },
  menuItemBadgeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logoutButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: SPACING.sm,
  },
  premiumBadgeSmall: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  // Subscription styles
  premiumCard: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  premiumGradient: {
    padding: SPACING.lg,
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  premiumTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.background,
    marginLeft: SPACING.sm,
  },
  premiumPlan: {
    fontSize: FONT_SIZES.md,
    color: 'rgba(0,0,0,0.7)',
    marginBottom: 4,
  },
  premiumExpiry: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(0,0,0,0.5)',
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warning + '15',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
    marginBottom: SPACING.md,
  },
  upgradeContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeText: {
    marginLeft: SPACING.md,
  },
  upgradeTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  upgradeSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  transactionsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  transactionsTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionDetails: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  transactionPlan: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  transactionDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionPrice: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  transactionStatus: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
});

export default ProfileScreen;
