import { useState, useEffect, useRef } from 'react';
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
  const [showConfetti, setShowConfetti] = useState(false);
  const [paymentReceivedAmount, setPaymentReceivedAmount] = useState<bigint>(BigInt(0));
  
  // Ref for payment checking interval
  const paymentCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Function to load mint URL from storage
  const loadMintUrlFromStorage = async () => {
    try {
      const savedMintUrl = await AsyncStorage.getItem(MINT_URL_STORAGE_KEY);
      if (savedMintUrl) {
        setMintUrl(savedMintUrl);
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

  // Function to check if wallet database exists
  const checkWalletExists = async () => {
    try {
      const dbPath = `${RNFS.DocumentDirectoryPath}/cdk_wallet.db`;
      const exists = await RNFS.exists(dbPath);
      return exists;
    } catch (error) {
      console.error('Failed to check wallet existence:', error);
      return false;
    }
  };

  // Function to restore existing wallet
  const restoreExistingWallet = async (mintUrlToUse?: string) => {
    const urlToUse = mintUrlToUse || mintUrl;
    if (!cdkModule || !urlToUse) {
      return false;
    }

    try {
      setModuleStatus('Restoring existing wallet...');
      
      const dbPath = `${RNFS.DocumentDirectoryPath}/cdk_wallet.db`;
      
      // Use a dummy seed since we're restoring from existing database
      const seed = new ArrayBuffer(32);
      const seedView = new Uint8Array(seed);
      for (let i = 0; i < 32; i++) {
        seedView[i] = Math.floor(Math.random() * 256);
      }
      
      let localStore;
      try {
        localStore = FfiLocalStore.newWithPath(dbPath);
      } catch (storeError) {
        console.error('Failed to open existing wallet database:', storeError);
        return false;
      }
      
      if (!localStore) {
        console.error('LocalStore is undefined, cannot restore wallet');
        return false;
      }
      
      const walletInstance = new FfiWallet(
        urlToUse,
        FfiCurrencyUnit.Sat,
        localStore,
        seed
      );
      
      try {
        // Try to get balance to verify wallet works
        const walletBalance = walletInstance.balance();
        setBalance(walletBalance.value);
        setWallet(walletInstance);
        setModuleStatus(`Wallet restored! Balance: ${walletBalance.value} sats`);
        return true;
      } catch (balanceError) {
        // Wallet exists but might be empty, still consider it restored
        setBalance(BigInt(0));
        setWallet(walletInstance);
        setModuleStatus('Wallet restored successfully!');
        return true;
      }
      
    } catch (error) {
      console.error('Failed to restore wallet:', error);
      setModuleStatus(`Failed to restore wallet: ${getErrorMessage(error)}`);
      return false;
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
    
    // If we should create wallet after setting mint, set loading state
    if (shouldCreateWalletAfterMint) {
      setIsLoadingWallet(true);
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
      const initializeWallet = async () => {
        try {
          // Try to load saved mint URL
          const savedMintUrl = await AsyncStorage.getItem(MINT_URL_STORAGE_KEY);
          
          if (!savedMintUrl) {
            setModuleStatus('Ready - Set mint URL to begin');
            setIsLoadingWallet(false);
            return;
          }
          
          // Set the mint URL in state
          setMintUrl(savedMintUrl);
          
          // Mint URL exists, check if wallet database exists
          const walletExists = await checkWalletExists();
          
          if (walletExists) {
            // Try to restore existing wallet, passing the mint URL directly
            const restored = await restoreExistingWallet(savedMintUrl);
            
            if (!restored) {
              setModuleStatus('Wallet database found but restoration failed. Ready to create new wallet.');
            }
            // If restored successfully, the status is set in restoreExistingWallet
          } else {
            setModuleStatus('Mint URL restored from storage. Ready to create wallet.');
          }
          
          // Set loading to false after wallet restoration is complete
          setIsLoadingWallet(false);
        } catch (error) {
          console.error('Error during wallet initialization:', error);
          setModuleStatus('Error during initialization. Ready to create wallet.');
          setIsLoadingWallet(false);
        }
      };

      // Add a small delay to ensure the screen is fully rendered, then initialize
      setTimeout(initializeWallet, 500);
    }
    
    // Safety timeout to ensure loading doesn't hang forever
    const safetyTimeout = setTimeout(() => {
      setIsLoadingWallet(false);
      setModuleStatus('Loading timeout. Please try again.');
    }, 10000); // 10 seconds timeout
    
    return () => clearTimeout(safetyTimeout);
  }, [cdkModule]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      stopPaymentChecking();
    };
  }, []);

  // Auto-create wallet after mint URL is set (when triggered from Create Wallet button)
  useEffect(() => {
    if (shouldCreateWalletAfterMint && mintUrl && cdkModule) {
      
      // Call wallet creation directly here instead of through testWalletCreation
      const createWalletDirectly = async () => {
        // Check if wallet already exists first
        const walletExists = await checkWalletExists();
        if (walletExists) {
          // Try to restore existing wallet instead of creating new one
          const restored = await restoreExistingWallet(mintUrl);
          if (restored) {
            setShouldCreateWalletAfterMint(false);
            return; // Successfully restored existing wallet
          }
          // If restoration failed, continue with creating new wallet
          setModuleStatus('Existing wallet found but failed to restore. Creating new wallet...');
        } else {
          setModuleStatus('Creating wallet...');
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
          setIsLoadingWallet(false);
          
        } catch (error) {
          console.error('Wallet creation error:', error);
          setModuleStatus(`Wallet creation failed: ${getErrorMessage(error)}`);
          setShouldCreateWalletAfterMint(false); // Reset flag on error
          setIsLoadingWallet(false);
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
    
    // Set loading state for wallet creation
    setIsLoadingWallet(true);
    
    // Check if wallet already exists
    const walletExists = await checkWalletExists();
    if (walletExists) {
      // Try to restore existing wallet instead of creating new one
      const restored = await restoreExistingWallet(mintUrl);
      if (restored) {
        setIsLoadingWallet(false);
        return; // Successfully restored existing wallet
      }
      // If restoration failed, continue with creating new wallet
      setModuleStatus('Existing wallet found but failed to restore. Creating new wallet...');
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
      
      setIsLoadingWallet(false);
      
    } catch (error) {
      console.error('Wallet creation error:', error);
      setModuleStatus(`Wallet creation failed: ${getErrorMessage(error)}`);
      setIsLoadingWallet(false);
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
    // Stop any existing payment checking
    stopPaymentChecking();
  };

  // Custom function to close receive modal and stop payment checking
  const closeReceiveModal = () => {
    stopPaymentChecking();
    setShowReceiveModal(false);
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
      
      // Start automatic payment checking with the quote ID directly
      startPaymentChecking(mintQuote.id);
      
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

      // Silent background payment checking
  const checkPaymentStatus = async (currentQuoteId?: string) => {
    const activeQuoteId = currentQuoteId || quoteId;
    
    if (!wallet || !activeQuoteId) {
      return false;
    }
    
    try {
      if (typeof wallet.mintQuoteState !== 'function') {
        return false;
      }
      
      const quoteState = await wallet.mintQuoteState(activeQuoteId);
      
      if (quoteState.state === FfiMintQuoteState.Paid) {
        if (typeof wallet.mint === 'function') {
          try {
            const mintedAmount = await wallet.mint(activeQuoteId, FfiSplitTarget.Default);
            const newBalance = wallet.balance();
            setBalance(newBalance.value);
            
            // Clear the interval
            if (paymentCheckInterval.current) {
              clearInterval(paymentCheckInterval.current);
              paymentCheckInterval.current = null;
            }
            
            // Clear invoice data and close modal
            setInvoice('');
            setQuoteId('');
            setShowReceiveModal(false);
            
            // Show confetti animation
            setPaymentReceivedAmount(mintedAmount.value);
            setShowConfetti(true);
            
            // Hide confetti after 3 seconds
            setTimeout(() => setShowConfetti(false), 3000);
            
            return true;
          } catch (mintError) {
            console.error('Failed to mint tokens:', mintError);
            Alert.alert('Error', `Failed to mint tokens: ${getErrorMessage(mintError)}`);
            return false;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to check mint quote:', error);
      return false;
    }
  };

  // Start automatic payment checking
  const startPaymentChecking = (targetQuoteId?: string) => {
    // Clear any existing interval
    if (paymentCheckInterval.current) {
      clearInterval(paymentCheckInterval.current);
    }
    
    // Check immediately first
    checkPaymentStatus(targetQuoteId);
    
    // Start checking every second
    paymentCheckInterval.current = setInterval(() => checkPaymentStatus(targetQuoteId), 1000);
  };

  // Stop automatic payment checking
  const stopPaymentChecking = () => {
    if (paymentCheckInterval.current) {
      clearInterval(paymentCheckInterval.current);
      paymentCheckInterval.current = null;
    }
  };



  const sendPayment = async (scannedInvoice?: string) => {
    const invoiceToUse = scannedInvoice || lightningInvoice;
    
    if (!wallet || !invoiceToUse.trim()) {
      Alert.alert('Error', 'Please enter a Lightning invoice');
      return;
    }

    if (!cdkModule) {
      Alert.alert('Error', 'CDK module not loaded');
      return;
    }

    if (!invoiceToUse.toLowerCase().startsWith('lnbc')) {
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
        const meltQuote = await wallet.meltQuote(invoiceToUse);
        
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
    showConfetti,
    paymentReceivedAmount,
    
    // Actions
    testWalletCreation,
    handleReceive,
    handleSend,
    createInvoice,
    copyToClipboard,
    refreshBalance,
    sendPayment,
    promptForMintUrl,
    handleMintUrlSubmit,
    clearMintUrlFromStorage,
    checkWalletExists,
    restoreExistingWallet,
    
    // Modal controls
    closeReceiveModal,
    setReceiveAmount,
    setShowSendModal,
    setLightningInvoice,
    handleMintUrlModalClose,
  };
} 