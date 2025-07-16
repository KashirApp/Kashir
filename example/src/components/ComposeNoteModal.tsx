import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { styles } from '../App.styles';
import { NostrClientService, LoginType } from '../services/NostrClient';
import { Keys, EventBuilder } from 'kashir';

interface ComposeNoteModalProps {
  visible: boolean;
  onClose: () => void;
  userKeys: Keys | null;
  loginType: LoginType;
  onNotePosted?: () => void;
}

export function ComposeNoteModal({
  visible,
  onClose,
  userKeys,
  loginType,
  onNotePosted,
}: ComposeNoteModalProps) {
  const [noteContent, setNoteContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  const handleClose = () => {
    if (isPosting) return;
    setNoteContent('');
    onClose();
  };

  const handlePost = async () => {
    if (!noteContent.trim()) {
      Alert.alert('Error', 'Please enter some content for your note.');
      return;
    }

    setIsPosting(true);

    try {
      const clientService = NostrClientService.getInstance();
      const client = clientService.getClient();

      if (!client) {
        throw new Error('Client not available');
      }

      // Create event builder for text note
      const eventBuilder = EventBuilder.textNote(noteContent);

      let signedEvent;

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

      // Publish the event
      await client.sendEvent(signedEvent);

      Alert.alert('Success', 'Note posted successfully!');
      setNoteContent('');
      onClose();
      onNotePosted?.();
    } catch (error) {
      console.error('Failed to post note:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to post note. Please try again.'
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Compose Note</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={isPosting}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.composeInput}
            value={noteContent}
            onChangeText={setNoteContent}
            placeholder="What's on your mind?"
            placeholderTextColor="#666"
            multiline
            autoFocus
            editable={!isPosting}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={handleClose}
              disabled={isPosting}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.postButton,
                { opacity: isPosting || !noteContent.trim() ? 0.5 : 1 },
              ]}
              onPress={handlePost}
              disabled={isPosting || !noteContent.trim()}
            >
              {isPosting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
