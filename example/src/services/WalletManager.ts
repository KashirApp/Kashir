/**
 * Global Wallet Manager Singleton
 *
 * Manages wallet instance globally outside of React component state
 * to avoid UI state sharing issues while enabling wallet access across components.
 */
import { updateCachedMintBalance } from '../components/wallet/utils/mintBalanceUtils';

export class WalletManager {
  private static instance: WalletManager | null = null;

  // Core wallet data
  private wallet: any = null;
  private balance: bigint = BigInt(0);
  private mintUrls: string[] = [];
  private activeMintUrl: string = '';
  private isLoadingWallet: boolean = false;

  // Event listeners for state changes
  private listeners: Set<() => void> = new Set();

  private constructor() {
    // Private constructor for singleton pattern
  }

  static getInstance(): WalletManager {
    if (!WalletManager.instance) {
      WalletManager.instance = new WalletManager();
    }
    return WalletManager.instance;
  }

  // Wallet instance management
  setWallet(wallet: any): void {
    this.wallet = wallet;
    this.notifyListeners();
  }

  getWallet(): any {
    return this.wallet;
  }

  hasWallet(): boolean {
    return this.wallet !== null;
  }

  // Balance management
  setBalance(balance: bigint): void {
    this.balance = balance;
    this.notifyListeners();
  }

  getBalance(): bigint {
    return this.balance;
  }

  // Mint URL management
  setMintUrls(mintUrls: string[]): void {
    this.mintUrls = [...mintUrls];
    this.notifyListeners();
  }

  getMintUrls(): string[] {
    return [...this.mintUrls];
  }

  setActiveMintUrl(url: string): void {
    this.activeMintUrl = url;
    this.notifyListeners();
  }

  getActiveMintUrl(): string {
    return this.activeMintUrl;
  }

  // Loading state
  setLoadingWallet(loading: boolean): void {
    this.isLoadingWallet = loading;
    this.notifyListeners();
  }

  isWalletLoading(): boolean {
    return this.isLoadingWallet;
  }

  // Wallet operations
  async sendPayment(invoice: string): Promise<void> {
    if (!this.wallet) {
      throw new Error('Wallet not available. Please create a wallet first.');
    }

    // Check balance first
    if (this.balance <= BigInt(0)) {
      throw new Error(
        'Insufficient balance. Please add funds to your wallet first.'
      );
    }

    // Validate Lightning invoice format
    if (!invoice.toLowerCase().startsWith('lnbc')) {
      throw new Error(
        'Please enter a valid Lightning invoice (should start with lnbc)'
      );
    }

    // Check if wallet supports Lightning payments
    if (typeof this.wallet.meltQuote !== 'function') {
      throw new Error(
        'Lightning payments are not supported by this wallet version'
      );
    }

    try {
      // Get melt quote (payment preparation)
      const meltQuote = await this.wallet.meltQuote(invoice);

      const prepareResult = {
        amount: meltQuote.amount,
        totalFee: meltQuote.feeReserve || { value: BigInt(0) },
      };

      const totalAmount =
        prepareResult.amount.value + prepareResult.totalFee.value;

      // Check if we have enough balance
      const currentBalance = this.wallet.balance();
      if (currentBalance.value < totalAmount) {
        throw new Error(
          `Insufficient balance. Need ${totalAmount} sats but only have ${currentBalance.value} sats`
        );
      }

      // Execute the payment
      await this.wallet.melt(meltQuote.id);

      // Update balance after successful payment
      const newBalance = currentBalance.value - totalAmount;
      this.setBalance(BigInt(newBalance));

      // Also update the cached mint balance to sync with settings screen
      if (this.activeMintUrl) {
        await updateCachedMintBalance(this.activeMintUrl, BigInt(newBalance));
      }
    } catch (error) {
      console.error('Lightning payment failed:', error);
      throw error;
    }
  }

  // State subscription for React components
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  // Utility methods
  reset(): void {
    this.wallet = null;
    this.balance = BigInt(0);
    this.mintUrls = [];
    this.activeMintUrl = '';
    this.isLoadingWallet = false;
    this.notifyListeners();
  }

  // Get current state snapshot
  getState() {
    return {
      wallet: this.wallet,
      balance: this.balance,
      mintUrls: [...this.mintUrls],
      activeMintUrl: this.activeMintUrl,
      isLoadingWallet: this.isLoadingWallet,
      hasWallet: this.hasWallet(),
    };
  }
}

// Export singleton instance for convenience
export const walletManager = WalletManager.getInstance();
