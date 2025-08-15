import React from 'react';
import { View, Text, Button } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { styles } from '../App.styles';

interface HeaderProps {
  userName: string;
  userNpub: string;
  profileLoading: boolean;
  isClientReady: boolean;
  onLogout: () => Promise<void>;
  onShowUserPosts: () => void;
}

export function Header({
  userName,
  userNpub: _userNpub,
  profileLoading,
  isClientReady,
  onLogout,
  onShowUserPosts,
}: HeaderProps) {
  const insets = useSafeAreaInsets();

  const handleUserNamePress = () => {
    onShowUserPosts();
  };

  return (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <View style={styles.headerTop}>
        <Button
          title={profileLoading ? '...' : userName || 'Loading...'}
          onPress={handleUserNamePress}
          disabled={profileLoading}
        />
        <Text style={styles.title}>Nostr Feed</Text>
        <Button title="Logout" onPress={() => onLogout()} />
      </View>
      <Text style={styles.subtitle}>
        {isClientReady
          ? '✅ Connected to relays'
          : '⏳ Connecting to relays...'}
      </Text>
    </View>
  );
}
