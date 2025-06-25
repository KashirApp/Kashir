import React from 'react';
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

interface WalletScreenProps {
  onClose: () => void;
}

export function WalletScreen({ onClose }: WalletScreenProps) {
  const [balance, setBalance] = React.useState<bigint>(BigInt(0));
  const [moduleStatus, setModuleStatus] = React.useState<string>('Loading...');
  const [cdkModule, setCdkModule] = React.useState<any>(null);
  const [wallet, setWallet] = React.useState<any>(null);
  const [showReceiveModal, setShowReceiveModal] = React.useState(false);
  const [receiveAmount, setReceiveAmount] = React.useState('');
  const [invoice, setInvoice] = React.useState('');
  const [isLoadingInvoice, setIsLoadingInvoice] = React.useState(false);
  const [quoteId, setQuoteId] = React.useState('');
  const [showSendModal, setShowSendModal] = React.useState(false);
  const [lightningInvoice, setLightningInvoice] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  
  const mintUrl = 'https://mint.103100.xyz';

  // Test CDK module loading step by step
  React.useEffect(() => {
    const testCdkLoading = async () => {
      try {
        setModuleStatus('Testing CDK import...');
        
        // Try importing the CDK module
        const cdkModuleImport = await import('../../../src/generated/cdk_ffi');
        console.log('CDK module imported:', cdkModuleImport);
        
        setModuleStatus('Initializing CDK native module...');
        
        // CRITICAL: Initialize the native module BEFORE using any CDK functions
        console.log('Full CDK module import:', Object.keys(cdkModuleImport));
        const defaultExport = cdkModuleImport.default;
        console.log('Default export:', defaultExport);
        console.log('Default export keys:', defaultExport ? Object.keys(defaultExport) : 'no default export');
        
        // Check if the React Native module is available
        console.log('Checking React Native modules...');
        const { NativeModules } = require('react-native');
        console.log('Available NativeModules:', Object.keys(NativeModules));
        console.log('CdkRn module:', NativeModules.CdkRn);
        console.log('NativeCdkRn module:', NativeModules.NativeCdkRn);
        
        // Check global object for JSI modules
        console.log('Checking globalThis for JSI modules...');
        console.log('globalThis.NativeCdkFfi:', (globalThis as any).NativeCdkFfi);
        console.log('Available globals:', Object.getOwnPropertyNames(globalThis).filter(name => name.includes('Cdk') || name.includes('cdk')));
        
        // Try to manually call installRustCrate if the module exists
        if (NativeModules.CdkRn && typeof NativeModules.CdkRn.installRustCrate === 'function') {
          console.log('Manually calling installRustCrate...');
          try {
            const result = await NativeModules.CdkRn.installRustCrate();
            console.log('installRustCrate result:', result);
            console.log('After installRustCrate - globalThis.NativeCdkFfi:', (globalThis as any).NativeCdkFfi);
          } catch (installError) {
            console.error('Manual installRustCrate failed:', installError);
          }
        }
        
        if (defaultExport && typeof defaultExport.initialize === 'function') {
          console.log('Calling CDK initialize...');
          try {
            defaultExport.initialize();
            console.log('CDK native module initialized successfully!');
            setModuleStatus('CDK native module initialized!');
            
            // Test if native module is actually working now
            console.log('Testing native module access after init...');
            const nativeModule = (cdkModuleImport as any).nativeModule;
            console.log('Native module:', nativeModule);
            if (nativeModule && typeof nativeModule === 'function') {
              const moduleInstance = nativeModule();
              console.log('Native module instance:', moduleInstance);
              console.log('Native module functions available:', Object.keys(moduleInstance || {}));
              
              // Check for the specific function we need
              const targetFunction = 'ubrn_uniffi_cdk_ffi_fn_constructor_ffilocalstore_new';
              if (moduleInstance && moduleInstance[targetFunction]) {
                console.log(`✅ ${targetFunction} is available!`);
              } else {
                console.log(`❌ ${targetFunction} is NOT available!`);
                console.log('Available functions:', Object.keys(moduleInstance || {}));
              }
            }
          } catch (initError) {
            console.error('Initialize function threw an error:', initError);
            throw new Error(`Initialization failed: ${initError instanceof Error ? initError.message : String(initError)}`);
          }
        } else {
          console.error('Initialize function not found or not a function');
          throw new Error('CDK initialize function not found');
        }
        
        setCdkModule(cdkModuleImport);
        
        // Test basic components availability  
        if (cdkModuleImport.FfiLocalStore && cdkModuleImport.FfiWallet) {
          setModuleStatus('All CDK components available and initialized!');
        } else {
          setModuleStatus('Some CDK components missing');
        }
        
      } catch (error) {
        console.error('CDK loading error:', error);
        setModuleStatus(`CDK loading failed: ${error instanceof Error ? error.message : String(error)}`);
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
      console.log('Testing wallet creation...');
      const { FfiLocalStore, FfiWallet, FfiCurrencyUnit } = cdkModule;
      
      // Generate a simple seed
      const seed = new ArrayBuffer(32);
      const seedView = new Uint8Array(seed);
      for (let i = 0; i < 32; i++) {
        seedView[i] = Math.floor(Math.random() * 256);
      }
      
      const localStore = new FfiLocalStore();
      console.log('Local store created');
      
      const walletInstance = new FfiWallet(
        mintUrl,
        FfiCurrencyUnit.Sat,
        localStore,
        seed
      );
      console.log('Wallet created successfully!');
      
      // Try to initialize wallet with mint keysets and mint info
      try {
        console.log('Initializing wallet with mint...');
        console.log('Available wallet methods:', Object.getOwnPropertyNames(walletInstance));
        
        // Try to get mint info to verify connection
        const mintUrlCheck = walletInstance.mintUrl();
        console.log('Wallet connected to mint:', mintUrlCheck);
        
        // Initialize mint information - this is crucial to fix "Token does not match wallet mint" error
        if (typeof walletInstance.getMintInfo === 'function') {
          console.log('Fetching and initializing mint information...');
          try {
            const mintInitResult = await walletInstance.getMintInfo();
            console.log('Mint initialization result:', mintInitResult);
          } catch (mintInfoError) {
            console.log('Mint info initialization failed:', mintInfoError);
            // Continue anyway, but this might cause issues later
          }
        } else {
          console.log('getMintInfo method not available');
        }
        
        // Force the wallet to sync by checking balance - this might trigger keyset fetching
        console.log('Attempting initial sync...');
        try {
          const initialBalance = walletInstance.balance();
          console.log('Initial balance sync successful:', initialBalance.value);
        } catch (balanceError) {
          console.log('Initial balance check failed (might be expected for new wallet):', balanceError);
          // This might fail for a new wallet, but it should trigger keyset fetching
        }
        
      } catch (initError) {
        console.log('Wallet initialization warning:', initError);
        // Continue anyway, this might not be required
      }
      
      // Save wallet instance for later use
      setWallet(walletInstance);
      
      // Try to get balance, but handle the case where wallet is not yet initialized
      try {
        const walletBalance = walletInstance.balance();
        setBalance(walletBalance.value);
        console.log('Balance retrieved:', walletBalance.value);
        Alert.alert('Success!', `Wallet created and balance retrieved: ${walletBalance.value} sats`);
      } catch (balanceError) {
        console.log('Balance retrieval failed (expected for new wallet):', balanceError);
        setBalance(BigInt(0));
        Alert.alert('Success!', 'Wallet created successfully! Balance is 0 sats (new wallet)');
      }
      
    } catch (error) {
      console.error('Wallet creation error:', error);
      Alert.alert('Error', `Wallet creation failed: ${error instanceof Error ? error.message : String(error)}`);
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
      console.log('Creating invoice for amount:', receiveAmount);
      console.log('Wallet instance:', wallet);
      console.log('Wallet methods:', Object.getOwnPropertyNames(wallet));
      
      // Check if wallet has required methods
      if (typeof wallet.mintQuote !== 'function') {
        throw new Error('Wallet mintQuote method not available');
      }
      
      // Check wallet state before making quote
      try {
        const mintUrlCheck = wallet.mintUrl();
        console.log('Wallet mint URL:', mintUrlCheck);
      } catch (urlErr) {
        console.log('Could not get mint URL:', urlErr);
      }
      
      // Try to sync wallet state by checking balance first
      try {
        const currentBalance = wallet.balance();
        console.log('Current wallet balance before quote:', currentBalance.value);
      } catch (balanceErr) {
        console.log('Balance check before quote failed:', balanceErr);
        // This might indicate the wallet isn't properly synced
      }
      
      const amount = { value: BigInt(receiveAmount) };
      console.log('Calling mintQuote with amount:', amount);
      
      // Add a small delay to ensure wallet is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const mintQuote = await wallet.mintQuote(amount, 'Cashu wallet receive');
      
      console.log('MintQuote successful:', mintQuote);
      
      setInvoice(mintQuote.request);
      setQuoteId(mintQuote.id);
      
      Alert.alert('Invoice Created!', 'Lightning invoice created successfully. Copy and share it to receive payment.');
      
    } catch (error) {
      console.error('Failed to create invoice:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      
      // Try to get more specific error information
      let errorMsg = 'Unknown error';
      
      // Check if it's a CDK FFI error with detailed message
      if (error && typeof error === 'object' && 'tag' in error && 'inner' in error && 
          error.tag === 'WalletError' && error.inner && typeof error.inner === 'object' && 'msg' in error.inner) {
        const walletError = error as { tag: string; inner: { msg: string } };
        errorMsg = `WalletError: ${walletError.inner.msg}`;
        console.error('Detailed WalletError message:', walletError.inner.msg);
      } else if (error && typeof error === 'object' && 'inner' in error && 
                 error.inner && typeof error.inner === 'object' && 'msg' in error.inner) {
        const cdkError = error as { inner: { msg: string } };
        errorMsg = `CDK Error: ${cdkError.inner.msg}`;
        console.error('CDK Error details:', cdkError.inner.msg);
      } else if (error instanceof Error) {
        errorMsg = error.message;
        console.error('Error stack:', error.stack);
      } else if (typeof error === 'string') {
        errorMsg = error;
      } else if (error && typeof error === 'object') {
        // Log the full error structure for debugging
        console.error('Full error object:', JSON.stringify(error, null, 2));
        errorMsg = JSON.stringify(error);
      }
      
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
      console.log('Refreshing balance...');
      const walletBalance = wallet.balance();
      setBalance(walletBalance.value);
      console.log('Balance refreshed:', walletBalance.value);
      Alert.alert('Balance Updated', `Current balance: ${walletBalance.value} sats`);
    } catch (error) {
      console.error('Failed to refresh balance:', error);
      Alert.alert('Error', `Failed to refresh balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const checkAndMintPendingTokens = async () => {
    if (!wallet || !quoteId) {
      console.log('No wallet or quote to check');
      return;
    }
    
    try {
      console.log('Checking mint quote status for:', quoteId);
      
      if (typeof wallet.mintQuoteState !== 'function') {
        console.log('mintQuoteState method not available');
        return;
      }
      
      const quoteState = await wallet.mintQuoteState(quoteId);
      console.log('Quote state:', quoteState);
      
      if (quoteState.state === cdkModule.FfiMintQuoteState.Paid) {
        console.log('Quote has been paid! Minting tokens...');
        
        if (typeof wallet.mint === 'function') {
          try {
            const mintedAmount = await wallet.mint(quoteId, cdkModule.FfiSplitTarget.Default);
            console.log('Successfully minted:', mintedAmount.value, 'sats');
            
            const newBalance = wallet.balance();
            setBalance(newBalance.value);
            
            Alert.alert('Success!', `Successfully minted ${mintedAmount.value} sats! New balance: ${newBalance.value} sats`);
            
            setInvoice('');
            setQuoteId('');
            setShowReceiveModal(false);
          } catch (mintError) {
            console.error('Failed to mint tokens:', mintError);
            Alert.alert('Error', `Failed to mint tokens: ${mintError instanceof Error ? mintError.message : String(mintError)}`);
          }
        }
      } else {
        console.log('Quote not yet paid, state:', quoteState.state);
        Alert.alert('Waiting', 'Invoice not yet paid. Please complete the payment.');
      }
    } catch (error) {
      console.error('Failed to check mint quote:', error);
      Alert.alert('Error', `Failed to check payment status: ${error instanceof Error ? error.message : String(error)}`);
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
      console.log('Attempting to send payment...');
      console.log('Lightning invoice:', lightningInvoice);
      
      // Check current balance first
      const currentBalance = wallet.balance();
      console.log('Current balance before send:', currentBalance.value);
      
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
      
      console.log('Using meltQuote for Lightning payment...');
      console.log('Preparing Lightning payment...');
      
      // Use melt methods for Lightning payments
      console.log('Calling meltQuote for Lightning invoice...');
      try {
        const meltQuote = await wallet.meltQuote(lightningInvoice);
        console.log('Melt quote result:', meltQuote);
        
        const prepareResult = {
          amount: meltQuote.amount,
          totalFee: meltQuote.feeReserve || { value: BigInt(0) }
        };
        
        console.log('Prepared result from melt quote:', prepareResult);
        
        const totalAmount = prepareResult.amount.value + prepareResult.totalFee.value;
        
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
                  console.log('Executing Lightning payment...');
                  console.log('Calling melt to execute Lightning payment with quote ID:', meltQuote.id);
                  const sendResult = await wallet.melt(meltQuote.id);
                  console.log('Melt successful:', sendResult);
                  
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
                  console.error('Send execution failed:', sendError);
                  Alert.alert('Error', `Failed to send payment: ${sendError instanceof Error ? sendError.message : String(sendError)}`);
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
      console.error('Send preparation failed:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      
      let errorMsg = 'Unknown error';
      
      if (error && typeof error === 'object' && 'tag' in error && 'inner' in error && 
          error.tag === 'WalletError' && error.inner && typeof error.inner === 'object' && 'msg' in error.inner) {
        const walletError = error as { tag: string; inner: { msg: string } };
        errorMsg = `WalletError: ${walletError.inner.msg}`;
        console.error('Detailed WalletError message:', walletError.inner.msg);
      } else if (error && typeof error === 'object' && 'inner' in error && 
                 error.inner && typeof error.inner === 'object' && 'msg' in error.inner) {
        const cdkError = error as { inner: { msg: string } };
        errorMsg = `CDK Error: ${cdkError.inner.msg}`;
        console.error('CDK Error details:', cdkError.inner.msg);
      } else if (error instanceof Error) {
        errorMsg = error.message;
        console.error('Error stack:', error.stack);
      } else if (typeof error === 'string') {
        errorMsg = error;
      } else if (error && typeof error === 'object') {
        console.error('Full error object:', JSON.stringify(error, null, 2));
        errorMsg = JSON.stringify(error);
      }
      
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
