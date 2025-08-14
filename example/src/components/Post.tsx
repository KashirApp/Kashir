import React, { useState } from 'react';
import { Text, View, TouchableOpacity, Alert } from 'react-native';
import type { EventInterface, TimestampInterface } from 'kashir';
import { styles } from '../App.styles';
import { PostActionService } from '../services/PostActionService';

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
  const postId = post.id().toHex();
  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const postActionService = PostActionService.getInstance();

  const handleLike = async () => {
    if (isLiking) return;
    
    setIsLiking(true);
    try {
      await postActionService.likePost(postId, post);
      Alert.alert('Success', 'Post liked successfully!');
    } catch (error) {
      console.error('Failed to like post:', error);
      Alert.alert('Error', 'Failed to like post. Please try again.');
    } finally {
      setIsLiking(false);
    }
  };

  const handleRepost = async () => {
    if (isReposting) return;
    
    setIsReposting(true);
    try {
      await postActionService.repostPost(postId, post);
      Alert.alert('Success', 'Post reposted successfully!');
    } catch (error) {
      console.error('Failed to repost post:', error);
      Alert.alert('Error', 'Failed to repost post. Please try again.');
    } finally {
      setIsReposting(false);
    }
  };

  return (
    <View key={postId} style={styles.postCard}>
      {showAuthor && authorName && (
        <Text style={styles.postAuthor}>@{authorName}</Text>
      )}
      <Text style={styles.postDate}>{formatTimestamp(post.createdAt())}</Text>
      <Text style={styles.postContent}>{post.content()}</Text>
      
      <View style={styles.postActions}>
        <TouchableOpacity 
          style={[styles.actionButton, { opacity: isLiking ? 0.5 : 1 }]} 
          onPress={handleLike}
          disabled={isLiking}
        >
          <Text style={styles.actionButtonText}>
            {isLiking ? '⏳ Liking...' : '👍 Like'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, { opacity: isReposting ? 0.5 : 1 }]} 
          onPress={handleRepost}
          disabled={isReposting}
        >
          <Text style={styles.actionButtonText}>
            {isReposting ? '⏳ Reposting...' : '🔄 Repost'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {index < totalPosts - 1 && <View style={styles.separator} />}
    </View>
  );
}
