import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MintRecommendationsModal } from './MintRecommendationsModal';

interface MintUrlModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
  isWalletCreation?: boolean;
}

export function MintUrlModal({
  visible,
  onClose,
  onSubmit,
  isWalletCreation = false,
}: MintUrlModalProps) {
  const [url, setUrl] = useState(
    isWalletCreation ? 'https://mint.kashir.xyz' : ''
  );
  const [isValidating, setIsValidating] = useState(false);
  const [showRecommendationsModal, setShowRecommendationsModal] =
    useState(false);

  // Reset validation state and URL when modal becomes visible
  useEffect(() => {
    if (visible) {
      setIsValidating(false);
      // Reset URL to default for wallet creation
      if (isWalletCreation) {
        setUrl('https://mint.kashir.xyz');
      }
    }
  }, [visible, isWalletCreation]);

  // Validate mint by checking /v1/info endpoint
  const validateMint = async (mintUrl: string): Promise<boolean> => {
    try {
      // Ensure URL ends with /v1/info
      const infoUrl = mintUrl.endsWith('/')
        ? `${mintUrl}v1/info`
        : `${mintUrl}/v1/info`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(infoUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const mintInfo = await response.json();

      // Validate that response has expected mint info structure
      if (!mintInfo.name || !mintInfo.version || !mintInfo.nuts) {
        throw new Error('Invalid mint response format');
      }

      // Check if it supports basic operations we need (NUT-4 for minting, NUT-5 for melting)
      if (!mintInfo.nuts['4'] || !mintInfo.nuts['5']) {
        throw new Error(
          'Mint does not support required operations (minting/melting)'
        );
      }

      return true;
    } catch (error) {
      console.error('Mint validation failed:', error);
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a valid mint URL');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Error', 'URL must start with http:// or https://');
      return;
    }

    setIsValidating(true);

    try {
      const isValid = await validateMint(url.trim());

      if (isValid) {
        onSubmit(url.trim());
        // Only clear the input for non-wallet creation scenarios
        if (!isWalletCreation) {
          setUrl('');
        }
      } else {
        Alert.alert(
          'Invalid Mint',
          'Could not connect to the mint. Please check the URL and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Validation Error',
        'Failed to validate mint. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleCancel = () => {
    // Don't clear URL for wallet creation to keep the default
    if (!isWalletCreation) {
      setUrl(''); // Only clear the input for non-wallet creation scenarios
    }
    setIsValidating(false); // Reset validation state
    onClose();
  };

  const handleShowRecommendations = () => {
    setShowRecommendationsModal(true);
  };

  const handleSelectFromRecommendations = (recommendedUrl: string) => {
    setUrl(recommendedUrl);
    setShowRecommendationsModal(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Enter Mint URL</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>Cashu Mint URL:</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder=""
            placeholderTextColor="#666666"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <Text style={styles.hint}>
            Enter the URL of the Cashu mint you want to connect to. The mint
            will be validated before connecting.
          </Text>

          <TouchableOpacity
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              isValidating && styles.submitButtonDisabled,
            ]}
            disabled={isValidating}
          >
            {isValidating ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={[styles.submitText, styles.loadingText]}>
                  Validating Mint...
                </Text>
              </View>
            ) : (
              <Text style={styles.submitText}>Connect to Mint</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            onPress={handleShowRecommendations}
            style={styles.recommendationsButton}
          >
            <Text style={styles.recommendationsButtonText}>
              Choose from Recommended Mints
            </Text>
            <Text style={styles.recommendationsButtonArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      <MintRecommendationsModal
        visible={showRecommendationsModal}
        onClose={() => setShowRecommendationsModal(false)}
        onSelectMint={handleSelectFromRecommendations}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 30,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#555555',
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingText: {
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#333333',
    marginVertical: 24,
  },
  recommendationsButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recommendationsButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
  recommendationsButtonArrow: {
    fontSize: 18,
    color: '#007AFF',
  },
});
