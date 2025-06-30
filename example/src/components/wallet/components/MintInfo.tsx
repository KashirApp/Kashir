import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface MintInfoProps {
  mintUrl: string;
  onChangeMint?: () => void;
}

export function MintInfo({ mintUrl, onChangeMint }: MintInfoProps) {
  const handleChangeMint = () => {
    if (onChangeMint) {
      onChangeMint();
    }
  };

  if (!mintUrl) {
    return (
      <View style={styles.mintContainer}>
        <Text style={styles.mintLabel}>No mint URL set</Text>
        {onChangeMint && (
          <TouchableOpacity onPress={handleChangeMint} style={styles.changeMintButton}>
            <Text style={styles.changeMintText}>Set Mint URL</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.mintContainer}>
      <Text style={styles.mintLabel}>Connected Mint</Text>
      <Text style={styles.mintUrl}>{mintUrl}</Text>
      {onChangeMint && (
        <TouchableOpacity onPress={handleChangeMint} style={styles.changeMintButton}>
          <Text style={styles.changeMintText}>Change Mint</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mintContainer: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  mintLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  mintUrl: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'monospace',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  changeMintButton: {
    backgroundColor: '#444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  changeMintText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
}); 