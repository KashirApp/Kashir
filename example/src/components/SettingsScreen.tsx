import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Clipboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MintsList, MintUrlModal, useWallet } from './wallet';
import { EnhancedRelaysList, RelayUrlModal } from './nostr';
import { SecureStorageService, StorageService, RelayListService } from '../services';
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
  const [isLoadingUserRelays, setIsLoadingUserRelays] = useState(false);
  const [hasUserRelayList, setHasUserRelayList] = useState(false);

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

  // Move loadUserRelayList outside useEffect so it can be shared
  const loadUserRelayList = async (publicKeyHex: string) => {
    try {
      console.log('SettingsScreen: Loading user relay list for:', publicKeyHex);
      const clientService = NostrClientService.getInstance();
      let client = clientService.getClient();
      
      console.log('SettingsScreen: Client available:', !!client);
      
      if (!client) {
        console.log('SettingsScreen: Client not initialized, initializing...');
        await clientService.initialize();
        client = clientService.getClient();
        if (!client) {
          throw new Error('Failed to initialize client');
        }
      }

      // Get the npub instead of hex for the relay list service
      const npub = await StorageService.loadNpub();
      if (!npub) {
        throw new Error('No npub found in storage');
      }

      const relayListService = RelayListService.getInstance();
      console.log('SettingsScreen: Fetching relay list from network...');
      const userRelays = await relayListService.fetchUserRelayList(client, npub);
      
      console.log('SettingsScreen: Fetched user relays:', userRelays);
      
      if (userRelays.length > 0) {
        // User has a relay list, use it
        setUserRelayInfo(userRelays);
        const relayUrls = relayListService.relayInfoToUrls(userRelays);
        setRelays(relayUrls);
        setHasUserRelayList(true);
        
        console.log(`SettingsScreen: Loaded ${userRelays.length} relays from user's NIP-65 relay list`);
      } else {
        // No user relay list found, fallback to stored relays
        console.log('SettingsScreen: No user relay list found, using stored relays');
        const storedRelays = await StorageService.loadRelays();
        setRelays(storedRelays);
        setUserRelayInfo([]);
        setHasUserRelayList(false);
      }
    } catch (error) {
      console.error('SettingsScreen: Failed to load user relay list:', error);
      // Fallback to stored relays
      const storedRelays = await StorageService.loadRelays();
      setRelays(storedRelays);
      setUserRelayInfo([]);
      setHasUserRelayList(false);
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

    const loadRelays = async () => {
      try {
        console.log('SettingsScreen: Loading relays...');
        // First, try to load user's NIP-65 relay list if logged in
        const clientService = NostrClientService.getInstance();
        const session = clientService.getCurrentSession();
        
        console.log('SettingsScreen: Current session:', session);
        
        if (session && session.publicKey) {
          console.log('SettingsScreen: User is logged in, fetching NIP-65 relay list');
          setIsLoadingUserRelays(true);
          await loadUserRelayList(session.publicKey);
        } else {
          console.log('SettingsScreen: No user session, loading stored relays');
          // Not logged in, load stored relays
          const storedRelays = await StorageService.loadRelays();
          setRelays(storedRelays);
          setHasUserRelayList(false);
        }
      } catch (error) {
        console.warn('Failed to load relays from storage:', error);
        // Fallback to stored relays
        const storedRelays = await StorageService.loadRelays();
        setRelays(storedRelays);
        setHasUserRelayList(false);
      } finally {
        setIsLoadingUserRelays(false);
      }
    };

    // Only check when the screen is visible
    if (isVisible) {
      checkSeedPhrase();
      loadMintUrls();
      loadRelays();
    }
  }, [isVisible]);

  // Effect to handle session changes and reload relays when user logs in/out
  useEffect(() => {
    if (!isVisible) return;

    const checkSessionAndReloadRelays = async () => {
      const clientService = NostrClientService.getInstance();
      
      // Load the most recent session from storage to ensure we have the latest state
      await clientService.loadStoredSession();
      const session = clientService.getCurrentSession();
      
      console.log('SettingsScreen: Checking session for relay reload. Session:', !!session, 'HasUserRelayList:', hasUserRelayList);
      
      if (session && session.publicKey && !hasUserRelayList && !isLoadingUserRelays) {
        // User just logged in and we don't have their relay list yet, and we're not already loading
        console.log('SettingsScreen: User logged in, loading NIP-65 relay list');
        setIsLoadingUserRelays(true);
        try {
          await loadUserRelayList(session.publicKey);
        } catch (error) {
          console.error('SettingsScreen: Failed to load relay list after login:', error);
        } finally {
          setIsLoadingUserRelays(false);
        }
      } else if (!session && hasUserRelayList) {
        // User logged out, revert to stored relays
        console.log('SettingsScreen: User logged out, reverting to stored relays');
        const storedRelays = await StorageService.loadRelays();
        setRelays(storedRelays);
        setUserRelayInfo([]);
        setHasUserRelayList(false);
      }
    };

    // Check immediately when the effect runs (when screen becomes visible or hasUserRelayList changes)
    checkSessionAndReloadRelays();
  }, [isVisible, hasUserRelayList, isLoadingUserRelays]);

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
    } catch (error) {
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
            } catch (error) {
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
    } catch (error) {
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
});
