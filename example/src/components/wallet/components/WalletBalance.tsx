import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface WalletBalanceProps {
  balance: bigint;
  wallet: any;
  onRefresh: () => void;
}

export function WalletBalance({ balance, wallet, onRefresh }: WalletBalanceProps) {
  return (
    <View style={styles.balanceContainer}>
      <Text style={styles.balanceLabel}>Total Balance</Text>
      <Text style={styles.balanceAmount}>{balance.toString()} sats</Text>
      {wallet && (
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={onRefresh}
          activeOpacity={0.8}
        >
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  balanceContainer: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  balanceLabel: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 10,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ffffff',
  },
  refreshButton: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
  },
  refreshButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
}); 