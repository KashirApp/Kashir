import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import type { TabType } from '../types';
import { styles } from '../App.styles';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  followingCount: number;
  eventsCount?: number;
}

export function TabNavigation({
  activeTab,
  onTabChange,
  followingCount,
  eventsCount = 0,
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
        style={[styles.tab, activeTab === 'events' && styles.activeTab]}
        onPress={() => onTabChange('events')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'events' && styles.activeTabText,
          ]}
        >
          Events {eventsCount > 0 ? `(${eventsCount})` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
