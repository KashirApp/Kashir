import React, { useState, useEffect, useMemo, memo } from 'react';
import { Text, View, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { EventInterface, TimestampInterface } from 'kashir';
import { PublicKey } from 'kashir';
import { styles } from '../App.styles';
import { PostActionService } from '../services/PostActionService';
import { StorageService } from '../services/StorageService';
import { walletManager } from '../services/WalletManager';
import type { PostWithStats } from '../types/EventStats';
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
import {
  parseNostrContent,
  extractEventIdsFromNevents,
  fetchEmbeddedPosts,
} from '../utils/nostrUtils';
import { TappableContent } from './TappableContent';
import { UrlPreview } from './UrlPreview';
import { EmbeddedPost } from './EmbeddedPost';
import { NostrClientService } from '../services/NostrClient';

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
  profileService: any; // ProfileService for nprofile parsing
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
  profileService,
}: PostProps) => {
  const navigation =
    useNavigation<
      CompositeNavigationProp<
        NativeStackNavigationProp<NostrStackParamList>,
        NativeStackNavigationProp<RootStackParamList>
      >
    >();
  // All posts are PostWithStats with originalEvent for actions
  const eventData = post.event;
  const stats = post.stats;
  const originalEvent = (post as any).originalEvent as EventInterface;
  const isLoadingStats = post.isLoadingStats;
  const isLoadingContent = post.isLoadingContent;

  const postId = eventData.id;
  const originalPostContent = eventData.content;
  const postTimestamp = originalEvent
    ? originalEvent.createdAt()
    : { asSecs: () => eventData.created_at };

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

  // Extract nevent IDs for embedded posts
  const neventIds = useMemo(() => {
    return extractEventIdsFromNevents(originalPostContent);
  }, [originalPostContent]);

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
  }, [originalPostContent, imageUrls, videoUrls, urls, profileService]);

  const [isLiking, setIsLiking] = useState(false);
  const [isReposting, setIsReposting] = useState(false);
  const [isZapping, setIsZapping] = useState(false);
  const [isReplyModalVisible, setIsReplyModalVisible] = useState(false);
  const [embeddedPosts, setEmbeddedPosts] = useState<Map<string, any>>(
    new Map()
  );
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

  // Fetch embedded posts when nevent IDs are present
  useEffect(() => {
    if (neventIds.length > 0) {
      const fetchEmbedded = async () => {
        try {
          const client = NostrClientService.getInstance().getClient();
          if (client) {
            const posts = await fetchEmbeddedPosts(
              client,
              neventIds,
              (updatedPosts) => {
                // Update state when stats are loaded
                setEmbeddedPosts(new Map(updatedPosts));
              }
            );
            setEmbeddedPosts(posts);

            // Fetch profiles for embedded post authors
            if (posts.size > 0) {
              const authorPubkeys: string[] = [];
              for (const embeddedPostData of posts.values()) {
                if (embeddedPostData.event.pubkey) {
                  authorPubkeys.push(embeddedPostData.event.pubkey);
                }
              }

              if (authorPubkeys.length > 0 && profileService) {
                // Convert hex pubkeys to PublicKey objects for profile fetching
                try {
                  const pubkeyObjects = authorPubkeys
                    .map((hex) => {
                      try {
                        return PublicKey.parse('hex:' + hex);
                      } catch {
                        try {
                          return PublicKey.parse(hex);
                        } catch {
                          return null;
                        }
                      }
                    })
                    .filter(Boolean);

                  if (pubkeyObjects.length > 0) {
                    await profileService.fetchProfilesForPubkeys(
                      client,
                      pubkeyObjects
                    );
                  }
                } catch (error) {
                  console.error(
                    'Failed to fetch embedded post author profiles:',
                    error
                  );
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch embedded posts:', error);
        }
      };
      fetchEmbedded();
    }
  }, [neventIds, profileService]);

  const handleLike = async () => {
    if (isLiking || !originalEvent) return;

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
    if (isReposting || !originalEvent) return;

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
    if (isZapping || !originalEvent) return;

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

  const handleAuthorPress = () => {
    if (!originalEvent) return;

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
    <View key={postId} style={styles.postCard}>
      <TouchableOpacity onPress={handlePostPress} activeOpacity={0.7}>
        {showAuthor && authorName && !isLoadingContent && (
          <TouchableOpacity onPress={handleAuthorPress} activeOpacity={0.7}>
            <Text style={styles.postAuthor}>@{authorName}</Text>
          </TouchableOpacity>
        )}
        {!isLoadingContent && (
          <Text style={styles.postDate}>{formatTimestamp(postTimestamp)}</Text>
        )}
        <TappableContent
          content={postContent}
          textStyle={styles.postContent}
          profileService={profileService}
        />
        <ImagePreview imageUrls={imageUrls} />
        <VideoPreview videoUrls={videoUrls} />
        {urls.map((url, urlIndex) => (
          <UrlPreview key={`${url}-${urlIndex}`} url={url} />
        ))}
        {/* Embedded posts from nevents */}
        {Array.from(embeddedPosts.values()).map(
          (embeddedPost, embeddedIndex) => {
            // Get author name from profile service
            const authorProfile = profileService
              ?.getProfileCache()
              ?.get(embeddedPost.event.pubkey);
            const embeddedAuthorName = authorProfile?.name;

            return (
              <EmbeddedPost
                key={`embedded-${embeddedPost.event.id}-${embeddedIndex}`}
                post={embeddedPost}
                authorName={embeddedAuthorName}
                profileService={profileService}
              />
            );
          }
        )}
      </TouchableOpacity>

      <View style={styles.postActions} pointerEvents="box-none">
        <TouchableOpacity
          style={[
            styles.actionButton,
            !originalEvent ? styles.disabledButton : styles.enabledButton,
          ]}
          onPress={handleReply}
          disabled={!originalEvent}
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
            isLiking || !originalEvent
              ? styles.disabledButton
              : styles.enabledButton,
          ]}
          onPress={handleLike}
          disabled={isLiking || !originalEvent}
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
            isReposting || !originalEvent
              ? styles.disabledButton
              : styles.enabledButton,
          ]}
          onPress={handleRepost}
          disabled={isReposting || !originalEvent}
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
            isZapping || !originalEvent
              ? styles.disabledButton
              : styles.enabledButton,
          ]}
          onPress={handleZap}
          disabled={isZapping || !originalEvent}
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
    prevProps.post.event.content === nextProps.post.event.content &&
    prevProps.index === nextProps.index &&
    prevProps.totalPosts === nextProps.totalPosts &&
    prevProps.authorName === nextProps.authorName &&
    prevProps.showAuthor === nextProps.showAuthor &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.userKeys === nextProps.userKeys &&
    prevProps.loginType === nextProps.loginType &&
    prevProps.onReplyPosted === nextProps.onReplyPosted &&
    prevProps.profileService === nextProps.profileService
  );
});
