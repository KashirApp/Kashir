import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface WalletStatusProps {
  status: string;
}

export function WalletStatus({ status }: WalletStatusProps) {
  return (
    <View style={styles.statusContainer}>
      <Text style={styles.statusLabel}>Module Status:</Text>
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusContainer: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'monospace',
  },
});
