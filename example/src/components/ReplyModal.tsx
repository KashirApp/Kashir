import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { styles } from '../App.styles';
import { NostrClientService, LoginType } from '../services/NostrClient';
import { NostrKeys as Keys, EventBuilder, Tag, Kind } from 'kashir';
import type { PostWithStats } from '../types/EventStats';

interface ReplyModalProps {
  visible: boolean;
  onClose: () => void;
  post: PostWithStats;
  userKeys: Keys | null | undefined;
  loginType: LoginType | undefined;
  onReplyPosted?: () => void;
}

export function ReplyModal({
  visible,
  onClose,
  post,
  userKeys,
  loginType,
  onReplyPosted,
}: ReplyModalProps) {
  const [replyContent, setReplyContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  // Focus the text input when the modal becomes visible
  useEffect(() => {
    if (visible) {
      // Use a longer delay to ensure modal animation completes
      const focusTimeout = setTimeout(() => {
        textInputRef.current?.focus();
      }, 300);

      return () => clearTimeout(focusTimeout);
    }
    return undefined;
  }, [visible]);

  const handleClose = () => {
    if (isPosting) return;
    setReplyContent('');
    onClose();
  };

  const handleReply = async () => {
    // Check authentication - Amber doesn't need userKeys, private key does
    if (!loginType) {
      Alert.alert('Error', 'Please log in first to post a reply.');
      return;
    }

    if (loginType !== LoginType.Amber && !userKeys) {
      Alert.alert('Error', 'Private key authentication requires user keys.');
      return;
    }

    setIsPosting(true);

    try {
      const clientService = NostrClientService.getInstance();
      const client = clientService.getClient();

      if (!client) {
        throw new Error('Client not available');
      }

      // Get the original event data
      const originalEvent = (post as any).originalEvent;

      if (!originalEvent) {
        throw new Error('Original event not found in post data');
      }

      const eventId = originalEvent.id().toHex();
      const authorPubkey = originalEvent.author().toHex();

      // Create reply event with proper NIP-10 tags
      const eventTag = Tag.parse(['e', eventId]);
      const pubkeyTag = Tag.parse(['p', authorPubkey]);

      const replyKind = new Kind(1); // Kind 1 for text notes/replies
      const eventBuilder = new EventBuilder(replyKind, replyContent)
        .tags([eventTag, pubkeyTag])
        .allowSelfTagging();

      let signedEvent: any;

      if (loginType === LoginType.Amber) {
        // Use Amber for signing
        const signer = await client.signer();
        if (!signer) {
          throw new Error('Amber signer not available');
        }

        signedEvent = await eventBuilder.sign(signer);
      } else if (userKeys) {
        // Use local keys for signing
        signedEvent = eventBuilder.signWithKeys(userKeys);
      } else {
        throw new Error('No signing method available');
      }

      // Try to send the event with retry logic
      let success = false;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Attempting to send reply (attempt ${attempt}/3)...`);
          await client.sendEvent(signedEvent);
          success = true;
          console.log('Reply posted successfully to relay');
          Alert.alert('Success', 'Reply posted successfully!');
          break;
        } catch (error) {
          lastError = error as Error;
          console.error(`Send attempt ${attempt} failed:`, error);

          if (attempt < 3) {
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      if (!success) {
        console.error('All send attempts failed. Last error:', lastError);
        // Check if client is still connected
        const nostrClientService = NostrClientService.getInstance();
        if (!nostrClientService.isReady()) {
          Alert.alert(
            'Connection Issue',
            'Lost connection to relay. Your reply was signed but not sent. Please try again.'
          );
        } else {
          Alert.alert(
            'Send Failed',
            'Reply was signed successfully but failed to send to relay. Please check your connection and try again.'
          );
        }
        return; // Don't close modal or clear content if sending failed
      }

      setReplyContent('');
      onClose();
      onReplyPosted?.();
    } catch (error) {
      console.error('Failed to post reply:', error);

      let errorMessage = 'Failed to post reply. Please try again.';

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setIsPosting(false);
    }
  };

  // Format the original post content for preview (truncate if too long)
  const originalContent = post.event.content;
  const previewContent =
    originalContent.length > 150
      ? originalContent.substring(0, 150) + '...'
      : originalContent;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Reply to Post</Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            disabled={isPosting}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Original post preview */}
        <View style={styles.replyPreviewContainer}>
          <Text style={styles.replyPreviewLabel}>Replying to:</Text>
          <Text style={styles.replyPreviewText}>{previewContent}</Text>
        </View>

        {/* Reply input - this will be pushed up by keyboard */}
        <View style={styles.replyInputContainer}>
          <TextInput
            ref={textInputRef}
            style={[styles.composeInput, styles.replyInput]}
            value={replyContent}
            onChangeText={setReplyContent}
            placeholder="Write your reply..."
            placeholderTextColor="#666"
            multiline
            editable={!isPosting}
            returnKeyType="default"
            textAlignVertical="top"
          />
        </View>

        <View style={styles.modalButtons} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelButton]}
            onPress={handleClose}
            disabled={isPosting}
          >
            <Text style={styles.modalButtonText}>Cancel</Text>
          </TouchableOpacity>

          <View
            onTouchStart={() => {
              if (!isPosting && replyContent.trim()) {
                handleReply();
              }
            }}
            onStartShouldSetResponder={() => true}
            onResponderGrant={() => {
              if (!isPosting && replyContent.trim()) {
                handleReply();
              }
            }}
          >
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.postButton,
                isPosting || !replyContent.trim()
                  ? styles.disabledButton
                  : styles.enabledButton,
              ]}
              onPressIn={handleReply}
              disabled={isPosting || !replyContent.trim()}
              activeOpacity={0.8}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              {isPosting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>Reply</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
