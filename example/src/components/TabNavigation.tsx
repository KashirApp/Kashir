import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import type { TabType } from '../types';
import { styles } from '../App.styles';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  followingCount: number;
}

export function TabNavigation({
  activeTab,
  onTabChange,
  followingCount,
}: TabNavigationProps) {
  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'following' && styles.activeTab]}
        onPress={() => onTabChange('following')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'following' && styles.activeTabText,
          ]}
        >
          Following {followingCount > 0 ? `(${followingCount})` : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'trending' && styles.activeTab]}
        onPress={() => onTabChange('trending')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'trending' && styles.activeTabText,
          ]}
        >
          Trending
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'your-posts' && styles.activeTab]}
        onPress={() => onTabChange('your-posts')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'your-posts' && styles.activeTabText,
          ]}
        >
          Your Posts
        </Text>
      </TouchableOpacity>
    </View>
  );
}
