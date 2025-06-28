import { useState, useEffect } from 'react';
import { Alert, Clipboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FfiLocalStore, FfiWallet, FfiCurrencyUnit, FfiMintQuoteState, FfiSplitTarget } from '../../../../../src';
import RNFS from 'react-native-fs';
import { getErrorMessage } from '../utils/errorUtils';

const MINT_URL_STORAGE_KEY = '@cashu_mint_url';

export function useWallet() {
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [moduleStatus, setModuleStatus] = useState<string>('Loading...');
  const [cdkModule, setCdkModule] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [mintUrl, setMintUrl] = useState<string>('');
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [invoice, setInvoice] = useState('');
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [quoteId, setQuoteId] = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [lightningInvoice, setLightningInvoice] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMintUrlModal, setShowMintUrlModal] = useState(false);
  const [shouldCreateWalletAfterMint, setShouldCreateWalletAfterMint] = useState(false);

  // Function to load mint URL from storage
  const loadMintUrlFromStorage = async () => {
    try {
      const savedMintUrl = await AsyncStorage.getItem(MINT_URL_STORAGE_KEY);
      if (savedMintUrl) {
        setMintUrl(savedMintUrl);
        setModuleStatus('Mint URL restored from storage. Ready to create wallet.');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load mint URL from storage:', error);
      return false;
    }
  };

  // Function to save mint URL to storage
  const saveMintUrlToStorage = async (url: string) => {
    try {
      await AsyncStorage.setItem(MINT_URL_STORAGE_KEY, url);
    } catch (error) {
      console.error('Failed to save mint URL to storage:', error);
    }
  };

  // Function to clear mint URL from storage
  const clearMintUrlFromStorage = async () => {
    try {
      await AsyncStorage.removeItem(MINT_URL_STORAGE_KEY);
      setMintUrl('');
      setModuleStatus('Ready - Set mint URL to begin');
    } catch (error) {
      console.error('Failed to clear mint URL from storage:', error);
    }
  };

  // Function to prompt user for mint URL
  const promptForMintUrl = () => {
    // Show the mint URL modal
    setShowMintUrlModal(true);
  };

  // Function to handle mint URL submission
  const handleMintUrlSubmit = async (url: string) => {
    setMintUrl(url);
    setShowMintUrlModal(false);
    
    // Save to storage
    await saveMintUrlToStorage(url);
    
    // If we should create wallet after setting mint, just set the status
    // The useEffect below will handle the automatic wallet creation
    if (shouldCreateWalletAfterMint) {
      setModuleStatus('Mint URL set. Creating wallet...');
    } else {
      setModuleStatus('Mint URL set. Ready to create wallet.');
    }
  };

  // Function to handle mint URL modal close
  const handleMintUrlModalClose = () => {
    setShowMintUrlModal(false);
    // Only reset the flag if the modal was cancelled (no mint URL was set)
    // If mint URL was set, let the useEffect handle the flag
    if (!mintUrl) {
      setShouldCreateWalletAfterMint(false);
      setModuleStatus('Mint URL required to continue');
    }
  };



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
        setIsLoadingWallet(false);
      }
    };
    
    // Add a small delay to ensure everything is initialized
    setTimeout(testCdkLoading, 100);
  }, []);

  // Set ready state when CDK module is loaded
  useEffect(() => {
    if (cdkModule) {
      // Add a small delay to ensure the screen is fully rendered
      setTimeout(async () => {
        setIsLoadingWallet(false);
        
        // Try to load saved mint URL
        const hasLoadedMintUrl = await loadMintUrlFromStorage();
        if (!hasLoadedMintUrl) {
          setModuleStatus('Ready - Set mint URL to begin');
        }
      }, 500);
    }
    
    // Safety timeout to ensure loading doesn't hang forever
    const safetyTimeout = setTimeout(() => {
      if (isLoadingWallet) {
        setIsLoadingWallet(false);
        setModuleStatus('Loading timeout. Please try again.');
      }
    }, 10000); // 10 seconds timeout
    
    return () => clearTimeout(safetyTimeout);
  }, [cdkModule, isLoadingWallet]);

  // Auto-create wallet after mint URL is set (when triggered from Create Wallet button)
  useEffect(() => {
    if (shouldCreateWalletAfterMint && mintUrl && cdkModule) {
      
      // Call wallet creation directly here instead of through testWalletCreation
      const createWalletDirectly = async () => {
        setModuleStatus('Creating wallet...');
        
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
              setModuleStatus(`CDK storage failed: ${errorMsg}. Fallback failed: ${fallbackErrorMsg}`);
              setShouldCreateWalletAfterMint(false); // Reset flag on error
              return;
            }
          }
          
          if (!localStore) {
            console.error('LocalStore is undefined, cannot create wallet');
            setShouldCreateWalletAfterMint(false); // Reset flag on error
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
            setModuleStatus('Wallet created successfully!');
          } catch (balanceError) {
            setBalance(BigInt(0));
            setModuleStatus('Wallet created successfully!');
          }
          
          // Reset flag after successful wallet creation
          setShouldCreateWalletAfterMint(false);
          
        } catch (error) {
          console.error('Wallet creation error:', error);
          setModuleStatus(`Wallet creation failed: ${getErrorMessage(error)}`);
          setShouldCreateWalletAfterMint(false); // Reset flag on error
        }
      };
      
      // Small delay to ensure everything is ready
      setTimeout(createWalletDirectly, 100);
    }
  }, [shouldCreateWalletAfterMint, mintUrl, cdkModule]);

  const testWalletCreation = async () => {
    if (!cdkModule) {
      setModuleStatus('CDK module not loaded');
      return;
    }
    
    if (!mintUrl) {
      setModuleStatus('Please set a mint URL first');
      setShouldCreateWalletAfterMint(true);
      promptForMintUrl();
      return;
    }
    
    // Reset flag since we're proceeding with wallet creation
    setShouldCreateWalletAfterMint(false);
    
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
          setModuleStatus(`CDK storage failed: ${errorMsg}. Fallback failed: ${fallbackErrorMsg}`);
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
        setModuleStatus('Wallet created successfully!');
      } catch (balanceError) {
        setBalance(BigInt(0));
        setModuleStatus('Wallet created successfully!');
      }
      
    } catch (error) {
      console.error('Wallet creation error:', error);
      setModuleStatus(`Wallet creation failed: ${getErrorMessage(error)}`);
    }
  };

  const handleReceive = () => {
    if (!wallet) {
      setModuleStatus('Please create a wallet first');
      return;
    }
    setShowReceiveModal(true);
    setReceiveAmount('');
    setInvoice('');
    setQuoteId('');
  };

  const handleSend = () => {
    if (!wallet) {
      setModuleStatus('Please create a wallet first');
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
      setModuleStatus('Please create a wallet first');
      return;
    }
    
    try {
      const walletBalance = wallet.balance();
      setBalance(walletBalance.value);
      setModuleStatus(`Balance updated: ${walletBalance.value} sats`);
    } catch (error) {
      console.error('Failed to refresh balance:', error);
      setModuleStatus(`Failed to refresh balance: ${getErrorMessage(error)}`);
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
    isLoadingWallet,
    showReceiveModal,
    receiveAmount,
    invoice,
    isLoadingInvoice,
    showSendModal,
    lightningInvoice,
    isSending,
    showMintUrlModal,
    
    // Actions
    testWalletCreation,
    handleReceive,
    handleSend,
    createInvoice,
    copyToClipboard,
    refreshBalance,
    checkAndMintPendingTokens,
    sendPayment,
    promptForMintUrl,
    handleMintUrlSubmit,
    clearMintUrlFromStorage,
    
    // Modal controls
    setShowReceiveModal,
    setReceiveAmount,
    setShowSendModal,
    setLightningInvoice,
    handleMintUrlModalClose,
  };
} 