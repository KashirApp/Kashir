import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface RelayUrlModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export function RelayUrlModal({ visible, onClose, onSubmit }: RelayUrlModalProps) {
  const [relayUrl, setRelayUrl] = useState('');

  const handleSubmit = () => {
    const trimmedUrl = relayUrl.trim();
    if (!trimmedUrl) {
      Alert.alert('Error', 'Please enter a relay URL');
      return;
    }

    // Basic validation for websocket URL
    if (!trimmedUrl.startsWith('wss://') && !trimmedUrl.startsWith('ws://')) {
      Alert.alert(
        'Invalid URL',
        'Relay URL must start with wss:// or ws://',
        [{ text: 'OK' }]
      );
      return;
    }

    onSubmit(trimmedUrl);
    setRelayUrl(''); // Clear the input for next time
  };

  const handleCancel = () => {
    setRelayUrl(''); // Clear the input
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>Add Nostr Relay</Text>
            <Text style={styles.subtitle}>
              Enter the websocket URL of the relay you want to connect to
            </Text>

            <TextInput
              style={styles.input}
              placeholder="wss://relay.example.com"
              placeholderTextColor="#999"
              value={relayUrl}
              onChangeText={setRelayUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            <View style={styles.exampleContainer}>
              <Text style={styles.exampleTitle}>Popular Relays:</Text>
              <Text style={styles.exampleText}>• wss://relay.damus.io</Text>
              <Text style={styles.exampleText}>• wss://nos.lol</Text>
              <Text style={styles.exampleText}>• wss://relay.nostr.band</Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.submitButton]}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>Add Relay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    backgroundColor: '#1a1a1a',
    fontFamily: 'monospace',
  },
  exampleContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  exampleTitle: {
    fontSize: 12,
    color: '#ccc',
    fontWeight: '600',
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#444',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#81b0ff',
  },
  submitButtonText: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '600',
  },
});