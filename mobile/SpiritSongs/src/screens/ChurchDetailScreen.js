/**
 * Church Detail Screen
 * Shows full church details, announcements, prayer schedule, choirs, and leaders
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Dimensions, Linking, Share, Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { COLORS, API_URL } from '../config';

const { width } = Dimensions.get('window');

const CATEGORY_COLORS = {
  general: '#6366f1',
  events: '#f59e0b',
  prayer_requests: '#ec4899'
};

export default function ChurchDetailScreen({ route, navigation }) {
  const { churchId } = route.params;
  const { user, token, isAuthenticated } = useAuth();
  
  const [church, setChurch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');

  const fetchChurchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const url = `${API_URL}/churches/${churchId}/full${user?.user_id ? `?user_id=${user.user_id}` : ''}`;
      const res = await axios.get(url);
      setChurch(res.data);
      setIsFollowing(res.data.is_following || false);
    } catch (error) {
      console.error('Error fetching church:', error);
      Alert.alert('Error', 'Could not load church details');
    } finally {
      setLoading(false);
    }
  }, [churchId, user?.user_id]);

  useEffect(() => {
    fetchChurchDetails();
  }, [fetchChurchDetails]);

  const handleFollow = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Login Required',
        'Please log in to follow this church',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log In', onPress: () => navigation.navigate('Login') }
        ]
      );
      return;
    }

    setFollowLoading(true);
    try {
      if (isFollowing) {
        await axios.delete(`${API_URL}/user/unfollow`, {
          data: { entity_type: 'church', entity_id: churchId },
          headers: { Authorization: `Bearer ${token}` }
        });
        setIsFollowing(false);
        setChurch(prev => ({ ...prev, followers_count: (prev.followers_count || 1) - 1 }));
      } else {
        await axios.post(
          `${API_URL}/user/follow`,
          { entity_type: 'church', entity_id: churchId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setIsFollowing(true);
        setChurch(prev => ({ ...prev, followers_count: (prev.followers_count || 0) + 1 }));
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Could not update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${church.name} on Spirit Songs!\n${church.location}`,
        title: church.name
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const openMaps = () => {
    if (church.google_maps_url) {
      Linking.openURL(church.google_maps_url);
    } else if (church.latitude && church.longitude) {
      Linking.openURL(`https://maps.google.com/?q=${church.latitude},${church.longitude}`);
    } else if (church.address) {
      Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(church.address)}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e91e63" />
      </View>
    );
  }

  if (!church) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.textMuted} />
        <Text style={styles.errorText}>Church not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Image */}
        <View style={styles.headerImage}>
          {church.cover_image || church.thumbnail ? (
            <Image 
              source={{ uri: church.cover_image || church.thumbnail }} 
              style={styles.coverImage}
            />
          ) : (
            <LinearGradient colors={['#4f46e5', '#7c3aed']} style={styles.coverImage}>
              <Ionicons name="business" size={80} color="rgba(255,255,255,0.3)" />
            </LinearGradient>
          )}
          <LinearGradient 
            colors={['transparent', 'rgba(0,0,0,0.8)']} 
            style={styles.headerGradient} 
          />
          
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          {/* Share Button */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Church Info */}
        <View style={styles.infoSection}>
          <Text style={styles.churchName}>{church.name}</Text>
          
          {church.denomination && (
            <View style={styles.denominationBadge}>
              <Text style={styles.denominationText}>
                {church.denomination.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          )}
          
          <TouchableOpacity style={styles.locationRow} onPress={openMaps}>
            <Ionicons name="location-outline" size={18} color={COLORS.textSecondary} />
            <Text style={styles.locationText}>{church.location}</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{church.followers_count || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{church.choirs?.length || 0}</Text>
              <Text style={styles.statLabel}>Choirs</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{church.announcements?.length || 0}</Text>
              <Text style={styles.statLabel}>Updates</Text>
            </View>
          </View>

          {/* Follow Button */}
          <TouchableOpacity 
            style={[styles.followBtn, isFollowing && styles.followBtnActive]}
            onPress={handleFollow}
            disabled={followLoading}
          >
            {followLoading ? (
              <ActivityIndicator size="small" color={isFollowing ? '#e91e63' : '#fff'} />
            ) : (
              <>
                <Ionicons 
                  name={isFollowing ? 'checkmark' : 'add'} 
                  size={20} 
                  color={isFollowing ? '#e91e63' : '#fff'} 
                />
                <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {['info', 'announcements', 'schedule', 'choirs'].map(tab => (
            <TouchableOpacity 
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {/* Info Tab */}
          {activeTab === 'info' && (
            <View>
              {church.bio && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About</Text>
                  <Text style={styles.bioText}>{church.bio}</Text>
                </View>
              )}

              {/* Leader Info */}
              {church.leader_name && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Church Leader</Text>
                  <View style={styles.leaderCard}>
                    {church.leader_photo ? (
                      <Image source={{ uri: church.leader_photo }} style={styles.leaderPhoto} />
                    ) : (
                      <View style={[styles.leaderPhoto, styles.leaderPhotoPlaceholder]}>
                        <Ionicons name="person" size={24} color={COLORS.textMuted} />
                      </View>
                    )}
                    <View style={styles.leaderInfo}>
                      <Text style={styles.leaderName}>{church.leader_name}</Text>
                      {church.leader_title && (
                        <Text style={styles.leaderTitle}>{church.leader_title}</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Contact Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contact</Text>
                {church.phone && (
                  <TouchableOpacity 
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(`tel:${church.phone}`)}
                  >
                    <Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />
                    <Text style={styles.contactText}>{church.phone}</Text>
                  </TouchableOpacity>
                )}
                {church.email && (
                  <TouchableOpacity 
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(`mailto:${church.email}`)}
                  >
                    <Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />
                    <Text style={styles.contactText}>{church.email}</Text>
                  </TouchableOpacity>
                )}
                {church.website && (
                  <TouchableOpacity 
                    style={styles.contactRow}
                    onPress={() => Linking.openURL(church.website)}
                  >
                    <Ionicons name="globe-outline" size={20} color={COLORS.textSecondary} />
                    <Text style={styles.contactText}>{church.website}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Announcements Tab */}
          {activeTab === 'announcements' && (
            <View>
              {church.announcements?.length > 0 ? (
                church.announcements.map((ann, i) => (
                  <View key={ann.announcement_id || i} style={styles.announcementCard}>
                    <View style={styles.announcementHeader}>
                      <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[ann.category] || CATEGORY_COLORS.general }]}>
                        <Text style={styles.categoryText}>{ann.category?.replace('_', ' ') || 'General'}</Text>
                      </View>
                      <Text style={styles.announcementDate}>{ann.date}</Text>
                    </View>
                    <Text style={styles.announcementTitle}>{ann.title}</Text>
                    {ann.content && (
                      <Text style={styles.announcementContent}>{ann.content}</Text>
                    )}
                    {ann.description && !ann.content && (
                      <Text style={styles.announcementDescription}>{ann.description}</Text>
                    )}
                    {ann.image_url && (
                      <Image source={{ uri: ann.image_url }} style={styles.announcementImage} />
                    )}
                    {ann.time && (
                      <View style={styles.announcementMeta}>
                        <Ionicons name="time-outline" size={14} color={COLORS.textMuted} />
                        <Text style={styles.metaText}>{ann.time}</Text>
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="megaphone-outline" size={48} color={COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>No Announcements</Text>
                  <Text style={styles.emptySubtitle}>Check back later for updates</Text>
                </View>
              )}
            </View>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <View>
              {church.prayer_schedule?.length > 0 ? (
                church.prayer_schedule.map((schedule, i) => (
                  <View key={i} style={styles.scheduleCard}>
                    <View style={styles.scheduleDay}>
                      <Text style={styles.scheduleDayText}>{schedule.day}</Text>
                    </View>
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.scheduleTime}>{schedule.time}</Text>
                      <Text style={styles.scheduleType}>{schedule.service_type}</Text>
                      {schedule.description && (
                        <Text style={styles.scheduleDesc}>{schedule.description}</Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={48} color={COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>No Schedule Available</Text>
                  <Text style={styles.emptySubtitle}>Prayer times will be added soon</Text>
                </View>
              )}
            </View>
          )}

          {/* Choirs Tab */}
          {activeTab === 'choirs' && (
            <View>
              {church.choirs?.length > 0 ? (
                church.choirs.map((choir, i) => (
                  <TouchableOpacity 
                    key={choir.singer_id || i} 
                    style={styles.choirCard}
                    onPress={() => navigation.navigate('Album', { 
                      albumId: choir.singer_id,
                      title: choir.name,
                      isChoir: true
                    })}
                  >
                    {choir.thumbnail || choir.photo ? (
                      <Image source={{ uri: choir.thumbnail || choir.photo }} style={styles.choirImage} />
                    ) : (
                      <View style={[styles.choirImage, styles.choirImagePlaceholder]}>
                        <Ionicons name="people" size={24} color={COLORS.textMuted} />
                      </View>
                    )}
                    <View style={styles.choirInfo}>
                      <Text style={styles.choirName}>{choir.name}</Text>
                      <Text style={styles.choirAlbums}>{choir.albums_count || 0} albums</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>No Choirs Yet</Text>
                  <Text style={styles.emptySubtitle}>Choirs from this church will appear here</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.textSecondary,
    marginTop: 16,
    fontSize: 16,
  },
  headerImage: {
    height: 250,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  backBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    padding: 20,
    marginTop: -40,
  },
  churchName: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  denominationBadge: {
    backgroundColor: 'rgba(233, 30, 99, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  denominationText: {
    color: '#e91e63',
    fontSize: 11,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  locationText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e91e63',
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 20,
    gap: 8,
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#e91e63',
  },
  followBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  followBtnTextActive: {
    color: '#e91e63',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#e91e63',
  },
  tabText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#e91e63',
  },
  tabContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  bioText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  leaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 12,
    gap: 16,
  },
  leaderPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  leaderPhotoPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderInfo: {
    flex: 1,
  },
  leaderName: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  leaderTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  contactText: {
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  announcementCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  announcementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  categoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  announcementDate: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  announcementTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  announcementContent: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  announcementDescription: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  announcementImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 12,
  },
  announcementMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  metaText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  scheduleCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 16,
  },
  scheduleDay: {
    backgroundColor: '#e91e63',
    width: 60,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleDayText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTime: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  scheduleType: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  scheduleDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  choirCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  choirImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  choirImagePlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  choirInfo: {
    flex: 1,
  },
  choirName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  choirAlbums: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
});
