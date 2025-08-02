import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FfiLocalStore,
  FfiWallet,
  FfiCurrencyUnit,
  FfiMintQuoteState,
  FfiSplitTarget,
  generateMnemonic,
} from 'kashir';
import RNFS from 'react-native-fs';
import { getErrorMessage } from '../utils/errorUtils';
import { formatSats, getSatUnit } from '../utils/formatUtils';
import { SecureStorageService } from '../../../services/SecureStorageService';
import {
  getMintDbPath,
  clearWalletCache,
  getMintBalance,
  getCachedMintBalance,
  updateCachedMintBalance,
  loadCachedBalances,
} from '../utils/mintBalanceUtils';

const MINT_URLS_STORAGE_KEY = '@cashu_mint_urls';
const ACTIVE_MINT_URL_STORAGE_KEY = '@cashu_active_mint_url';

export function useWallet() {
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [moduleStatus, setModuleStatus] = useState<string>('Loading...');
  const [cdkModule, setCdkModule] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [mintUrls, setMintUrls] = useState<string[]>([]);
  const [activeMintUrl, setActiveMintUrl] = useState<string>('');
  // Track current mint URL to ensure synchronous updates
  const currentMintUrlRef = useRef<string>('');

  const setCurrentMintUrlRef = (value: string) => {
    currentMintUrlRef.current = value;
  };
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
  const [shouldCreateWalletAfterMint, setShouldCreateWalletAfterMint] =
    useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [paymentReceivedAmount, setPaymentReceivedAmount] = useState<bigint>(
    BigInt(0)
  );
  const [showSentConfetti, setShowSentConfetti] = useState(false);
  const [paymentSentAmount, setPaymentSentAmount] = useState<bigint>(BigInt(0));
  const [showSendingLoader, setShowSendingLoader] = useState(false);
  const [showReceivingLoader, setShowReceivingLoader] = useState(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string>('');
  const [showMnemonicModal, setShowMnemonicModal] = useState(false);
  const [pendingWalletCreation, setPendingWalletCreation] = useState<any>(null);
  const [showRecoverModal, setShowRecoverModal] = useState(false);
  const [shouldShowRecoverAfterMint, setShouldShowRecoverAfterMint] =
    useState(false);
  const [showRecoveryLoader, setShowRecoveryLoader] = useState(false);
  const [showRecoveryConfetti, setShowRecoveryConfetti] = useState(false);

  // Ref for payment checking interval
  const paymentCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Ref to prevent duplicate payment calls
  const isProcessingPayment = useRef(false);

  // Function to load mint URLs from storage
  const loadMintUrlsFromStorage = async () => {
    try {
      const savedMintUrls = await AsyncStorage.getItem(MINT_URLS_STORAGE_KEY);
      if (savedMintUrls) {
        const parsedUrls = JSON.parse(savedMintUrls);
        setMintUrls(parsedUrls);
        // Set the first URL as active if no active URL is set
        if (parsedUrls.length > 0 && !activeMintUrl) {
          setActiveMintUrl(parsedUrls[0]);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load mint URLs from storage:', error);
      return false;
    }
  };

  // Function to save active mint URL to storage
  const saveActiveMintUrlToStorage = async (url: string) => {
    try {
      await AsyncStorage.setItem(ACTIVE_MINT_URL_STORAGE_KEY, url);
    } catch (error) {
      console.error('Failed to save active mint URL to storage:', error);
    }
  };

  // Function to load active mint URL from storage
  const loadActiveMintUrlFromStorage = async () => {
    try {
      const savedActiveMintUrl = await AsyncStorage.getItem(
        ACTIVE_MINT_URL_STORAGE_KEY
      );
      return savedActiveMintUrl;
    } catch (error) {
      console.error('Failed to load active mint URL from storage:', error);
      return null;
    }
  };

  // Function to save mint URLs to storage
  const saveMintUrlsToStorage = async (urls: string[]) => {
    try {
      await AsyncStorage.setItem(MINT_URLS_STORAGE_KEY, JSON.stringify(urls));
    } catch (error) {
      console.error('Failed to save mint URLs to storage:', error);
    }
  };

  // Function to add a new mint URL
  const addMintUrl = async (url: string) => {
    try {
      const newUrls = [...mintUrls];
      if (!newUrls.includes(url)) {
        newUrls.push(url);
        setMintUrls(newUrls);
        await saveMintUrlsToStorage(newUrls);

        // Create/restore wallet instance for the new mint
        const walletExists = await checkWalletExists(url);
        if (!walletExists) {
          // Create a new wallet instance for this mint
          const mnemonic = await SecureStorageService.getSeedPhrase();
          if (mnemonic) {
            try {
              const dbPath = getMintDbPath(url);
              const localStore = FfiLocalStore.newWithPath(dbPath);
              const walletInstance = FfiWallet.restoreFromMnemonic(
                url,
                FfiCurrencyUnit.Sat,
                localStore,
                mnemonic
              );
              console.log(`Created wallet instance for mint: ${url}`);
            } catch (error) {
              console.error(`Failed to create wallet for mint ${url}:`, error);
            }
          }
        }

        // Set as active if it's the first one
        if (newUrls.length === 1) {
          setActiveMintUrl(url);
          await saveActiveMintUrlToStorage(url);
          if (!currentMintUrlRef.current) {
            setCurrentMintUrlRef(url);
          }
        }
      }
    } catch (error) {
      console.error('Failed to add mint URL:', error);
    }
  };

  // Function to set active mint URL
  const setActiveMint = async (url: string) => {
    try {
      if (mintUrls.includes(url)) {
        const previousMintUrl = activeMintUrl;

        setCurrentMintUrlRef(url);
        await saveActiveMintUrlToStorage(url);
        setWallet(null);
        clearWalletCache();

        setModuleStatus(`Switching to mint: ${url}...`);
        const restored = await restoreExistingWallet(url);

        if (restored) {
          setModuleStatus(`Active mint changed to: ${url}`);
        } else {
          setModuleStatus(`Failed to switch to mint: ${url}`);
          setCurrentMintUrlRef(previousMintUrl);
          if (previousMintUrl) {
            await restoreExistingWallet(previousMintUrl);
          }
        }
      }
    } catch (error) {
      console.error('Failed to set active mint:', error);
      setModuleStatus(`Error switching mint: ${getErrorMessage(error)}`);
    }
  };

  // Function to remove a mint URL
  const removeMintUrl = async (url: string) => {
    try {
      // Don't allow removing the active mint
      if (url === activeMintUrl) {
        Alert.alert(
          'Error',
          'Cannot remove the currently active mint. Please set another mint as active first.'
        );
        return false;
      }

      const newUrls = mintUrls.filter((mintUrl) => mintUrl !== url);
      setMintUrls(newUrls);
      await saveMintUrlsToStorage(newUrls);
      return true;
    } catch (error) {
      console.error('Failed to remove mint URL:', error);
      return false;
    }
  };

  // Function to clear mint URLs from storage
  const clearMintUrlsFromStorage = async () => {
    try {
      await AsyncStorage.removeItem(MINT_URLS_STORAGE_KEY);
      setMintUrls([]);
      setActiveMintUrl('');
      setModuleStatus('Ready - Set mint URL to begin');
    } catch (error) {
      console.error('Failed to clear mint URLs from storage:', error);
    }
  };

  // Function to check if wallet database exists for a specific mint
  const checkWalletExists = async (mintUrl?: string) => {
    try {
      const urlToUse = mintUrl || activeMintUrl;
      if (!urlToUse) {
        return false;
      }
      const dbPath = getMintDbPath(urlToUse);
      const exists = await RNFS.exists(dbPath);
      return exists;
    } catch (error) {
      console.error('Failed to check wallet existence:', error);
      return false;
    }
  };

  // Function to restore existing wallet
  const restoreExistingWallet = async (mintUrlToUse?: string) => {
    const urlToUse = mintUrlToUse || activeMintUrl;
    if (!cdkModule || !urlToUse) {
      return false;
    }

    try {
      setModuleStatus('Restoring existing wallet...');

      const dbPath = getMintDbPath(urlToUse);

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

      // Try to get the stored seed phrase first
      const storedSeedPhrase = await SecureStorageService.getSeedPhrase();
      let walletInstance;

      if (storedSeedPhrase) {
        // Use the stored seed phrase
        walletInstance = FfiWallet.fromMnemonic(
          urlToUse,
          FfiCurrencyUnit.Sat,
          localStore,
          storedSeedPhrase
        );
      } else {
        // If no stored seed phrase, try to restore with a temporary one
        // This is for backwards compatibility with wallets created before secure storage
        const tempMnemonic = generateMnemonic();
        walletInstance = FfiWallet.fromMnemonic(
          urlToUse,
          FfiCurrencyUnit.Sat,
          localStore,
          tempMnemonic
        );
      }

      try {
        // Try to get balance to verify wallet works
        const walletBalance = walletInstance.balance();
        setWallet(walletInstance);

        // Update cached balance for this mint
        await updateCachedMintBalance(urlToUse, walletBalance.value);

        // Update total balance from cached balances
        await updateTotalBalance();

        // Update activeMintUrl to match the restored wallet
        setActiveMintUrl(urlToUse);
        setCurrentMintUrlRef(urlToUse);

        setModuleStatus(`Wallet restored! Total balance updated`);
        return true;
      } catch (balanceError) {
        // Wallet exists but might be empty, still consider it restored
        setWallet(walletInstance);

        // Update cached balance for this mint (0 for empty wallet)
        await updateCachedMintBalance(urlToUse, BigInt(0));

        // Update total balance from cached balances
        await updateTotalBalance();

        // Update activeMintUrl to match the restored wallet
        setActiveMintUrl(urlToUse);
        setCurrentMintUrlRef(urlToUse);

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
    await addMintUrl(url);
    setActiveMintUrl(url);
    setShowMintUrlModal(false);

    // If we should create wallet after setting mint, set loading state
    if (shouldCreateWalletAfterMint) {
      setIsLoadingWallet(true);
      setModuleStatus('Mint URL set. Creating wallet...');
    } else if (shouldShowRecoverAfterMint) {
      setModuleStatus('Mint URL set. Ready to recover wallet.');
      // Show recovery modal after a brief delay
      setTimeout(() => {
        setShowRecoverModal(true);
        setShouldShowRecoverAfterMint(false);
      }, 100);
    } else {
      setModuleStatus('Mint URL set. Ready to create wallet.');
    }
  };

  // Function to handle mint URL modal close
  const handleMintUrlModalClose = () => {
    setShowMintUrlModal(false);
    // Only reset the flag if the modal was cancelled (no mint URL was set)
    // If mint URL was set, let the useEffect handle the flag
    if (!activeMintUrl) {
      setShouldCreateWalletAfterMint(false);
      setShouldShowRecoverAfterMint(false);
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
          // Try to load saved mint URLs
          const savedMintUrls = await AsyncStorage.getItem(
            MINT_URLS_STORAGE_KEY
          );

          if (!savedMintUrls) {
            setModuleStatus('Ready - Set mint URL to begin');
            setIsLoadingWallet(false);
            return;
          }

          // Set the mint URLs in state
          const parsedUrls = JSON.parse(savedMintUrls);
          setMintUrls(parsedUrls);

          // Load the active mint URL from storage (not just the first one)
          const savedActiveMintUrl = await loadActiveMintUrlFromStorage();
          const activeMintToUse =
            savedActiveMintUrl && parsedUrls.includes(savedActiveMintUrl)
              ? savedActiveMintUrl
              : parsedUrls[0]; // Fallback to first mint if no saved active mint

          if (activeMintToUse) {
            setActiveMintUrl(activeMintToUse);
            if (!currentMintUrlRef.current) {
              setCurrentMintUrlRef(activeMintToUse);
            }
          }

          // Mint URL exists, check if wallet database exists
          const walletExists = await checkWalletExists(activeMintToUse);

          if (walletExists) {
            // Try to restore existing wallet, passing the correct active mint URL
            const restored = await restoreExistingWallet(activeMintToUse);

            if (!restored) {
              setModuleStatus(
                'Wallet database found but restoration failed. Ready to create new wallet.'
              );
            }
            // If restored successfully, the status is set in restoreExistingWallet
          } else {
            setModuleStatus(
              'Mint URL restored from storage. Ready to create wallet.'
            );
          }

          // Set loading to false after wallet restoration is complete
          setIsLoadingWallet(false);
        } catch (error) {
          console.error('Error during wallet initialization:', error);
          setModuleStatus(
            'Error during initialization. Ready to create wallet.'
          );
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
    if (shouldCreateWalletAfterMint && activeMintUrl && cdkModule) {
      // Call wallet creation directly here instead of through testWalletCreation
      const createWalletDirectly = async () => {
        // Check if wallet already exists first
        const walletExists = await checkWalletExists(activeMintUrl);
        if (walletExists) {
          // Try to restore existing wallet instead of creating new one
          const restored = await restoreExistingWallet(activeMintUrl);
          if (restored) {
            setShouldCreateWalletAfterMint(false);
            return; // Successfully restored existing wallet
          }
          // If restoration failed, continue with creating new wallet
          setModuleStatus(
            'Existing wallet found but failed to restore. Creating new wallet...'
          );
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
            const dbPath = getMintDbPath(activeMintUrl);
            localStore = FfiLocalStore.newWithPath(dbPath);
          } catch (storeError) {
            console.error('FfiLocalStore creation failed:', storeError);
            const errorMsg = getErrorMessage(storeError);

            try {
              localStore = new FfiLocalStore();
            } catch (fallbackError) {
              const fallbackErrorMsg = getErrorMessage(fallbackError);
              setModuleStatus(
                `CDK storage failed: ${errorMsg}. Fallback failed: ${fallbackErrorMsg}`
              );
              setShouldCreateWalletAfterMint(false); // Reset flag on error
              return;
            }
          }

          if (!localStore) {
            console.error('LocalStore is undefined, cannot create wallet');
            setShouldCreateWalletAfterMint(false); // Reset flag on error
            return;
          }

          // Generate mnemonic and create wallet
          const mnemonic = generateMnemonic();

          // Store wallet creation callback for when modal is closed
          setPendingWalletCreation(() => async () => {
            try {
              // Store the seed phrase securely before creating the wallet
              const stored =
                await SecureStorageService.storeSeedPhrase(mnemonic);
              if (!stored) {
                console.warn(
                  'Failed to store seed phrase securely, but continuing with wallet creation'
                );
              }

              // Create wallet with the mnemonic after user confirms
              let walletInstance;
              try {
                walletInstance = FfiWallet.fromMnemonic(
                  activeMintUrl,
                  FfiCurrencyUnit.Sat,
                  localStore,
                  mnemonic
                );
              } catch (walletCreationError) {
                console.error('Wallet creation failed:', walletCreationError);
                Alert.alert(
                  'Wallet Creation Failed',
                  'There was an error creating your wallet. Please check your mint URL and try again.',
                  [{ text: 'OK' }]
                );
                setIsLoadingWallet(false);
                return;
              }

              // Try to initialize wallet methods
              try {
                if (typeof walletInstance.getMintInfo === 'function') {
                  walletInstance.getMintInfo();
                }
              } catch (initError) {
                console.warn('getMintInfo failed, but continuing:', initError);
                // Continue anyway, this might not be critical
              }

              try {
                walletInstance.balance();
              } catch (balanceError) {
                console.warn(
                  'Initial balance check failed, but continuing:',
                  balanceError
                );
                // Expected for new wallets, continue
              }

              setWallet(walletInstance);

              // Try to get balance
              try {
                const walletBalance = walletInstance.balance();
                setBalance(walletBalance.value);
                setModuleStatus('Wallet created successfully!');
              } catch (balanceError) {
                console.warn(
                  'Balance retrieval failed, setting to 0:',
                  balanceError
                );
                setBalance(BigInt(0));
                setModuleStatus('Wallet created successfully!');
              }

              setIsLoadingWallet(false);
            } catch (error) {
              console.error('Error in wallet creation callback:', error);
              Alert.alert(
                'Wallet Creation Error',
                'An unexpected error occurred during wallet creation. Please try again.',
                [{ text: 'OK' }]
              );
              setIsLoadingWallet(false);
            }
          });

          // Set the generated mnemonic and show modal
          setGeneratedMnemonic(mnemonic);
          setShowMnemonicModal(true);

          return; // Return early since wallet creation happens in modal callback
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
  }, [shouldCreateWalletAfterMint, activeMintUrl, cdkModule]);

  const testWalletCreation = async () => {
    if (!cdkModule) {
      setModuleStatus('CDK module not loaded');
      return;
    }

    if (!activeMintUrl) {
      setModuleStatus('Please set a mint URL first');
      setShouldCreateWalletAfterMint(true);
      promptForMintUrl();
      return;
    }

    // Set loading state for wallet creation
    setIsLoadingWallet(true);

    // Check if wallet already exists
    const walletExists = await checkWalletExists(activeMintUrl);
    if (walletExists) {
      // Try to restore existing wallet instead of creating new one
      const restored = await restoreExistingWallet(activeMintUrl);
      if (restored) {
        setIsLoadingWallet(false);
        return; // Successfully restored existing wallet
      }
      // If restoration failed, continue with creating new wallet
      setModuleStatus(
        'Existing wallet found but failed to restore. Creating new wallet...'
      );
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
        const dbPath = getMintDbPath(activeMintUrl);
        localStore = FfiLocalStore.newWithPath(dbPath);
      } catch (storeError) {
        console.error('FfiLocalStore creation failed:', storeError);
        const errorMsg = getErrorMessage(storeError);

        try {
          localStore = new FfiLocalStore();
        } catch (fallbackError) {
          const fallbackErrorMsg = getErrorMessage(fallbackError);
          setModuleStatus(
            `CDK storage failed: ${errorMsg}. Fallback failed: ${fallbackErrorMsg}`
          );
          return;
        }
      }

      if (!localStore) {
        console.error('LocalStore is undefined, cannot create wallet');
        return;
      }

      // Generate mnemonic and create wallet
      const mnemonic = generateMnemonic();

      // Store wallet creation callback for when modal is closed
      setPendingWalletCreation(() => async () => {
        try {
          // Store the seed phrase securely before creating the wallet
          const stored = await SecureStorageService.storeSeedPhrase(mnemonic);
          if (!stored) {
            console.warn(
              'Failed to store seed phrase securely, but continuing with wallet creation'
            );
          }

          // Create wallet with the mnemonic after user confirms
          let walletInstance;
          try {
            walletInstance = FfiWallet.fromMnemonic(
              activeMintUrl,
              FfiCurrencyUnit.Sat,
              localStore,
              mnemonic
            );
          } catch (walletCreationError) {
            console.error('Wallet creation failed:', walletCreationError);
            Alert.alert(
              'Wallet Creation Failed',
              'There was an error creating your wallet. Please check your mint URL and try again.',
              [{ text: 'OK' }]
            );
            setIsLoadingWallet(false);
            return;
          }

          // Try to initialize wallet methods
          try {
            if (typeof walletInstance.getMintInfo === 'function') {
              walletInstance.getMintInfo();
            }
          } catch (initError) {
            console.warn('getMintInfo failed, but continuing:', initError);
            // Continue anyway, this might not be critical
          }

          try {
            walletInstance.balance();
          } catch (balanceError) {
            console.warn(
              'Initial balance check failed, but continuing:',
              balanceError
            );
            // Expected for new wallets, continue
          }

          setWallet(walletInstance);

          // Try to get balance
          try {
            const walletBalance = walletInstance.balance();
            setBalance(walletBalance.value);
            setModuleStatus('Wallet created successfully!');
          } catch (balanceError) {
            console.warn(
              'Balance retrieval failed, setting to 0:',
              balanceError
            );
            setBalance(BigInt(0));
            setModuleStatus('Wallet created successfully!');
          }

          setIsLoadingWallet(false);
        } catch (error) {
          console.error('Error in wallet creation callback:', error);
          Alert.alert(
            'Wallet Creation Error',
            'An unexpected error occurred during wallet creation. Please try again.',
            [{ text: 'OK' }]
          );
          setIsLoadingWallet(false);
        }
      });

      // Set the generated mnemonic and show modal
      setGeneratedMnemonic(mnemonic);
      setShowMnemonicModal(true);

      return; // Return early since wallet creation happens in modal callback
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

  // Function to calculate total balance across all mints using cached balances
  const calculateTotalBalance = async (): Promise<bigint> => {
    try {
      const cachedBalances = await loadCachedBalances();
      let totalBalance = BigInt(0);

      for (const mintBalance of cachedBalances) {
        totalBalance += mintBalance.balance;
      }

      return totalBalance;
    } catch (error) {
      console.error('Failed to calculate total balance:', error);
      return BigInt(0);
    }
  };

  // Function to update total balance display
  const updateTotalBalance = async () => {
    const total = await calculateTotalBalance();
    setBalance(total);
  };

  // Get the current active mint URL directly from storage (bypass React state)
  const getCurrentActiveMintUrl = async (): Promise<string> => {
    try {
      const savedActiveMintUrl = await AsyncStorage.getItem(
        ACTIVE_MINT_URL_STORAGE_KEY
      );
      if (savedActiveMintUrl) {
        return savedActiveMintUrl;
      }

      // Fallback to first mint if no active mint saved
      const savedMintUrls = await AsyncStorage.getItem(MINT_URLS_STORAGE_KEY);
      if (savedMintUrls) {
        const parsedUrls = JSON.parse(savedMintUrls);
        return parsedUrls[0] || '';
      }

      return '';
    } catch (error) {
      console.error('Failed to get current active mint URL:', error);
      return '';
    }
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
            const mintedAmount = await wallet.mint(
              activeQuoteId,
              FfiSplitTarget.Default
            );

            // Update cached balance arithmetically (faster than syncing)
            const actualMintUrl = await getCurrentActiveMintUrl();
            const currentCachedBalance =
              await getCachedMintBalance(actualMintUrl);
            const newBalance =
              currentCachedBalance.balance + mintedAmount.value;
            await updateCachedMintBalance(actualMintUrl, newBalance);

            // Update total balance from cached balances
            await updateTotalBalance();

            // Clear the interval
            if (paymentCheckInterval.current) {
              clearInterval(paymentCheckInterval.current);
              paymentCheckInterval.current = null;
            }

            // Clear invoice data and close modal immediately for better UX
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
            Alert.alert(
              'Error',
              `Failed to mint tokens: ${getErrorMessage(mintError)}`
            );
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
    paymentCheckInterval.current = setInterval(
      () => checkPaymentStatus(targetQuoteId),
      1000
    );
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

    // Prevent duplicate calls
    if (isProcessingPayment.current) {
      console.log('Payment already in progress, ignoring duplicate call');
      return;
    }

    if (!wallet || !invoiceToUse.trim()) {
      Alert.alert('Error', 'Please enter a Lightning invoice');
      return;
    }

    if (!cdkModule) {
      Alert.alert('Error', 'CDK module not loaded');
      return;
    }

    if (!invoiceToUse.toLowerCase().startsWith('lnbc')) {
      Alert.alert(
        'Error',
        'Please enter a valid Lightning invoice (should start with lnbc)'
      );
      return;
    }

    isProcessingPayment.current = true;
    setIsSending(true);
    try {
      const currentBalance = wallet.balance();

      if (currentBalance.value <= 0) {
        Alert.alert('Error', 'Insufficient balance to send payment');
        setIsSending(false);
        isProcessingPayment.current = false;
        return;
      }

      if (typeof wallet.meltQuote !== 'function') {
        console.error(
          'meltQuote is not a function, type:',
          typeof wallet.meltQuote
        );

        Alert.alert(
          'Lightning Payments Not Supported',
          'This CDK version does not support Lightning payments (meltQuote/melt methods are missing).\n\nAvailable methods: ' +
            Object.getOwnPropertyNames(Object.getPrototypeOf(wallet)).join(
              ', '
            ),
          [
            {
              text: 'OK',
              onPress: () => {
                setIsSending(false);
                isProcessingPayment.current = false;
              },
            },
          ]
        );
        return;
      }

      try {
        const meltQuote = await wallet.meltQuote(invoiceToUse);

        const prepareResult = {
          amount: meltQuote.amount,
          totalFee: meltQuote.feeReserve || { value: BigInt(0) },
        };

        const totalAmount =
          prepareResult.amount.value + prepareResult.totalFee.value;

        const currentBalance = wallet.balance();
        if (currentBalance.value < totalAmount) {
          Alert.alert(
            'Insufficient Balance',
            `You need ${formatSats(totalAmount)} but only have ${formatSats(currentBalance.value)}`
          );
          setIsSending(false);
          isProcessingPayment.current = false;
          return;
        }

        Alert.alert(
          'Confirm Payment',
          `Amount: ${formatSats(prepareResult.amount.value)}\nFee: ${formatSats(prepareResult.totalFee.value)}\nTotal: ${formatSats(totalAmount)}\n\nDo you want to proceed?`,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setIsSending(false);
                isProcessingPayment.current = false;
              },
            },
            {
              text: 'Send',
              onPress: async () => {
                try {
                  // Show loading indicator
                  setShowSendingLoader(true);

                  // Small delay to ensure the loading indicator renders
                  await new Promise((resolve) => setTimeout(resolve, 100));

                  const sendResult = await wallet.melt(meltQuote.id);

                  // Update cached balance arithmetically (faster than syncing)
                  const actualMintUrl = await getCurrentActiveMintUrl();
                  const currentCachedBalance =
                    await getCachedMintBalance(actualMintUrl);
                  const newBalance = currentCachedBalance.balance - totalAmount;
                  await updateCachedMintBalance(actualMintUrl, newBalance);

                  // Update total balance from cached balances
                  await updateTotalBalance();

                  // Clear invoice and close modal
                  setLightningInvoice('');
                  setShowSendModal(false);

                  // Hide loading indicator
                  setShowSendingLoader(false);

                  // Show sent confetti animation
                  setPaymentSentAmount(prepareResult.amount.value);
                  setShowSentConfetti(true);

                  // Hide confetti after 3 seconds
                  setTimeout(() => setShowSentConfetti(false), 3000);
                } catch (sendError) {
                  console.error('Payment failed:', sendError);

                  // Hide loading indicator on error
                  setShowSendingLoader(false);

                  const errorMsg = getErrorMessage(sendError);

                  Alert.alert('Payment Failed', errorMsg);
                } finally {
                  setIsSending(false);
                  isProcessingPayment.current = false;
                }
              },
            },
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
      isProcessingPayment.current = false;
    }
  };

  // Handle mnemonic modal done
  const handleMnemonicModalDone = async () => {
    setShowMnemonicModal(false);
    if (pendingWalletCreation) {
      await pendingWalletCreation();
      setPendingWalletCreation(null);
    }
  };

  // Handle recover wallet button
  const handleRecoverWallet = () => {
    if (!cdkModule) {
      setModuleStatus('CDK module not loaded');
      return;
    }

    if (!activeMintUrl) {
      setModuleStatus('Please set a mint URL first');
      setShouldShowRecoverAfterMint(true);
      promptForMintUrl();
      return;
    }

    setShowRecoverModal(true);
  };

  // Send cashu token directly (not Lightning)
  const sendCashuToken = async (amount: string, memo?: string) => {
    if (!wallet || !amount || parseInt(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return null;
    }

    try {
      const amountBigInt = BigInt(amount);
      const currentBalance = wallet.balance();

      if (currentBalance.value < amountBigInt) {
        Alert.alert(
          'Insufficient Balance',
          `You need ${formatSats(amountBigInt)} but only have ${formatSats(currentBalance.value)}`
        );
        return null;
      }

      const cashuToken = await wallet.sendCashuToken(
        { value: amountBigInt },
        memo || undefined
      );

      // Update balance
      const newBalance = wallet.balance();
      setBalance(newBalance.value);

      return cashuToken;
    } catch (error) {
      console.error('Failed to send cashu token:', error);
      const errorMsg = getErrorMessage(error);
      Alert.alert('Error', `Failed to send cashu token: ${errorMsg}`);
      return null;
    }
  };

  // Receive cashu token
  const receiveCashuToken = async (tokenString: string) => {
    if (!wallet || !tokenString.trim()) {
      Alert.alert('Error', 'Please enter a valid cashu token');
      return false;
    }

    try {
      // Parse the token first to extract mint information
      const parsedToken = await wallet.parseCashuToken(tokenString);
      const tokenMintUrl = parsedToken.mint;
      const currentActiveMint = await getCurrentActiveMintUrl();

      // Check if we need to add a new mint
      let needsNewMint = false;
      let targetMintUrl = tokenMintUrl;

      if (!mintUrls.includes(tokenMintUrl)) {
        needsNewMint = true;
      }

      // Show confirmation dialog with mint information
      const confirmationMessage = needsNewMint
        ? `This token is from: ${tokenMintUrl}\n\nThis mint will be automatically added to your wallet.\n\nDo you want to redeem this cashu token?`
        : `This token is from: ${tokenMintUrl}\n\nDo you want to redeem this cashu token to your wallet?`;

      Alert.alert('Redeem Cashu Token', confirmationMessage, [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Redeem',
          onPress: async () => {
            try {
              // Close the receive modal first
              setShowReceiveModal(false);

              // Show receiving loading indicator
              setShowReceivingLoader(true);

              // Small delay to ensure the loading indicator renders
              await new Promise((resolve) => setTimeout(resolve, 100));

              // Add mint if it doesn't exist
              if (needsNewMint) {
                await addMintUrl(tokenMintUrl);

                // Wait for React state to update after adding the mint
                await new Promise((resolve) => setTimeout(resolve, 500));
              }

              // Get the wallet instance for the token's mint
              let targetWallet = wallet;
              let previousMintUrl = null;

              // If token is from a different mint, temporarily switch to it
              if (tokenMintUrl !== currentActiveMint) {
                previousMintUrl = currentActiveMint;

                // Create wallet for the target mint directly instead of using setActiveMint
                try {
                  const dbPath = getMintDbPath(tokenMintUrl);
                  const localStore = FfiLocalStore.newWithPath(dbPath);

                  const storedSeedPhrase =
                    await SecureStorageService.getSeedPhrase();
                  if (!storedSeedPhrase) {
                    throw new Error(
                      'No seed phrase available for target mint wallet creation'
                    );
                  }

                  targetWallet = FfiWallet.fromMnemonic(
                    tokenMintUrl,
                    FfiCurrencyUnit.Sat,
                    localStore,
                    storedSeedPhrase
                  );

                  // Verify wallet works by checking if it has the receiveCashuToken method
                  if (typeof targetWallet.receiveCashuToken !== 'function') {
                    throw new Error(
                      'Target wallet does not have receiveCashuToken method'
                    );
                  }
                } catch (walletCreationError) {
                  console.error(
                    'Failed to create target wallet:',
                    walletCreationError
                  );
                  const errorMessage =
                    walletCreationError instanceof Error
                      ? walletCreationError.message
                      : 'Unknown error';
                  throw new Error(
                    `Failed to create wallet for mint ${tokenMintUrl}: ${errorMessage}`
                  );
                }
              }

              // Redeem the token using the correct mint's wallet
              const receivedAmount =
                await targetWallet.receiveCashuToken(tokenString);

              // Update cached balance for the correct mint
              const currentCachedBalance =
                await getCachedMintBalance(tokenMintUrl);
              const newBalance =
                currentCachedBalance.balance + receivedAmount.value;
              await updateCachedMintBalance(tokenMintUrl, newBalance);

              // Update total balance from cached balances
              await updateTotalBalance();

              // Switch back to previous mint if we changed it
              if (previousMintUrl && previousMintUrl !== tokenMintUrl) {
                await setActiveMint(previousMintUrl);
              }

              // Hide receiving loading indicator
              setShowReceivingLoader(false);

              // Show success confetti animation
              setPaymentReceivedAmount(receivedAmount.value);
              setShowConfetti(true);

              // Hide confetti after 3 seconds
              setTimeout(() => setShowConfetti(false), 3000);

              return true;
            } catch (error) {
              console.error('Failed to receive cashu token:', error);

              // Hide receiving loading indicator on error
              setShowReceivingLoader(false);

              const errorMsg = getErrorMessage(error);
              Alert.alert(
                'Error',
                `Failed to receive cashu token: ${errorMsg}`
              );
              return false;
            }
          },
        },
      ]);

      // Return true to indicate the dialog was shown
      return true;
    } catch (parseError) {
      console.error('Failed to parse cashu token:', parseError);
      const errorMsg = getErrorMessage(parseError);
      Alert.alert('Invalid Token', `Failed to parse cashu token: ${errorMsg}`);
      return false;
    }
  };

  // Handle wallet recovery from mnemonic
  const handleWalletRecovery = async (mnemonic: string) => {
    if (!cdkModule || !activeMintUrl) {
      Alert.alert('Error', 'CDK module or mint URL not available');
      return;
    }

    setIsLoadingWallet(true);
    setShowRecoverModal(false);
    setShowRecoveryLoader(true); // Show recovery loading indicator

    // Small delay to ensure the loading indicator renders
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      // Store the seed phrase securely first
      const stored = await SecureStorageService.storeSeedPhrase(mnemonic);
      if (!stored) {
        Alert.alert(
          'Warning',
          'Failed to securely store seed phrase. The wallet will still be recovered, but you should backup your seed phrase manually.',
          [{ text: 'Continue' }]
        );
      }

      let localStore;
      try {
        const dbPath = getMintDbPath(activeMintUrl);
        localStore = FfiLocalStore.newWithPath(dbPath);
      } catch (storeError) {
        console.error('FfiLocalStore creation failed:', storeError);
        try {
          localStore = new FfiLocalStore();
        } catch (fallbackError) {
          const fallbackErrorMsg = getErrorMessage(fallbackError);
          setModuleStatus(
            `CDK storage failed: ${getErrorMessage(storeError)}. Fallback failed: ${fallbackErrorMsg}`
          );
          setIsLoadingWallet(false);
          setShowRecoveryLoader(false);
          return;
        }
      }

      if (!localStore) {
        console.error('LocalStore is undefined, cannot recover wallet');
        Alert.alert('Error', 'Failed to initialize wallet storage');
        setIsLoadingWallet(false);
        setShowRecoveryLoader(false);
        return;
      }

      // Use restoreFromMnemonic which calls restore() internally
      const walletInstance = FfiWallet.restoreFromMnemonic(
        activeMintUrl,
        FfiCurrencyUnit.Sat,
        localStore,
        mnemonic
      );

      setWallet(walletInstance);

      try {
        const walletBalance = walletInstance.balance();

        // Update cached balance for this mint
        await updateCachedMintBalance(activeMintUrl, walletBalance.value);

        // Update total balance from cached balances
        await updateTotalBalance();

        setModuleStatus('Wallet recovered successfully!');
      } catch (balanceError) {
        // Update cached balance for this mint (0 for empty wallet)
        await updateCachedMintBalance(activeMintUrl, BigInt(0));

        // Update total balance from cached balances
        await updateTotalBalance();

        setModuleStatus('Wallet recovered successfully!');
      }

      setIsLoadingWallet(false);
      setShowRecoveryLoader(false); // Hide recovery loading indicator

      // Show recovery confetti animation
      setShowRecoveryConfetti(true);

      // Hide confetti after 3 seconds
      setTimeout(() => setShowRecoveryConfetti(false), 3000);
    } catch (error) {
      console.error('Wallet recovery error:', error);
      const errorMsg = getErrorMessage(error);
      setModuleStatus(`Wallet recovery failed: ${errorMsg}`);
      Alert.alert('Recovery Failed', `Failed to recover wallet: ${errorMsg}`);
      setIsLoadingWallet(false);
      setShowRecoveryLoader(false); // Hide recovery loading indicator on error
    }
  };

  return {
    // State
    balance,
    moduleStatus,
    wallet,
    mintUrls,
    activeMintUrl,
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
    showSentConfetti,
    paymentSentAmount,
    showSendingLoader,
    showReceivingLoader,
    generatedMnemonic,
    showMnemonicModal,
    pendingWalletCreation,
    showRecoverModal,
    shouldShowRecoverAfterMint,
    shouldCreateWalletAfterMint,
    showRecoveryLoader,
    showRecoveryConfetti,

    // Actions
    testWalletCreation,
    handleReceive,
    handleSend,
    createInvoice,
    copyToClipboard,
    sendPayment,
    sendCashuToken,
    receiveCashuToken,
    promptForMintUrl,
    handleMintUrlSubmit,
    addMintUrl,
    setActiveMint,
    removeMintUrl,
    clearMintUrlsFromStorage,
    checkWalletExists,
    restoreExistingWallet,
    loadMintUrlsFromStorage,

    // Modal controls
    closeReceiveModal,
    setReceiveAmount,
    setShowSendModal,
    setLightningInvoice,
    handleMintUrlModalClose,
    handleMnemonicModalDone,
    handleRecoverWallet,
    handleWalletRecovery,
    setShowRecoverModal,
    updateTotalBalance,
  };
}
