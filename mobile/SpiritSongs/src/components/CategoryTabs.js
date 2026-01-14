import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '../config';

const CategoryTabs = ({ categories, activeCategory, onSelect }) => {
  const allCategories = [
    { category_id: 'all', name: 'All' },
    { category_id: 'music', name: 'Music' },
    { category_id: 'podcasts', name: 'Podcasts' },
    ...categories,
  ];

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {allCategories.map((category) => {
        const isActive = activeCategory === category.category_id;
        return (
          <TouchableOpacity
            key={category.category_id}
            style={[styles.tab, isActive && styles.activeTab]}
            onPress={() => onSelect(category.category_id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, isActive && styles.activeTabText]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundCard,
    marginRight: 8,
  },
  activeTab: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '600',
  },
});

export default CategoryTabs;
