import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

interface MintItemProps {
  mintUrl: string;
  isActive: boolean;
  onSetActive: (url: string) => void;
  onRemove: (url: string) => void;
}

export function MintItem({ mintUrl, isActive, onSetActive, onRemove }: MintItemProps) {
  // Always show the full URL to users

  const handleSetActive = () => {
    if (!isActive) {
      onSetActive(mintUrl);
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove Mint',
      `Are you sure you want to remove this mint?\n\n${mintUrl}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemove(mintUrl)
        }
      ]
    );
  };

  return (
    <View style={[styles.container, isActive && styles.activeContainer]}>
      <View style={styles.leftSection}>
        <Text style={styles.mintUrl}>
          {mintUrl}
        </Text>
        {isActive && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
      </View>
      
      <View style={styles.rightSection}>
        {!isActive && (
          <TouchableOpacity onPress={handleSetActive} style={styles.setActiveButton}>
            <Text style={styles.setActiveButtonText}>Set Active</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          onPress={handleRemove} 
          style={[styles.removeButton, isActive && styles.removeButtonDisabled]}
          disabled={isActive}
        >
          <Text style={[styles.removeButtonText, isActive && styles.removeButtonTextDisabled]}>
            Remove
          </Text>
        </TouchableOpacity>
      </View>
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
    alignItems: 'flex-start', // Changed from 'center' to handle multi-line URLs
    justifyContent: 'space-between',
  },
  activeContainer: {
    borderColor: '#007AFF',
    backgroundColor: '#1a2332',
  },
  leftSection: {
    flex: 1,
    marginRight: 12,
  },
  mintUrl: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'monospace',
    marginBottom: 4,
    lineHeight: 18, // Better line spacing for multi-line URLs
    flexWrap: 'wrap', // Allow text to wrap naturally
  },
  activeBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align buttons to top for multi-line URLs
    gap: 8,
    paddingTop: 2, // Small offset to align with text baseline
  },
  setActiveButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  setActiveButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
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