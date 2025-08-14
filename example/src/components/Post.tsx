import React, { useState, useEffect } from 'react';
import { Text, View, TouchableOpacity, Alert } from 'react-native';
import type { EventInterface, TimestampInterface } from 'kashir';
import { styles } from '../App.styles';
import { PostActionService } from '../services/PostActionService';
import { StorageService } from '../services/StorageService';
import { walletManager } from '../services/WalletManager';

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
  const [isZapping, setIsZapping] = useState(false);
  const [zapAmount, setZapAmount] = useState(21);
  const postActionService = PostActionService.getInstance();
  
  // Access wallet functionality for payments via WalletManager
  const [walletState, setWalletState] = useState(walletManager.getState());

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
      await postActionService.zapPost(postId, post, zapAmount, undefined, sendPaymentCallback);
      Alert.alert('Zap Sent! ⚡', `Successfully zapped ${zapAmount} sats to this post!`);
    } catch (error) {
      console.error('Failed to zap post:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to zap post. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('Lightning address')) {
          errorMessage = 'This user does not have a Lightning address for receiving zaps.';
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
        <TouchableOpacity 
          style={[styles.actionButton, { opacity: isZapping ? 0.5 : 1 }]} 
          onPress={handleZap}
          disabled={isZapping}
        >
          <Text style={styles.actionButtonText}>
            {isZapping ? '⏳ Zapping...' : '⚡ Zap'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {index < totalPosts - 1 && <View style={styles.separator} />}
    </View>
  );
}
