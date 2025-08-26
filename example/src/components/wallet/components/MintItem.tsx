import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { formatSats } from '../utils/formatUtils';

interface MintItemProps {
  mintUrl: string;
  isActive: boolean;
  balance?: bigint;
  onSetActive: (url: string) => void;
  onRemove: (url: string) => void;
  onRefresh?: (url: string) => Promise<void>;
}

export function MintItem({
  mintUrl,
  isActive,
  balance,
  onSetActive,
  onRemove,
  onRefresh,
}: MintItemProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

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
          onPress: () => onRemove(mintUrl),
        },
      ]
    );
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;

    setIsRefreshing(true);
    try {
      await onRefresh(mintUrl);
    } catch {
      // Silently handle errors - balance will remain unchanged
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <View style={[styles.container, isActive && styles.activeContainer]}>
      <View style={styles.leftSection}>
        <Text style={styles.mintUrl}>{mintUrl}</Text>

        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Balance: </Text>
          <Text style={styles.balanceValue}>
            {balance !== undefined ? formatSats(balance) : formatSats(BigInt(0))}
          </Text>
        </View>

        {isActive && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
      </View>

      <View style={styles.rightSection}>
        {onRefresh && (
          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.refreshButton}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.refreshButtonText}>Sync</Text>
            )}
          </TouchableOpacity>
        )}

        {!isActive && (
          <TouchableOpacity
            onPress={handleSetActive}
            style={styles.setActiveButton}
          >
            <Text style={styles.setActiveButtonText}>Set Active</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleRemove}
          style={[styles.removeButton, isActive && styles.removeButtonDisabled]}
          disabled={isActive}
        >
          <Text
            style={[
              styles.removeButtonText,
              isActive && styles.removeButtonTextDisabled,
            ]}
          >
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
    flexWrap: 'wrap', // Allow buttons to wrap if needed
  },
  refreshButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 50,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
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
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  balanceValue: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  balanceError: {
    fontSize: 12,
    color: '#ff6b6b',
    fontStyle: 'italic',
  },
});
