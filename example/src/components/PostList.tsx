import React, { useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
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
  userKeys?: any;
  loginType?: any;
  onReplyPosted?: () => void;
}

export function PostList({
  posts,
  loading,
  showAuthor,
  profileService,
  title,
  hidePostCount = false,
  userKeys,
  loginType,
  onReplyPosted,
}: PostListProps) {
  const getAuthorName = useCallback(
    (post: PostWithStats): string => {
      if (!showAuthor || !post || !post.event) return '';

      const pubkey = post.event.pubkey;

      // Get name from cache
      const cached = profileService.getProfileCache().get(pubkey);
      if (cached && cached.name) {
        return cached.name;
      } else {
        // Fallback to shortened hex if name not loaded yet
        return pubkey.substring(0, 8) + '...';
      }
    },
    [showAuthor, profileService]
  );

  const renderPost = useCallback(
    ({ item, index }: { item: PostWithStats; index: number }) => {
      if (!item || !item.event) {
        return null;
      }
      
      return (
        <Post
          key={item.event.id}
          post={item}
          index={index}
          totalPosts={posts.length}
          authorName={getAuthorName(item)}
          showAuthor={showAuthor}
          userKeys={userKeys}
          loginType={loginType}
          onReplyPosted={onReplyPosted}
        />
      );
    },
    [
      posts.length,
      getAuthorName,
      showAuthor,
      userKeys,
      loginType,
      onReplyPosted,
    ]
  );

  const renderHeader = useCallback(() => {
    if (posts.length > 0 && !hidePostCount) {
      return <Text style={styles.postCount}>Found {posts.length} posts</Text>;
    }
    return null;
  }, [posts.length, hidePostCount]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>{title}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.postsContainer}
      data={posts.filter(post => post && post.event)}
      renderItem={renderPost}
      keyExtractor={(item) => item?.event?.id || `unknown-${Math.random()}`}
      ListHeaderComponent={renderHeader}
      removeClippedSubviews={false}
      maxToRenderPerBatch={5}
      windowSize={10}
      initialNumToRender={3}
    />
  );
}
