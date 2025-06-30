import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import type { MainTabType } from '../types';

interface BottomTabNavigationProps {
  activeTab: MainTabType;
  onTabChange: (tab: MainTabType) => void;
}

export function BottomTabNavigation({ activeTab, onTabChange }: BottomTabNavigationProps) {
  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'wallet' && styles.activeTab]}
        onPress={() => onTabChange('wallet')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'wallet' && styles.activeTabText,
          ]}
        >
          Wallet
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'nostr' && styles.activeTab]}
        onPress={() => onTabChange('nostr')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'nostr' && styles.activeTabText,
          ]}
        >
          Nostr
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
        onPress={() => onTabChange('settings')}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === 'settings' && styles.activeTabText,
          ]}
        >
          Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#2a2a2a',
    borderTopWidth: 1,
    borderTopColor: '#444',
    paddingBottom: 20, // Account for safe area on newer phones
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: '#444',
  },
  tabText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
  },
}); 