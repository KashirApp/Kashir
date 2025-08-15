import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Clipboard,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MintsList, MintUrlModal, useWallet } from './wallet';
import { EnhancedRelaysList, RelayUrlModal } from './nostr';
import { SecureStorageService, StorageService } from '../services';
import type { UserRelayInfo } from '../services';
import { NostrClientService } from '../services/NostrClient';
import packageInfo from '../../package.json';

interface SettingsScreenProps {
  isVisible: boolean;
}

export function SettingsScreen({ isVisible }: SettingsScreenProps) {
  const [hasSeedPhrase, setHasSeedPhrase] = useState<boolean>(false);
  const [relays, setRelays] = useState<string[]>([]);
  const [showRelayModal, setShowRelayModal] = useState(false);
  const [userRelayInfo, setUserRelayInfo] = useState<UserRelayInfo[]>([]);
  const [isLoadingUserRelays, _setIsLoadingUserRelays] = useState(false);
  const [hasUserRelayList, setHasUserRelayList] = useState(false);
  const [lastRelayCheck, setLastRelayCheck] = useState<string>(''); // Track last relay state
  const [_zapAmount, setZapAmount] = useState<number>(21);
  const [zapAmountInput, setZapAmountInput] = useState<string>('21');

  const {
    mintUrls,
    activeMintUrl,
    showMintUrlModal,
    promptForMintUrl,
    handleMintUrlSubmit,
    handleMintUrlModalClose,
    loadMintUrlsFromStorage,
    setActiveMint,
    removeMintUrl,
    updateTotalBalance,
  } = useWallet();

  // Load relays for display only (don't affect client initialization)
  const loadRelaysForDisplay = async () => {
    try {
      // Always load from storage - the main app manages what goes in storage
      const storedRelays = await StorageService.loadRelays();
      const relayHash = JSON.stringify(storedRelays.sort()); // Create hash to detect changes

      // Only update if relays actually changed
      if (relayHash !== lastRelayCheck) {
        setRelays(storedRelays);
        setLastRelayCheck(relayHash);

        // Reset NIP-65 specific state since we're not fetching that here
        setHasUserRelayList(false);
        setUserRelayInfo([]);
      }
    } catch (error) {
      console.warn('SettingsScreen: Failed to load relays for display:', error);
      const defaultRelays = StorageService.getDefaultRelays();
      setRelays(defaultRelays);
      setHasUserRelayList(false);
      setUserRelayInfo([]);
    }
  };

  // Check if seed phrase exists and wallet database exists when component becomes visible
  useEffect(() => {
    const checkSeedPhrase = async () => {
      try {
        const exists = await SecureStorageService.hasSeedPhrase();
        setHasSeedPhrase(exists);
      } catch (error) {
        console.warn('Failed to check seed phrase existence:', error);
        setHasSeedPhrase(false);
      }
    };

    const loadMintUrls = async () => {
      try {
        await loadMintUrlsFromStorage();
      } catch (error) {
        console.warn('Failed to load mint URLs from storage:', error);
      }
    };

    const loadZapAmount = async () => {
      try {
        const amount = await StorageService.loadZapAmount();
        setZapAmount(amount);
        setZapAmountInput(amount.toString());
      } catch (error) {
        console.warn('Failed to load zap amount from storage:', error);
      }
    };

    // Load relays whenever screen becomes visible
    if (isVisible) {
      checkSeedPhrase();
      loadMintUrls();
      loadZapAmount();
      loadRelaysForDisplay();
    }
  }, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also refresh when login state might have changed
  useEffect(() => {
    if (isVisible) {
      // Add a small delay to ensure any logout operations have completed
      const timer = setTimeout(() => {
        loadRelaysForDisplay();
      }, 200);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Monitor for session state changes when visible (reduced frequency)
  useEffect(() => {
    if (!isVisible) return undefined;

    // Much less aggressive polling to avoid log spam
    const interval = setInterval(() => {
      loadRelaysForDisplay();
    }, 10000); // Check every 10 seconds

    return () => {
      clearInterval(interval);
    };
  }, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Removed automatic session checking - let the main app handle relay management
  // SettingsScreen only loads relays for display when explicitly requested

  // Refresh mint URLs when the modal closes (in case they were changed)
  useEffect(() => {
    if (!showMintUrlModal && isVisible) {
      loadMintUrlsFromStorage();
    }
  }, [showMintUrlModal, isVisible, loadMintUrlsFromStorage]);

  const handleViewSeedPhrase = async () => {
    try {
      const seedPhrase = await SecureStorageService.getSeedPhrase();
      if (seedPhrase) {
        Alert.alert('Seed Phrase', seedPhrase, [
          {
            text: 'Copy to Clipboard',
            onPress: () => {
              Clipboard.setString(seedPhrase);
              Alert.alert('Copied!', 'Seed phrase copied to clipboard');
            },
          },
          { text: 'Close', style: 'cancel' },
        ]);
      } else {
        Alert.alert('No Seed Phrase', 'No seed phrase found in secure storage');
      }
    } catch {
      Alert.alert(
        'Error',
        'Failed to retrieve seed phrase. Authentication may have been cancelled.'
      );
    }
  };

  const handleRemoveSeedPhrase = async () => {
    Alert.alert(
      'Remove Seed Phrase',
      'Are you sure you want to remove the stored seed phrase? You should have it backed up elsewhere.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const removed = await SecureStorageService.removeSeedPhrase();
              if (removed) {
                setHasSeedPhrase(false); // Update state to hide the button
                Alert.alert(
                  'Success',
                  'Seed phrase removed from secure storage'
                );
              } else {
                Alert.alert('Error', 'Failed to remove seed phrase');
              }
            } catch {
              Alert.alert('Error', 'Failed to remove seed phrase');
            }
          },
        },
      ]
    );
  };

  const handleAddRelay = async (relayUrl: string) => {
    try {
      await StorageService.addRelay(relayUrl);
      const updatedRelays = await StorageService.loadRelays();
      setRelays(updatedRelays);
      setShowRelayModal(false);

      // Clear user relay list since we're now using custom relays
      if (hasUserRelayList) {
        setHasUserRelayList(false);
        setUserRelayInfo([]);
      }

      // Reconnect Nostr client with new relays
      const clientService = NostrClientService.getInstance();
      await clientService.reconnectWithNewRelays();

      Alert.alert('Success', 'Relay added successfully');
    } catch {
      Alert.alert('Error', 'Failed to add relay');
    }
  };

  const handleRemoveRelay = async (relayUrl: string) => {
    const success = await StorageService.removeRelay(relayUrl);
    if (success) {
      const updatedRelays = await StorageService.loadRelays();
      setRelays(updatedRelays);

      // Clear user relay list since we're now using custom relays
      if (hasUserRelayList) {
        setHasUserRelayList(false);
        setUserRelayInfo([]);
      }

      // Reconnect Nostr client with updated relays
      const clientService = NostrClientService.getInstance();
      await clientService.reconnectWithNewRelays();

      Alert.alert('Success', 'Relay removed successfully');
    } else {
      Alert.alert('Error', 'Cannot remove the last relay');
    }
  };

  const handleZapAmountChange = (text: string) => {
    setZapAmountInput(text);
  };

  const handleZapAmountSave = async () => {
    try {
      const amount = parseInt(zapAmountInput, 10);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid positive number');
        return;
      }
      if (amount > 1000000) {
        Alert.alert(
          'Amount Too Large',
          'Please enter an amount less than 1,000,000 sats'
        );
        return;
      }

      await StorageService.saveZapAmount(amount);
      setZapAmount(amount);
      Alert.alert('Success', `Default zap amount set to ${amount} sats`);
    } catch {
      Alert.alert('Error', 'Failed to save zap amount');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wallet Settings</Text>

          <View style={styles.mintInfoContainer}>
            <MintsList
              mintUrls={mintUrls}
              activeMintUrl={activeMintUrl}
              onSetActive={setActiveMint}
              onRemove={removeMintUrl}
              onAddMint={promptForMintUrl}
              onUpdateTotalBalance={updateTotalBalance}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nostr Settings</Text>

          <View style={styles.relayInfoContainer}>
            <EnhancedRelaysList
              relays={relays}
              userRelayInfo={userRelayInfo}
              hasUserRelayList={hasUserRelayList}
              isLoadingUserRelays={isLoadingUserRelays}
              onRemove={handleRemoveRelay}
              onAddRelay={() => setShowRelayModal(true)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zap Settings</Text>

          <View style={styles.zapAmountContainer}>
            <Text style={styles.zapAmountLabel}>Default Zap Amount (sats)</Text>
            <View style={styles.zapAmountInputContainer}>
              <TextInput
                style={styles.zapAmountInput}
                value={zapAmountInput}
                onChangeText={handleZapAmountChange}
                keyboardType="numeric"
                placeholder="21"
                placeholderTextColor="#666"
              />
              <TouchableOpacity
                style={styles.zapAmountSaveButton}
                onPress={handleZapAmountSave}
              >
                <Text style={styles.zapAmountSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>

          {hasSeedPhrase ? (
            <>
              <TouchableOpacity
                style={styles.settingButton}
                onPress={handleViewSeedPhrase}
              >
                <Text style={styles.settingButtonText}>View Seed Phrase</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingButton}
                onPress={handleRemoveSeedPhrase}
              >
                <Text style={[styles.settingButtonText, styles.dangerText]}>
                  Remove Stored Seed Phrase
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.noSeedPhraseText}>No seed phrase stored</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutContainer}>
            <Text style={styles.aboutText}>Version: {packageInfo.version}</Text>
          </View>
        </View>
      </ScrollView>

      <MintUrlModal
        visible={showMintUrlModal}
        onClose={handleMintUrlModalClose}
        onSubmit={handleMintUrlSubmit}
      />

      <RelayUrlModal
        visible={showRelayModal}
        onClose={() => setShowRelayModal(false)}
        onSubmit={handleAddRelay}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  mintInfoContainer: {
    position: 'relative',
    // Removed fixed minHeight to allow flexible content sizing
  },
  relayInfoContainer: {
    position: 'relative',
    // Removed fixed minHeight to allow flexible content sizing
  },
  settingButton: {
    paddingVertical: 15,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingButtonText: {
    fontSize: 16,
    color: '#81b0ff',
  },
  dangerText: {
    color: '#ff6b6b',
  },
  noSeedPhraseText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  aboutContainer: {
    paddingVertical: 10,
  },
  aboutText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
  },
  zapAmountContainer: {
    backgroundColor: '#2a2a2a',
    padding: 20,
    borderRadius: 8,
  },
  zapAmountLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
    fontWeight: '500',
  },
  zapAmountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  zapAmountInput: {
    flex: 1,
    backgroundColor: '#333',
    color: '#fff',
    padding: 12,
    borderRadius: 6,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#555',
  },
  zapAmountSaveButton: {
    backgroundColor: '#81b0ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  zapAmountSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  zapAmountDescription: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
});
