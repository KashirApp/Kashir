import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RelayItem } from './RelayItem';

interface RelaysListProps {
  relays: string[];
  onRemove: (url: string) => void;
  onAddRelay: () => void;
}

export function RelaysList({ relays, onRemove, onAddRelay }: RelaysListProps) {
  if (relays.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No relays configured</Text>
        <TouchableOpacity onPress={onAddRelay} style={styles.addRelayButton}>
          <Text style={styles.addRelayButtonText}>Add Your First Relay</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>
        Connected Relays ({relays.length})
      </Text>

      {relays.map((relayUrl, index) => (
        <RelayItem
          key={`${relayUrl}-${index}`}
          relayUrl={relayUrl}
          onRemove={onRemove}
          canRemove={relays.length > 1}
        />
      ))}

      <TouchableOpacity onPress={onAddRelay} style={styles.addRelayButton}>
        <Text style={styles.addRelayButtonText}>+ Add Another Relay</Text>
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
  addRelayButton: {
    backgroundColor: '#81b0ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  addRelayButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '500',
  },
});