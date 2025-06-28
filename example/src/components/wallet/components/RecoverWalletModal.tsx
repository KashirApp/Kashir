import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';

interface RecoverWalletModalProps {
  visible: boolean;
  onClose: () => void;
  onRecover: (mnemonic: string) => void;
}

export function RecoverWalletModal({ visible, onClose, onRecover }: RecoverWalletModalProps) {
  const [mnemonic, setMnemonic] = useState('');
  const [isRecovering, setIsRecovering] = useState(false);

  const handleRecover = () => {
    const trimmedMnemonic = mnemonic.trim();
    
    if (!trimmedMnemonic) {
      Alert.alert('Error', 'Please enter your recovery phrase');
      return;
    }

    const words = trimmedMnemonic.split(' ').filter(word => word.length > 0);
    
    if (words.length !== 12) {
      Alert.alert('Error', 'Recovery phrase must be exactly 12 words');
      return;
    }

    setIsRecovering(true);
    onRecover(trimmedMnemonic);
    // Reset state after recovery attempt
    setTimeout(() => {
      setIsRecovering(false);
      setMnemonic('');
    }, 1000);
  };

  const handleCancel = () => {
    setMnemonic('');
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
          <Text style={styles.title}>Recover Wallet</Text>
          <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.instruction}>
            Enter your 12-word recovery phrase to restore your wallet. Separate each word with a space.
          </Text>
          
          <TextInput
            style={styles.mnemonicInput}
            value={mnemonic}
            onChangeText={setMnemonic}
            placeholder="Enter your 12 words separated by spaces..."
            placeholderTextColor="#666666"
            multiline={true}
            numberOfLines={4}
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
          />

          <Text style={styles.hint}>
            Make sure to enter the words in the exact order you wrote them down.
          </Text>

          <TouchableOpacity 
            onPress={handleRecover} 
            style={[styles.recoverButton, isRecovering && styles.recoverButtonDisabled]}
            disabled={isRecovering}
          >
            <Text style={styles.recoverText}>
              {isRecovering ? 'Recovering...' : 'Recover Wallet'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
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
  instruction: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 20,
    lineHeight: 22,
  },
  mnemonicInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    minHeight: 120,
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 30,
    lineHeight: 20,
  },
  recoverButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  recoverButtonDisabled: {
    backgroundColor: '#666666',
  },
  recoverText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 