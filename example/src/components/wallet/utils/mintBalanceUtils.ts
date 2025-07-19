import { FfiLocalStore, FfiWallet, FfiCurrencyUnit } from 'kashir';
import { SecureStorageService } from '../../../services/SecureStorageService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

export interface MintBalance {
  mintUrl: string;
  balance: bigint;
}

let updateCallback: ((balances: MintBalance[]) => void) | null = null;

// Cache wallet instances to avoid recreating them
const walletCache = new Map<string, any>();

// Storage key for cached balances
const CACHED_BALANCES_KEY = '@cashu_cached_balances';

// Generate database file path for a specific mint
export function getMintDbPath(mintUrl: string): string {
  // Convert mint URL to safe filename
  const safeFilename = mintUrl
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `${RNFS.DocumentDirectoryPath}/cdk_wallet_${safeFilename}.db`;
}

export function setBalanceUpdateCallback(
  callback: (balances: MintBalance[]) => void
) {
  updateCallback = callback;
}

// Save cached balances to AsyncStorage
export async function saveCachedBalances(
  balances: MintBalance[]
): Promise<void> {
  try {
    const serializedBalances = balances.map((b) => ({
      mintUrl: b.mintUrl,
      balance: b.balance.toString(),
    }));
    await AsyncStorage.setItem(
      CACHED_BALANCES_KEY,
      JSON.stringify(serializedBalances)
    );
  } catch (error) {
    console.error('Failed to save cached balances:', error);
  }
}

// Load cached balances from AsyncStorage
export async function loadCachedBalances(): Promise<MintBalance[]> {
  try {
    const cached = await AsyncStorage.getItem(CACHED_BALANCES_KEY);
    if (!cached) {
      return [];
    }
    const serializedBalances = JSON.parse(cached);
    return serializedBalances.map((b: any) => ({
      mintUrl: b.mintUrl,
      balance: BigInt(b.balance),
    }));
  } catch (error) {
    console.error('Failed to load cached balances:', error);
    return [];
  }
}

// Get cached balance for a specific mint
export async function getCachedMintBalance(
  mintUrl: string
): Promise<MintBalance> {
  try {
    const cachedBalances = await loadCachedBalances();
    const found = cachedBalances.find((b) => b.mintUrl === mintUrl);
    return found || { mintUrl, balance: BigInt(0) };
  } catch (error) {
    console.error('Failed to get cached balance:', error);
    return { mintUrl, balance: BigInt(0) };
  }
}

// Update cached balance for a specific mint
export async function updateCachedMintBalance(
  mintUrl: string,
  newBalance: bigint
): Promise<void> {
  try {
    const cachedBalances = await loadCachedBalances();
    const index = cachedBalances.findIndex((b) => b.mintUrl === mintUrl);

    if (index >= 0 && cachedBalances[index]) {
      cachedBalances[index].balance = newBalance;
    } else {
      cachedBalances.push({ mintUrl, balance: newBalance });
    }

    await saveCachedBalances(cachedBalances);

    // Notify UI of the update
    if (updateCallback) {
      updateCallback([{ mintUrl, balance: newBalance }]);
    }
  } catch (error) {
    console.error('Failed to update cached balance:', error);
  }
}

// Get mint balance using cached wallet instance
export async function getMintBalance(mintUrl: string): Promise<MintBalance> {
  try {
    // Get wallet (uses cached wallet instance)
    const wallet = await getWalletForMint(mintUrl);
    if (!wallet) {
      return { mintUrl, balance: BigInt(0) };
    }

    const balance = wallet.balance();
    const mintBalance = { mintUrl, balance: balance.value };

    // Update cache with balance
    await updateCachedMintBalance(mintUrl, balance.value);

    return mintBalance;
  } catch (error) {
    console.error('Failed to get mint balance:', error);
    return { mintUrl, balance: BigInt(0) };
  }
}

// Sync balance directly with wallet (network call) - bypasses cache for fresh data
export async function syncMintBalance(mintUrl: string): Promise<MintBalance> {
  try {
    // Create fresh wallet instance to get up-to-date balance
    const wallet = await getWalletForMint(mintUrl, false);
    if (!wallet) {
      return { mintUrl, balance: BigInt(0) };
    }

    // The balance() method should handle syncing internally
    // or the wallet is already synced when created with restoreFromMnemonic()
    const balance = wallet.balance();
    const mintBalance = { mintUrl, balance: balance.value };

    // Update cache with synced balance
    await updateCachedMintBalance(mintUrl, balance.value);

    return mintBalance;
  } catch (error) {
    console.error('Failed to sync mint balance:', error);
    return { mintUrl, balance: BigInt(0) };
  }
}

// Get or create wallet instance for a specific mint
async function getWalletForMint(
  mintUrl: string,
  useCachedWallet = true
): Promise<any | null> {
  try {
    // Return cached wallet if available and requested
    if (useCachedWallet && walletCache.has(mintUrl)) {
      return walletCache.get(mintUrl);
    }

    const mnemonic = await SecureStorageService.getSeedPhrase();
    if (!mnemonic) {
      return null;
    }

    const dbPath = getMintDbPath(mintUrl);
    const localStore = FfiLocalStore.newWithPath(dbPath);

    const wallet = FfiWallet.restoreFromMnemonic(
      mintUrl,
      FfiCurrencyUnit.Sat,
      localStore,
      mnemonic
    );

    // Cache the wallet instance
    walletCache.set(mintUrl, wallet);
    return wallet;
  } catch (error) {
    console.error(`Failed to get wallet for mint ${mintUrl}:`, error);
    return null;
  }
}

// Clear wallet cache (useful for cleanup)
export function clearWalletCache() {
  walletCache.clear();
}
