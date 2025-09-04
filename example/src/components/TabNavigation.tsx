import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import type { TabType } from '../types';
import { styles } from '../App.styles';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onFollowingPress?: () => void;
  followingCount: number;
  trendingCount?: number;
  currentFollowSetName?: string;
}

export function TabNavigation({
  activeTab,
  onTabChange,
  onFollowingPress,
  followingCount,
  trendingCount = 0,
  currentFollowSetName,
}: TabNavigationProps) {
  const handleFollowingPress = () => {
    if (activeTab === 'following' && onFollowingPress) {
      // If already on following tab, open follow set selection
      onFollowingPress();
    } else {
      // If not on following tab, just switch to it
      onTabChange('following');
    }
  };

  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'following' && styles.activeTab]}
        onPress={handleFollowingPress}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'following' && styles.activeTabText,
          ]}
          numberOfLines={1}
        >
          {currentFollowSetName
            ? `${currentFollowSetName} (${followingCount})`
            : `Following ${followingCount > 0 ? `(${followingCount})` : ''}`}
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
          numberOfLines={1}
        >
          {trendingCount > 0 ? `Trend (${trendingCount})` : 'Trending'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
