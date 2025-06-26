import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MintInfoProps {
  mintUrl: string;
}

export function MintInfo({ mintUrl }: MintInfoProps) {
  return (
    <View style={styles.mintContainer}>
      <Text style={styles.mintLabel}>Connected Mint</Text>
      <Text style={styles.mintUrl}>{mintUrl}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mintContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  mintLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
  },
  mintUrl: {
    fontSize: 14,
    color: '#888888',
    fontFamily: 'monospace',
  },
}); 