import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Button,
  Alert,
  TouchableOpacity,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NostrClientService, LoginType } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { SecureStorageService } from '../services/SecureStorageService';
import { usePosts } from '../hooks/usePosts';
import { useFollowing } from '../hooks/useFollowing';
import { useTrending } from '../hooks/useTrending';
import { useEvents } from '../hooks/useEvents';
import type { CalendarEvent } from '../hooks/useEvents';
import { Header } from './Header';
import { TabNavigation } from './TabNavigation';
import { PostList } from './PostList';
import { EventList } from './EventList';
import { ComposeNoteModal } from './ComposeNoteModal';
import type { TabType } from '../types';
import type { NostrStackParamList } from './NostrNavigator';
import { styles } from '../App.styles';
import { Keys, SecretKey, Client } from 'kashir';

type PostsScreenProps = NativeStackScreenProps<
  NostrStackParamList,
  'PostsMain'
> & {
  onLogout: () => void;
};

export function PostsScreen({ route, navigation, onLogout }: PostsScreenProps) {
  const { userNpub, loginType } = route.params;
  const [isClientReady, setIsClientReady] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('trending');
  const [userKeys, setUserKeys] = useState<Keys | null>(null);
  const [isComposeModalVisible, setIsComposeModalVisible] = useState(false);

  // Use ref to track if initial fetch has been triggered
  const hasInitialFetchStarted = useRef(false);

  // Initialize services
  const clientService = useMemo(() => NostrClientService.getInstance(), []);
  const profileService = useMemo(() => new ProfileService(), []);
  
  // Get client from service but only use it when ready
  const [client, setClient] = useState<Client | null>(null);

  // Custom hooks - only pass client when it's ready
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

  // Monitor client readiness instead of initializing our own client
  useEffect(() => {
    const checkClientReadiness = () => {
      if (clientService.isReady()) {
        const readyClient = clientService.getClient();
        console.log('PostsScreen: Client is ready, updating state');
        setClient(readyClient);
        setIsClientReady(true);
      } else {
        console.log('PostsScreen: Client not ready yet');
        setClient(null);
        setIsClientReady(false);
      }
    };

    // Check immediately
    checkClientReadiness();

    // Set up an interval to check client readiness
    const interval = setInterval(checkClientReadiness, 500); // Check every 500ms

    // Clear interval when component unmounts or client becomes ready
    return () => {
      clearInterval(interval);
    };
  }, [clientService]);

  // Stop checking once client is ready
  useEffect(() => {
    if (isClientReady) {
      console.log('PostsScreen: Client ready, stopping readiness checks');
    }
  }, [isClientReady]);

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
    } else if (tab === 'events' && events.length === 0 && !eventsLoading) {
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
    navigation.navigate('UserPosts', {
      userNpub,
      userName,
    });
  };

  const handleShowEventMap = () => {
    navigation.navigate('EventMap', {
      userNpub,
      onEventSelect: handleShowEventDetail,
    });
  };

  const handleShowEventDetail = (event: CalendarEvent) => {
    navigation.navigate('EventDetail', {
      event,
      userNpub,
    });
  };

  const handleEventRSVP = async (
    status: 'accepted' | 'declined' | 'tentative'
  ) => {
    // TODO: Implement RSVP functionality with Nostr
    console.log('RSVP submitted:', status);
    // For now, just show success
    return Promise.resolve();
  };

  const currentPosts =
    activeTab === 'following'
      ? followingPosts
      : activeTab === 'trending'
        ? trendingPosts
        : [];
  const currentLoading =
    activeTab === 'following'
      ? followingLoading
      : activeTab === 'trending'
        ? trendingLoading
        : eventsLoading;

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
            handleShowEventDetail(event);
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
