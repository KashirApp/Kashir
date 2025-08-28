import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { NostrClientService } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { usePosts } from '../hooks/usePosts';
import { PostList } from './PostList';

interface UserPostsModalProps {
  visible: boolean;
  onClose: () => void;
  userNpub: string;
  userName: string;
}

export function UserPostsModal({
  visible,
  onClose,
  userNpub,
  userName,
}: UserPostsModalProps) {
  const [client, _setClient] = useState(
    NostrClientService.getInstance().getClient()
  );

  // Initialize services
  const profileService = useMemo(() => new ProfileService(), []);

  // Custom hooks
  const { posts, loading, fetchPosts } = usePosts(client);

  // Fetch user posts when modal opens
  useEffect(() => {
    if (visible && client && userNpub) {
      fetchPosts(userNpub);
    }
  }, [visible, client, userNpub, fetchPosts]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{userName}'s posts</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <PostList
            posts={posts}
            loading={loading}
            showAuthor={false}
            profileService={profileService}
            title="User Posts"
          />
        </View>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    marginRight: 16,
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
  },
});
