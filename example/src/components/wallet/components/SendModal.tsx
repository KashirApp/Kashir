import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

interface SendModalProps {
  visible: boolean;
  lightningInvoice: string;
  isSending: boolean;
  onClose: () => void;
  onInvoiceChange: (invoice: string) => void;
  onSendPayment: (invoice?: string) => void;
  onShowScanner: () => void;
  onSendCashuToken: (amount: string, memo?: string) => Promise<any>;
}

export function SendModal({
  visible,
  lightningInvoice,
  isSending,
  onClose,
  onInvoiceChange,
  onSendPayment,
  onShowScanner,
  onSendCashuToken,
}: SendModalProps) {
  const [activeTab, setActiveTab] = useState<'lightning' | 'cashu'>('lightning');
  const [cashuAmount, setCashuAmount] = useState('');
  const [cashuMemo, setCashuMemo] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string>('');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  const handleSendCashuToken = async () => {
    if (!cashuAmount || parseInt(cashuAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsGeneratingToken(true);
    try {
      const token = await onSendCashuToken(cashuAmount, cashuMemo || undefined);
      if (token) {
        setGeneratedToken(token.tokenString);
      }
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const copyTokenToClipboard = () => {
    Clipboard.setString(generatedToken);
    Alert.alert('Copied!', 'Cashu token copied to clipboard');
  };

  const resetCashuForm = () => {
    setCashuAmount('');
    setCashuMemo('');
    setGeneratedToken('');
  };

  const handleClose = () => {
    resetCashuForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Send Payment</Text>

          {/* Tab Selector */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'lightning' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('lightning')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'lightning' && styles.activeTabText,
                ]}
              >
                ⚡ Lightning
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'cashu' && styles.activeTab,
              ]}
              onPress={() => setActiveTab('cashu')}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'cashu' && styles.activeTabText,
                ]}
              >
                🪙 Cashu Token
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentContainer}>
            {activeTab === 'lightning' ? (
              // Lightning Tab
              <View style={styles.amountInputContainer}>
                <Text style={styles.inputLabel}>Lightning Invoice</Text>
                <TextInput
                  style={[styles.amountInput, styles.invoiceInput]}
                  placeholder="lnbc1..."
                  placeholderTextColor="#666666"
                  value={lightningInvoice}
                  onChangeText={onInvoiceChange}
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.scanButton]}
                    onPress={onShowScanner}
                    disabled={isSending}
                  >
                    <Text style={styles.buttonText}>📷 Scan QR Code</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.sendPaymentButton]}
                    onPress={() => onSendPayment()}
                    disabled={isSending || !lightningInvoice.trim()}
                  >
                    <Text style={styles.buttonText}>
                      {isSending ? 'Processing...' : 'Send Payment'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Cashu Tab
              <View style={styles.amountInputContainer}>
                {!generatedToken ? (
                  <>
                    <Text style={styles.inputLabel}>Amount (sats)</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="Enter amount"
                      placeholderTextColor="#666666"
                      value={cashuAmount}
                      onChangeText={setCashuAmount}
                      keyboardType="numeric"
                    />

                    <Text style={styles.inputLabel}>Memo (optional)</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="Enter memo"
                      placeholderTextColor="#666666"
                      value={cashuMemo}
                      onChangeText={setCashuMemo}
                    />

                    <TouchableOpacity
                      style={[styles.button, styles.createTokenButton]}
                      onPress={handleSendCashuToken}
                      disabled={isGeneratingToken || !cashuAmount.trim()}
                    >
                      <Text style={styles.buttonText}>
                        {isGeneratingToken ? 'Creating Token...' : 'Create Cashu Token'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.successLabel}>✅ Cashu Token Created!</Text>
                    <Text style={styles.inputLabel}>Share this token:</Text>
                    
                    <View style={styles.tokenContainer}>
                      <Text style={styles.tokenText} numberOfLines={4}>
                        {generatedToken}
                      </Text>
                    </View>

                    <View style={styles.actionButtonsContainer}>
                      <TouchableOpacity
                        style={[styles.button, styles.copyButton]}
                        onPress={copyTokenToClipboard}
                      >
                        <Text style={styles.buttonText}>📋 Copy Token</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.button, styles.newTokenButton]}
                        onPress={resetCashuForm}
                      >
                        <Text style={styles.buttonText}>Create Another</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.button, styles.modalCloseButton]}
            onPress={handleClose}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#4CAF50',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888888',
  },
  activeTabText: {
    color: '#ffffff',
  },
  contentContainer: {
    maxHeight: 400,
  },
  amountInputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 10,
  },
  successLabel: {
    fontSize: 18,
    color: '#4CAF50',
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  amountInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 20,
  },
  invoiceInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 20,
  },
  tokenContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  tokenText: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 20,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionButtonsContainer: {
    gap: 15,
  },
  scanButton: {
    backgroundColor: '#2196F3',
  },
  sendPaymentButton: {
    backgroundColor: '#4CAF50',
  },
  createTokenButton: {
    backgroundColor: '#FF9800',
  },
  copyButton: {
    backgroundColor: '#2196F3',
  },
  newTokenButton: {
    backgroundColor: '#9C27B0',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalCloseButton: {
    backgroundColor: '#666666',
    marginTop: 10,
  },
});
