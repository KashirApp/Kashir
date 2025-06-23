import React from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { styles } from '../App.styles';

interface HeaderProps {
  userName: string;
  userNpub: string;
  profileLoading: boolean;
  isClientReady: boolean;
  currentLoading: boolean;
  onLogout: () => void;
  onRefresh: () => void;
}

export function Header({
  userName,
  userNpub,
  profileLoading,
  isClientReady,
  currentLoading,
  onLogout,
  onRefresh,
}: HeaderProps) {
  const handleUserNamePress = () => {
    Alert.alert('User Profile', `Full npub: ${userNpub}\n\nName: ${userName}`, [
      {
        text: 'Copy npub',
        onPress: () => console.log('Copy functionality not implemented'),
      },
      { text: 'OK' },
    ]);
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.headerTop}>
        <Button
          title={profileLoading ? '...' : userName || 'Loading...'}
          onPress={handleUserNamePress}
          disabled={profileLoading}
        />
        <Text style={styles.title}>Nostr Feed</Text>
        <Button title="Logout" onPress={onLogout} />
      </View>
      <Text style={styles.subtitle}>
        {isClientReady
          ? '✅ Connected to relays'
          : '⏳ Connecting to relays...'}
      </Text>
    </View>
  );
} 