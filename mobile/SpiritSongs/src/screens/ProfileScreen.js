import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, 
  StyleSheet, Dimensions, ActivityIndicator, Alert, Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useLanguage } from '../context/LanguageContext';
import { COLORS } from '../config';

const { width } = Dimensions.get('window');

const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['Limited streaming', 'Ads supported', 'Basic quality'],
    color: '#666',
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '$4.99',
    period: '/month',
    features: ['Unlimited streaming', 'No ads', 'Standard quality', 'Offline mode'],
    color: '#4CAF50',
    popular: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$9.99',
    period: '/month',
    features: ['Unlimited streaming', 'No ads', 'High quality audio', 'Offline mode', 'Early access', 'Exclusive content'],
    color: '#3498DB',
    popular: true,
  },
  {
    id: 'family',
    name: 'Family',
    price: '$14.99',
    period: '/month',
    features: ['Up to 6 accounts', 'All Premium features', 'Family mix playlists', 'Parental controls'],
    color: '#1A295E',
  },
];

const SubscriptionCard = ({ plan, currentPlan, onSelect }) => {
  const isCurrentPlan = currentPlan === plan.id;
  
  return (
    <TouchableOpacity 
      style={[styles.planCard, isCurrentPlan && styles.planCardActive]}
      onPress={() => !isCurrentPlan && onSelect(plan)}
      activeOpacity={0.8}
    >
      {plan.popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>MOST POPULAR</Text>
        </View>
      )}
      <View style={styles.planHeader}>
        <Text style={styles.planName}>{plan.name}</Text>
        <View style={styles.planPriceRow}>
          <Text style={styles.planPrice}>{plan.price}</Text>
          <Text style={styles.planPeriod}>{plan.period}</Text>
        </View>
      </View>
      <View style={styles.planFeatures}>
        {plan.features.map((feature, idx) => (
          <View key={idx} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={plan.color} />
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity 
        style={[styles.selectPlanBtn, { backgroundColor: isCurrentPlan ? '#333' : plan.color }]}
        onPress={() => !isCurrentPlan && onSelect(plan)}
        disabled={isCurrentPlan}
      >
        <Text style={styles.selectPlanText}>
          {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export default function ProfileScreen({ navigation }) {
  const { user, isAuthenticated, logout } = useAuth();
  const { isPremium, isTrial, trialInfo, features, subscriptionExpiry, subscriptionInfo, refresh, getTrialDaysRemaining, isTrialExpiringSoon } = useSubscription();
  const { t, language, changeLanguage, availableLanguages } = useLanguage();
  const [currentPlan, setCurrentPlan] = useState(isPremium ? 'premium' : 'free');
  const [loading, setLoading] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Update current plan when subscription changes
  useEffect(() => {
    setCurrentPlan(isPremium ? 'premium' : 'free');
  }, [isPremium]);

  const handleSelectPlan = (plan) => {
    if (plan.id === 'free') return;
    navigation.navigate('Subscription');
  };

  const handleManageSubscription = () => {
    navigation.navigate('Subscription');
  };

  // Get membership status text
  const getMembershipText = () => {
    if (isTrial) {
      const daysRemaining = getTrialDaysRemaining();
      return `Free Trial (${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left)`;
    }
    if (isPremium) return 'Premium Member';
    return 'Free Member';
  };

  const handleLogout = () => {
    Alert.alert(
      t('logout'),
      language === 'sw' ? 'Una uhakika unataka kutoka?' : 'Are you sure you want to logout?',
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('logout'), 
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.goBack();
          }
        },
      ]
    );
  };

  const handleLanguageSelect = async (langCode) => {
    await changeLanguage(langCode);
    setShowLanguageModal(false);
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('profile')}</Text>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowLanguageModal(true)}>
            <Ionicons name="language-outline" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <LinearGradient colors={['#3498DB', '#1A295E']} style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'G'}
            </Text>
          </LinearGradient>
          
          {isAuthenticated ? (
            <>
              <Text style={styles.userName}>{user?.name || 'User'}</Text>
              <Text style={styles.userEmail}>{user?.email || user?.phone || 'No email'}</Text>
              <TouchableOpacity 
                style={[
                  styles.membershipBadge, 
                  isPremium && styles.premiumBadge,
                  isTrial && styles.trialBadge
                ]}
                onPress={handleManageSubscription}
              >
                <Ionicons 
                  name={isPremium ? 'star' : 'star-outline'} 
                  size={14} 
                  color={isTrial ? '#FF9800' : (isPremium ? '#FFD700' : '#888')} 
                />
                <Text style={[
                  styles.membershipText, 
                  isPremium && styles.premiumText,
                  isTrial && styles.trialText
                ]}>
                  {getMembershipText()}
                </Text>
                {!isPremium && (
                  <Text style={styles.upgradeText}>Upgrade</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.userName}>Guest User</Text>
              <Text style={styles.userEmail}>Login to access more features</Text>
              <TouchableOpacity style={styles.loginBtn} onPress={handleLogin}>
                <Text style={styles.loginBtnText}>Login / Sign Up</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Trial Expiring Warning */}
        {isAuthenticated && isTrial && isTrialExpiringSoon() && (
          <TouchableOpacity 
            style={styles.trialWarningBanner}
            onPress={handleManageSubscription}
            activeOpacity={0.8}
          >
            <View style={styles.trialWarningContent}>
              <Ionicons name="warning" size={24} color="#FF9800" />
              <View style={styles.trialWarningText}>
                <Text style={styles.trialWarningTitle}>Trial Ending Soon!</Text>
                <Text style={styles.trialWarningSubtitle}>
                  {getTrialDaysRemaining()} day{getTrialDaysRemaining() !== 1 ? 's' : ''} left - Subscribe now to keep premium features
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#FF9800" />
          </TouchableOpacity>
        )}

        {/* Premium Banner for Free Users (non-trial) */}
        {isAuthenticated && !isPremium && (
          <TouchableOpacity 
            style={styles.premiumBanner}
            onPress={handleManageSubscription}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#3498DB', '#1A295E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumBannerGradient}
            >
              <View style={styles.premiumBannerContent}>
                <Ionicons name="musical-notes" size={28} color="#fff" />
                <View style={styles.premiumBannerText}>
                  <Text style={styles.premiumBannerTitle}>Go Premium</Text>
                  <Text style={styles.premiumBannerSubtitle}>
                    Unlimited songs, no ads, offline mode
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Stats Section */}
        {isAuthenticated && (
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Playlists</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Liked Songs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Downloads</Text>
            </View>
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="person-outline" size={24} color={COLORS.textPrimary} />
            <Text style={styles.menuText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleManageSubscription}>
            <Ionicons name="card-outline" size={24} color="#3498DB" />
            <Text style={styles.menuText}>Subscription</Text>
            {isPremium ? (
              <View style={styles.premiumIndicator}>
                <Text style={styles.premiumIndicatorText}>Active</Text>
              </View>
            ) : (
              <Text style={styles.upgradeIndicator}>Upgrade</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Library')}>
            <Ionicons name="heart-outline" size={24} color={COLORS.textPrimary} />
            <Text style={styles.menuText}>{t('likedSongs')}</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="download-outline" size={24} color={COLORS.textPrimary} />
            <Text style={styles.menuText}>{t('downloads')}</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowLanguageModal(true)}>
            <Ionicons name="language-outline" size={24} color={COLORS.textPrimary} />
            <Text style={styles.menuText}>{t('language')}</Text>
            <View style={styles.languageIndicator}>
              <Text style={styles.languageIndicatorText}>
                {language === 'sw' ? 'Kiswahili' : 'English'}
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="time-outline" size={24} color={COLORS.textPrimary} />
            <Text style={styles.menuText}>{language === 'sw' ? 'Historia ya Kusikiliza' : 'Listening History'}</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.textPrimary} />
            <Text style={styles.menuText}>{language === 'sw' ? 'Arifa' : 'Notifications'}</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Subscription Section */}
        <View style={styles.subscriptionSection}>
          <Text style={styles.sectionTitle}>Subscription Plans</Text>
          <Text style={styles.sectionSubtitle}>Choose a plan that works for you</Text>
          
          {SUBSCRIPTION_PLANS.map((plan) => (
            <SubscriptionCard
              key={plan.id}
              plan={plan}
              currentPlan={currentPlan}
              onSelect={handleSelectPlan}
            />
          ))}
        </View>

        {/* Actions */}
        {isAuthenticated && (
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#ff5252" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>{t('appName')} v1.0.24</Text>
          <Text style={styles.copyright}>© 2026 Spirit Songs. All rights reserved.</Text>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowLanguageModal(false)}
        >
          <View style={styles.languageModalContainer}>
            <View style={styles.languageModalHeader}>
              <Text style={styles.languageModalTitle}>{t('changeLanguage')}</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            
            {availableLanguages.map((lang) => (
              <TouchableOpacity 
                key={lang.code}
                style={[
                  styles.languageOption,
                  language === lang.code && styles.languageOptionActive
                ]}
                onPress={() => handleLanguageSelect(lang.code)}
              >
                <View style={styles.languageOptionInfo}>
                  <Text style={styles.languageOptionName}>{lang.nativeName}</Text>
                  <Text style={styles.languageOptionNameSecondary}>{lang.name}</Text>
                </View>
                {language === lang.code && (
                  <Ionicons name="checkmark-circle" size={24} color="#3498DB" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
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
    padding: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  settingsBtn: {
    padding: 4,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
  },
  userName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  premiumBadge: {
    backgroundColor: 'rgba(233, 30, 99, 0.2)',
    borderWidth: 1,
    borderColor: '#3498DB',
  },
  trialBadge: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FF9800',
  },
  membershipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  premiumText: {
    color: '#3498DB',
  },
  trialText: {
    color: '#FF9800',
  },
  upgradeText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  trialWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  trialWarningContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  trialWarningText: {
    flex: 1,
  },
  trialWarningTitle: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  trialWarningSubtitle: {
    color: 'rgba(255, 152, 0, 0.8)',
    fontSize: 12,
  },
  premiumBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  premiumBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  premiumBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  premiumBannerText: {
    flex: 1,
  },
  premiumBannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  premiumBannerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  premiumIndicator: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumIndicatorText: {
    color: '#4CAF50',
    fontSize: 11,
    fontWeight: '600',
  },
  upgradeIndicator: {
    color: '#3498DB',
    fontSize: 13,
    fontWeight: '600',
  },
  loginBtn: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 8,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  statsSection: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  menuSection: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 16,
  },
  subscriptionSection: {
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  planCardActive: {
    borderColor: '#3498DB',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#3498DB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  popularText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  planHeader: {
    marginBottom: 12,
  },
  planName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  planPrice: {
    color: '#3498DB',
    fontSize: 28,
    fontWeight: '800',
  },
  planPeriod: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginLeft: 4,
  },
  planFeatures: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  featureText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  selectPlanBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectPlanText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  actionsSection: {
    padding: 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#ff5252',
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    color: '#ff5252',
    fontSize: 16,
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appVersion: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  copyright: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  // Language Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageModalContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    width: '85%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  languageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  languageModalTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  languageOptionActive: {
    backgroundColor: 'rgba(233, 30, 99, 0.1)',
  },
  languageOptionInfo: {
    flex: 1,
  },
  languageOptionName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  languageOptionNameSecondary: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  languageIndicator: {
    backgroundColor: 'rgba(233, 30, 99, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  languageIndicatorText: {
    color: '#3498DB',
    fontSize: 12,
    fontWeight: '500',
  },
});
