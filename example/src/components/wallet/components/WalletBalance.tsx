import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatSats } from '../utils';

interface WalletBalanceProps {
  balance: bigint;
  wallet: any;
}

export function WalletBalance({
  balance,
  wallet: _wallet,
}: WalletBalanceProps) {
  return (
    <View style={styles.balanceContainer}>
      <Text style={styles.balanceLabel}>Total Balance</Text>
      <Text style={styles.balanceAmount}>{formatSats(balance)}</Text>
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
});
