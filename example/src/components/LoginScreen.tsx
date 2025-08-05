import React, { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  Button,
  Alert,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PublicKey, SecretKey, Keys } from 'kashir';
import { SecureStorageService } from '../services/SecureStorageService';
import { StorageService } from '../services/StorageService';
import { NostrClientService, LoginType } from '../services/NostrClient';
import { styles } from '../App.styles';

interface LoginScreenProps {
  onLogin: (npub: string, loginType: LoginType) => Promise<void>;
}

type LoginMethod = 'private' | 'amber';

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('amber');

  const checkAmberInstalled = async (): Promise<boolean> => {
    try {
      const canOpen = await Linking.canOpenURL('nostrsigner://');
      return canOpen;
    } catch (error) {
      console.error('Error checking Amber installation:', error);
      return false;
    }
  };

  const handleAmberLogin = async () => {
    const isAmberInstalled = await checkAmberInstalled();
    if (!isAmberInstalled) {
      Alert.alert(
        'Amber Not Found',
        'Amber signer app is not installed. Please install Amber from the Play Store to use this login method.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Get Amber',
            onPress: () =>
              Linking.openURL('https://github.com/greenart7c3/Amber'),
          },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      const nostrClient = NostrClientService.getInstance();
      const result = await nostrClient.loginWithAmber();

      // The result could be either hex string or npub format
      let npub: string;
      if (result.startsWith('npub')) {
        npub = result;
      } else {
        // If it's hex, convert to npub format
        const publicKey = PublicKey.parse(result);
        npub = publicKey.toBech32();
      }

      await onLogin(npub, LoginType.Amber);
    } catch (error) {
      console.error('Amber login error:', error);
      Alert.alert(
        'Login Failed',
        error instanceof Error
          ? error.message
          : 'Failed to login with Amber. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyLogin = async () => {
    if (!keyInput.trim()) {
      Alert.alert('Error', 'Please enter your private key');
      return;
    }

    setLoading(true);
    try {
      // Handle private key login
      const secretKey = SecretKey.parse(keyInput.trim());
      const keys = new Keys(secretKey);
      const npub = keys.publicKey().toBech32();

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

      // Store the npub as well
      await StorageService.saveNpub(npub);

      await onLogin(npub, LoginType.PrivateKey);
    } catch (error) {
      Alert.alert('Error', 'Invalid private key. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    if (loginMethod === 'amber') {
      handleAmberLogin();
    } else {
      handleKeyLogin();
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
              loginMethod === 'amber' && styles.activeLoginMethod,
            ]}
            onPress={() => setLoginMethod('amber')}
          >
            <Text
              style={[
                styles.loginMethodText,
                loginMethod === 'amber' && styles.activeLoginMethodText,
              ]}
            >
              🟡 Amber
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

        {loginMethod !== 'amber' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Enter your private key (nsec or hex)"
              placeholderTextColor="#999"
              value={keyInput}
              onChangeText={setKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              secureTextEntry={true}
            />

            <Text style={styles.warningText}>
              ⚠️ Private keys are stored securely for signing. Only use on
              trusted devices.
            </Text>
          </>
        )}

        {loginMethod === 'amber' && (
          <View style={styles.amberContainer}>
            <Text style={styles.amberDescription}>
              🟡 Login with Amber external signer app for secure key management.
            </Text>
            <Text style={styles.amberNote}>
              Your private keys remain secure in the Amber app and never leave
              your device.
            </Text>
          </View>
        )}

        <Button
          title={
            loading
              ? loginMethod === 'amber'
                ? 'Connecting to Amber...'
                : 'Validating...'
              : loginMethod === 'amber'
                ? 'Login with Amber'
                : 'Login'
          }
          onPress={handleLogin}
          disabled={loading || (loginMethod !== 'amber' && !keyInput.trim())}
        />
      </View>
    </SafeAreaView>
  );
}
