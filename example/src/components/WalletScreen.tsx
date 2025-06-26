import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Clipboard,
} from 'react-native';
import { FfiLocalStore, FfiWallet, FfiCurrencyUnit, FfiMintQuoteState, FfiSplitTarget } from '../../../src';
import RNFS from 'react-native-fs';

interface WalletScreenProps {
  onClose: () => void;
}

// Utility function to extract error messages from various error types
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'object' && error !== null) {
    const anyError = error as any;
    // Try CDK-specific error format first
    if (anyError.inner?.msg) {
      return anyError.inner.msg;
    }
    // Try standard message property
    if (anyError.message) {
      return anyError.message;
    }
  }
  
  return String(error);
};

export function WalletScreen({ onClose }: WalletScreenProps) {
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [moduleStatus, setModuleStatus] = useState<string>('Loading...');
  const [cdkModule, setCdkModule] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [invoice, setInvoice] = useState('');
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [quoteId, setQuoteId] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [lightningInvoice, setLightningInvoice] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const mintUrl = 'https://mint.103100.xyz';

  // Test CDK module loading step by step
  useEffect(() => {
    const testCdkLoading = () => {
      try {
        setModuleStatus('Testing CDK import...');
        
        if (FfiLocalStore && FfiWallet && FfiCurrencyUnit) {
          setModuleStatus('All CDK components available!');
          
          // Create a CDK module object for compatibility with existing code
          const cdkModuleImport = {
            FfiLocalStore,
            FfiWallet,
            FfiCurrencyUnit,
            FfiMintQuoteState,
            FfiSplitTarget,
          };
          setCdkModule(cdkModuleImport);
        } else {
          console.error('CDK components not found');
          throw new Error('CDK components not found');
        }
        
      } catch (error) {
        console.error('CDK loading error:', error);
        setModuleStatus(`CDK loading failed: ${getErrorMessage(error)}`);
      }
    };
    
    testCdkLoading();
  }, []);

  const testWalletCreation = async () => {
    if (!cdkModule) {
      Alert.alert('Error', 'CDK module not loaded');
      return;
    }
    
    try {
      // Generate a simple seed
      const seed = new ArrayBuffer(32);
      const seedView = new Uint8Array(seed);
      for (let i = 0; i < 32; i++) {
        seedView[i] = Math.floor(Math.random() * 256);
      }
      
      let localStore;
      try {
        // Use react-native-fs to get the proper app internal storage directory
        const dbPath = `${RNFS.DocumentDirectoryPath}/cdk_wallet.db`;
        localStore = FfiLocalStore.newWithPath(dbPath);
      } catch (storeError) {
        console.error('FfiLocalStore creation failed:', storeError);
        const errorMsg = getErrorMessage(storeError);
        
        // Try fallback to default constructor (uses temp directory)
        try {
          localStore = new FfiLocalStore();
        } catch (fallbackError) {
          const fallbackErrorMsg = getErrorMessage(fallbackError);
          
          Alert.alert(
            'CDK Storage Error', 
            `Failed to create CDK storage with both RNFS and default paths.\n\nRNFS error: ${errorMsg}\nFallback error: ${fallbackErrorMsg}\n\nThis indicates a device storage restriction issue.`,
            [
              { 
                text: 'OK', 
                onPress: () => {
                  setModuleStatus('CDK storage failed - all paths inaccessible');
                }
              }
            ]
          );
          return;
        }
      }
      
      // Ensure localStore was created successfully
      if (!localStore) {
        console.error('LocalStore is undefined, cannot create wallet');
        return;
      }
      
      const walletInstance = new FfiWallet(
        mintUrl,
        FfiCurrencyUnit.Sat,
        localStore,
        seed
      );
      
      // Initialize wallet with mint information
      try {
        if (typeof walletInstance.getMintInfo === 'function') {
          await walletInstance.getMintInfo();
        }
        
        // Attempt initial balance sync
        try {
          walletInstance.balance();
        } catch (balanceError) {
          // Expected for new wallets
        }
      } catch (initError) {
        // Continue anyway, initialization might not be required
      }
      
      setWallet(walletInstance);
      
      // Get wallet balance
      try {
        const walletBalance = walletInstance.balance();
        setBalance(walletBalance.value);
        Alert.alert('Success!', `Wallet created! Balance: ${walletBalance.value} sats`);
      } catch (balanceError) {
        setBalance(BigInt(0));
        Alert.alert('Success!', 'Wallet created successfully! Balance: 0 sats');
      }
      
    } catch (error) {
      console.error('Wallet creation error:', error);
      Alert.alert('Wallet Creation Failed', `Error: ${getErrorMessage(error)}\n\nThis might be a device-specific issue. Try restarting the app.`);
    }
  };

  const handleReceive = () => {
    if (!wallet) {
      Alert.alert('Error', 'Please create a wallet first');
      return;
    }
    setShowReceiveModal(true);
    setReceiveAmount('');
    setInvoice('');
    setQuoteId('');
  };

  const handleSend = () => {
    if (!wallet) {
      Alert.alert('Error', 'Please create a wallet first');
      return;
    }
    setShowSendModal(true);
    setLightningInvoice('');
  };

  const createInvoice = async () => {
    if (!wallet || !receiveAmount || parseInt(receiveAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setIsLoadingInvoice(true);
    try {
      if (typeof wallet.mintQuote !== 'function') {
        throw new Error('Wallet mintQuote method not available');
      }
      
      const amount = { value: BigInt(receiveAmount) };
      const mintQuote = await wallet.mintQuote(amount, 'Cashu wallet receive');
      
      setInvoice(mintQuote.request);
      setQuoteId(mintQuote.id);
      
      Alert.alert('Invoice Created!', 'Lightning invoice created successfully. Copy and share it to receive payment.');
      
    } catch (error) {
      console.error('Failed to create invoice:', error);
      const errorMsg = getErrorMessage(error);
      Alert.alert('Error', `Failed to create invoice: ${errorMsg}`);
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  const copyToClipboard = () => {
    Clipboard.setString(invoice);
    Alert.alert('Copied!', 'Invoice copied to clipboard');
  };

  const refreshBalance = async () => {
    if (!wallet) {
      Alert.alert('Error', 'Please create a wallet first');
      return;
    }
    
    try {
      const walletBalance = wallet.balance();
      setBalance(walletBalance.value);
      Alert.alert('Balance Updated', `Current balance: ${walletBalance.value} sats`);
    } catch (error) {
      console.error('Failed to refresh balance:', error);
      Alert.alert('Error', `Failed to refresh balance: ${getErrorMessage(error)}`);
    }
  };

  const checkAndMintPendingTokens = async () => {
    if (!wallet || !quoteId) {
      return;
    }
    
    try {
      if (typeof wallet.mintQuoteState !== 'function') {
        return;
      }
      
      const quoteState = await wallet.mintQuoteState(quoteId);
      
      if (quoteState.state === FfiMintQuoteState.Paid) {
        if (typeof wallet.mint === 'function') {
          try {
            const mintedAmount = await wallet.mint(quoteId, FfiSplitTarget.Default);
            const newBalance = wallet.balance();
            setBalance(newBalance.value);
            
            Alert.alert('Success!', `Successfully minted ${mintedAmount.value} sats! New balance: ${newBalance.value} sats`);
            
            setInvoice('');
            setQuoteId('');
            setShowReceiveModal(false);
          } catch (mintError) {
            console.error('Failed to mint tokens:', mintError);
            Alert.alert('Error', `Failed to mint tokens: ${getErrorMessage(mintError)}`);
          }
        }
      } else {
        Alert.alert('Waiting', 'Invoice not yet paid. Please complete the payment.');
      }
    } catch (error) {
      console.error('Failed to check mint quote:', error);
      Alert.alert('Error', `Failed to check payment status: ${getErrorMessage(error)}`);
    }
  };

  const sendPayment = async () => {
    if (!wallet || !lightningInvoice.trim()) {
      Alert.alert('Error', 'Please enter a Lightning invoice');
      return;
    }

    if (!cdkModule) {
      Alert.alert('Error', 'CDK module not loaded');
      return;
    }

    if (!lightningInvoice.toLowerCase().startsWith('lnbc')) {
      Alert.alert('Error', 'Please enter a valid Lightning invoice (should start with lnbc)');
      return;
    }

    setIsSending(true);
    try {
      // Check current balance first
      const currentBalance = wallet.balance();
      
      if (currentBalance.value <= 0) {
        Alert.alert('Error', 'Insufficient balance to send payment');
        setIsSending(false);
        return;
      }
      
      // Check if wallet has required Lightning payment methods (melt)
      if (typeof wallet.meltQuote !== 'function') {
        console.error('meltQuote is not a function, type:', typeof wallet.meltQuote);
        
        // Check if this CDK version supports Lightning payments at all
        Alert.alert(
          'Lightning Payments Not Supported',
          'This CDK version does not support Lightning payments (meltQuote/melt methods are missing).\n\nAvailable methods: ' + Object.getOwnPropertyNames(Object.getPrototypeOf(wallet)).join(', '),
          [
            {
              text: 'OK',
              onPress: () => setIsSending(false)
            }
          ]
        );
        return;
      }
      
      try {
        const meltQuote = await wallet.meltQuote(lightningInvoice);
        
        const prepareResult = {
          amount: meltQuote.amount,
          totalFee: meltQuote.feeReserve || { value: BigInt(0) }
        };
        
        const totalAmount = prepareResult.amount.value + prepareResult.totalFee.value;
        
        // Check if wallet has sufficient balance
        const currentBalance = wallet.balance();
        if (currentBalance.value < totalAmount) {
          Alert.alert('Insufficient Balance', `You need ${totalAmount} sats but only have ${currentBalance.value} sats`);
          setIsSending(false);
          return;
        }
        
        // Confirm the payment with the user
        Alert.alert(
          'Confirm Payment',
          `Amount: ${prepareResult.amount.value} sats\nFee: ${prepareResult.totalFee.value} sats\nTotal: ${totalAmount} sats\n\nDo you want to proceed?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setIsSending(false)
            },
            {
              text: 'Send',
              onPress: async () => {
                try {
                  const sendResult = await wallet.melt(meltQuote.id);
                  
                  // Update balance
                  const newBalance = wallet.balance();
                  setBalance(newBalance.value);
                  
                  const resultMessage = sendResult.preimage 
                    ? `Payment sent successfully!\nPayment proof: ${sendResult.preimage}\nNew balance: ${newBalance.value} sats`
                    : `Payment sent successfully!\nNew balance: ${newBalance.value} sats`;
                  
                  Alert.alert('Success!', resultMessage);
                  
                  // Close modal and clear input
                  setLightningInvoice('');
                  setShowSendModal(false);
                  
                } catch (sendError) {
                  console.error('Payment failed:', sendError);
                  
                  const errorMsg = getErrorMessage(sendError);
                  
                  Alert.alert('Payment Failed', errorMsg);
                } finally {
                  setIsSending(false);
                }
              }
            }
          ]
        );
      } catch (meltError) {
        console.error('Melt quote failed:', meltError);
        throw meltError;
      }
      
    } catch (error) {
      console.error('Payment preparation failed:', error);
      const errorMsg = getErrorMessage(error);
      Alert.alert('Error', `Failed to prepare payment: ${errorMsg}`);
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={styles.closeButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerText}>Cashu Wallet</Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Module Status:</Text>
        <Text style={styles.statusText}>{moduleStatus}</Text>
      </View>

      <View style={styles.balanceContainer}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>{balance.toString()} sats</Text>
        {wallet && (
          <TouchableOpacity 
            style={styles.refreshButton} 
            onPress={refreshBalance}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.buttonsContainer}>
        {!wallet ? (
          <TouchableOpacity 
            style={[styles.button, styles.testButton]} 
            onPress={testWalletCreation}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Create Wallet</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.walletActions}>
            <TouchableOpacity 
              style={[styles.button, styles.receiveButton]} 
              onPress={handleReceive}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Receive</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.sendButton]} 
              onPress={handleSend}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Send</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.mintContainer}>
        <Text style={styles.mintLabel}>Connected Mint</Text>
        <Text style={styles.mintUrl}>{mintUrl}</Text>
      </View>

      <Modal
        visible={showReceiveModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowReceiveModal(false)}
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
                  onChangeText={setReceiveAmount}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[styles.button, styles.createInvoiceButton]}
                  onPress={createInvoice}
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
                <View style={styles.invoiceTextContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text style={styles.invoiceText} selectable>
                      {invoice}
                    </Text>
                  </ScrollView>
                </View>
                <TouchableOpacity
                  style={[styles.button, styles.copyButton]}
                  onPress={copyToClipboard}
                >
                  <Text style={styles.buttonText}>Copy Invoice</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.checkPaymentButton]}
                  onPress={checkAndMintPendingTokens}
                >
                  <Text style={styles.buttonText}>Check Payment</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
            
            <TouchableOpacity
              style={[styles.button, styles.modalCloseButton]}
              onPress={() => setShowReceiveModal(false)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showSendModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSendModal(false)}
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
                onChangeText={setLightningInvoice}
                multiline={true}
                numberOfLines={4}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.button, styles.sendPaymentButton]}
                onPress={sendPayment}
                disabled={isSending || !lightningInvoice.trim()}
              >
                <Text style={styles.buttonText}>
                  {isSending ? 'Processing...' : 'Send Payment'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.button, styles.modalCloseButton]}
              onPress={() => setShowSendModal(false)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  headerText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
  },
  statusContainer: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  balanceContainer: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 20,
    padding: 30,
    borderRadius: 20,
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
  balanceLabel: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 10,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonsContainer: {
    marginTop: 40,
    marginHorizontal: 20,
  },
  walletActions: {
    flexDirection: 'row',
    gap: 15,
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
  testButton: {
    backgroundColor: '#2196F3',
  },
  receiveButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
  },
  sendButton: {
    backgroundColor: '#FF9800',
    flex: 1,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  refreshButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
  },
  refreshButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  mintContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mintLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
  },
  mintUrl: {
    fontSize: 14,
    color: '#888888',
    fontFamily: 'monospace',
  },
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
  createInvoiceButton: {
    backgroundColor: '#4CAF50',
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
  invoiceInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 20,
  },
  sendPaymentButton: {
    backgroundColor: '#4CAF50',
  },
});
