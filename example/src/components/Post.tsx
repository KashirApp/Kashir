import React, { useState, useEffect, useMemo, memo } from 'react';
import { Text, View, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { EventInterface, TimestampInterface } from 'kashir';
import { styles } from '../App.styles';
import { PostActionService } from '../services/PostActionService';
import { StorageService } from '../services/StorageService';
import { walletManager } from '../services/WalletManager';
import type { PostWithStats } from '../types/EventStats';
import type { NostrStackParamList } from './NostrNavigator';
import { ImagePreview } from './ImagePreview';
import { VideoPreview } from './VideoPreview';
import { ReplyModal } from './ReplyModal';
import {
  extractImageUrls,
  removeImageUrlsFromContent,
} from '../utils/imageUtils';
import {
  extractVideoUrls,
  removeVideoUrlsFromContent,
} from '../utils/videoUtils';

interface PostProps {
  post: PostWithStats;
  index: number;
  totalPosts: number;
  authorName?: string;
  showAuthor?: boolean;
  onPress?: () => void; // Optional onPress override
  userKeys?: any;
  loginType?: any;
  onReplyPosted?: () => void;
}

const formatTimestamp = (timestamp: TimestampInterface) => {
  const date = new Date(Number(timestamp.asSecs()) * 1000);
  return date.toLocaleString();
};

const PostComponent = ({
  post,
  index,
  totalPosts,
  authorName,
  showAuthor = false,
  onPress,
  userKeys,
  loginType,
  onReplyPosted,
}: PostProps) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<NostrStackParamList>>();
  // All posts are PostWithStats with originalEvent for actions
  const eventData = post.event;
  const stats = post.stats;
  const originalEvent = (post as any).originalEvent as EventInterface;

  const postId = eventData.id;
  const originalPostContent = eventData.content;
  const postTimestamp = originalEvent.createdAt();

  // Extract images and videos, and clean content
  const imageUrls = useMemo(
    () => extractImageUrls(originalPostContent),
    [originalPostContent]
  );
  const videoUrls = useMemo(() => {
    return extractVideoUrls(originalPostContent);
  }, [originalPostContent]);
  const postContent = useMemo(() => {
    let cleanedContent = originalPostContent;

    // Remove image URLs
    if (imageUrls.length > 0) {
      cleanedContent = removeImageUrlsFromContent(cleanedContent, imageUrls);
    }

    // Remove video URLs
    if (videoUrls.length > 0) {
      cleanedContent = removeVideoUrlsFromContent(cleanedContent, videoUrls);
    }

    return cleanedContent;
  }, [originalPostContent, imageUrls, videoUrls]);

  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [isZapping, setIsZapping] = useState(false);
  const [zapAmount, setZapAmount] = useState(21);
  const [isReplyModalVisible, setIsReplyModalVisible] = useState(false);
  const postActionService = PostActionService.getInstance();

  // Access wallet functionality for payments via WalletManager
  const [_walletState, setWalletState] = useState(walletManager.getState());

  // Subscribe to WalletManager state changes
  useEffect(() => {
    const unsubscribe = walletManager.subscribe(() => {
      setWalletState(walletManager.getState());
    });

    return unsubscribe;
  }, []);

  // Load zap amount from storage
  useEffect(() => {
    const loadZapAmount = async () => {
      try {
        const amount = await StorageService.loadZapAmount();
        setZapAmount(amount);
      } catch (error) {
        console.warn('Failed to load zap amount:', error);
      }
    };
    loadZapAmount();
  }, []);

  const handleLike = async () => {
    if (isLiking) return;

    setIsLiking(true);
    try {
      await postActionService.likePost(postId, originalEvent);
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
      await postActionService.repostPost(postId, originalEvent);
      Alert.alert('Success', 'Post reposted successfully!');
    } catch (error) {
      console.error('Failed to repost post:', error);
      Alert.alert('Error', 'Failed to repost post. Please try again.');
    } finally {
      setIsReposting(false);
    }
  };

  const handleZap = async () => {
    if (isZapping) return;

    setIsZapping(true);
    try {
      // Create a payment callback that uses WalletManager
      const sendPaymentCallback = async (invoice: string): Promise<boolean> => {
        try {
          // Use WalletManager to send payment
          await walletManager.sendPayment(invoice);
          return true; // Payment was successful
        } catch (error) {
          console.error('WalletManager payment failed:', error);
          throw error; // Re-throw so the main zap handler can show the error
        }
      };

      // Use configurable zap amount
      await postActionService.zapPost(
        postId,
        originalEvent,
        zapAmount,
        undefined,
        sendPaymentCallback
      );
      Alert.alert(
        'Zap Sent! ⚡',
        `Successfully zapped ${zapAmount} sats to this post!`
      );
    } catch (error) {
      console.error('Failed to zap post:', error);

      // Provide user-friendly error messages
      let errorMessage = 'Failed to zap post. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Lightning address')) {
          errorMessage =
            'This user does not have a Lightning address for receiving zaps.';
        } else if (error.message.includes('Insufficient')) {
          errorMessage = 'Insufficient balance to send this zap.';
        } else if (error.message.includes('Wallet not available')) {
          errorMessage = 'Please create a wallet first in the Wallet tab.';
        }
      }

      Alert.alert('Zap Failed', errorMessage);
    } finally {
      setIsZapping(false);
    }
  };

  const handlePostPress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('PostDetail', {
        post: {
          ...post,
          authorName,
        },
      });
    }
  };

  const handleReply = () => {
    setIsReplyModalVisible(true);
  };

  const handleReplyPosted = () => {
    setIsReplyModalVisible(false);
    onReplyPosted?.();
  };

  return (
    <View key={postId} style={styles.postCard}>
      <TouchableOpacity onPress={handlePostPress} activeOpacity={0.7}>
        {showAuthor && authorName && (
          <Text style={styles.postAuthor}>@{authorName}</Text>
        )}
        <Text style={styles.postDate}>{formatTimestamp(postTimestamp)}</Text>
        <Text style={styles.postContent}>{postContent}</Text>
        <ImagePreview imageUrls={imageUrls} />
        <VideoPreview videoUrls={videoUrls} />
      </TouchableOpacity>

      <View style={styles.postActions} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.actionButton, styles.enabledButton]}
          onPress={handleReply}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>
            💬
            {stats && stats.replies > 0 && ` ${stats.replies.toLocaleString()}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            isLiking ? styles.disabledButton : styles.enabledButton,
          ]}
          onPress={handleLike}
          disabled={isLiking}
        >
          <Text style={styles.actionButtonText}>
            {isLiking ? '⏳' : '👍'}
            {stats && stats.likes > 0 && ` ${stats.likes.toLocaleString()}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            isReposting ? styles.disabledButton : styles.enabledButton,
          ]}
          onPress={handleRepost}
          disabled={isReposting}
        >
          <Text style={styles.actionButtonText}>
            {isReposting ? '⏳' : '🔄'}
            {stats && stats.reposts > 0 && ` ${stats.reposts.toLocaleString()}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            isZapping ? styles.disabledButton : styles.enabledButton,
          ]}
          onPress={handleZap}
          disabled={isZapping}
        >
          <Text style={styles.actionButtonText}>
            {isZapping ? '⏳' : '⚡'}
            {stats &&
              stats.satszapped > 0 &&
              ` ${stats.satszapped.toLocaleString()}`}
          </Text>
        </TouchableOpacity>
      </View>

      {index < totalPosts - 1 && <View style={styles.separator} />}

      {/* Reply Modal */}
      <ReplyModal
        visible={isReplyModalVisible}
        onClose={() => setIsReplyModalVisible(false)}
        post={post}
        userKeys={userKeys}
        loginType={loginType}
        onReplyPosted={handleReplyPosted}
      />
    </View>
  );
};

export const Post = memo(PostComponent, (prevProps, nextProps) => {
  return (
    prevProps.post.event.id === nextProps.post.event.id &&
    prevProps.index === nextProps.index &&
    prevProps.totalPosts === nextProps.totalPosts &&
    prevProps.authorName === nextProps.authorName &&
    prevProps.showAuthor === nextProps.showAuthor &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.userKeys === nextProps.userKeys &&
    prevProps.loginType === nextProps.loginType &&
    prevProps.onReplyPosted === nextProps.onReplyPosted
  );
});
