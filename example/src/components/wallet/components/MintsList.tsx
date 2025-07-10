import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MintItem } from './MintItem';

interface MintsListProps {
  mintUrls: string[];
  activeMintUrl: string;
  onSetActive: (url: string) => void;
  onRemove: (url: string) => void;
  onAddMint: () => void;
}

export function MintsList({
  mintUrls,
  activeMintUrl,
  onSetActive,
  onRemove,
  onAddMint,
}: MintsListProps) {
  if (mintUrls.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No mints connected</Text>
        <TouchableOpacity onPress={onAddMint} style={styles.addMintButton}>
          <Text style={styles.addMintButtonText}>Add Your First Mint</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        Connected Mints ({mintUrls.length})
      </Text>

      {mintUrls.map((mintUrl, index) => (
        <MintItem
          key={`${mintUrl}-${index}`}
          mintUrl={mintUrl}
          isActive={mintUrl === activeMintUrl}
          onSetActive={onSetActive}
          onRemove={onRemove}
        />
      ))}

      <TouchableOpacity onPress={onAddMint} style={styles.addMintButton}>
        <Text style={styles.addMintButtonText}>+ Add Another Mint</Text>
      </TouchableOpacity>
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
});
