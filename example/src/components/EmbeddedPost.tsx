import React, { useState, useEffect, useMemo, memo } from 'react';
import { Text, View, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { TimestampInterface } from 'kashir';
import { styles } from '../App.styles';
import { PostActionService } from '../services/PostActionService';
import { StorageService } from '../services/StorageService';
import { walletManager } from '../services/WalletManager';
import type { NostrStackParamList } from './NostrNavigator';
import type { RootStackParamList } from '../App';
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
import { extractUrls, removeUrlsFromContent } from '../utils/urlUtils';
import { parseNostrContent } from '../utils/nostrUtils';
import { TappableContent } from './TappableContent';
import { UrlPreview } from './UrlPreview';
import { ProfileService } from '../services/ProfileService';

interface EmbeddedPostProps {
  post: {
    event: {
      id: string;
      content: string;
      created_at: number;
      pubkey: string;
      kind: number;
    };
    stats?: {
      event_id: string;
      likes: number;
      reposts: number;
      replies: number;
      mentions: number;
      zaps: number;
      satszapped: number;
      score: number;
      score24h: number;
    };
    originalEvent: any;
    isLoadingStats?: boolean;
  };
  authorName?: string;
  profileService: ProfileService;
}

const formatTimestamp = (timestamp: TimestampInterface | number) => {
  const date =
    typeof timestamp === 'number'
      ? new Date(timestamp * 1000)
      : new Date(Number(timestamp.asSecs()) * 1000);
  return date.toLocaleString();
};

const EmbeddedPostComponent = ({
  post,
  authorName,
  profileService,
}: EmbeddedPostProps) => {
  const navigation =
    useNavigation<
      CompositeNavigationProp<
        NativeStackNavigationProp<NostrStackParamList>,
        NativeStackNavigationProp<RootStackParamList>
      >
    >();

  // All embedded posts have originalEvent for actions
  const eventData = post.event;
  const stats = post.stats;
  const originalEvent = post.originalEvent;
  const isLoadingStats = post.isLoadingStats;

  const postId = eventData.id;
  const originalPostContent = eventData.content;
  const postTimestamp =
    typeof eventData.created_at === 'number'
      ? eventData.created_at
      : originalEvent.createdAt();

  // Extract images and videos, and clean content
  const imageUrls = useMemo(
    () => extractImageUrls(originalPostContent),
    [originalPostContent]
  );
  const videoUrls = useMemo(() => {
    return extractVideoUrls(originalPostContent);
  }, [originalPostContent]);
  const urls = useMemo(
    () => extractUrls(originalPostContent),
    [originalPostContent]
  );

  const postContent = useMemo(() => {
    let cleanedContent = originalPostContent;

    // Parse nostr:nprofile URIs and replace with @username
    if (profileService) {
      cleanedContent = parseNostrContent(cleanedContent, profileService);
    }

    // Remove image URLs
    if (imageUrls.length > 0) {
      cleanedContent = removeImageUrlsFromContent(cleanedContent, imageUrls);
    }

    // Remove video URLs
    if (videoUrls.length > 0) {
      cleanedContent = removeVideoUrlsFromContent(cleanedContent, videoUrls);
    }

    // Remove regular URLs (they'll be shown as previews)
    if (urls.length > 0) {
      cleanedContent = removeUrlsFromContent(cleanedContent, urls);
    }

    return cleanedContent;
  }, [originalPostContent, imageUrls, videoUrls, urls, profileService, post]);

  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [isZapping, setIsZapping] = useState(false);
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
      // Load the current zap amount from storage
      const zapAmount = await StorageService.loadZapAmount();

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
    navigation.navigate('PostDetail', {
      post: {
        event: post.event,
        stats: post.stats || {
          event_id: post.event.id,
          likes: 0,
          reposts: 0,
          replies: 0,
          mentions: 0,
          zaps: 0,
          satszapped: 0,
          score: 0,
          score24h: 0,
        },
        authorName,
        // Cast to any to add originalEvent like other components do
        ...(post as any),
      },
    });
  };

  const handleReply = () => {
    setIsReplyModalVisible(true);
  };

  const handleReplyPosted = () => {
    setIsReplyModalVisible(false);
  };

  const handleAuthorPress = () => {
    try {
      const authorPubkey = originalEvent.author();
      const authorNpub = authorPubkey.toBech32();

      navigation.push('UserPosts', {
        userNpub: authorNpub,
        userName: authorName || 'Loading...',
      });
    } catch (error) {
      console.error('Failed to navigate to user posts:', error);
      Alert.alert('Error', 'Failed to load user profile');
    }
  };

  return (
    <View style={[styles.postCard, styles.embeddedPostCard]}>
      <TouchableOpacity onPress={handlePostPress} activeOpacity={0.7}>
        {authorName && (
          <TouchableOpacity onPress={handleAuthorPress} activeOpacity={0.7}>
            <Text style={styles.postAuthor}>@{authorName}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.postDate}>{formatTimestamp(postTimestamp)}</Text>
        <TappableContent
          content={postContent}
          textStyle={styles.postContent}
          profileService={profileService}
        />
        <ImagePreview imageUrls={imageUrls} isEmbedded={true} />
        <VideoPreview videoUrls={videoUrls} />
        {urls.map((url, urlIndex) => (
          <UrlPreview key={`${url}-${urlIndex}`} url={url} />
        ))}
      </TouchableOpacity>

      <View style={styles.postActions} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.actionButton, styles.enabledButton]}
          onPress={handleReply}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>
            💬
            {isLoadingStats
              ? ' ⏳'
              : stats &&
                stats.replies > 0 &&
                ` ${stats.replies.toLocaleString()}`}
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
            {isLoadingStats
              ? ' ⏳'
              : stats && stats.likes > 0 && ` ${stats.likes.toLocaleString()}`}
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
            {isLoadingStats
              ? ' ⏳'
              : stats &&
                stats.reposts > 0 &&
                ` ${stats.reposts.toLocaleString()}`}
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
            {isLoadingStats
              ? ' ⏳'
              : stats &&
                stats.satszapped > 0 &&
                ` ${stats.satszapped.toLocaleString()}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Reply Modal */}
      <ReplyModal
        visible={isReplyModalVisible}
        onClose={() => setIsReplyModalVisible(false)}
        post={post}
        userKeys={undefined}
        loginType={undefined}
        onReplyPosted={handleReplyPosted}
      />
    </View>
  );
};

export const EmbeddedPost = memo(
  EmbeddedPostComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.post.event.id === nextProps.post.event.id &&
      prevProps.post.event.content === nextProps.post.event.content &&
      prevProps.authorName === nextProps.authorName &&
      prevProps.profileService === nextProps.profileService
    );
  }
);
