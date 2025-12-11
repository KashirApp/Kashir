/**
 * Global Wallet Manager Singleton
 *
 * Manages MultiMintWallet instance globally outside of React component state
 * to avoid UI state sharing issues while enabling wallet access across components.
 */
import type { MultiMintWalletInterface } from 'kashir';

export class WalletManager {
  private static instance: WalletManager | null = null;

  // Core wallet data - using MultiMintWallet for all mints
  private multiMintWallet: MultiMintWalletInterface | null = null;
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
  setMultiMintWallet(wallet: MultiMintWalletInterface | null): void {
    this.multiMintWallet = wallet;
    this.notifyListeners();
  }

  getMultiMintWallet(): MultiMintWalletInterface | null {
    return this.multiMintWallet;
  }

  hasWallet(): boolean {
    return this.multiMintWallet !== null;
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

  // Wallet operations are now handled in useWallet hook
  // This maintains single responsibility and leverages MultiMintWallet's native methods

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
    this.multiMintWallet = null;
    this.mintUrls = [];
    this.activeMintUrl = '';
    this.isLoadingWallet = false;
    this.notifyListeners();
  }

  // Get current state snapshot
  getState() {
    return {
      multiMintWallet: this.multiMintWallet,
      mintUrls: [...this.mintUrls],
      activeMintUrl: this.activeMintUrl,
      isLoadingWallet: this.isLoadingWallet,
      hasWallet: this.hasWallet(),
    };
  }
}

// Export singleton instance for convenience
export const walletManager = WalletManager.getInstance();
