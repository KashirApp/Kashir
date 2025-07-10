import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

interface RelayItemProps {
  relayUrl: string;
  onRemove: (url: string) => void;
  canRemove: boolean;
}

export function RelayItem({ relayUrl, onRemove, canRemove }: RelayItemProps) {
  const handleRemove = () => {
    if (!canRemove) {
      Alert.alert(
        'Cannot Remove',
        'You must have at least one relay configured.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Remove Relay',
      `Are you sure you want to remove this relay?\n\n${relayUrl}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemove(relayUrl),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.relayUrl}>{relayUrl}</Text>
      <TouchableOpacity
        onPress={handleRemove}
        style={[styles.removeButton, !canRemove && styles.removeButtonDisabled]}
      >
        <Text
          style={[
            styles.removeButtonText,
            !canRemove && styles.removeButtonTextDisabled,
          ]}
        >
          Remove
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  relayUrl: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'monospace',
    flex: 1,
    marginRight: 12,
  },
  removeButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  removeButtonDisabled: {
    backgroundColor: '#444',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  removeButtonTextDisabled: {
    color: '#888',
  },
});