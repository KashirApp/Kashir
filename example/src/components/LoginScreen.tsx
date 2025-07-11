import React, { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  Button,
  Alert,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import NostrSdk from '../../../src';
import { SecureStorageService } from '../services/SecureStorageService';
import { styles } from '../App.styles';

interface LoginScreenProps {
  onLogin: (npub: string) => Promise<void>;
}

type LoginMethod = 'npub' | 'private';

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('npub');

  const handleLogin = async () => {
    if (!keyInput.trim()) {
      Alert.alert(
        'Error',
        `Please enter your ${loginMethod === 'npub' ? 'npub key' : 'private key'}`
      );
      return;
    }

    setLoading(true);
    try {
      let npub: string;

      if (loginMethod === 'npub') {
        // Validate the npub key by trying to parse it
        NostrSdk.nostr_sdk.PublicKey.parse(keyInput.trim());
        npub = keyInput.trim();
      } else {
        // Handle private key login
        const secretKey = NostrSdk.nostr_sdk.SecretKey.parse(keyInput.trim());
        const keys = new NostrSdk.nostr_sdk.Keys(secretKey);
        npub = keys.publicKey().toBech32();

        // Store the private key securely
        const stored = await SecureStorageService.storeNostrPrivateKey(
          keyInput.trim()
        );
        if (!stored) {
          Alert.alert(
            'Warning',
            'Private key could not be stored securely. DVM features may not work.'
          );
        }
      }

      await onLogin(npub);
    } catch (error) {
      Alert.alert(
        'Error',
        `Invalid ${loginMethod === 'npub' ? 'npub key' : 'private key'}. Please check and try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.loginSafeArea}>
      <View style={styles.loginContainer}>
        <Text style={styles.loginTitle}>Welcome to Nostr</Text>

        {/* Login Method Toggle */}
        <View style={styles.loginMethodContainer}>
          <TouchableOpacity
            style={[
              styles.loginMethodButton,
              loginMethod === 'npub' && styles.activeLoginMethod,
            ]}
            onPress={() => setLoginMethod('npub')}
          >
            <Text
              style={[
                styles.loginMethodText,
                loginMethod === 'npub' && styles.activeLoginMethodText,
              ]}
            >
              Public Key (npub)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.loginMethodButton,
              loginMethod === 'private' && styles.activeLoginMethod,
            ]}
            onPress={() => setLoginMethod('private')}
          >
            <Text
              style={[
                styles.loginMethodText,
                loginMethod === 'private' && styles.activeLoginMethodText,
              ]}
            >
              Private Key
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder={
            loginMethod === 'npub'
              ? 'Enter your npub key'
              : 'Enter your private key (nsec or hex)'
          }
          placeholderTextColor="#999"
          value={keyInput}
          onChangeText={setKeyInput}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          secureTextEntry={loginMethod === 'private'}
        />

        {loginMethod === 'private' && (
          <Text style={styles.warningText}>
            ⚠️ Private keys are stored securely for signing. Only use on trusted
            devices.
          </Text>
        )}

        <Button
          title={loading ? 'Validating...' : 'Login'}
          onPress={handleLogin}
          disabled={loading}
        />
      </View>
    </SafeAreaView>
  );
}
