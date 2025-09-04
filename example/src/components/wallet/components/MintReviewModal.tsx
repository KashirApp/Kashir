import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { EventBuilder, Kind, Tag } from 'kashir';
import { NostrClientService, LoginType } from '../../../services/NostrClient';
import { MintRecommendationService } from '../../../services/MintRecommendationService';
import type { MintComment } from '../../../services/MintRecommendationService';
import { getNostrKeys } from '../../../utils/nostrUtils';

// Helper function to calculate d tag identifier from mint pubkey
// As per NIP-87: "if no event exists, the d tag can still be calculated from the mint's pubkey/id"
function calculateDTagFromPubkey(pubkeyHex: string): string {
  // Remove '0x' prefix if present
  const cleanHex = pubkeyHex.startsWith('0x') ? pubkeyHex.slice(2) : pubkeyHex;

  // Convert hex pubkey to bytes
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }

  // Take first 12 bytes for reasonable identifier length
  const truncated = bytes.slice(0, 12);

  // Base64url encode (manual implementation to avoid external dependency)
  const base64 = btoa(String.fromCharCode(...truncated))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/[=]/g, '');

  return base64;
}

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readonly?: boolean;
  size?: number;
}

function StarRating({
  rating,
  onRatingChange,
  readonly = false,
  size = 30,
}: StarRatingProps) {
  return (
    <View style={styles.starContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => !readonly && onRatingChange && onRatingChange(star)}
          disabled={readonly}
          style={[styles.star, { width: size, height: size }]}
        >
          <Text style={[styles.starText, { fontSize: size * 0.6 }]}>
            {star <= rating ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface MintReviewModalProps {
  visible: boolean;
  mintUrl: string;
  onClose: () => void;
  userNpub?: string;
}

export function MintReviewModal({
  visible,
  mintUrl,
  onClose,
  userNpub,
}: MintReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [existingReview, setExistingReview] = useState<MintComment | null>(
    null
  );

  const loadExistingReview = useCallback(async () => {
    if (!userNpub) return;

    setIsLoading(true);
    try {
      const recommendationService = MintRecommendationService.getInstance();
      const recommendations =
        await recommendationService.fetchMintRecommendations();

      const mintRecommendation = recommendations.find((r) => r.url === mintUrl);

      if (mintRecommendation) {
        const userReviews = mintRecommendation.comments.filter(
          (c) => c.npub === userNpub
        );

        if (userReviews.length > 0) {
          // Use the most recent review (highest createdAt)
          const latestReview = userReviews.sort(
            (a, b) => b.createdAt - a.createdAt
          )[0];

          setExistingReview(latestReview);
          setRating(latestReview.rating || 0);
          setReviewText(latestReview.review || '');
        }
      }
    } catch (error) {
      console.error('Error loading existing review:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userNpub, mintUrl]);

  // Load existing review when modal opens
  useEffect(() => {
    if (visible && userNpub && mintUrl) {
      loadExistingReview();
    } else if (!visible) {
      // Reset form when modal closes
      setRating(0);
      setReviewText('');
      setExistingReview(null);
    }
  }, [visible, userNpub, mintUrl, loadExistingReview]);

  const handleSubmit = async () => {
    if (!userNpub) {
      Alert.alert('Error', 'You must be logged in to submit a review');
      return;
    }

    if (rating === 0 && reviewText.trim() === '') {
      Alert.alert('Error', 'Please provide either a rating or review text');
      return;
    }

    setIsSubmitting(true);
    try {
      const clientService = NostrClientService.getInstance();
      const client = clientService.getClient();
      const session = clientService.getCurrentSession();

      if (!client) {
        throw new Error('Nostr client not available');
      }

      if (!session) {
        throw new Error('User not logged in');
      }

      // Calculate d tag identifier from mint pubkey for NIP-87 compliance
      let dTagIdentifier: string;
      try {
        // Use /v1/info endpoint to get the mint's pubkey
        const response = await fetch(`${mintUrl}/v1/info`);
        if (response.ok) {
          const mintInfo = await response.json();
          if (
            mintInfo &&
            mintInfo.pubkey &&
            typeof mintInfo.pubkey === 'string'
          ) {
            // Calculate d tag identifier from pubkey as per NIP-87:
            // "if no event exists, the d tag can still be calculated from the mint's pubkey/id"
            dTagIdentifier = calculateDTagFromPubkey(mintInfo.pubkey);
          } else {
            throw new Error('No pubkey found in mint info');
          }
        } else {
          throw new Error(`HTTP ${response.status}`);
        }

        if (!dTagIdentifier) {
          throw new Error('No d tag identifier calculated');
        }
      } catch {
        // Fallback: use a deterministic hash of the mint URL
        const encoder = new TextEncoder();
        const data = encoder.encode(mintUrl);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);
        dTagIdentifier = Array.from(hashArray)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
          .substring(0, 16);
      }

      // Format content in the same way as bitcoinmints: [rating/5] review text
      let content = '';
      if (rating > 0) {
        content += `[${rating}/5]`;
      }
      if (reviewText.trim()) {
        content += (content ? ' ' : '') + reviewText.trim();
      }

      // Create NIP-87 recommendation event (kind 38000) - Following NIP-87 spec
      // d tag: calculated identifier from mint pubkey as per NIP-87
      const dTag = Tag.parse(['d', dTagIdentifier]);
      const kTag = Tag.parse(['k', '38172']); // Recommending Cashu mint info kind
      const uTag = Tag.parse(['u', mintUrl, 'cashu']); // Mint URL with type
      // Note: Omitting 'a' tag since most mints don't publish kind 38172 info events

      const eventBuilder = new EventBuilder(new Kind(38000), content).tags([
        dTag,
        kTag,
        uTag,
      ]);

      let signedEvent;
      if (session.type === LoginType.Amber) {
        const signer = await client.signer();
        if (!signer) {
          throw new Error('Amber signer not available');
        }
        signedEvent = await eventBuilder.sign(signer);
      } else if (session.type === LoginType.PrivateKey) {
        const keys = await getNostrKeys();
        if (!keys) {
          throw new Error('Private key not found in secure storage');
        }
        signedEvent = eventBuilder.signWithKeys(keys);
      } else {
        throw new Error('No signing method available');
      }

      // Publish the event using the client
      await client.sendEvent(signedEvent);

      Alert.alert(
        'Success',
        existingReview
          ? 'Review updated successfully!'
          : 'Review submitted successfully!'
      );
      onClose();
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (rating > 0 || reviewText.trim() !== '') {
      Alert.alert(
        'Discard Changes?',
        'Are you sure you want to discard your changes?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {existingReview ? 'Update Review' : 'Review Mint'}
          </Text>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              isSubmitting && styles.submitButtonDisabled,
            ]}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {existingReview ? 'Update' : 'Submit'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.mintUrlText}>{mintUrl}</Text>
                {existingReview && (
                  <Text style={styles.existingReviewText}>
                    Editing your existing review
                  </Text>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rating</Text>
                <StarRating
                  rating={rating}
                  onRatingChange={setRating}
                  size={40}
                />
                <Text style={styles.ratingDescription}>
                  How would you rate this mint's performance?
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Review</Text>
                <TextInput
                  style={styles.reviewInput}
                  placeholder="Share your experience with this mint..."
                  placeholderTextColor="#888"
                  value={reviewText}
                  onChangeText={setReviewText}
                  multiline
                  textAlignVertical="top"
                  maxLength={500}
                />
                <Text style={styles.charCount}>
                  {reviewText.length}/500 characters
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    minWidth: 60,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  mintUrlText: {
    fontSize: 14,
    color: '#007AFF',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  existingReviewText: {
    fontSize: 12,
    color: '#ff9500',
    fontStyle: 'italic',
  },
  starContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  star: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  starText: {
    color: '#FFD700',
  },
  ratingDescription: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  reviewInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#444',
  },
  charCount: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
    marginTop: 8,
  },
});
