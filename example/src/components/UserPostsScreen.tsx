import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Button,
  SafeAreaView,
  Text,
  TouchableOpacity,
} from 'react-native';
import { NostrClientService } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { usePosts } from '../hooks/usePosts';
import { PostList } from './PostList';
import { styles } from '../App.styles';

interface UserPostsScreenProps {
  userNpub: string;
  userName: string;
  onBack: () => void;
}

export function UserPostsScreen({
  userNpub,
  userName,
  onBack,
}: UserPostsScreenProps) {
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
      {/* Header with back button */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{userName}'s Posts</Text>
          <View style={{ width: 60 }} />
        </View>
      </View>

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