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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { churchAPI, getImageUrl } from '../services/api';

const ChurchesScreen = ({ navigation, route }) => {
  const [loading, setLoading] = useState(true);
  const [churches, setChurches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChurch, setSelectedChurch] = useState(route.params?.selectedChurch || null);

  useEffect(() => {
    loadChurches();
  }, []);

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

  const renderChurchCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.churchCard}
      onPress={() => setSelectedChurch(item)}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: getImageUrl(item.thumbnail || item.cover_image) || 'https://via.placeholder.com/400x200' }}
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
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderChurchDetail = () => (
    <ScrollView style={styles.detailContainer} showsVerticalScrollIndicator={false}>
      {/* Church Header Image */}
      <View style={styles.detailHeader}>
        <Image
          source={{ uri: getImageUrl(selectedChurch.thumbnail || selectedChurch.cover_image) || 'https://via.placeholder.com/400x250' }}
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
              <Text style={styles.actionButtonText}>Elekeo</Text>
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
          <TouchableOpacity style={[styles.actionButton, styles.actionButtonPrimary]}>
            <Ionicons name="heart-outline" size={20} color={COLORS.background} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Fuatilia</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );

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
