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
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../config/theme';
import { churchAPI, getImageUrl } from '../services/api';

const ChurchesScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [churches, setChurches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

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
    church.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openMap = (church) => {
    if (church.latitude && church.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${church.latitude},${church.longitude}`;
      Linking.openURL(url);
    }
  };

  const renderChurchCard = ({ item }) => (
    <TouchableOpacity style={styles.churchCard}>
      <Image
        source={{ uri: getImageUrl(item.thumbnail || item.image_url) || 'https://via.placeholder.com/120' }}
        style={styles.churchImage}
      />
      <View style={styles.churchInfo}>
        <Text style={styles.churchName} numberOfLines={2}>{item.name}</Text>
        {item.location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.churchLocation} numberOfLines={1}>{item.location}</Text>
          </View>
        )}
        {item.service_times && (
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.churchTime} numberOfLines={1}>{item.service_times}</Text>
          </View>
        )}
        <View style={styles.churchActions}>
          {item.latitude && item.longitude && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => openMap(item)}
            >
              <Ionicons name="navigate-outline" size={16} color={COLORS.primary} />
              <Text style={styles.actionText}>Directions</Text>
            </TouchableOpacity>
          )}
          {item.phone && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => Linking.openURL(`tel:${item.phone}`)}
            >
              <Ionicons name="call-outline" size={16} color={COLORS.primary} />
              <Text style={styles.actionText}>Call</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
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
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Churches</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search churches..."
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
          <Text style={styles.emptyTitle}>No churches found</Text>
          <Text style={styles.emptyText}>Try a different search term</Text>
        </View>
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
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.text,
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
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  churchImage: {
    width: 120,
    height: 140,
    backgroundColor: COLORS.surface,
  },
  churchInfo: {
    flex: 1,
    padding: SPACING.md,
  },
  churchName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  churchLocation: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: 4,
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  churchTime: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  churchActions: {
    flexDirection: 'row',
    marginTop: 'auto',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    marginRight: SPACING.sm,
  },
  actionText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginLeft: 4,
    fontWeight: '500',
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
