import React from 'react';
import { Text, View } from 'react-native';
import type { EventInterface, TimestampInterface } from '../../../src';
import { styles } from '../App.styles';

interface PostProps {
  post: EventInterface;
  index: number;
  totalPosts: number;
  authorName?: string;
  showAuthor?: boolean;
}

const formatTimestamp = (timestamp: TimestampInterface) => {
  const date = new Date(Number(timestamp.asSecs()) * 1000);
  return date.toLocaleString();
};

export function Post({
  post,
  index,
  totalPosts,
  authorName,
  showAuthor = false,
}: PostProps) {
  return (
    <View key={post.id().toHex()} style={styles.postCard}>
      {showAuthor && authorName && (
        <Text style={styles.postAuthor}>@{authorName}</Text>
      )}
      <Text style={styles.postDate}>{formatTimestamp(post.createdAt())}</Text>
      <Text style={styles.postContent}>{post.content()}</Text>
      {index < totalPosts - 1 && <View style={styles.separator} />}
    </View>
  );
}
