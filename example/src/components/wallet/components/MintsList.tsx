import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MintItem } from './MintItem';
import type { MultiMintWalletInterface } from 'kashir';

interface MintsListProps {
  mintUrls: string[];
  activeMintUrl: string;
  multiMintWallet: MultiMintWalletInterface | null;
  onSetActive: (url: string) => void;
  onRemove: (url: string) => void;
  onAddMint: () => void;
  onUpdateTotalBalance?: () => Promise<void>;
  onSwap?: () => void;
  onReview?: (url: string) => void;
}

export function MintsList({
  mintUrls,
  activeMintUrl,
  multiMintWallet,
  onSetActive,
  onRemove,
  onAddMint,
  onUpdateTotalBalance,
  onSwap,
  onReview,
}: MintsListProps) {
  const [mintBalances, setMintBalances] = useState<Map<string, bigint>>(
    new Map()
  );

  // Memoize the mint URLs to prevent unnecessary re-renders
  const memoizedMintUrls = useMemo(() => mintUrls, [mintUrls]);

  // Load balances from MultiMintWallet when component mounts or wallet/mintUrls change
  useEffect(() => {
    const loadBalances = async () => {
      if (!multiMintWallet || memoizedMintUrls.length === 0) {
        setMintBalances(new Map());
        return;
      }

      try {
        // Get balances from MultiMintWallet (returns Map<string, Amount>)
        const balances = await multiMintWallet.getBalances();

        // Convert to Map<string, bigint> for easier use
        const balanceMap = new Map<string, bigint>();
        balances.forEach((amount, mintUrl) => {
          balanceMap.set(mintUrl, BigInt(amount.value));
        });

        setMintBalances(balanceMap);
      } catch (error) {
        console.error('Failed to load mint balances:', error);
        setMintBalances(new Map());
      }
    };

    loadBalances();
  }, [multiMintWallet, memoizedMintUrls]);

  // Helper function to get balance for a specific mint
  const getMintBalance = (mintUrl: string): bigint | undefined => {
    return mintBalances.get(mintUrl);
  };

  // Handle refresh for individual mint
  const handleMintRefresh = async (_mintUrl: string) => {
    try {
      if (!multiMintWallet) {
        return;
      }

      // Refresh balances from wallet
      const balances = await multiMintWallet.getBalances();
      const balanceMap = new Map<string, bigint>();
      balances.forEach((amount, url) => {
        balanceMap.set(url, BigInt(amount.value));
      });
      setMintBalances(balanceMap);

      // Update total balance on main wallet screen
      if (onUpdateTotalBalance) {
        await onUpdateTotalBalance();
      }
    } catch (error) {
      console.error('Failed to refresh mint balance:', error);
    }
  };

  if (mintUrls.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No mints connected</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        Connected Mints ({mintUrls.length})
      </Text>

      <ScrollView showsVerticalScrollIndicator={false}>
        {memoizedMintUrls.map((mintUrl, index) => {
          const mintBalance = getMintBalance(mintUrl);
          return (
            <MintItem
              key={`${mintUrl}-${index}`}
              mintUrl={mintUrl}
              isActive={mintUrl === activeMintUrl}
              balance={mintBalance}
              onSetActive={onSetActive}
              onRemove={onRemove}
              onRefresh={handleMintRefresh}
              onReview={onReview}
            />
          );
        })}

        {/* Show swap button if there are at least 2 mints */}
        {mintUrls.length >= 2 && onSwap && (
          <TouchableOpacity onPress={onSwap} style={styles.swapButton}>
            <Text style={styles.swapButtonText}>⇄ Swap Between Mints</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={onAddMint} style={styles.addMintButton}>
          <Text style={styles.addMintButtonText}>+ Add Another Mint</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Removed flex: 1 to prevent expansion and overlap issues
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 16,
  },
  addMintButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  addMintButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  swapButton: {
    backgroundColor: '#ff9500',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  swapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
