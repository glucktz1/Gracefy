import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { churchAPI, getImageUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';

const ChurchesScreen = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [churches, setChurches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChurch, setSelectedChurch] = useState(null);
  const [churchDetails, setChurchDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    loadChurches();
  }, []);

  // Load church details when a church is selected
  useEffect(() => {
    if (selectedChurch) {
      loadChurchDetails(selectedChurch.church_id);
    } else {
      setChurchDetails(null);
    }
  }, [selectedChurch]);

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
  };

  const loadChurches = async () => {
    try {
      const response = await churchAPI.getChurches();
      setChurches(response.data?.churches || response.data || []);
    } catch (error) {
      console.error('Error loading churches:', error);
      showToast('Imeshindwa kupakia makanisa', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadChurchDetails = async (churchId) => {
    try {
      setDetailsLoading(true);
      const userId = user?.user_id || null;
      const response = await churchAPI.getChurchFull(churchId, userId);
      setChurchDetails(response.data);
    } catch (error) {
      console.error('Error loading church details:', error);
      showToast('Imeshindwa kupakia maelezo ya kanisa', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (selectedChurch) {
      loadChurchDetails(selectedChurch.church_id);
      setRefreshing(false);
    } else {
      loadChurches();
    }
  }, [selectedChurch]);

  const handleFollow = async () => {
    if (!isAuthenticated) {
      showToast('Ingia kwanza ili kufuatilia kanisa', 'warning');
      navigation.navigate('ProfileTab');
      return;
    }

    if (!churchDetails) return;

    try {
      setFollowLoading(true);
      const isFollowing = churchDetails.is_following;
      
      if (isFollowing) {
        await churchAPI.unfollowChurch(churchDetails.church_id);
        setChurchDetails(prev => ({
          ...prev,
          is_following: false,
          followers_count: Math.max(0, (prev.followers_count || 1) - 1)
        }));
        showToast(`Umeacha kufuatilia ${churchDetails.name}`, 'success');
      } else {
        await churchAPI.followChurch(churchDetails.church_id);
        setChurchDetails(prev => ({
          ...prev,
          is_following: true,
          followers_count: (prev.followers_count || 0) + 1
        }));
        showToast(`Unafuatilia ${churchDetails.name}`, 'success');
      }
    } catch (error) {
      console.error('Error following church:', error);
      showToast('Imeshindwa. Jaribu tena', 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBack = () => {
    if (selectedChurch) {
      setSelectedChurch(null);
      setChurchDetails(null);
    } else {
      navigation.goBack();
    }
  };

  const openMap = (church) => {
    if (church.google_maps_url) {
      Linking.openURL(church.google_maps_url);
    } else if (church.latitude && church.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${church.latitude},${church.longitude}`;
      Linking.openURL(url);
    } else if (church.direction) {
      Linking.openURL(church.direction);
    }
  };

  const openPhone = (phone) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const filteredChurches = churches.filter(church =>
    church.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    church.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Navigate to choir songs
  const handleChoirPress = (choir) => {
    navigation.navigate('ArtistDetail', {
      artist: {
        singer_id: choir.singer_id,
        name: choir.name,
        bio: choir.bio,
        profile_image: choir.profile_image,
        thumbnail: choir.thumbnail,
      }
    });
  };

  // Render a single church card in the list
  const renderChurchCard = ({ item }) => (
    <TouchableOpacity
      style={styles.churchCard}
      onPress={() => setSelectedChurch(item)}
      activeOpacity={0.8}
    >
      {item.thumbnail || item.image ? (
        <Image
          source={{ uri: getImageUrl(item.thumbnail || item.image) }}
          style={styles.churchImage}
        />
      ) : (
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryDark || '#1a5a2e']}
          style={styles.churchImagePlaceholder}
        >
          <Ionicons name="business" size={40} color={COLORS.text} />
        </LinearGradient>
      )}
      <View style={styles.churchInfo}>
        <Text style={styles.churchName} numberOfLines={1}>{item.name}</Text>
        {item.location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.churchLocation} numberOfLines={1}>{item.location}</Text>
          </View>
        )}
        {item.followers_count > 0 && (
          <View style={styles.followersRow}>
            <Ionicons name="people-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.followersText}>
              Wafuasi {item.followers_count}
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={24} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  // Render choir card
  const renderChoirCard = ({ item }) => (
    <TouchableOpacity
      style={styles.choirCard}
      onPress={() => handleChoirPress(item)}
      activeOpacity={0.8}
    >
      {item.profile_image || item.thumbnail ? (
        <Image
          source={{ uri: getImageUrl(item.profile_image || item.thumbnail) }}
          style={styles.choirImage}
        />
      ) : (
        <View style={styles.choirImagePlaceholder}>
          <Ionicons name="musical-notes" size={24} color={COLORS.primary} />
        </View>
      )}
      <Text style={styles.choirName} numberOfLines={2}>{item.name}</Text>
      {item.albums_count > 0 && (
        <Text style={styles.choirAlbums}>Albamu {item.albums_count}</Text>
      )}
    </TouchableOpacity>
  );

  // Render announcement item
  const renderAnnouncement = (announcement, index) => (
    <View key={announcement.announcement_id || index} style={styles.announcementCard}>
      <View style={styles.announcementHeader}>
        <View style={styles.announcementIconContainer}>
          <Ionicons name="megaphone" size={18} color={COLORS.warning} />
        </View>
        <View style={styles.announcementMeta}>
          {announcement.title && (
            <Text style={styles.announcementTitle}>{announcement.title}</Text>
          )}
          {announcement.date && (
            <Text style={styles.announcementDate}>{announcement.date}</Text>
          )}
        </View>
      </View>
      <Text style={styles.announcementMessage}>
        {announcement.message || announcement.content}
      </Text>
    </View>
  );

  // Church detail view
  const renderChurchDetail = () => {
    if (detailsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Inapakia maelezo...</Text>
        </View>
      );
    }

    const church = churchDetails || selectedChurch;
    if (!church) return null;

    const isFollowing = churchDetails?.is_following || false;
    const followersCount = churchDetails?.followers_count || 0;
    const announcements = churchDetails?.announcements || [];
    const choirs = churchDetails?.choirs || [];
    const leaders = churchDetails?.leaders || [];

    return (
      <ScrollView 
        style={styles.detailContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Church Header Image */}
        {church.thumbnail || church.image ? (
          <Image
            source={{ uri: getImageUrl(church.thumbnail || church.image) }}
            style={styles.detailImage}
          />
        ) : (
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryDark || '#1a5a2e']}
            style={styles.detailImagePlaceholder}
          >
            <Ionicons name="business" size={80} color={COLORS.text} />
          </LinearGradient>
        )}

        <View style={styles.detailContent}>
          {/* Church Name & Follow Button */}
          <View style={styles.detailHeader}>
            <View style={styles.detailTitleContainer}>
              <Text style={styles.detailName}>{church.name}</Text>
              {followersCount > 0 && (
                <Text style={styles.detailFollowers}>
                  Wafuasi {followersCount}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing ? styles.followingButton : styles.notFollowingButton
              ]}
              onPress={handleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? COLORS.primary : COLORS.background} />
              ) : (
                <>
                  <Ionicons
                    name={isFollowing ? "checkmark-circle" : "heart"}
                    size={18}
                    color={isFollowing ? COLORS.primary : COLORS.background}
                  />
                  <Text style={[
                    styles.followButtonText,
                    isFollowing ? styles.followingButtonText : styles.notFollowingButtonText
                  ]}>
                    {isFollowing ? 'Unafuatilia' : 'Fuatilia'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Location */}
          {(church.location || church.address) && (
            <TouchableOpacity 
              style={styles.infoRow}
              onPress={() => openMap(church)}
              disabled={!church.direction && !church.latitude && !church.google_maps_url}
            >
              <View style={styles.infoIconContainer}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Mahali</Text>
                <Text style={styles.infoValue}>{church.location}</Text>
                {church.address && (
                  <Text style={styles.infoSubValue}>{church.address}</Text>
                )}
              </View>
              {(church.direction || church.latitude || church.google_maps_url) && (
                <Ionicons name="navigate" size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          )}

          {/* Priest/Leader */}
          {(church.priest_name || church.leader_name || leaders.length > 0) && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="person" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>
                  {church.leader_title || 'Kiongozi'}
                </Text>
                <Text style={styles.infoValue}>
                  {church.priest_name || church.leader_name || leaders[0]?.name}
                </Text>
              </View>
            </View>
          )}

          {/* Phone */}
          {(church.phone || church.leader_phone) && (
            <TouchableOpacity 
              style={styles.infoRow}
              onPress={() => openPhone(church.phone || church.leader_phone)}
            >
              <View style={styles.infoIconContainer}>
                <Ionicons name="call" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Simu</Text>
                <Text style={styles.infoValue}>
                  {church.phone || church.leader_phone}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}

          {/* About */}
          {church.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Kuhusu Kanisa</Text>
              <Text style={styles.bioText}>{church.bio}</Text>
            </View>
          )}

          {/* Prayer Schedule */}
          {church.prayer_schedule && church.prayer_schedule.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ratiba ya Ibada</Text>
              {church.prayer_schedule.map((schedule, index) => (
                <View key={index} style={styles.scheduleItem}>
                  <View style={styles.scheduleDay}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.scheduleDayText}>{schedule.day}</Text>
                  </View>
                  <View style={styles.scheduleDetails}>
                    <Text style={styles.scheduleTime}>{schedule.time}</Text>
                    {schedule.service && (
                      <Text style={styles.scheduleService}>{schedule.service}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Announcements Section */}
          {announcements.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="megaphone" size={20} color={COLORS.warning} />
                <Text style={styles.sectionTitle}>Matangazo</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{announcements.length}</Text>
                </View>
              </View>
              {announcements.map((announcement, index) => renderAnnouncement(announcement, index))}
            </View>
          )}

          {/* Choirs Section */}
          {choirs.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="musical-notes" size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Kwaya za Kanisa</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{choirs.length}</Text>
                </View>
              </View>
              <FlatList
                data={choirs}
                keyExtractor={(item) => item.singer_id}
                renderItem={renderChoirCard}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.choirsListContent}
              />
            </View>
          )}

          {/* Leaders Section */}
          {leaders.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="people" size={20} color={COLORS.primary} />
                <Text style={styles.sectionTitle}>Viongozi wa Dini</Text>
              </View>
              {leaders.map((leader, index) => (
                <View key={leader.leader_id || index} style={styles.leaderCard}>
                  {leader.image ? (
                    <Image
                      source={{ uri: getImageUrl(leader.image) }}
                      style={styles.leaderImage}
                    />
                  ) : (
                    <View style={styles.leaderImagePlaceholder}>
                      <Ionicons name="person" size={24} color={COLORS.primary} />
                    </View>
                  )}
                  <View style={styles.leaderInfo}>
                    <Text style={styles.leaderName}>{leader.name}</Text>
                    {leader.title && (
                      <Text style={styles.leaderTitle}>{leader.title}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {(church.direction || church.latitude || church.google_maps_url) && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => openMap(church)}
              >
                <Ionicons name="navigate" size={20} color={COLORS.text} />
                <Text style={styles.actionButtonText}>Uelekeo</Text>
              </TouchableOpacity>
            )}
            {(church.phone || church.leader_phone) && (
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => openPhone(church.phone || church.leader_phone)}
              >
                <Ionicons name="call" size={20} color={COLORS.text} />
                <Text style={styles.actionButtonText}>Piga Simu</Text>
              </TouchableOpacity>
            )}
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
        <Text style={styles.title} numberOfLines={1}>
          {selectedChurch ? selectedChurch.name : 'Makanisa'}
        </Text>
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
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Churches List */}
          {filteredChurches.length > 0 ? (
            <FlatList
              data={filteredChurches}
              keyExtractor={(item) => item.church_id || item._id}
              renderItem={renderChurchCard}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Hakuna makanisa</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'Jaribu utafutaji tofauti' : 'Makanisa hayajapatikana'}
              </Text>
            </View>
          )}
        </>
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
      />
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
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
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
    borderRadius: BORDER_RADIUS.lg,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100,
  },
  // Church Card Styles
  churchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  churchImage: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
  },
  churchImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  churchInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  churchName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  churchLocation: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginLeft: 4,
    flex: 1,
  },
  followersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  followersText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  // Detail View Styles
  detailContainer: {
    flex: 1,
  },
  detailImage: {
    width: '100%',
    height: 200,
  },
  detailImagePlaceholder: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailContent: {
    padding: SPACING.md,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  detailTitleContainer: {
    flex: 1,
    marginRight: SPACING.md,
  },
  detailName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  detailFollowers: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: 6,
  },
  followingButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  notFollowingButton: {
    backgroundColor: COLORS.primary,
  },
  followButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  followingButtonText: {
    color: COLORS.primary,
  },
  notFollowingButtonText: {
    color: COLORS.background,
  },
  // Info Row Styles
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  infoSubValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Section Styles
  section: {
    marginTop: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  badge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.background,
    fontWeight: '600',
  },
  bioText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  // Schedule Styles
  scheduleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  scheduleDay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  scheduleDayText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  scheduleDetails: {
    alignItems: 'flex-end',
  },
  scheduleTime: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  scheduleService: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  // Announcement Styles
  announcementCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  announcementIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.warning}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  announcementMeta: {
    flex: 1,
  },
  announcementTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  announcementDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  announcementMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  // Choir Styles
  choirsListContent: {
    paddingVertical: SPACING.sm,
  },
  choirCard: {
    width: 120,
    marginRight: SPACING.md,
    alignItems: 'center',
  },
  choirImage: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  choirImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  choirName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
    textAlign: 'center',
  },
  choirAlbums: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Leader Styles
  leaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  leaderImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  leaderImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: `${COLORS.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  leaderName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  leaderTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  actionButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  // Empty State
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
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});

export default ChurchesScreen;
