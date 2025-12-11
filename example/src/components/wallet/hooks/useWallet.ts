import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MultiMintWallet,
  MintUrl,
  WalletDbBackend,
  createWalletDb,
  CurrencyUnit,
  QuoteState,
  SplitTarget,
  generateMnemonic,
  TransferMode,
  Token,
  SendKind,
  type MultiMintWalletInterface,
} from 'kashir';
import RNFS from 'react-native-fs';
import { getErrorMessage } from '../utils/errorUtils';
import { formatSats } from '../utils/formatUtils';
import { SecureStorageService } from '../../../services/SecureStorageService';
import { walletManager } from '../../../services/WalletManager';

const MINT_URLS_STORAGE_KEY = '@cashu_mint_urls';
const ACTIVE_MINT_URL_STORAGE_KEY = '@cashu_active_mint_url';
const MULTIMINT_WALLET_DB_PATH = `${RNFS.DocumentDirectoryPath}/cdk_multimint_wallet.db`;

export function useWallet() {
  // Get wallet data from WalletManager
  const [managerState, setManagerState] = useState(walletManager.getState());

  // UI-only state (not shared across components)
  const [moduleStatus, setModuleStatus] = useState<string>('Loading...');
  const [isInitializing, setIsInitializing] = useState(true);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [invoice, setInvoice] = useState('');
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
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
  const [shouldShowRecoverAfterMint] = useState(false);
  const [showRecoveryLoader, setShowRecoveryLoader] = useState(false);
  const [showRecoveryConfetti, setShowRecoveryConfetti] = useState(false);

  // Balance state (fetched from MultiMintWallet)
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [totalBalance, setTotalBalance] = useState<bigint>(BigInt(0));

  // Track current mint URL to ensure synchronous updates
  const currentMintUrlRef = useRef<string>('');

  const setCurrentMintUrlRef = useCallback((value: string) => {
    currentMintUrlRef.current = value;
  }, []);

  // Ref for payment checking interval
  const paymentCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Ref to prevent duplicate payment calls
  const isProcessingPayment = useRef(false);

  // Ref to prevent concurrent swaps
  const isSwapping = useRef(false);

  // Ref to track if wallet has been initialized
  const hasInitialized = useRef(false);

  // Subscribe to WalletManager state changes
  useEffect(() => {
    const unsubscribe = walletManager.subscribe(() => {
      setManagerState(walletManager.getState());
    });

    return unsubscribe;
  }, []);

  // Extract values from WalletManager
  const { multiMintWallet, mintUrls, activeMintUrl, isLoadingWallet } =
    managerState;

  // ============================================================================
  // STORAGE HELPERS
  // ============================================================================

  const loadMintUrlsFromStorage = useCallback(async () => {
    try {
      const savedMintUrls = await AsyncStorage.getItem(MINT_URLS_STORAGE_KEY);
      if (savedMintUrls) {
        const parsedUrls = JSON.parse(savedMintUrls);
        walletManager.setMintUrls(parsedUrls);

        // Set the first URL as active if no active URL is set
        if (parsedUrls.length > 0 && !walletManager.getActiveMintUrl()) {
          walletManager.setActiveMintUrl(parsedUrls[0]);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load mint URLs from storage:', error);
      return false;
    }
  }, []);

  const saveActiveMintUrlToStorage = async (url: string) => {
    try {
      await AsyncStorage.setItem(ACTIVE_MINT_URL_STORAGE_KEY, url);
    } catch (error) {
      console.error('Failed to save active mint URL to storage:', error);
    }
  };

  const loadActiveMintUrlFromStorage = useCallback(async () => {
    try {
      const savedActiveMintUrl = await AsyncStorage.getItem(
        ACTIVE_MINT_URL_STORAGE_KEY
      );
      return savedActiveMintUrl;
    } catch (error) {
      console.error('Failed to load active mint URL from storage:', error);
      return null;
    }
  }, []);

  const saveMintUrlsToStorage = async (urls: string[]) => {
    try {
      await AsyncStorage.setItem(MINT_URLS_STORAGE_KEY, JSON.stringify(urls));
    } catch (error) {
      console.error('Failed to save mint URLs to storage:', error);
    }
  };

  const clearMintUrlsFromStorage = async () => {
    try {
      await AsyncStorage.removeItem(MINT_URLS_STORAGE_KEY);
      await AsyncStorage.removeItem(ACTIVE_MINT_URL_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear mint URLs from storage:', error);
    }
  };

  // ============================================================================
  // MINT MANAGEMENT
  // ============================================================================

  const addMintUrl = async (url: string) => {
    try {
      const newUrls = [...mintUrls];
      if (!newUrls.includes(url)) {
        // Add to storage first
        newUrls.push(url);
        walletManager.setMintUrls(newUrls);
        await saveMintUrlsToStorage(newUrls);

        // If wallet exists, add mint to it
        if (multiMintWallet) {
          await multiMintWallet.addMint(MintUrl.new({ url: url }), undefined);

          // Set as active if it's the first one
          if (newUrls.length === 1) {
            await setActiveMint(url);
          }
        } else {
          // If wallet doesn't exist yet, just set as active URL
          if (newUrls.length === 1) {
            walletManager.setActiveMintUrl(url);
            await saveActiveMintUrlToStorage(url);
            setCurrentMintUrlRef(url);
          }
        }

        console.log(`Added mint: ${url}`);
      }
    } catch (error) {
      console.error('Failed to add mint URL:', error);
      throw error;
    }
  };

  const removeMintUrl = async (url: string) => {
    try {
      if (!multiMintWallet) {
        throw new Error('Wallet not initialized');
      }

      // Remove from MultiMintWallet
      await multiMintWallet.removeMint(MintUrl.new({ url: url }));

      // Update storage
      const newUrls = mintUrls.filter((u) => u !== url);
      walletManager.setMintUrls(newUrls);
      await saveMintUrlsToStorage(newUrls);

      // If we removed the active mint, set a new active mint
      if (activeMintUrl === url && newUrls.length > 0) {
        await setActiveMint(newUrls[0]);
      } else if (newUrls.length === 0) {
        walletManager.setActiveMintUrl('');
        await saveActiveMintUrlToStorage('');
      }

      console.log(`Removed mint: ${url}`);
    } catch (error) {
      console.error('Failed to remove mint URL:', error);
      throw error;
    }
  };

  const setActiveMint = async (url: string) => {
    try {
      if (!multiMintWallet) {
        throw new Error('Wallet not initialized');
      }

      // Verify mint exists in wallet
      const hasMint = await multiMintWallet.hasMint(MintUrl.new({ url: url }));
      if (!hasMint) {
        throw new Error(`Mint not found in wallet: ${url}`);
      }

      // Update active mint (just UI state - no wallet reload needed!)
      walletManager.setActiveMintUrl(url);
      await saveActiveMintUrlToStorage(url);
      setCurrentMintUrlRef(url);

      // Update balance for new active mint
      await updateBalance();

      console.log(`Switched to mint: ${url}`);
    } catch (error) {
      console.error('Failed to set active mint:', error);
      throw error;
    }
  };

  // ============================================================================
  // BALANCE OPERATIONS
  // ============================================================================

  const updateBalance = useCallback(async () => {
    try {
      if (!multiMintWallet || !activeMintUrl) {
        setBalance(BigInt(0));
        setTotalBalance(BigInt(0));
        return;
      }

      // Get balances for all mints (returns Map<string, Amount>)
      const balances = await multiMintWallet.getBalances();

      // Get active mint balance from map
      const activeMintBalance = balances.get(activeMintUrl);
      if (activeMintBalance) {
        setBalance(BigInt(activeMintBalance.value));
      } else {
        setBalance(BigInt(0));
      }

      // Get total balance across all mints
      const total = await multiMintWallet.totalBalance();
      setTotalBalance(BigInt(total.value));
    } catch (error) {
      console.error('Failed to update balance:', error);
      setBalance(BigInt(0));
      setTotalBalance(BigInt(0));
    }
  }, [multiMintWallet, activeMintUrl]);

  const updateTotalBalance = async () => {
    await updateBalance();
  };

  // ============================================================================
  // WALLET CREATION & INITIALIZATION
  // ============================================================================

  const createMultiMintWallet = useCallback(
    async (mnemonic: string): Promise<MultiMintWalletInterface> => {
      try {
        // Create shared database for all mints
        const localStore = createWalletDb(
          WalletDbBackend.Sqlite.new({ path: MULTIMINT_WALLET_DB_PATH })
        );

        // Create MultiMintWallet
        const wallet = new MultiMintWallet(
          CurrencyUnit.Sat.new(),
          mnemonic,
          localStore
        );

        console.log('Created MultiMintWallet with shared database');
        return wallet;
      } catch (error) {
        console.error('Failed to create MultiMintWallet:', error);
        throw error;
      }
    },
    []
  );

  const checkWalletExists = async (): Promise<boolean> => {
    try {
      // Check if shared wallet database exists
      const dbExists = await RNFS.exists(MULTIMINT_WALLET_DB_PATH);
      return dbExists;
    } catch (error) {
      console.error('Failed to check wallet existence:', error);
      return false;
    }
  };

  const restoreExistingWallet = useCallback(async (): Promise<boolean> => {
    try {
      walletManager.setLoadingWallet(true);

      const mnemonic = await SecureStorageService.getSeedPhrase();
      if (!mnemonic) {
        console.log('No seed phrase found');
        walletManager.setLoadingWallet(false);
        return false;
      }

      // Create/restore MultiMintWallet
      const wallet = await createMultiMintWallet(mnemonic);
      walletManager.setMultiMintWallet(wallet);

      // Load saved mint URLs
      await loadMintUrlsFromStorage();
      const savedActiveMintUrl = await loadActiveMintUrlFromStorage();

      // Add all saved mints to the wallet (use fresh value from manager)
      const currentMintUrls = walletManager.getMintUrls();
      for (const mintUrl of currentMintUrls) {
        const hasMint = await wallet.hasMint(MintUrl.new({ url: mintUrl }));
        if (!hasMint) {
          await wallet.addMint(MintUrl.new({ url: mintUrl }), undefined);
        }
      }

      // Set active mint
      if (savedActiveMintUrl && currentMintUrls.includes(savedActiveMintUrl)) {
        walletManager.setActiveMintUrl(savedActiveMintUrl);
        setCurrentMintUrlRef(savedActiveMintUrl);
      } else if (currentMintUrls.length > 0) {
        walletManager.setActiveMintUrl(currentMintUrls[0]);
        setCurrentMintUrlRef(currentMintUrls[0]);
      }

      // Update balance
      await updateBalance();

      walletManager.setLoadingWallet(false);
      console.log('Wallet restored successfully');
      return true;
    } catch (error) {
      console.error('Failed to restore wallet:', error);
      walletManager.setLoadingWallet(false);
      return false;
    }
  }, [
    createMultiMintWallet,
    loadMintUrlsFromStorage,
    loadActiveMintUrlFromStorage,
    setCurrentMintUrlRef,
    updateBalance,
  ]);

  const testWalletCreation = async () => {
    try {
      walletManager.setLoadingWallet(true);

      // Check if wallet already exists
      const walletExists = await checkWalletExists();
      if (walletExists) {
        const restored = await restoreExistingWallet();
        if (restored) {
          console.log('Existing wallet restored');
          return;
        }
      }

      // Get current mint URLs (might have been just added)
      const currentMintUrls = walletManager.getMintUrls();

      // Load existing mints or prompt for first mint
      const hasMintsLoaded = await loadMintUrlsFromStorage();
      if (!hasMintsLoaded && currentMintUrls.length === 0) {
        console.log('No mints found, prompting for mint URL');
        setShouldCreateWalletAfterMint(true);
        promptForMintUrl();
        walletManager.setLoadingWallet(false);
        return;
      }

      // Use the mints we have (either loaded from storage or just added)
      const mintsToUse =
        currentMintUrls.length > 0 ? currentMintUrls : mintUrls;

      if (mintsToUse.length === 0) {
        console.log('No mints available, prompting for mint URL');
        setShouldCreateWalletAfterMint(true);
        promptForMintUrl();
        walletManager.setLoadingWallet(false);
        return;
      }

      // Check if we have a seed phrase
      const existingSeed = await SecureStorageService.getSeedPhrase();
      if (existingSeed) {
        const restored = await restoreExistingWallet();
        if (restored) {
          console.log('Wallet restored from existing seed');
          return;
        }
      }

      // No existing wallet, create new one
      const newMnemonic = generateMnemonic();
      console.log(
        'Generated mnemonic:',
        newMnemonic ? 'exists' : 'is null/undefined'
      );
      console.log('Mnemonic type:', typeof newMnemonic);
      setGeneratedMnemonic(newMnemonic);
      setPendingWalletCreation({ mnemonic: newMnemonic, mintUrls: mintsToUse });
      setShowMnemonicModal(true);
      walletManager.setLoadingWallet(false);
    } catch (error) {
      console.error('Wallet creation failed:', error);
      Alert.alert(
        'Error',
        `Failed to create wallet: ${getErrorMessage(error)}`
      );
      walletManager.setLoadingWallet(false);
    }
  };

  const handleMnemonicModalDone = async () => {
    try {
      setShowMnemonicModal(false);

      if (!pendingWalletCreation) {
        console.error('No pending wallet creation found');
        return;
      }

      const { mnemonic, mintUrls: pendingMintUrls } = pendingWalletCreation;
      console.log(
        'Mnemonic from pending:',
        mnemonic ? 'exists' : 'is null/undefined'
      );
      console.log('Mnemonic type:', typeof mnemonic);
      console.log('Mnemonic length:', mnemonic?.length);
      console.log('Pending mint URLs:', pendingMintUrls);

      if (!mnemonic || typeof mnemonic !== 'string') {
        throw new Error('Invalid mnemonic: must be a non-empty string');
      }

      // Store seed phrase securely
      await SecureStorageService.storeSeedPhrase(mnemonic);

      // Create MultiMintWallet
      console.log('Creating MultiMintWallet...');
      const wallet = await createMultiMintWallet(mnemonic);
      console.log('MultiMintWallet created successfully');
      walletManager.setMultiMintWallet(wallet);

      // Add all mints from pending creation
      for (const mintUrl of pendingMintUrls) {
        await wallet.addMint(MintUrl.new({ url: mintUrl }), undefined);
      }

      // Set first mint as active
      if (pendingMintUrls.length > 0) {
        walletManager.setActiveMintUrl(pendingMintUrls[0]);
        setCurrentMintUrlRef(pendingMintUrls[0]);
      }

      // Update balance
      await updateBalance();

      setPendingWalletCreation(null);

      // Mark initialization as complete
      setIsInitializing(false);
      walletManager.setLoadingWallet(false);

      console.log('Wallet created successfully');
    } catch (error) {
      console.error('Failed to complete wallet creation:', error);
      Alert.alert(
        'Error',
        `Failed to create wallet: ${getErrorMessage(error)}`
      );
      setIsInitializing(false);
      walletManager.setLoadingWallet(false);
    }
  };

  // ============================================================================
  // PAYMENT OPERATIONS - RECEIVE (MINT)
  // ============================================================================

  const handleReceive = () => {
    if (!multiMintWallet) {
      Alert.alert('Error', 'Wallet not initialized');
      return;
    }
    if (!activeMintUrl) {
      Alert.alert('Error', 'No active mint selected');
      return;
    }
    setShowReceiveModal(true);
  };

  const closeReceiveModal = () => {
    setShowReceiveModal(false);
    setReceiveAmount('');
    setInvoice('');
    if (paymentCheckInterval.current) {
      clearInterval(paymentCheckInterval.current);
      paymentCheckInterval.current = null;
    }
  };

  const createInvoice = async () => {
    try {
      if (!multiMintWallet || !activeMintUrl) {
        throw new Error('Wallet not initialized or no active mint');
      }

      setIsLoadingInvoice(true);

      const amount = BigInt(receiveAmount);
      if (amount <= BigInt(0)) {
        throw new Error('Amount must be greater than 0');
      }

      // Create mint quote
      const quote = await multiMintWallet.mintQuote(
        MintUrl.new({ url: activeMintUrl }),
        { value: amount },
        'Lightning invoice'
      );

      setInvoice(quote.request);
      setIsLoadingInvoice(false);

      // Start checking for payment
      startPaymentCheck(quote.id);
    } catch (error) {
      console.error('Failed to create invoice:', error);
      Alert.alert(
        'Error',
        `Failed to create invoice: ${getErrorMessage(error)}`
      );
      setIsLoadingInvoice(false);
    }
  };

  const startPaymentCheck = (mintQuoteId: string) => {
    // Clear any existing interval
    if (paymentCheckInterval.current) {
      clearInterval(paymentCheckInterval.current);
    }

    // Check payment status every 3 seconds
    paymentCheckInterval.current = setInterval(async () => {
      if (!multiMintWallet || !activeMintUrl) {
        return;
      }

      if (isProcessingPayment.current) {
        return;
      }

      try {
        isProcessingPayment.current = true;

        // Check quote status
        const quote = await multiMintWallet.checkMintQuote(
          MintUrl.new({ url: activeMintUrl }),
          mintQuoteId
        );

        if (quote.state === QuoteState.Paid) {
          // Quote is paid, execute mint
          setShowReceivingLoader(true);

          await multiMintWallet.mint(
            MintUrl.new({ url: activeMintUrl }),
            mintQuoteId,
            undefined // spending conditions
          );

          // Stop checking
          if (paymentCheckInterval.current) {
            clearInterval(paymentCheckInterval.current);
            paymentCheckInterval.current = null;
          }

          // Update balance
          await updateBalance();

          // Show success
          setPaymentReceivedAmount(BigInt(receiveAmount));
          setShowReceivingLoader(false);
          setShowConfetti(true);
          closeReceiveModal();

          setTimeout(() => {
            setShowConfetti(false);
            setPaymentReceivedAmount(BigInt(0));
          }, 3000);
        }
      } catch (error) {
        console.error('Error checking payment:', error);
      } finally {
        isProcessingPayment.current = false;
      }
    }, 3000);
  };

  // ============================================================================
  // PAYMENT OPERATIONS - SEND (MELT)
  // ============================================================================

  const handleSend = () => {
    if (!multiMintWallet) {
      Alert.alert('Error', 'Wallet not initialized');
      return;
    }
    if (!activeMintUrl) {
      Alert.alert('Error', 'No active mint selected');
      return;
    }
    if (balance <= BigInt(0)) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }
    setShowSendModal(true);
  };

  const sendPayment = async () => {
    try {
      if (!multiMintWallet || !activeMintUrl) {
        throw new Error('Wallet not initialized or no active mint');
      }

      if (!lightningInvoice) {
        throw new Error('Please enter a Lightning invoice');
      }

      if (!lightningInvoice.toLowerCase().startsWith('lnbc')) {
        throw new Error('Invalid Lightning invoice format');
      }

      setIsSending(true);
      setShowSendingLoader(true);

      // Get melt quote
      const meltQuote = await multiMintWallet.meltQuote(
        MintUrl.new({ url: activeMintUrl }),
        lightningInvoice,
        undefined // options
      );

      const totalAmount =
        BigInt(meltQuote.amount.value) + BigInt(meltQuote.feeReserve.value);

      // Check balance
      if (balance < totalAmount) {
        throw new Error(
          `Insufficient balance. Need ${totalAmount} sats but only have ${balance} sats`
        );
      }

      // Stop the loading indicator before showing confirmation
      setShowSendingLoader(false);
      setIsSending(false);

      // Show confirmation dialog with amount and fees
      Alert.alert(
        'Confirm Payment',
        `Amount: ${formatSats(BigInt(meltQuote.amount.value))}\nFees: ${formatSats(BigInt(meltQuote.feeReserve.value))}\nTotal: ${formatSats(totalAmount)}\n\nSend this payment?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              setIsSending(false);
              setShowSendingLoader(false);
            },
          },
          {
            text: 'Send',
            onPress: async () => {
              try {
                setIsSending(true);
                setShowSendingLoader(true);

                // Execute payment using meltWithMint
                await multiMintWallet.meltWithMint(
                  MintUrl.new({ url: activeMintUrl }),
                  meltQuote.id
                );

                // Update balance
                await updateBalance();

                // Show success
                setPaymentSentAmount(BigInt(meltQuote.amount.value));
                setShowSendingLoader(false);
                setShowSentConfetti(true);
                setShowSendModal(false);
                setLightningInvoice('');
                setIsSending(false);

                setTimeout(() => {
                  setShowSentConfetti(false);
                  setPaymentSentAmount(BigInt(0));
                }, 3000);
              } catch (error) {
                console.error('Payment failed:', error);
                Alert.alert(
                  'Error',
                  `Payment failed: ${getErrorMessage(error)}`
                );
                setIsSending(false);
                setShowSendingLoader(false);
              }
            },
          },
        ]
      );
      return; // Exit the try block after showing dialog
    } catch (error) {
      console.error('Payment failed:', error);
      Alert.alert('Error', `Payment failed: ${getErrorMessage(error)}`);
      setIsSending(false);
      setShowSendingLoader(false);
    }
  };

  // ============================================================================
  // CASHU TOKEN OPERATIONS
  // ============================================================================

  const sendCashuToken = async (amount: bigint) => {
    try {
      if (!multiMintWallet || !activeMintUrl) {
        throw new Error('Wallet not initialized or no active mint');
      }

      if (amount <= BigInt(0)) {
        throw new Error('Amount must be greater than 0');
      }

      if (balance < amount) {
        throw new Error('Insufficient balance');
      }

      // Prepare send (generates token)
      const prepared = await multiMintWallet.prepareSend(
        MintUrl.new({ url: activeMintUrl }),
        { value: amount },
        {
          allowTransfer: false,
          maxTransferAmount: undefined,
          allowedMints: [],
          excludedMints: [],
          sendOptions: {
            memo: undefined,
            conditions: undefined,
            amountSplitTarget: SplitTarget.None.new(),
            sendKind: SendKind.OnlineExact.new(),
            includeFee: false,
            maxProofs: undefined,
            metadata: new Map(),
          },
        }
      );

      console.log('prepareSend result:', prepared);

      if (!prepared) {
        throw new Error(
          'Failed to prepare token: prepareSend returned invalid result'
        );
      }

      // Confirm the prepared send to create the token
      const token = await prepared.confirm(undefined);

      // Update balance
      await updateBalance();

      // Return token string in expected format
      return { tokenString: token.encode() };
    } catch (error) {
      console.error('Failed to create Cashu token:', error);
      console.error('Error details:', error?.message || error);
      throw error;
    }
  };

  const receiveCashuToken = async (tokenString: string) => {
    try {
      if (!multiMintWallet) {
        throw new Error('Wallet not initialized');
      }

      // Parse the token string into a Token object
      const token = Token.fromString(tokenString);

      // Create receive options with defaults
      const receiveOptions = {
        amountSplitTarget: SplitTarget.None.new(),
        p2pkSigningKeys: [],
        preimages: [],
        metadata: new Map(), // Use Map for FFI HashMap conversion
      };

      // Create multi-mint receive options
      const multiMintReceiveOptions = {
        allowUntrusted: true, // Allow receiving from mints not yet in our wallet
        // transferToMint intentionally omitted - will be treated as None in Rust
        receiveOptions: receiveOptions,
      };

      // Receive token
      const receivedAmount = await multiMintWallet.receive(
        token,
        multiMintReceiveOptions
      );

      // Get the mint URL from the token and ensure it's in our mint URLs list
      const tokenMintUrl = token.mintUrl().url;
      if (!mintUrls.includes(tokenMintUrl)) {
        const updatedMintUrls = [...mintUrls, tokenMintUrl];
        walletManager.setMintUrls(updatedMintUrls);
        await saveMintUrlsToStorage(updatedMintUrls);

        // If this is the first mint, set it as active
        if (mintUrls.length === 0) {
          walletManager.setActiveMintUrl(tokenMintUrl);
          setCurrentMintUrlRef(tokenMintUrl);
          await saveActiveMintUrlToStorage(tokenMintUrl);
        }
      }

      // Update balance
      await updateBalance();

      Alert.alert('Success', `Received ${receivedAmount.value} sats`);
      return receivedAmount.value;
    } catch (error) {
      console.error('Failed to receive Cashu token:', error);
      const errorMsg = getErrorMessage(error);
      Alert.alert('Error', `Failed to receive token: ${errorMsg}`);
      throw error;
    }
  };

  // ============================================================================
  // CROSS-MINT OPERATIONS (SWAP)
  // ============================================================================

  const handleSwapBetweenMints = async (
    fromMintUrl: string,
    toMintUrl: string,
    amount: bigint
  ) => {
    if (isSwapping.current) {
      Alert.alert('Info', 'A swap is already in progress');
      return;
    }

    try {
      if (!multiMintWallet) {
        throw new Error('Wallet not initialized');
      }

      if (amount <= BigInt(0)) {
        throw new Error('Amount must be greater than 0');
      }

      isSwapping.current = true;
      setShowSendingLoader(true);

      // Use native transfer method!
      const result = await multiMintWallet.transfer(
        MintUrl.new({ url: fromMintUrl }),
        MintUrl.new({ url: toMintUrl }),
        TransferMode.ExactReceive.new({ amount: { value: amount } })
      );

      // Update balance
      await updateBalance();

      setShowSendingLoader(false);
      isSwapping.current = false;

      Alert.alert(
        'Swap Complete',
        `Sent: ${result.amountSent.value} sats\nReceived: ${result.amountReceived.value} sats\nFees: ${result.feesPaid.value} sats`
      );
    } catch (error) {
      console.error('Swap failed:', error);
      Alert.alert('Error', `Swap failed: ${getErrorMessage(error)}`);
      setShowSendingLoader(false);
      isSwapping.current = false;
    }
  };

  // ============================================================================
  // WALLET RECOVERY
  // ============================================================================

  const handleRecoverWallet = () => {
    setShowRecoverModal(true);
  };

  const handleWalletRecovery = async (recoveryMnemonic: string) => {
    try {
      if (!recoveryMnemonic || recoveryMnemonic.trim().length === 0) {
        throw new Error('Please enter a recovery phrase');
      }

      setShowRecoveryLoader(true);

      // Store the seed phrase
      await SecureStorageService.storeSeedPhrase(recoveryMnemonic);

      // Create MultiMintWallet with recovery phrase
      const wallet = await createMultiMintWallet(recoveryMnemonic);
      walletManager.setMultiMintWallet(wallet);

      // Load saved mints
      await loadMintUrlsFromStorage();

      // Add all mints and restore
      for (const mintUrl of mintUrls) {
        await wallet.addMint(MintUrl.new({ url: mintUrl }), undefined);

        // Restore funds from this mint
        await wallet.restore(MintUrl.new({ url: mintUrl }));
      }

      // Set active mint
      if (mintUrls.length > 0) {
        walletManager.setActiveMintUrl(mintUrls[0]);
        setCurrentMintUrlRef(mintUrls[0]);
      }

      // Update balance
      await updateBalance();

      setShowRecoveryLoader(false);
      setShowRecoverModal(false);
      setShowRecoveryConfetti(true);

      setTimeout(() => {
        setShowRecoveryConfetti(false);
      }, 3000);

      Alert.alert('Success', 'Wallet recovered successfully');
    } catch (error) {
      console.error('Recovery failed:', error);
      Alert.alert('Error', `Recovery failed: ${getErrorMessage(error)}`);
      setShowRecoveryLoader(false);
    }
  };

  // ============================================================================
  // MINT URL MANAGEMENT UI
  // ============================================================================

  const promptForMintUrl = () => {
    setShowMintUrlModal(true);
  };

  const handleMintUrlSubmit = async (url: string) => {
    try {
      if (!url || url.trim().length === 0) {
        throw new Error('Please enter a mint URL');
      }

      // Validate URL format
      let isValidUrl = false;
      try {
        const parsedUrl = new URL(url);
        isValidUrl =
          parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
      } catch {
        isValidUrl = false;
      }

      if (!isValidUrl) {
        throw new Error('Invalid URL format');
      }

      await addMintUrl(url);

      setShowMintUrlModal(false);

      // If this was triggered by wallet creation, create the wallet now
      if (shouldCreateWalletAfterMint) {
        setShouldCreateWalletAfterMint(false);
        await testWalletCreation();
      }
    } catch (error) {
      console.error('Failed to add mint URL:', error);
      Alert.alert('Error', `Failed to add mint: ${getErrorMessage(error)}`);
    }
  };

  const handleMintUrlModalClose = () => {
    setShowMintUrlModal(false);
    setShouldCreateWalletAfterMint(false);
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'Copied to clipboard');
  };

  // ============================================================================
  // MODULE INITIALIZATION
  // ============================================================================

  useEffect(() => {
    const initializeWallet = async () => {
      // Prevent re-initialization
      if (hasInitialized.current) {
        return;
      }
      hasInitialized.current = true;

      try {
        setIsInitializing(true);

        // Check if we have an existing wallet
        const walletExists = await checkWalletExists();
        if (walletExists) {
          await restoreExistingWallet();
        }

        setModuleStatus('Wallet Ready');
        setIsInitializing(false);
      } catch (error) {
        console.error('Failed to initialize wallet:', error);
        setModuleStatus('Initialization Failed');
        setIsInitializing(false);
      }
    };

    initializeWallet();
    // Only run once on mount, not when restoreExistingWallet changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update balance when active mint changes
  useEffect(() => {
    if (multiMintWallet && activeMintUrl) {
      updateBalance();
    }
  }, [multiMintWallet, activeMintUrl, updateBalance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (paymentCheckInterval.current) {
        clearInterval(paymentCheckInterval.current);
      }
    };
  }, []);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // Wallet state
    balance,
    totalBalance,
    moduleStatus,
    multiMintWallet,
    wallet: multiMintWallet, // Alias for backwards compatibility
    mintUrls,
    activeMintUrl,
    isLoadingWallet,
    isInitializing,

    // UI state
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

    // Wallet actions
    testWalletCreation,
    restoreExistingWallet,
    checkWalletExists,
    loadMintUrlsFromStorage,

    // Mint management
    addMintUrl,
    setActiveMint,
    removeMintUrl,
    clearMintUrlsFromStorage,

    // Payment actions
    handleReceive,
    handleSend,
    createInvoice,
    sendPayment,
    sendCashuToken,
    receiveCashuToken,

    // Cross-mint operations
    handleSwapBetweenMints,

    // Recovery
    handleRecoverWallet,
    handleWalletRecovery,

    // Balance
    updateTotalBalance,

    // UI controls
    closeReceiveModal,
    setReceiveAmount,
    setShowSendModal,
    setLightningInvoice,
    promptForMintUrl,
    handleMintUrlSubmit,
    handleMintUrlModalClose,
    handleMnemonicModalDone,
    setShowRecoverModal,
    copyToClipboard,
  };
}
