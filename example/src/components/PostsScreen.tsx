import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Button,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Text,
} from 'react-native';
import { NostrClientService, LoginType } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { SecureStorageService } from '../services/SecureStorageService';
import { usePosts } from '../hooks/usePosts';
import { useFollowing } from '../hooks/useFollowing';
import { useTrending } from '../hooks/useTrending';
import { useEvents } from '../hooks/useEvents';
import { Header } from './Header';
import { TabNavigation } from './TabNavigation';
import { PostList } from './PostList';
import { EventList } from './EventList';
import { EventMapScreen } from './EventMapScreen';
import { ComposeNoteModal } from './ComposeNoteModal';
import { UserPostsScreen } from './UserPostsScreen';
import type { TabType } from '../types';
import { styles } from '../App.styles';
import { Keys, SecretKey } from 'kashir';

interface PostsScreenProps {
  userNpub: string;
  loginType: LoginType;
  onLogout: () => Promise<void>;
}

export function PostsScreen({
  userNpub,
  loginType,
  onLogout,
}: PostsScreenProps) {
  const [isClientReady, setIsClientReady] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  const [userKeys, setUserKeys] = useState<Keys | null>(null);
  const [isComposeModalVisible, setIsComposeModalVisible] = useState(false);
  const [showUserPostsScreen, setShowUserPostsScreen] = useState(false);
  const [showEventMapScreen, setShowEventMapScreen] = useState(false);

  // Use ref to track if initial fetch has been triggered
  const hasInitialFetchStarted = useRef(false);

  // Initialize services
  const clientService = useMemo(() => NostrClientService.getInstance(), []);
  const profileService = useMemo(() => new ProfileService(), []);
  const [client, setClient] = useState(clientService.getClient());

  // Custom hooks
  const { posts, loading, fetchPosts } = usePosts(client);
  const {
    followingPosts,
    followingList,
    followingLoading,
    profilesLoading,
    fetchFollowingList,
    fetchFollowingPosts,
  } = useFollowing(client, profileService);
  const {
    trendingPosts,
    trendingEventIds,
    trendingLoading,
    profilesLoading: trendingProfilesLoading,
    fetchTrendingPosts,
  } = useTrending(client, profileService);
  const {
    events,
    loading: eventsLoading,
    profilesLoading: eventsProfilesLoading,
    fetchEvents,
  } = useEvents(client, profileService);

  // Initialize client on mount
  useEffect(() => {
    const initClient = async () => {
      try {
        const newClient = await clientService.initialize();
        setClient(newClient);
        setIsClientReady(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to connect to Nostr relays');
      }
    };

    initClient();

    // Cleanup on unmount
    return () => {
      clientService.disconnect();
    };
  }, [clientService]);

  // Load user keys for signing DVM requests
  useEffect(() => {
    const loadKeys = async () => {
      try {
        const privateKey = await SecureStorageService.getNostrPrivateKey();
        if (privateKey) {
          const secretKey = SecretKey.parse(privateKey);
          const keys = new Keys(secretKey);
          setUserKeys(keys);
        } else {
          console.log('No Nostr private key found in secure storage');
        }
      } catch (error) {
        console.error('Failed to load user keys:', error);
      }
    };

    loadKeys();
  }, []);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!client || !isClientReady || !userNpub) return;

      setProfileLoading(true);
      try {
        const name = await profileService.fetchUserProfile(client, userNpub);
        setUserName(name);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [client, isClientReady, userNpub, profileService]);

  // Auto-fetch trending data when client is ready (only once)
  useEffect(() => {
    if (isClientReady && userNpub && !hasInitialFetchStarted.current) {
      hasInitialFetchStarted.current = true;

      // Fetch trending content on startup (default tab)
      // For Amber users, userKeys will be null, but trending doesn't require signing
      if (userKeys) {
        fetchTrendingPosts(userKeys);
      } else {
        // For Amber users, we can still fetch trending without keys
        // since it only reads DVM responses, doesn't publish
        console.log('Fetching trending posts for Amber user (no local keys)');
        fetchTrendingPosts(null);
      }
    }
  }, [isClientReady, userNpub, userKeys, fetchTrendingPosts]);

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
      // For trending, try with userKeys if available, otherwise null for Amber users
      fetchTrendingPosts(userKeys || null);
    } else if (
      tab === 'events' &&
      events.length === 0 &&
      !eventsLoading
    ) {
      fetchEvents();
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'following') {
      fetchFollowingPosts(userNpub);
    } else if (activeTab === 'trending') {
      fetchTrendingPosts(userKeys || null);
    } else if (activeTab === 'events') {
      fetchEvents();
    }
  };

  const handleLogout = async () => {
    clientService.disconnect();
    await onLogout();
  };

  const handleComposeNote = () => {
    setIsComposeModalVisible(true);
  };

  const handleNotePosted = () => {
    // Refresh the current tab after posting a note
    handleRefresh();
  };

  const handleShowUserPosts = () => {
    setShowUserPostsScreen(true);
  };

  const handleBackFromUserPosts = () => {
    setShowUserPostsScreen(false);
  };

  const handleShowEventMap = () => {
    setShowEventMapScreen(true);
  };

  const handleBackFromEventMap = () => {
    setShowEventMapScreen(false);
  };

  const currentPosts = activeTab === 'following'
    ? followingPosts
    : activeTab === 'trending'
    ? trendingPosts
    : [];
  const currentLoading = activeTab === 'following'
    ? followingLoading
    : activeTab === 'trending'
    ? trendingLoading
    : eventsLoading;

  if (showUserPostsScreen) {
    return (
      <UserPostsScreen
        userNpub={userNpub}
        userName={userName}
        onBack={handleBackFromUserPosts}
      />
    );
  }

  if (showEventMapScreen) {
    return (
      <EventMapScreen
        events={events}
        profileService={profileService}
        onBack={handleBackFromEventMap}
        onEventPress={(event) => {
          console.log('Event pressed from map:', event.title);
          // Navigate back to event list and show event details
          setShowEventMapScreen(false);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        userName={userName}
        userNpub={userNpub}
        profileLoading={profileLoading}
        isClientReady={isClientReady}
        currentLoading={currentLoading}
        onLogout={handleLogout}
        onRefresh={handleRefresh}
        onShowUserPosts={handleShowUserPosts}
      />

      <TabNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        followingCount={followingList.length}
        eventsCount={events.length}
      />

      <View style={styles.headerButtons}>
        <Button
          title="Refresh"
          onPress={handleRefresh}
          disabled={currentLoading || !isClientReady}
        />
      </View>

      {/* Simplified rendering - show events or posts based on active tab */}
      {activeTab === 'events' ? (
        <EventList
          events={events}
          loading={eventsLoading}
          profileService={profileService}
          title="Calendar Events"
          onEventPress={(event) => {
            console.log('Event pressed:', event.title);
            // TODO: Navigate to event detail view
          }}
          onMapPress={handleShowEventMap}
        />
      ) : (
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
        />
      )}

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
    </SafeAreaView>
  );
}
