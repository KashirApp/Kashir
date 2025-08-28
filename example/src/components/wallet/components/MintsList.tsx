import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MintItem } from './MintItem';
import {
  setBalanceUpdateCallback,
  loadCachedBalances,
  syncMintBalance,
} from '../utils/mintBalanceUtils';
import type { MintBalance } from '../utils/mintBalanceUtils';

interface MintsListProps {
  mintUrls: string[];
  activeMintUrl: string;
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
  onSetActive,
  onRemove,
  onAddMint,
  onUpdateTotalBalance,
  onSwap,
  onReview,
}: MintsListProps) {
  const [mintBalances, setMintBalances] = useState<MintBalance[]>([]);

  // Memoize the mint URLs to prevent unnecessary re-renders
  const memoizedMintUrls = useMemo(() => mintUrls, [mintUrls]);

  // Load cached balances when component mounts or mintUrls change
  useEffect(() => {
    const loadBalances = async () => {
      if (memoizedMintUrls.length === 0) {
        setMintBalances([]);
        return;
      }

      try {
        // Load all cached balances
        const cachedBalances = await loadCachedBalances();

        // Filter to only include balances for current mint URLs
        const validBalances = cachedBalances.filter(
          (balance) =>
            balance &&
            balance.mintUrl &&
            memoizedMintUrls.includes(balance.mintUrl)
        );

        setMintBalances(validBalances);
      } catch (error) {
        console.error('Failed to load cached balances:', error);
        setMintBalances([]);
      }
    };

    loadBalances();
  }, [memoizedMintUrls]);

  // Stable callback for balance updates
  const handleBalanceUpdate = useCallback((updatedBalances: MintBalance[]) => {
    if (!updatedBalances || !Array.isArray(updatedBalances)) {
      return;
    }

    setMintBalances((prev) => {
      const newBalances = [...prev];
      updatedBalances.forEach((updated) => {
        if (updated && updated.mintUrl) {
          const index = newBalances.findIndex(
            (b) => b && b.mintUrl === updated.mintUrl
          );
          if (index >= 0) {
            newBalances[index] = updated;
          } else {
            newBalances.push(updated);
          }
        }
      });
      return newBalances;
    });
  }, []);

  // Set up callback for balance updates from main wallet
  useEffect(() => {
    setBalanceUpdateCallback(handleBalanceUpdate);
    return () => setBalanceUpdateCallback(() => {});
  }, [handleBalanceUpdate]);

  // Helper function to get balance for a specific mint
  const getMintBalance = (mintUrl: string): MintBalance | undefined => {
    return mintBalances.find(
      (balance) => balance && balance.mintUrl === mintUrl
    );
  };

  // Handle refresh for individual mint
  const handleMintRefresh = async (mintUrl: string) => {
    try {
      await syncMintBalance(mintUrl);

      // Reload cached balances to update the display
      const cachedBalances = await loadCachedBalances();
      const validBalances = cachedBalances.filter(
        (balance) =>
          balance &&
          balance.mintUrl &&
          memoizedMintUrls.includes(balance.mintUrl)
      );
      setMintBalances(validBalances);

      // Update total balance on main wallet screen
      if (onUpdateTotalBalance) {
        await onUpdateTotalBalance();
      }
    } catch {
      // Silently handle errors - balance will remain unchanged
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
              balance={mintBalance?.balance}
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
