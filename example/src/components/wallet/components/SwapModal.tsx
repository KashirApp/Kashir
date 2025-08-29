import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { formatSats } from '../utils/formatUtils';
import type { MintBalance } from '../utils/mintBalanceUtils';

interface SwapModalProps {
  visible: boolean;
  onClose: () => void;
  mintBalances: MintBalance[];
  onSwap: (
    fromMintUrl: string,
    toMintUrl: string,
    amount: bigint
  ) => Promise<void>;
}

export function SwapModal({
  visible,
  onClose,
  mintBalances,
  onSwap,
}: SwapModalProps) {
  const [fromMintUrl, setFromMintUrl] = useState<string>('');
  const [toMintUrl, setToMintUrl] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [isSwapping, setIsSwapping] = useState(false);

  const handleSwap = useCallback(async () => {
    if (!fromMintUrl || !toMintUrl || !amount) {
      Alert.alert('Error', 'Please select both mints and enter an amount');
      return;
    }

    if (fromMintUrl === toMintUrl) {
      Alert.alert('Error', 'Please select different mints for swap');
      return;
    }

    const amountSats = parseInt(amount, 10);
    if (isNaN(amountSats) || amountSats <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const fromMint = mintBalances.find((mb) => mb.mintUrl === fromMintUrl);
    if (!fromMint || fromMint.balance < BigInt(amountSats)) {
      Alert.alert('Error', 'Insufficient balance in source mint');
      return;
    }

    // Show confirmation dialog
    Alert.alert(
      'Confirm Swap',
      `Swap ${formatSats(BigInt(amountSats))} from ${getMintDisplayName(fromMintUrl)} to ${getMintDisplayName(toMintUrl)}?\n\nFees will be calculated automatically during the swap process.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm Swap',
          onPress: async () => {
            setIsSwapping(true);
            try {
              await onSwap(fromMintUrl, toMintUrl, BigInt(amountSats));
              setFromMintUrl('');
              setToMintUrl('');
              setAmount('');
              onClose();
            } catch (error) {
              Alert.alert(
                'Swap Failed',
                error instanceof Error
                  ? error.message
                  : 'Unknown error occurred'
              );
            } finally {
              setIsSwapping(false);
            }
          },
        },
      ]
    );
  }, [fromMintUrl, toMintUrl, amount, mintBalances, onSwap, onClose]);

  const getMintDisplayName = (mintUrl: string) => {
    try {
      // Extract hostname from URL string without using URL constructor
      const match = mintUrl.match(/^https?:\/\/([^/]+)/);
      return match ? match[1] : mintUrl;
    } catch {
      return mintUrl;
    }
  };

  const getMintBalance = (mintUrl: string) => {
    const mint = mintBalances.find((mb) => mb.mintUrl === mintUrl);
    return mint?.balance || BigInt(0);
  };

  const availableMints = mintBalances.filter(
    (mb) => mb.balance && mb.balance > 0
  );

  if (availableMints.length < 2) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Swap Between Mints</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>⚠️ Insufficient Mints</Text>
            <Text style={styles.emptySubtext}>
              You need at least 2 mints with positive balances to perform a swap
            </Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      supportedOrientations={['portrait']}
      hardwareAccelerated={true}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Swap Between Mints</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={isSwapping ? styles.fixedContent : undefined}
          pointerEvents={isSwapping ? 'none' : 'auto'}
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>From Mint</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {availableMints.map((mint) => (
                <TouchableOpacity
                  key={mint.mintUrl}
                  style={[
                    styles.mintOption,
                    fromMintUrl === mint.mintUrl && styles.selectedMint,
                  ]}
                  onPress={() => setFromMintUrl(mint.mintUrl)}
                  disabled={isSwapping}
                >
                  <Text style={styles.mintUrl}>
                    {getMintDisplayName(mint.mintUrl)}
                  </Text>
                  <Text style={styles.mintBalance}>
                    {formatSats(mint.balance)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>To Mint</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {mintBalances.map((mint) => (
                <TouchableOpacity
                  key={mint.mintUrl}
                  style={[
                    styles.mintOption,
                    toMintUrl === mint.mintUrl && styles.selectedMint,
                    fromMintUrl === mint.mintUrl && styles.disabledMint,
                  ]}
                  onPress={() =>
                    fromMintUrl !== mint.mintUrl && setToMintUrl(mint.mintUrl)
                  }
                  disabled={fromMintUrl === mint.mintUrl || isSwapping}
                >
                  <Text style={styles.mintUrl}>
                    {getMintDisplayName(mint.mintUrl)}
                  </Text>
                  <Text style={styles.mintBalance}>
                    {formatSats(mint.balance)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amount (sats)</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="Enter amount to swap"
              placeholderTextColor="#666"
              keyboardType="numeric"
              editable={!isSwapping}
            />
            {fromMintUrl && (
              <Text style={styles.maxAmount}>
                Max: {formatSats(getMintBalance(fromMintUrl))}
              </Text>
            )}
          </View>

          {fromMintUrl && toMintUrl && amount && (
            <View style={styles.swapPreview}>
              <Text style={styles.previewTitle}>Swap Preview</Text>
              <Text style={styles.previewText}>
                {amount} sats from {getMintDisplayName(fromMintUrl)}
              </Text>
              <Text style={styles.previewArrow}>↓</Text>
              <Text style={styles.previewText}>
                To {getMintDisplayName(toMintUrl)}
              </Text>
              <Text style={styles.previewNote}>
                * Final amount will depend on Lightning Network fees
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.swapButton,
              (!fromMintUrl || !toMintUrl || !amount || isSwapping) &&
                styles.swapButtonDisabled,
            ]}
            onPress={handleSwap}
            disabled={!fromMintUrl || !toMintUrl || !amount || isSwapping}
          >
            <Text style={styles.swapButtonText}>⇄ Execute Swap</Text>
          </TouchableOpacity>
        </View>

        {/* Overlay moved to root level for stable positioning */}
        {isSwapping && (
          <View style={styles.swapInProgressOverlay}>
            <View style={styles.swapInProgressContainer}>
              <ActivityIndicator size="large" color="#ff9500" />
              <Text style={styles.swapInProgressText}>Swapping tokens...</Text>
              <Text style={styles.swapInProgressSubtext}>
                This may take a few seconds. Please don't close the app.
              </Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  swapInProgressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.95)', // Increased opacity to fully block background
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000, // Android elevation
    width: screenWidth,
    height: screenHeight,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  swapInProgressContainer: {
    backgroundColor: '#2a2a2a',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: screenWidth * 0.8,
    elevation: 1001, // Higher than overlay
  },
  swapInProgressText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  swapInProgressSubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  fixedContent: {
    minHeight: screenHeight * 0.6, // Fixed height to prevent reflow
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  mintOption: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#444',
    minWidth: 120,
  },
  selectedMint: {
    borderColor: '#007AFF',
    backgroundColor: '#1a2332',
  },
  disabledMint: {
    opacity: 0.5,
  },
  mintUrl: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  mintBalance: {
    color: '#999',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  amountInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  maxAmount: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  swapPreview: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
    alignItems: 'center',
  },
  previewTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  previewText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 4,
  },
  previewArrow: {
    color: '#ff9500',
    fontSize: 18,
    marginVertical: 8,
  },
  previewNote: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  swapButton: {
    backgroundColor: '#ff9500',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  swapButtonDisabled: {
    backgroundColor: '#444',
  },
  swapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
});
