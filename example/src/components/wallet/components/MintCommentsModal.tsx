import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { PublicKey } from 'kashir';
import { sharedProfileService } from '../../../services/ProfileService';
import { NostrClientService } from '../../../services/NostrClient';
import { UserPostsModal } from '../../UserPostsModal';
import type { MintComment } from '../../../services';

interface MintCommentsModalProps {
  visible: boolean;
  onClose: () => void;
  mintUrl: string;
  comments: MintComment[];
}

export function MintCommentsModal({
  visible,
  onClose,
  mintUrl,
  comments,
}: MintCommentsModalProps) {
  const [usernames, setUsernames] = useState<Map<string, string>>(new Map());
  const [showUserPostsModal, setShowUserPostsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    npub: string;
    name: string;
  } | null>(null);

  const fetchUsernames = useCallback(async () => {
    const clientService = NostrClientService.getInstance();
    const client = clientService.getClient();

    if (!client) return;

    const newUsernames = new Map<string, string>();

    for (const comment of comments) {
      try {
        const name = await sharedProfileService.fetchUserProfile(
          client,
          comment.npub
        );
        newUsernames.set(
          comment.pubkey,
          name || comment.npub.substring(0, 16) + '...'
        );
      } catch {
        newUsernames.set(comment.pubkey, comment.npub.substring(0, 16) + '...');
      }
    }

    setUsernames(newUsernames);
  }, [comments]);

  useEffect(() => {
    if (visible && comments.length > 0) {
      fetchUsernames();
    }
  }, [visible, comments, fetchUsernames]);

  const formatDate = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) {
      return '';
    }

    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDisplayName = (comment: MintComment) => {
    return (
      usernames.get(comment.pubkey) || comment.npub.substring(0, 8) + '...'
    );
  };

  const handleAuthorPress = (comment: MintComment) => {
    try {
      const authorPubkey = PublicKey.parse(comment.pubkey);
      const authorNpub = authorPubkey.toBech32();
      const authorName = getDisplayName(comment);

      setSelectedUser({ npub: authorNpub, name: authorName });
      setShowUserPostsModal(true);
    } catch (error) {
      console.error('Failed to parse user pubkey:', error);
      Alert.alert('Error', 'Failed to load user profile');
    }
  };

  const handleCloseUserPostsModal = () => {
    setShowUserPostsModal(false);
    setSelectedUser(null);
  };

  const renderRating = (rating?: number) => {
    if (!rating) return null;

    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Text
          key={i}
          style={[
            styles.star,
            i <= rating ? styles.filledStar : styles.emptyStar,
          ]}
        >
          {i <= rating ? '★' : '☆'}
        </Text>
      );
    }

    return <View style={styles.starsContainer}>{stars}</View>;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Reviews & Comments</Text>
            <Text style={styles.mintUrl} numberOfLines={1}>
              {mintUrl}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {comments.length > 0 ? (
            <View style={styles.commentsList}>
              {comments.map((comment, index) => (
                <View
                  key={`${comment.pubkey}-${comment.createdAt}`}
                  style={styles.commentItem}
                >
                  <View style={styles.commentHeader}>
                    <View style={styles.userInfo}>
                      <TouchableOpacity
                        onPress={() => handleAuthorPress(comment)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.username} numberOfLines={1}>
                          @{getDisplayName(comment)}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.timestamp}>
                        {formatDate(comment.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.ratingContainer}>
                      {renderRating(comment.rating)}
                    </View>
                  </View>

                  {comment.review && (
                    <Text style={styles.commentContent}>{comment.review}</Text>
                  )}

                  {index < comments.length - 1 && (
                    <View style={styles.separator} />
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noCommentsContainer}>
              <Text style={styles.noComments}>
                No reviews available for this mint.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* User Posts Modal */}
        {selectedUser && (
          <UserPostsModal
            visible={showUserPostsModal}
            onClose={handleCloseUserPostsModal}
            userNpub={selectedUser.npub}
            userName={selectedUser.name}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  titleContainer: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  mintUrl: {
    fontSize: 13,
    color: '#888888',
    fontFamily: 'monospace',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 16,
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  commentsList: {
    gap: 0,
  },
  commentItem: {
    paddingVertical: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  userInfo: {
    flex: 1,
    marginRight: 16,
  },
  username: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#81b0ff',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  star: {
    fontSize: 14,
    marginRight: 1,
  },
  filledStar: {
    color: '#FFD700',
  },
  emptyStar: {
    color: '#444444',
  },
  commentContent: {
    fontSize: 15,
    color: '#cccccc',
    lineHeight: 20,
  },
  separator: {
    height: 1,
    backgroundColor: '#333333',
    marginTop: 16,
  },
  noCommentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noComments: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
  },
});
