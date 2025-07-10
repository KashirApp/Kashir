import React, { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  Button,
  Alert,
  SafeAreaView,
} from 'react-native';
import NostrSdk from '../../../src';
import { styles } from '../App.styles';

interface LoginScreenProps {
  onLogin: (npub: string) => Promise<void>;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [npubInput, setNpubInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!npubInput.trim()) {
      Alert.alert('Error', 'Please enter your npub key');
      return;
    }

    setLoading(true);
    try {
      // Validate the npub key by trying to parse it
      NostrSdk.nostr_sdk.PublicKey.parse(npubInput.trim());
      await onLogin(npubInput.trim());
    } catch (error) {
      Alert.alert('Error', 'Invalid npub key. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.loginSafeArea}>
      <View style={styles.loginContainer}>
        <Text style={styles.loginTitle}>Welcome to Nostr</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your npub key"
          value={npubInput}
          onChangeText={setNpubInput}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <Button
          title={loading ? 'Validating...' : 'Login'}
          onPress={handleLogin}
          disabled={loading}
        />
      </View>
    </SafeAreaView>
  );
}
