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
    marginBottom: 10,
  },
  changeMintButton: {
    backgroundColor: '#333333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  changeMintText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
}); 