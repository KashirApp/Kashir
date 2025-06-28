import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { QRScanner } from './QRScanner';

interface SendModalProps {
  visible: boolean;
  lightningInvoice: string;
  isSending: boolean;
  onClose: () => void;
  onInvoiceChange: (invoice: string) => void;
  onSendPayment: (invoice?: string) => void;
}

export function SendModal({
  visible,
  lightningInvoice,
  isSending,
  onClose,
  onInvoiceChange,
  onSendPayment,
}: SendModalProps) {
  const [showScanner, setShowScanner] = React.useState(false);

  const handleScanResult = (data: string) => {
    // Extract Lightning invoice from QR code data
    let invoice = data;
    if (data.toLowerCase().startsWith('lightning:')) {
      invoice = data.substring(10);
    }
    
    // Set the invoice and close scanner
    onInvoiceChange(invoice);
    setShowScanner(false);
    
    // Close the send modal since we're going directly to payment confirmation
    onClose();
    
    // Trigger payment confirmation directly with the scanned invoice
    // This avoids React state timing issues
    onSendPayment(invoice);
  };
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
          <Text style={styles.modalTitle}>Send Payment</Text>
          
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
                onPress={() => setShowScanner(true)}
                disabled={isSending}
              >
                <Text style={styles.buttonText}>📷 Scan QR Code</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.sendPaymentButton]}
                onPress={onSendPayment}
                disabled={isSending || !lightningInvoice.trim()}
              >
                <Text style={styles.buttonText}>
                  {isSending ? 'Processing...' : 'Send Payment'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.button, styles.modalCloseButton]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      
      <QRScanner
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScanResult}
      />
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
  invoiceInput: {
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
  actionButtonsContainer: {
    gap: 15,
  },
  scanButton: {
    backgroundColor: '#2196F3',
  },
  sendPaymentButton: {
    backgroundColor: '#4CAF50',
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