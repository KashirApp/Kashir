import { useState, useEffect } from 'react';
import { Alert, Clipboard } from 'react-native';
import { FfiLocalStore, FfiWallet, FfiCurrencyUnit, FfiMintQuoteState, FfiSplitTarget } from '../../../../../src';
import RNFS from 'react-native-fs';
import { getErrorMessage } from '../utils/errorUtils';

const mintUrl = 'https://mint.103100.xyz';

export function useWallet() {
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

  // Initialize CDK module
  useEffect(() => {
    const testCdkLoading = () => {
      try {
        setModuleStatus('Testing CDK import...');
        
        if (FfiLocalStore && FfiWallet && FfiCurrencyUnit) {
          setModuleStatus('All CDK components available!');
          
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
      const seed = new ArrayBuffer(32);
      const seedView = new Uint8Array(seed);
      for (let i = 0; i < 32; i++) {
        seedView[i] = Math.floor(Math.random() * 256);
      }
      
      let localStore;
      try {
        const dbPath = `${RNFS.DocumentDirectoryPath}/cdk_wallet.db`;
        localStore = FfiLocalStore.newWithPath(dbPath);
      } catch (storeError) {
        console.error('FfiLocalStore creation failed:', storeError);
        const errorMsg = getErrorMessage(storeError);
        
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
      
      try {
        if (typeof walletInstance.getMintInfo === 'function') {
          await walletInstance.getMintInfo();
        }
        
        try {
          walletInstance.balance();
        } catch (balanceError) {
          // Expected for new wallets
        }
      } catch (initError) {
        // Continue anyway, initialization might not be required
      }
      
      setWallet(walletInstance);
      
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
      const currentBalance = wallet.balance();
      
      if (currentBalance.value <= 0) {
        Alert.alert('Error', 'Insufficient balance to send payment');
        setIsSending(false);
        return;
      }
      
      if (typeof wallet.meltQuote !== 'function') {
        console.error('meltQuote is not a function, type:', typeof wallet.meltQuote);
        
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
        
        const currentBalance = wallet.balance();
        if (currentBalance.value < totalAmount) {
          Alert.alert('Insufficient Balance', `You need ${totalAmount} sats but only have ${currentBalance.value} sats`);
          setIsSending(false);
          return;
        }
        
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
                  
                  const newBalance = wallet.balance();
                  setBalance(newBalance.value);
                  
                  const resultMessage = sendResult.preimage 
                    ? `Payment sent successfully!\nPayment proof: ${sendResult.preimage}\nNew balance: ${newBalance.value} sats`
                    : `Payment sent successfully!\nNew balance: ${newBalance.value} sats`;
                  
                  Alert.alert('Success!', resultMessage);
                  
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

  return {
    // State
    balance,
    moduleStatus,
    wallet,
    mintUrl,
    showReceiveModal,
    receiveAmount,
    invoice,
    isLoadingInvoice,
    showSendModal,
    lightningInvoice,
    isSending,
    
    // Actions
    testWalletCreation,
    handleReceive,
    handleSend,
    createInvoice,
    copyToClipboard,
    refreshBalance,
    checkAndMintPendingTokens,
    sendPayment,
    
    // Modal controls
    setShowReceiveModal,
    setReceiveAmount,
    setShowSendModal,
    setLightningInvoice,
  };
} 