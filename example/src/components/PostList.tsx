import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import type { EventInterface } from 'kashir';
import { ProfileService } from '../services/ProfileService';
import { Post } from './Post';
import { styles } from '../App.styles';

interface PostListProps {
  posts: EventInterface[];
  loading: boolean;
  showAuthor: boolean;
  profileService: ProfileService;
  title: string;
  onProfileFetch?: (pubkey: any) => void;
  hidePostCount?: boolean;
}

export function PostList({
  posts,
  loading,
  showAuthor,
  profileService,
  title,
  hidePostCount = false,
}: PostListProps) {
  const getAuthorName = (post: EventInterface): string => {
    if (!showAuthor) return '';

    const authorPubkey = post.author();
    const hexKey = authorPubkey.toHex();

    // Get name from cache
    const cached = profileService.getProfileCache().get(hexKey);
    if (cached && cached.name) {
      return cached.name;
    } else {
      // Fallback to shortened hex if name not loaded yet
      return hexKey.substring(0, 8) + '...';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{title}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.postsContainer}>
      {posts.length > 0 && !hidePostCount && (
        <Text style={styles.postCount}>Found {posts.length} posts</Text>
      )}
      {posts.map((post, index) => (
        <Post
          key={post.id().toHex()}
          post={post}
          index={index}
          totalPosts={posts.length}
          authorName={getAuthorName(post)}
          showAuthor={showAuthor}
        />
      ))}
    </ScrollView>
  );
}
