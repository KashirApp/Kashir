import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NostrClientService } from '../services/NostrClient';
import { sharedProfileService } from '../services/ProfileService';
import { usePosts } from '../hooks/usePosts';
import { PostList } from './PostList';
import { styles } from '../App.styles';
import type { RootStackParamList } from '../App';

type UserPostsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'UserPosts'
>;

export function UserPostsScreen({ route }: UserPostsScreenProps) {
  const { userNpub, userName } = route.params;
  const [client, _setClient] = useState(
    NostrClientService.getInstance().getClient()
  );

  // Use the shared ProfileService instance instead of creating a new one
  const profileService = sharedProfileService;

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
        title={
          loading ? `Fetching ${userName}'s posts...` : `${userName}'s posts`
        }
      />
    </SafeAreaView>
  );
}
