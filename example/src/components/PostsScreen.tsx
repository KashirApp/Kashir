import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NostrClientService } from '../services/NostrClient';
import { sharedProfileService } from '../services/ProfileService';
import { useFollowing } from '../hooks/useFollowing';
import { useTrending } from '../hooks/useTrending';
import { Header } from './Header';
import { TabNavigation } from './TabNavigation';
import { PostList } from './PostList';
import { ComposeNoteModal } from './ComposeNoteModal';
import { FollowSetSelectionModal } from './nostr/FollowSetSelectionModal';
import { ListService } from '../services/ListService';
import { StorageService } from '../services/StorageService';
import type { FollowSet } from '../services/ListService';
import type { TabType } from '../types';
import type { NostrStackParamList } from './NostrNavigator';
import { styles } from '../App.styles';
import { NostrKeys as Keys, Client } from 'kashir';
import { getNostrKeys } from '../utils/nostrUtils';

type PostsScreenProps = NativeStackScreenProps<
  NostrStackParamList,
  'PostsMain'
> & {
  onLogout: () => void;
};

export function PostsScreen({
  route,
  navigation: _navigation,
  onLogout: _onLogout,
}: PostsScreenProps) {
  const { userNpub, loginType } = route.params;
  const [isClientReady, setIsClientReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  const [userKeys, setUserKeys] = useState<Keys | null>(null);
  const [isComposeModalVisible, setIsComposeModalVisible] = useState(false);
  const [isFollowSetSelectionVisible, setIsFollowSetSelectionVisible] =
    useState(false);
  const [availableFollowSets, setAvailableFollowSets] = useState<FollowSet[]>(
    []
  );
  const [followSetsLoading, setFollowSetsLoading] = useState(false);
  const [currentActiveFollowSetId, setCurrentActiveFollowSetId] = useState<
    string | undefined
  >();

  // Use ref to track if initial fetch has been triggered
  const hasInitialFetchStarted = useRef(false);

  // Initialize services
  const clientService = useMemo(() => NostrClientService.getInstance(), []);
  const listService = useMemo(() => ListService.getInstance(), []);
  const profileService = sharedProfileService;

  // Get client from service but only use it when ready
  const [client, setClient] = useState<Client | null>(null);

  // Custom hooks - only pass client when it's ready
  const {
    followingPosts,
    followingList,
    followingLoading,
    fetchFollowingPosts,
    currentFollowSetInfo,
    setCurrentFollowSetInfo,
    setFollowingList,
  } = useFollowing(client, profileService);
  const {
    trendingPosts,
    trendingEventIds,
    trendingLoading,
    fetchTrendingPosts,
  } = useTrending(client, profileService);

  // Monitor client readiness instead of initializing our own client
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const checkClientReadiness = () => {
      if (clientService.isReady()) {
        const readyClient = clientService.getClient();
        setClient(readyClient);
        setIsClientReady(true);

        // Clear interval once client is ready
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      } else {
        setClient(null);
        setIsClientReady(false);
      }
    };

    // Check immediately
    checkClientReadiness();

    // Only set interval if client is not ready yet
    if (!clientService.isReady()) {
      interval = setInterval(checkClientReadiness, 500); // Check every 500ms
    }

    // Clear interval when component unmounts
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [clientService]);

  // Load user keys for signing DVM requests
  useEffect(() => {
    const loadKeys = async () => {
      try {
        const keys = await getNostrKeys();
        if (keys) {
          setUserKeys(keys);
        }
      } catch (error) {
        console.error('Failed to load user keys:', error);
      }
    };

    loadKeys();
  }, []);

  // Auto-fetch trending DVM data when client is ready (only once)
  useEffect(() => {
    if (isClientReady && userNpub && !hasInitialFetchStarted.current) {
      hasInitialFetchStarted.current = true;

      // For Amber users, we can still fetch trending without keys
      // since it only reads DVM responses, doesn't publish
      fetchTrendingPosts();
    }
  }, [isClientReady, userNpub, fetchTrendingPosts]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);

    // Only fetch if we're switching to a tab that has no data and isn't currently loading
    if (
      tab === 'following' &&
      followingPosts.length === 0 &&
      !followingLoading
    ) {
      fetchFollowingPosts(userNpub);
    } else if (
      tab === 'trending' &&
      trendingPosts.length === 0 &&
      trendingEventIds.length === 0 &&
      !trendingLoading
    ) {
      fetchTrendingPosts();
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'following') {
      fetchFollowingPosts(userNpub);
    } else if (activeTab === 'trending') {
      fetchTrendingPosts();
    }
  };

  const handleComposeNote = () => {
    setIsComposeModalVisible(true);
  };

  const handleNotePosted = () => {
    // Refresh the current tab after posting a note
    handleRefresh();
  };

  const handleFollowingPress = async () => {
    if (!client) return;

    // Show modal immediately with loading state
    setFollowSetsLoading(true);
    setAvailableFollowSets([]);
    setCurrentActiveFollowSetId(undefined);
    setIsFollowSetSelectionVisible(true);

    try {
      // Load data in background
      const [followSets, activeFollowSet] = await Promise.all([
        listService.fetchUserFollowSets(client, userNpub),
        StorageService.loadActiveFollowSet(),
      ]);

      setAvailableFollowSets(followSets);
      setCurrentActiveFollowSetId(activeFollowSet?.eventId);
    } catch (error) {
      console.error('Error loading follow sets for selection:', error);
    } finally {
      setFollowSetsLoading(false);
    }
  };

  const handleFollowSetSelection = async (followSet: FollowSet | null) => {
    try {
      if (followSet) {
        // Set custom follow set as active
        await StorageService.saveActiveFollowSet(
          followSet.identifier,
          followSet.eventId
        );
        // Immediately update the UI with the selected follow set info
        setCurrentFollowSetInfo({
          identifier: followSet.identifier,
          eventId: followSet.eventId,
        });
        const combinedKeys = [
          ...followSet.publicKeys,
          ...(followSet.privateKeys || []),
        ];
        setFollowingList(combinedKeys);

        // Switch to following tab and trigger refresh with the new follow list
        setActiveTab('following');
        setTimeout(() => fetchFollowingPosts(userNpub, combinedKeys), 100);
      } else {
        // Use main following list (remove active follow set)
        await StorageService.removeActiveFollowSet();
        // Find the main following list from available follow sets
        const mainFollowSet = availableFollowSets.find(
          (set) => set.identifier === 'Following'
        );
        if (mainFollowSet) {
          setCurrentFollowSetInfo({
            identifier: 'Following',
            eventId: 'kind3',
          });
          setFollowingList(mainFollowSet.publicKeys);

          // Switch to following tab and trigger refresh with the main follow list
          setActiveTab('following');
          setTimeout(
            () => fetchFollowingPosts(userNpub, mainFollowSet.publicKeys),
            100
          );
        }
      }
    } catch (error) {
      console.error('Error setting active follow set:', error);
    }
  };

  const currentPosts =
    activeTab === 'following'
      ? followingPosts
      : activeTab === 'trending'
        ? trendingPosts
        : [];
  const currentLoading =
    activeTab === 'following' ? followingLoading : trendingLoading;

  return (
    <SafeAreaView style={styles.container}>
      <Header />

      <TabNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onFollowingPress={handleFollowingPress}
        followingCount={followingList.length}
        trendingCount={trendingPosts.length}
        currentFollowSetName={currentFollowSetInfo?.identifier}
      />

      {/* Show posts based on active tab */}
      <PostList
        posts={currentPosts}
        loading={currentLoading}
        showAuthor={activeTab === 'following' || activeTab === 'trending'}
        profileService={profileService}
        title={
          activeTab === 'following'
            ? 'Fetching posts from following...'
            : activeTab === 'trending' && trendingPosts.length > 0
              ? 'Trending posts'
              : 'Fetching trending posts...'
        }
        hidePostCount={activeTab === 'trending'}
        userKeys={userKeys}
        loginType={loginType}
        onReplyPosted={handleRefresh}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleComposeNote}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Compose Note Modal */}
      <ComposeNoteModal
        visible={isComposeModalVisible}
        onClose={() => setIsComposeModalVisible(false)}
        userKeys={userKeys}
        loginType={loginType}
        onNotePosted={handleNotePosted}
      />

      {/* Follow Set Selection Modal */}
      <FollowSetSelectionModal
        visible={isFollowSetSelectionVisible}
        followSets={availableFollowSets}
        activeFollowSetId={currentActiveFollowSetId}
        loading={followSetsLoading}
        onClose={() => setIsFollowSetSelectionVisible(false)}
        onSelect={handleFollowSetSelection}
      />
    </SafeAreaView>
  );
}
