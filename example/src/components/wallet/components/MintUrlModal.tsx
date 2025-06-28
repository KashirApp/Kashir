import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

interface MintUrlModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
}

export function MintUrlModal({ visible, onClose, onSubmit }: MintUrlModalProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a valid mint URL');
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Error', 'URL must start with http:// or https://');
      return;
    }

    onSubmit(url.trim());
    // Don't call onClose() here - let the parent handle closing the modal
    // This prevents the close handler from being called with stale state
  };

  const handleCancel = () => {
    setUrl(''); // Clear the input
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Enter Mint URL</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>Cashu Mint URL:</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder=""
            placeholderTextColor="#666666"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          
          <Text style={styles.hint}>
            Enter the URL of the Cashu mint you want to connect to.
          </Text>

          <TouchableOpacity onPress={handleSubmit} style={styles.submitButton}>
            <Text style={styles.submitText}>Connect to Mint</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 30,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 