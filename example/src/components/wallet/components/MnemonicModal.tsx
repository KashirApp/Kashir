import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Clipboard,
  Alert,
} from 'react-native';

interface MnemonicModalProps {
  visible: boolean;
  mnemonic: string;
  onDone: () => void;
}

export function MnemonicModal({ visible, mnemonic, onDone }: MnemonicModalProps) {
  const handleCopy = () => {
    Clipboard.setString(mnemonic);
    Alert.alert('Copied!', 'Recovery phrase copied to clipboard');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDone}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Wallet Recovery Phrase</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.warning}>
            ⚠️ Important: Write down these 12 words in order. You'll need them to restore your wallet if you lose your device.
          </Text>
          
          <View style={styles.mnemonicContainer}>
            <Text style={styles.mnemonicText}>{mnemonic}</Text>
          </View>

          <Text style={styles.hint}>
            Keep this recovery phrase safe and private. Anyone with access to these words can control your wallet.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleCopy} style={styles.copyButton}>
              <Text style={styles.copyText}>Copy to Clipboard</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={onDone} style={styles.doneButton}>
              <Text style={styles.doneText}>I've Saved It - Continue</Text>
            </TouchableOpacity>
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  warning: {
    fontSize: 14,
    color: '#ff9500',
    marginBottom: 20,
    lineHeight: 20,
    textAlign: 'center',
  },
  mnemonicContainer: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
  },
  mnemonicText: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 24,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 30,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 12,
  },
  copyButton: {
    backgroundColor: '#333333',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555555',
  },
  copyText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  doneText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 