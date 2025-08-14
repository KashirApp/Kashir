import React, { createContext, useContext, type ReactNode } from 'react';
import { useWallet } from './hooks/useWallet';

// Create the wallet context with the full wallet interface
const WalletContext = createContext<ReturnType<typeof useWallet> | null>(null);

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const walletState = useWallet();

  return (
    <WalletContext.Provider value={walletState}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider');
  }
  return context;
}
