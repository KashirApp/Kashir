import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../App';
import {
  MintsList,
  MintUrlModal,
  useWallet,
  SwapModal,
  MintReviewModal,
} from './wallet';
import { EnhancedRelaysList, RelayUrlModal } from './nostr';
import { FollowSetsList } from './nostr/FollowSetsList';
import { FollowSetModal } from './nostr/FollowSetModal';
import { ZapAmountModal } from './ZapAmountModal';
import { SecureStorageService, StorageService } from '../services';
import type { UserRelayInfo } from '../services';
import { NostrClientService } from '../services/NostrClient';
import { RelayListService } from '../services/RelayListService';
import { ListService } from '../services/ListService';
import type { FollowSet } from '../services/ListService';
import { FollowSetsStorageService, FollowSetProfileService } from '../services';
import { ProfileService } from '../services/ProfileService';
import { NostrPublicKey as PublicKey } from 'kashir';
import { loadCachedBalances } from './wallet/utils/mintBalanceUtils';
import type { MintBalance } from './wallet/utils/mintBalanceUtils';
import packageInfo from '../../package.json';

interface SettingsScreenProps {
  isVisible: boolean;
  userNpub?: string;
  profileLoading?: boolean;
  onLogout?: () => Promise<void>;
}

export function SettingsScreen({
  isVisible,
  userNpub,
  profileLoading: _externalProfileLoading,
  onLogout,
}: SettingsScreenProps) {
  const [hasSeedPhrase, setHasSeedPhrase] = useState<boolean>(false);
  const [internalUserName, setInternalUserName] = useState<string>('');
  const [internalProfileLoading, setInternalProfileLoading] =
    useState<boolean>(false);
  const [relays, setRelays] = useState<string[]>([]);
  const [showRelayModal, setShowRelayModal] = useState(false);
  const [userRelayInfo, setUserRelayInfo] = useState<UserRelayInfo[]>([]);
  const [isLoadingUserRelays, _setIsLoadingUserRelays] = useState(false);
  const [hasUserRelayList, setHasUserRelayList] = useState(false);
  const [lastRelayCheck, setLastRelayCheck] = useState<string>(''); // Track last relay state
  const [zapAmount, setZapAmount] = useState<number>(21);
  const [showZapAmountModal, setShowZapAmountModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [mintBalances, setMintBalances] = useState<MintBalance[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewMintUrl, setReviewMintUrl] = useState<string>('');
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  // Follow sets state
  const [followSets, setFollowSets] = useState<FollowSet[]>([]);
  const [isLoadingFollowSets, setIsLoadingFollowSets] = useState(false);
  const [activeFollowSetEventId, setActiveFollowSetEventId] = useState<
    string | null
  >(null);
  const [hasLoadedFollowSets, setHasLoadedFollowSets] = useState(false);
  const [showFollowSetModal, setShowFollowSetModal] = useState(false);
  const [editingFollowSet, setEditingFollowSet] = useState<
    FollowSet | undefined
  >(undefined);

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
    handleSwapBetweenMints,
  } = useWallet();

  // Navigation and profile service
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const profileService = useMemo(() => new ProfileService(), []);
  const relayListService = useMemo(() => RelayListService.getInstance(), []);
  const listService = useMemo(() => ListService.getInstance(), []);
  const followSetProfileService = useMemo(
    () => FollowSetProfileService.getInstance(),
    []
  );

  // Helper function to reconstruct PublicKey objects from npubs
  const reconstructPublicKeys = (npubs: string[]): PublicKey[] => {
    const publicKeys: PublicKey[] = [];
    npubs.forEach((npub, index) => {
      try {
        const pk = PublicKey.parse(npub);
        publicKeys.push(pk);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(
          `SettingsScreen: Failed to parse npub ${index}: ${errorMsg}`
        );
      }
    });
    return publicKeys;
  };

  // Load cached mint balances for swap functionality
  useEffect(() => {
    const loadMintBalances = async () => {
      try {
        const balances = await loadCachedBalances();
        const validBalances = balances.filter(
          (balance) =>
            balance && balance.mintUrl && mintUrls.includes(balance.mintUrl)
        );
        setMintBalances(validBalances);
      } catch (error) {
        console.warn('Failed to load mint balances for swap:', error);
        setMintBalances([]);
      }
    };

    if (mintUrls.length > 0) {
      loadMintBalances();
    } else {
      setMintBalances([]);
    }
  }, [mintUrls]);

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

  // Helper function to publish relay list if user is logged in
  const publishRelayListIfLoggedIn = async (relayUrls: string[]) => {
    try {
      // Only publish if user is logged in (has npub)
      if (!userNpub) {
        console.log(
          'SettingsScreen: Not publishing relay list - user not logged in'
        );
        return;
      }

      // Get Nostr client
      const clientService = NostrClientService.getInstance();
      if (!clientService.isReady()) {
        console.log(
          'SettingsScreen: Not publishing relay list - client not ready'
        );
        return;
      }

      const client = clientService.getClient();
      const session = clientService.getCurrentSession();

      if (!session) {
        console.log('SettingsScreen: Not publishing relay list - no session');
        return;
      }

      // Publish the relay list using the current login type
      await relayListService.publishRelayList(client, session.type, relayUrls);
      console.log('SettingsScreen: Successfully published relay list');
    } catch (error) {
      console.error('SettingsScreen: Failed to publish relay list:', error);
      // Don't throw error - relay list publishing is optional
    }
  };

  // Load user's follow sets - prioritize local storage, fallback to network
  const loadFollowSets = useCallback(async () => {
    if (!userNpub) {
      setFollowSets([]);
      return;
    }

    setIsLoadingFollowSets(true);
    try {
      const storedSets =
        await FollowSetsStorageService.loadFollowSets(userNpub);

      if (storedSets.length > 0) {
        const followSetsFromStorage = storedSets.map((stored) => {
          const publicKeys = reconstructPublicKeys(stored.publicUserIds || []);
          const privateKeys = stored.privateUserIds
            ? reconstructPublicKeys(stored.privateUserIds)
            : undefined;

          return {
            identifier: stored.identifier,
            eventId: stored.eventId,
            createdAt: stored.createdAt,
            isPrivate: stored.isPrivate,
            publicKeys,
            privateKeys,
          };
        }) as FollowSet[];

        // Update state immediately instead of using setTimeout
        try {
          setFollowSets(followSetsFromStorage);
          setHasLoadedFollowSets(true);
        } catch (stateError) {
          console.error('SettingsScreen: State update failed:', stateError);
          setFollowSets([]);
        }

        const hasMainFollowing = storedSets.some(
          (set) => set.identifier === 'Following'
        );
        if (!hasMainFollowing) {
          fetchMissingMainFollowingList().catch(() => {});
        }

        const clientService = NostrClientService.getInstance();
        if (clientService.isReady()) {
          const client = clientService.getClient();
          followSetProfileService
            .fetchAndStoreProfilesForFollowSets(
              client,
              followSetsFromStorage,
              userNpub
            )
            .catch(() => {});
        }

        return;
      }

      // Fallback to network
      await fetchAllFollowSetsFromNetwork();
    } catch (error) {
      console.error('SettingsScreen: Error in loadFollowSets:', error);
      setFollowSets([]);
    } finally {
      setIsLoadingFollowSets(false);
    }
  }, [userNpub, followSetProfileService]); // eslint-disable-line react-hooks/exhaustive-deps

  // Helper function to fetch missing main following list
  const fetchMissingMainFollowingList = async () => {
    try {
      const clientService = NostrClientService.getInstance();
      if (clientService.isReady()) {
        const client = clientService.getClient();
        const session = clientService.getCurrentSession();
        const userFollowSets = await listService.fetchUserFollowSets(
          client,
          userNpub!,
          session?.type
        );

        // Find just the main following list and add it
        const mainFollowing = userFollowSets.find(
          (set) => set.identifier === 'Following'
        );
        if (mainFollowing) {
          setFollowSets((prev) => {
            // Check if it already exists to avoid duplicates
            const existingIndex = prev.findIndex(
              (set) => set.identifier === 'Following'
            );
            if (existingIndex >= 0) {
              // Replace existing
              const updated = [...prev];
              updated[existingIndex] = mainFollowing;
              return updated;
            } else {
              // Add to beginning
              return [mainFollowing, ...prev];
            }
          });

          // Save the complete list including the main following
          const allSets = [
            mainFollowing,
            ...userFollowSets.filter((set) => set.identifier !== 'Following'),
          ];
          await FollowSetsStorageService.saveFollowSets(allSets, userNpub!);
        }
      }
    } catch (error) {
      console.warn(
        'SettingsScreen: Failed to fetch missing main following list:',
        error
      );
    }
  };

  // Helper function to fetch all follow sets from network
  const fetchAllFollowSetsFromNetwork = async () => {
    const clientService = NostrClientService.getInstance();
    if (clientService.isReady()) {
      const client = clientService.getClient();
      const session = clientService.getCurrentSession();
      const userFollowSets = await listService.fetchUserFollowSets(
        client,
        userNpub!,
        session?.type // Pass the loginType to enable decryption
      );

      setFollowSets(userFollowSets);
      setHasLoadedFollowSets(true);

      // Save follow sets to local storage
      try {
        await FollowSetsStorageService.saveFollowSets(
          userFollowSets,
          userNpub!
        );
      } catch {
        // Handle storage errors silently
      }

      // Fetch and store user profiles in the background
      try {
        await followSetProfileService.fetchAndStoreProfilesForFollowSets(
          client,
          userFollowSets,
          userNpub!
        );
      } catch {
        // Handle profile errors silently
      }
    } else {
      // Client not ready and no local data available
    }
  };

  // Fetch user profile when needed
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userNpub || !isVisible) return;

      setInternalProfileLoading(true);
      try {
        const clientService = NostrClientService.getInstance();
        if (clientService.isReady()) {
          const client = clientService.getClient();
          const name = await profileService.fetchUserProfile(client, userNpub);
          setInternalUserName(name);
        }
      } catch (error) {
        console.warn('Failed to fetch user profile in settings:', error);
      } finally {
        setInternalProfileLoading(false);
      }
    };

    fetchProfile();
  }, [userNpub, isVisible, profileService]);

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
      } catch (error) {
        console.warn('Failed to load zap amount from storage:', error);
      }
    };

    // Load relays whenever screen becomes visible
    console.log(
      'SettingsScreen: Screen visibility changed, isVisible:',
      isVisible
    );
    if (isVisible) {
      console.log(
        'SettingsScreen: Screen is visible, starting to load data...'
      );
      checkSeedPhrase();
      loadMintUrls();
      loadZapAmount();
      loadRelaysForDisplay();
      loadFollowSets();
    }
  }, [isVisible, loadFollowSets]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Load follow sets when user is logged in
  useEffect(() => {
    if (userNpub && isVisible && !hasLoadedFollowSets) {
      loadFollowSets();
    }
  }, [userNpub, isVisible, loadFollowSets, hasLoadedFollowSets]);

  // Reset loaded flag when user changes
  useEffect(() => {
    setHasLoadedFollowSets(false);
    setFollowSets([]);
  }, [userNpub]);

  // Load active follow set from storage
  useEffect(() => {
    const loadActiveFollowSet = async () => {
      try {
        const activeSet = await StorageService.loadActiveFollowSet();
        setActiveFollowSetEventId(activeSet ? activeSet.eventId : null);
      } catch (error) {
        console.error('Error loading active follow set:', error);
      }
    };

    loadActiveFollowSet();
  }, []);

  const handleSetAsActive = async (followSet: FollowSet) => {
    try {
      if (followSet.identifier === 'Following') {
        // Reset to main following list (kind 3)
        await StorageService.removeActiveFollowSet();
        setActiveFollowSetEventId(null);
        Alert.alert(
          'Success',
          'Main following list is now active for the Following tab'
        );
      } else {
        // Set custom follow set as active
        await StorageService.saveActiveFollowSet(
          followSet.identifier,
          followSet.eventId
        );
        setActiveFollowSetEventId(followSet.eventId);
        Alert.alert(
          'Success',
          `"${followSet.identifier}" is now active for the Following tab`
        );
      }
    } catch (error) {
      console.error('Error setting active follow set:', error);
      Alert.alert('Error', 'Failed to set active follow set');
    }
  };

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

      // Publish updated relay list to network (NIP-65)
      await publishRelayListIfLoggedIn(updatedRelays);

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

      // Publish updated relay list to network (NIP-65)
      await publishRelayListIfLoggedIn(updatedRelays);

      Alert.alert('Success', 'Relay removed successfully');
    } else {
      Alert.alert('Error', 'Cannot remove the last relay');
    }
  };

  const handleZapAmountTap = () => {
    setShowZapAmountModal(true);
  };

  const handleZapAmountSubmit = async (amount: number) => {
    try {
      await StorageService.saveZapAmount(amount);
      setZapAmount(amount);
      setShowZapAmountModal(false);
    } catch {
      Alert.alert('Error', 'Failed to save zap amount');
    }
  };

  const handleZapAmountModalClose = () => {
    setShowZapAmountModal(false);
  };

  const handleReviewMint = (mintUrl: string) => {
    if (!userNpub) {
      Alert.alert('Login Required', 'Please login to review mints');
      return;
    }
    setReviewMintUrl(mintUrl);
    setShowReviewModal(true);
  };

  const handleReviewModalClose = () => {
    setShowReviewModal(false);
    setReviewMintUrl('');
  };

  const handleLogout = async () => {
    if (!onLogout || isLoggingOut) return;

    setIsLoggingOut(true);
    try {
      // Clear stored follow sets data before logging out
      if (userNpub) {
        try {
          await FollowSetsStorageService.clearUserData(userNpub);
        } catch {
          // Handle storage errors silently
        }
      }

      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Follow sets handlers
  const handleCreateFollowSet = () => {
    setEditingFollowSet(undefined);
    setShowFollowSetModal(true);
  };

  const handleEditFollowSet = (followSet: FollowSet) => {
    // Don't allow editing the main following list
    if (followSet.identifier === 'Following') {
      Alert.alert(
        'Cannot Edit',
        'The main following list cannot be edited here. Use the follow/unfollow buttons on user profiles instead.'
      );
      return;
    }

    setEditingFollowSet(followSet);
    setShowFollowSetModal(true);
  };

  const handleDeleteFollowSet = async (followSet: FollowSet) => {
    // Don't allow deleting the main following list
    if (followSet.identifier === 'Following') {
      Alert.alert(
        'Cannot Delete',
        'The main following list cannot be deleted. It represents your core Nostr contact list.'
      );
      return;
    }

    // Don't allow deleting the active follow set
    const isActiveFollowSet = followSet.eventId === activeFollowSetEventId;
    if (isActiveFollowSet) {
      Alert.alert(
        'Cannot Delete',
        'Cannot delete the active follow set. Please set a different follow set as active first.'
      );
      return;
    }
    try {
      const clientService = NostrClientService.getInstance();
      if (!clientService.isReady()) {
        Alert.alert('Error', 'Nostr client is not ready');
        return;
      }

      const client = clientService.getClient();
      const session = clientService.getCurrentSession();

      if (!session) {
        Alert.alert('Error', 'No active session found');
        return;
      }

      const success = await listService.deleteFollowSet(
        client,
        session.type,
        followSet.identifier,
        followSet.eventId
      );

      if (success) {
        Alert.alert('Success', 'Follow set deleted successfully');
        // Wait before refreshing from network to allow propagation
        setTimeout(async () => {
          await fetchAllFollowSetsFromNetwork();
        }, 1000);
      } else {
        Alert.alert('Error', 'Failed to delete follow set');
      }
    } catch (error) {
      console.error('Failed to delete follow set:', error);
      Alert.alert('Error', 'Failed to delete follow set');
    }
  };

  const handleSaveFollowSet = async (
    identifier: string,
    publicKeys: any[],
    privateKeys?: any[]
  ) => {
    try {
      const clientService = NostrClientService.getInstance();
      if (!clientService.isReady()) {
        Alert.alert('Error', 'Nostr client is not ready');
        return false;
      }

      const client = clientService.getClient();
      const session = clientService.getCurrentSession();

      if (!session) {
        Alert.alert('Error', 'No active session found');
        return false;
      }

      let success;
      if (editingFollowSet) {
        // Check if the identifier (name) has changed
        const identifierChanged = editingFollowSet.identifier !== identifier;

        if (identifierChanged) {
          // If identifier changed, we need to delete the old follow set first
          // because in NIP-51, the identifier is the unique key ('d' tag)
          const deleteSuccess = await listService.deleteFollowSet(
            client,
            session.type,
            editingFollowSet.identifier,
            editingFollowSet.eventId
          );

          if (!deleteSuccess) {
            console.warn(
              'Failed to delete old follow set, proceeding with creation anyway'
            );
          }
        }

        // Create new follow set (or update if identifier didn't change)
        if (privateKeys && privateKeys.length > 0) {
          success = await listService.createMixedFollowSet(
            client,
            session.type,
            identifier,
            publicKeys,
            privateKeys
          );
        } else {
          success = await listService.createFollowSet(
            client,
            session.type,
            identifier,
            publicKeys
          );
        }

        if (success) {
          // Wait for network propagation before refreshing
          setTimeout(async () => {
            await fetchAllFollowSetsFromNetwork();
          }, 1000);
        }
      } else {
        // Creating new follow set
        if (privateKeys && privateKeys.length > 0) {
          success = await listService.createMixedFollowSet(
            client,
            session.type,
            identifier,
            publicKeys,
            privateKeys
          );
        } else {
          success = await listService.createFollowSet(
            client,
            session.type,
            identifier,
            publicKeys
          );
        }

        if (success) {
          // Wait for network propagation before refreshing
          setTimeout(async () => {
            await fetchAllFollowSetsFromNetwork();
          }, 1000);
        }
      }

      if (success) {
        // Auto-sync to fetch profiles for newly added users BEFORE showing success
        if (userNpub) {
          try {
            const syncClientService = NostrClientService.getInstance();
            if (syncClientService.isReady()) {
              const syncClient = syncClientService.getClient();
              const syncProfileService = FollowSetProfileService.getInstance();

              // Find the saved follow set and sync its profiles
              const updatedFollowSets =
                await FollowSetsStorageService.loadFollowSets(userNpub);
              const targetSet = updatedFollowSets.find(
                (set) => set.identifier === identifier
              );

              if (targetSet) {
                // Convert stored follow set back to FollowSet format for profile syncing
                const followSetForSync: FollowSet = {
                  identifier: targetSet.identifier,
                  eventId: targetSet.eventId,
                  createdAt: targetSet.createdAt,
                  isPrivate: targetSet.isPrivate,
                  publicKeys: targetSet.publicUserIds.map((npub) =>
                    PublicKey.parse(npub)
                  ),
                  privateKeys: targetSet.privateUserIds?.map((npub) =>
                    PublicKey.parse(npub)
                  ),
                };

                // Fetch and store profiles for the follow set
                await syncProfileService.fetchAndStoreProfilesForFollowSets(
                  syncClient,
                  [followSetForSync],
                  userNpub
                );
              }
            }
          } catch (error) {
            console.error('Auto-sync after save failed:', error);
            // Don't show error to user as this is a background operation
          }
        }

        Alert.alert(
          'Success',
          `Follow set ${editingFollowSet ? 'updated' : 'created'} successfully`
        );

        return true;
      } else {
        Alert.alert(
          'Error',
          `Failed to ${editingFollowSet ? 'update' : 'create'} follow set`
        );
        return false;
      }
    } catch (error) {
      console.error('Failed to save follow set:', error);

      // Check for specific error types and show appropriate user-friendly messages
      if (error instanceof Error) {
        if (
          error.message.includes('require stored private key for encryption')
        ) {
          Alert.alert(
            'Encryption Keys Not Available',
            'Private follow set members require stored private key for encryption. Please ensure your private key is available.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Error',
            `Failed to ${editingFollowSet ? 'update' : 'create'} follow set: ${error.message}`
          );
        }
      } else {
        Alert.alert(
          'Error',
          `Failed to ${editingFollowSet ? 'update' : 'create'} follow set`
        );
      }

      return false;
    }
  };

  const handleFollowSetModalClose = () => {
    setShowFollowSetModal(false);
    setEditingFollowSet(undefined);
  };

  // Handle sync for all follow sets
  const handleSyncAllFollowSets = useCallback(async () => {
    if (!userNpub) return;

    try {
      const clientService = NostrClientService.getInstance();
      if (clientService.isReady()) {
        const client = clientService.getClient();
        const session = clientService.getCurrentSession();

        // Fetch data without any state updates first
        const userFollowSets = await listService.fetchUserFollowSets(
          client,
          userNpub,
          session?.type
        );

        // Save to storage
        await FollowSetsStorageService.saveFollowSets(userFollowSets, userNpub);

        // Fetch profiles (now safe from Hermes errors)
        await followSetProfileService.fetchAndStoreProfilesForFollowSets(
          client,
          userFollowSets,
          userNpub
        );

        // Use setTimeout instead of requestAnimationFrame for better isolation
        setTimeout(() => {
          try {
            setFollowSets(userFollowSets);
          } catch {
            // State update failed, reload from storage
            loadFollowSets();
          }
        }, 250);
      }
    } catch {
      // Handle error silently
    }
  }, [userNpub, listService, followSetProfileService, loadFollowSets]);

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
              onSwap={() => setShowSwapModal(true)}
              onReview={handleReviewMint}
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

          {userNpub && (
            <View style={styles.followSetsContainer}>
              <FollowSetsList
                followSets={followSets}
                isLoading={isLoadingFollowSets}
                onEdit={handleEditFollowSet}
                onDelete={handleDeleteFollowSet}
                onCreateNew={handleCreateFollowSet}
                onSetAsActive={handleSetAsActive}
                onSyncAll={handleSyncAllFollowSets}
                activeFollowSetEventId={activeFollowSetEventId}
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zap Settings</Text>

          <View style={styles.zapAmountContainer}>
            <Text style={styles.zapAmountLabel}>Default Zap Amount</Text>
            <TouchableOpacity
              style={styles.zapAmountButton}
              onPress={handleZapAmountTap}
            >
              <Text style={styles.zapAmountValue}>{zapAmount} sats</Text>
              <Text style={styles.zapAmountHint}>Tap to change</Text>
            </TouchableOpacity>
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

        {userNpub && onLogout && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>

            <TouchableOpacity
              style={styles.settingButton}
              onPress={() =>
                navigation.navigate('UserPosts', {
                  userNpub,
                  userName: internalUserName || 'Loading...',
                })
              }
              disabled={internalProfileLoading}
            >
              <Text style={styles.settingButtonText}>
                {internalProfileLoading
                  ? 'Loading...'
                  : internalUserName || 'View Profile'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.settingButton,
                isLoggingOut && styles.disabledButton,
              ]}
              onPress={handleLogout}
              disabled={isLoggingOut}
            >
              <Text style={[styles.settingButtonText, styles.dangerText]}>
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

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

      <SwapModal
        visible={showSwapModal}
        onClose={() => setShowSwapModal(false)}
        mintBalances={mintBalances}
        onSwap={handleSwapBetweenMints}
      />

      <ZapAmountModal
        visible={showZapAmountModal}
        currentAmount={zapAmount}
        onClose={handleZapAmountModalClose}
        onSubmit={handleZapAmountSubmit}
      />

      <RelayUrlModal
        visible={showRelayModal}
        onClose={() => setShowRelayModal(false)}
        onSubmit={handleAddRelay}
      />

      <FollowSetModal
        visible={showFollowSetModal}
        followSet={editingFollowSet}
        followSets={followSets}
        userNpub={userNpub!}
        onClose={handleFollowSetModalClose}
        onSave={handleSaveFollowSet}
      />

      <MintReviewModal
        visible={showReviewModal}
        mintUrl={reviewMintUrl}
        onClose={handleReviewModalClose}
        userNpub={userNpub}
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
  followSetsContainer: {
    position: 'relative',
    marginTop: 20,
    // Container for follow sets list component
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
  disabledButton: {
    opacity: 0.5,
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
  zapAmountButton: {
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
  },
  zapAmountValue: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  zapAmountHint: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
});
