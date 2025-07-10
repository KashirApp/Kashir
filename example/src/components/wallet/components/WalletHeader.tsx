import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface WalletHeaderProps {
  onClose: () => void;
}

export function WalletHeader({ onClose }: WalletHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        activeOpacity={0.8}
      >
        <Text style={styles.closeButtonText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.headerText}>Cashu Wallet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    left: 20,
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  headerText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
  },
});
