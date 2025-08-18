import React from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { ProfileService } from '../services/ProfileService';
import { Post } from './Post';
import type { PostWithStats } from '../types/EventStats';
import { styles } from '../App.styles';

interface PostListProps {
  posts: PostWithStats[];
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
  const getAuthorName = (post: PostWithStats): string => {
    if (!showAuthor) return '';

    const pubkey = post.event.pubkey;

    // Get name from cache
    const cached = profileService.getProfileCache().get(pubkey);
    if (cached && cached.name) {
      return cached.name;
    } else {
      // Fallback to shortened hex if name not loaded yet
      return pubkey.substring(0, 8) + '...';
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
      {posts.map((post, index) => {
        const postKey = post.event.id;

        return (
          <Post
            key={postKey}
            post={post}
            index={index}
            totalPosts={posts.length}
            authorName={getAuthorName(post)}
            showAuthor={showAuthor}
          />
        );
      })}
    </ScrollView>
  );
}
