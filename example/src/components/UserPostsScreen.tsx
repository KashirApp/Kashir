import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Button,
  SafeAreaView,
  Text,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NostrClientService } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { usePosts } from '../hooks/usePosts';
import { PostList } from './PostList';
import { styles } from '../App.styles';
import type { NostrStackParamList } from './NostrNavigator';

type UserPostsScreenProps = NativeStackScreenProps<NostrStackParamList, 'UserPosts'>;

export function UserPostsScreen({
  route,
}: UserPostsScreenProps) {
  const { userNpub, userName } = route.params;
  const [client, setClient] = useState(NostrClientService.getInstance().getClient());
  
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

  const handleRefresh = () => {
    fetchPosts(userNpub);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerButtons}>
        <Button
          title="Refresh"
          onPress={handleRefresh}
          disabled={loading}
        />
      </View>

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