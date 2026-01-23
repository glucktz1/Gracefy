import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { churchAPI, libraryAPI, getImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ChurchesScreen = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [churches, setChurches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChurch, setSelectedChurch] = useState(route.params?.selectedChurch || null);
  const [followedChurches, setFollowedChurches] = useState(new Set());
  const [followLoading, setFollowLoading] = useState(false);

  const { isAuthenticated } = useAuth();

  useEffect(() => {
    loadChurches();
    if (isAuthenticated) {
      loadFollowedChurches();
    }
  }, [isAuthenticated]);

  const loadChurches = async () => {
    try {
      const response = await churchAPI.getChurches();
      setChurches(response.data?.churches || response.data || []);
    } catch (error) {
      console.error('Error loading churches:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFollowedChurches = async () => {
    try {
      const response = await libraryAPI.getFollowedChurches?.() || { data: [] };
      const followed = new Set((response.data || []).map(c => c.church_id));
      setFollowedChurches(followed);
    } catch (error) {
      console.error('Error loading followed churches:', error);
    }
  };

  const handleFollow = async (church) => {
    if (!isAuthenticated) {
      Alert.alert('Ingia kwanza', 'Unahitaji kuingia ili kufuatilia kanisa');
      return;
    }

    try {
      setFollowLoading(true);
      const isFollowing = followedChurches.has(church.church_id);
      
      if (isFollowing) {
        await churchAPI.unfollowChurch?.(church.church_id) || 
          libraryAPI.unfollowChurch?.(church.church_id);
        setFollowedChurches(prev => {
          const newSet = new Set(prev);
          newSet.delete(church.church_id);
          return newSet;
        });
        Alert.alert('Umefanikiwa', `Umeacha kufuatilia ${church.name}`);
      } else {
        await churchAPI.followChurch?.(church.church_id) || 
          libraryAPI.followChurch?.(church.church_id);
        setFollowedChurches(prev => new Set(prev).add(church.church_id));
        Alert.alert('Umefanikiwa', `Unafuatilia ${church.name}`);
      }
    } catch (error) {
      console.error('Error following church:', error);
      Alert.alert('Kosa', 'Imeshindikana kubadilisha hali ya kufuatilia');
    } finally {
      setFollowLoading(false);
    }
  };

  const filteredChurches = churches.filter(church =>
    church.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    church.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    church.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openMap = (church) => {
    if (church.direction) {
      Linking.openURL(church.direction);
    } else if (church.latitude && church.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${church.latitude},${church.longitude}`;
      Linking.openURL(url);
    } else if (church.google_maps_url) {
      Linking.openURL(church.google_maps_url);
    }
  };

  const openPhone = (phone) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleBack = () => {
    if (selectedChurch) {
      setSelectedChurch(null);
    } else {
      navigation.goBack();
    }
  };

  // Get church thumbnail or placeholder
  const getChurchImage = (church) => {
    if (church.thumbnail) return getImageUrl(church.thumbnail);
    if (church.cover_image) return getImageUrl(church.cover_image);
    return 'https://via.placeholder.com/400x200?text=Kanisa';
  };

  const renderChurchCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.churchCard}
      onPress={() => setSelectedChurch(item)}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: getChurchImage(item) }}
        style={styles.churchCardImage}
      />
      <LinearGradient 
        colors={['transparent', 'rgba(0,0,0,0.9)']} 
        style={styles.churchCardGradient}
      >
        <View style={styles.churchCardBadge}>
          <Ionicons name="business" size={14} color={COLORS.text} />
        </View>
        <Text style={styles.churchCardName} numberOfLines={2}>{item.name}</Text>
        {item.location && (
          <View style={styles.churchCardLocation}>
            <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.churchCardLocationText} numberOfLines={1}>{item.location}</Text>
          </View>
        )}
        <View style={styles.churchCardMeta}>
          <View style={styles.churchCardFollowers}>
            <Ionicons name="people-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.churchCardFollowersText}>{item.followers_count || 0}</Text>
          </View>
          {followedChurches.has(item.church_id) && (
            <View style={styles.followingBadge}>
              <Ionicons name="checkmark" size={10} color={COLORS.primary} />
              <Text style={styles.followingBadgeText}>Unafuatilia</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderChurchDetail = () => {
    const isFollowing = followedChurches.has(selectedChurch.church_id);
    
    return (
      <ScrollView style={styles.detailContainer} showsVerticalScrollIndicator={false}>
        {/* Church Header Image */}
        <View style={styles.detailHeader}>
          <Image
            source={{ uri: getChurchImage(selectedChurch) }}
            style={styles.detailImage}
          />
          <LinearGradient 
            colors={['transparent', COLORS.background]} 
            style={styles.detailGradient}
          >
            <Text style={styles.detailName}>{selectedChurch.name}</Text>
            {selectedChurch.denomination && (
              <Text style={styles.detailDenomination}>{selectedChurch.denomination}</Text>
            )}
          </LinearGradient>
        </View>

        {/* Church Info */}
        <View style={styles.detailContent}>
          {/* Location */}
          {selectedChurch.location && (
            <TouchableOpacity style={styles.detailRow} onPress={() => openMap(selectedChurch)}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.detailRowContent}>
                <Text style={styles.detailLabel}>Mahali</Text>
                <Text style={styles.detailValue}>{selectedChurch.location}</Text>
                {selectedChurch.address && (
                  <Text style={styles.detailSubValue}>{selectedChurch.address}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Priest/Leader Info */}
          {(selectedChurch.priest_name || selectedChurch.leader_name) && (
            <View style={styles.detailRow}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="person" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.detailRowContent}>
                <Text style={styles.detailLabel}>
                  {selectedChurch.leader_title || 'Kasisi'}
                </Text>
                <Text style={styles.detailValue}>
                  {selectedChurch.priest_name || selectedChurch.leader_name}
                </Text>
              </View>
            </View>
          )}

          {/* Phone */}
          {(selectedChurch.phone || selectedChurch.leader_phone) && (
            <TouchableOpacity 
              style={styles.detailRow} 
              onPress={() => openPhone(selectedChurch.phone || selectedChurch.leader_phone)}
            >
              <View style={styles.detailIconContainer}>
                <Ionicons name="call" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.detailRowContent}>
                <Text style={styles.detailLabel}>Simu</Text>
                <Text style={styles.detailValue}>
                  {selectedChurch.phone || selectedChurch.leader_phone}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Bio */}
          {selectedChurch.bio && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Kuhusu</Text>
              <Text style={styles.detailBio}>{selectedChurch.bio}</Text>
            </View>
          )}

          {/* Announcements (Matangazo) */}
          {selectedChurch.announcements && selectedChurch.announcements.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Matangazo</Text>
              {selectedChurch.announcements.map((announcement, index) => (
                <View key={index} style={styles.announcementItem}>
                  <View style={styles.announcementIcon}>
                    <Ionicons name="megaphone" size={16} color={COLORS.warning} />
                  </View>
                  <View style={styles.announcementContent}>
                    {announcement.title && (
                      <Text style={styles.announcementTitle}>{announcement.title}</Text>
                    )}
                    <Text style={styles.announcementText}>
                      {announcement.message || announcement.content || announcement}
                    </Text>
                    {announcement.date && (
                      <Text style={styles.announcementDate}>{announcement.date}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Prayer Schedule */}
          {selectedChurch.prayer_schedule && selectedChurch.prayer_schedule.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Ratiba ya Ibada</Text>
              {selectedChurch.prayer_schedule.map((schedule, index) => (
                <View key={index} style={styles.scheduleItem}>
                  <View style={styles.scheduleDay}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.scheduleDayText}>{schedule.day}</Text>
                  </View>
                  <View style={styles.scheduleDetails}>
                    <Text style={styles.scheduleTime}>{schedule.time}</Text>
                    {(schedule.service || schedule.service_type || schedule.description) && (
                      <Text style={styles.scheduleService}>
                        {schedule.service || schedule.service_type || schedule.description}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.detailActions}>
            {(selectedChurch.direction || selectedChurch.latitude || selectedChurch.google_maps_url) && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => openMap(selectedChurch)}
              >
                <Ionicons name="navigate" size={20} color={COLORS.text} />
                <Text style={styles.actionButtonText}>Uelekeo</Text>
              </TouchableOpacity>
            )}
            {(selectedChurch.phone || selectedChurch.leader_phone) && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => openPhone(selectedChurch.phone || selectedChurch.leader_phone)}
              >
                <Ionicons name="call" size={20} color={COLORS.text} />
                <Text style={styles.actionButtonText}>Piga Simu</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[
                styles.actionButton, 
                isFollowing ? styles.actionButtonFollowing : styles.actionButtonPrimary
              ]}
              onPress={() => handleFollow(selectedChurch)}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? COLORS.text : COLORS.background} />
              ) : (
                <>
                  <Ionicons 
                    name={isFollowing ? "checkmark-circle" : "heart-outline"} 
                    size={20} 
                    color={isFollowing ? COLORS.primary : COLORS.background} 
                  />
                  <Text style={[
                    styles.actionButtonText, 
                    !isFollowing && styles.actionButtonTextPrimary
                  ]}>
                    {isFollowing ? 'Unafuatilia' : 'Fuatilia'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{selectedChurch ? selectedChurch.name : 'Makanisa'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {selectedChurch ? (
        renderChurchDetail()
      ) : (
        <>
          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tafuta kanisa..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Churches List */}
          {filteredChurches.length > 0 ? (
            <FlatList
              data={filteredChurches}
              keyExtractor={(item) => item.church_id || item._id}
              renderItem={renderChurchCard}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Hakuna makanisa</Text>
              <Text style={styles.emptyText}>Jaribu utafutaji tofauti</Text>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  title: {
    flex: 1,
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  searchInput: {
    flex: 1,
    height: 44,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100,
  },
  churchCard: {
    height: 200,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
  },
  churchCardImage: {
    width: '100%',
    height: '100%',
  },
  churchCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    padding: SPACING.md,
    justifyContent: 'flex-end',
  },
  churchCardBadge: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  churchCardName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  churchCardLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  churchCardLocationText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: 4,
    flex: 1,
  },
  churchCardMeta: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  churchCardFollowers: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  churchCardFollowersText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  followingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  followingBadgeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginLeft: 2,
  },
  
  // Detail View
  detailContainer: {
    flex: 1,
  },
  detailHeader: {
    height: 250,
    position: 'relative',
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    padding: SPACING.md,
    justifyContent: 'flex-end',
  },
  detailName: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  detailDenomination: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
    marginTop: 4,
  },
  detailContent: {
    padding: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  detailRowContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  detailSubValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  detailSection: {
    marginTop: SPACING.md,
  },
  detailSectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  detailBio: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  // Announcements
  announcementItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  announcementIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  announcementContent: {
    flex: 1,
  },
  announcementTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  announcementText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  announcementDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  // Schedule
  scheduleItem: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  scheduleDay: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  scheduleDayText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '500',
    marginLeft: SPACING.xs,
  },
  scheduleDetails: {
    flex: 1,
  },
  scheduleTime: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  scheduleService: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  detailActions: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginRight: SPACING.sm,
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.primary,
    marginRight: 0,
  },
  actionButtonFollowing: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: 0,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  actionButtonTextPrimary: {
    color: COLORS.background,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});

export default ChurchesScreen;
