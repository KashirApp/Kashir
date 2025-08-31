import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

interface ZapAmountModalProps {
  visible: boolean;
  currentAmount: number;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}

export function ZapAmountModal({
  visible,
  currentAmount,
  onClose,
  onSubmit,
}: ZapAmountModalProps) {
  const [amountInput, setAmountInput] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Set the initial value when modal opens and focus the input
  useEffect(() => {
    if (visible) {
      setAmountInput(currentAmount.toString());

      // Focus after a brief delay to ensure rendering is complete
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible, currentAmount]);

  const handleSubmit = () => {
    const amount = parseInt(amountInput.trim(), 10);

    if (!amountInput.trim()) {
      Alert.alert('Error', 'Please enter a zap amount');
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number');
      return;
    }

    if (amount > 1000000) {
      Alert.alert(
        'Amount Too Large',
        'Please enter an amount less than 1,000,000 sats'
      );
      return;
    }

    onSubmit(amount);
    setAmountInput(''); // Clear for next time
  };

  const handleCancel = () => {
    setAmountInput(''); // Clear the input
    onClose();
  };

  return visible ? (
    <View style={styles.fullScreenOverlay}>
      <View style={styles.backdrop} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.modalContent}>
          <Text style={styles.title}>Set Default Zap Amount</Text>
          <Text style={styles.subtitle}>
            Enter the default amount of sats for zapping posts
          </Text>

          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholderTextColor="#999"
            value={amountInput}
            onChangeText={setAmountInput}
            keyboardType="numeric"
            autoFocus
            selectTextOnFocus
          />

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
              <Text style={styles.submitButtonText}>Set Amount</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  ) : null;
}

const styles = StyleSheet.create({
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 24,
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
    fontSize: 18,
    color: '#fff',
    backgroundColor: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
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
