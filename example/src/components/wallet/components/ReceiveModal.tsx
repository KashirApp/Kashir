import React from 'react';
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
  onCheckPayment: () => void;
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
  onCheckPayment,
}: ReceiveModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Receive Payment</Text>
          
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
            <ScrollView style={styles.invoiceContainer}>
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
              
              <TouchableOpacity
                style={[styles.button, styles.checkPaymentButton]}
                onPress={onCheckPayment}
              >
                <Text style={styles.buttonText}>Check Payment</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
          
          <TouchableOpacity
            style={[styles.button, styles.modalCloseButton]}
            onPress={onClose}
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
  createInvoiceButton: {
    backgroundColor: '#4CAF50',
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
  invoiceTextContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    maxHeight: 120,
  },
  invoiceText: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  copyButton: {
    backgroundColor: '#2196F3',
    marginBottom: 15,
  },
  checkPaymentButton: {
    backgroundColor: '#FF9800',
    marginBottom: 15,
  },
  modalCloseButton: {
    backgroundColor: '#666666',
    marginTop: 10,
  },
}); 