import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface ReceiveModalProps {
  visible: boolean;
  receiveAmount: string;
  invoice: string;
  isLoadingInvoice: boolean;
  onClose: () => void;
  onAmountChange: (amount: string) => void;
  onCreateInvoice: () => void;
  onCopyInvoice: () => void;
  onReceiveCashuToken: (tokenString: string) => Promise<boolean>;
}

export function ReceiveModal({
  visible,
  receiveAmount,
  invoice,
  isLoadingInvoice,
  onClose,
  onAmountChange,
  onCreateInvoice,
  onCopyInvoice,
  onReceiveCashuToken,
}: ReceiveModalProps) {
  const [activeTab, setActiveTab] = useState<'lightning' | 'cashu'>('lightning');
  const [cashuTokenInput, setCashuTokenInput] = useState('');
  const [isProcessingToken, setIsProcessingToken] = useState(false);

  const handleReceiveCashuToken = async () => {
    if (!cashuTokenInput.trim()) {
      Alert.alert('Error', 'Please enter a cashu token');
      return;
    }

    setIsProcessingToken(true);
    try {
      const success = await onReceiveCashuToken(cashuTokenInput.trim());
      if (success) {
        setCashuTokenInput('');
        // Modal will be closed by parent component after showing success
      }
    } finally {
      setIsProcessingToken(false);
    }
  };

  const resetCashuForm = () => {
    setCashuTokenInput('');
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
          <Text style={styles.modalTitle}>Receive Payment</Text>

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
              <>
                {!invoice ? (
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.inputLabel}>Amount (sats)</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="Enter amount"
                      placeholderTextColor="#666666"
                      value={receiveAmount}
                      onChangeText={onAmountChange}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity
                      style={[styles.button, styles.createInvoiceButton]}
                      onPress={onCreateInvoice}
                      disabled={isLoadingInvoice}
                    >
                      <Text style={styles.buttonText}>
                        {isLoadingInvoice ? 'Creating...' : 'Create Invoice'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.invoiceContainer}>
                    <Text style={styles.invoiceLabel}>Lightning Invoice</Text>

                    {/* QR Code Container */}
                    <View style={styles.qrCodeContainer}>
                      <QRCode
                        value={invoice}
                        size={200}
                        color="#000000"
                        backgroundColor="#ffffff"
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.button, styles.copyButton]}
                      onPress={onCopyInvoice}
                    >
                      <Text style={styles.buttonText}>Copy Invoice</Text>
                    </TouchableOpacity>

                    <Text style={styles.waitingText}>Waiting for payment...</Text>
                  </View>
                )}
              </>
            ) : (
              // Cashu Tab
              <View style={styles.amountInputContainer}>
                <Text style={styles.inputLabel}>Paste Cashu Token</Text>
                <TextInput
                  style={[styles.amountInput, styles.tokenInput]}
                  placeholder="cashuA..."
                  placeholderTextColor="#666666"
                  value={cashuTokenInput}
                  onChangeText={setCashuTokenInput}
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.pasteButton]}
                    onPress={() => {
                      // Add paste from clipboard functionality here if needed
                      // For now, user can manually paste
                    }}
                    disabled={isProcessingToken}
                  >
                    <Text style={styles.buttonText}>📋 Paste Token</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.redeemButton]}
                    onPress={handleReceiveCashuToken}
                    disabled={isProcessingToken || !cashuTokenInput.trim()}
                  >
                    <Text style={styles.buttonText}>
                      {isProcessingToken ? 'Processing...' : 'Redeem Token'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.helpText}>
                  💡 Paste a cashu token you received from someone else to add the funds to your wallet.
                </Text>
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
  amountInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 20,
  },
  tokenInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 20,
    minHeight: 100,
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
    marginBottom: 15,
  },
  createInvoiceButton: {
    backgroundColor: '#4CAF50',
  },
  pasteButton: {
    backgroundColor: '#2196F3',
  },
  redeemButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  invoiceContainer: {
    maxHeight: 400,
  },
  invoiceLabel: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 15,
    textAlign: 'center',
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 20,
  },
  copyButton: {
    backgroundColor: '#2196F3',
    marginBottom: 15,
  },
  waitingText: {
    color: '#888888',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  helpText: {
    color: '#888888',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  modalCloseButton: {
    backgroundColor: '#666666',
    marginTop: 10,
  },
});
