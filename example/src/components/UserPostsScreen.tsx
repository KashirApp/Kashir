import React, { useState, useEffect, useMemo } from 'react';
import { SafeAreaView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NostrClientService } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { usePosts } from '../hooks/usePosts';
import { PostList } from './PostList';
import { styles } from '../App.styles';
import type { RootStackParamList } from '../App';

type UserPostsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'UserPosts'
>;

export function UserPostsScreen({ route }: UserPostsScreenProps) {
  const { userNpub } = route.params;
  const [client, _setClient] = useState(
    NostrClientService.getInstance().getClient()
  );

  // Initialize services
  const profileService = useMemo(() => new ProfileService(), []);

  // Custom hooks
  const { posts, loading, fetchPosts } = usePosts(client);

  // Fetch user posts on mount
  useEffect(() => {
    if (client && userNpub) {
      fetchPosts(userNpub);
    }
  }, [client, userNpub, fetchPosts]);

  return (
    <SafeAreaView style={styles.container}>
      <PostList
        posts={posts}
        loading={loading}
        showAuthor={false}
        profileService={profileService}
        title={loading ? 'Fetching your posts...' : 'Your posts'}
      />
    </SafeAreaView>
  );
}
