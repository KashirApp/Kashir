import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Button, SafeAreaView, Alert } from 'react-native';
import { NostrClientService } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { usePosts } from '../hooks/usePosts';
import { useFollowing } from '../hooks/useFollowing';
import { Header } from './Header';
import { TabNavigation } from './TabNavigation';
import { PostList } from './PostList';
import type { TabType } from '../types';
import { styles } from '../App.styles';

interface PostsScreenProps {
  userNpub: string;
  onLogout: () => Promise<void>;
}

export function PostsScreen({ userNpub, onLogout }: PostsScreenProps) {
  const [isClientReady, setIsClientReady] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('following');
  
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
    fetchFollowingPosts 
  } = useFollowing(client, profileService);

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

  // Auto-fetch following data when client is ready (only once)
  useEffect(() => {
    if (isClientReady && userNpub && !hasInitialFetchStarted.current) {
      hasInitialFetchStarted.current = true;
      fetchFollowingList(userNpub);
      fetchFollowingPosts(userNpub);
    }
  }, [isClientReady, userNpub, fetchFollowingList, fetchFollowingPosts]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    
    // Only fetch if we're switching to a tab that has no data and isn't currently loading
    if (tab === 'following' && followingPosts.length === 0 && !followingLoading) {
      fetchFollowingPosts(userNpub);
    } else if (tab === 'your-posts' && posts.length === 0 && !loading) {
      fetchPosts(userNpub);
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'your-posts') {
      fetchPosts(userNpub);
    } else {
      fetchFollowingPosts(userNpub);
    }
  };

  const handleLogout = async () => {
    clientService.disconnect();
    await onLogout();
  };

  const currentPosts = activeTab === 'your-posts' ? posts : followingPosts;
  const currentLoading = activeTab === 'your-posts' ? loading : followingLoading;

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
      />

      <TabNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        followingCount={followingList.length}
      />

      <View style={styles.headerButtons}>
        <Button
          title="Refresh"
          onPress={handleRefresh}
          disabled={currentLoading || !isClientReady}
        />
      </View>

      <PostList
        posts={currentPosts}
        loading={currentLoading}
        showAuthor={activeTab === 'following'}
        profileService={profileService}
        title={
          activeTab === 'your-posts'
            ? 'Fetching your posts...'
            : 'Fetching posts from following...'
        }
      />
    </SafeAreaView>
  );
} 