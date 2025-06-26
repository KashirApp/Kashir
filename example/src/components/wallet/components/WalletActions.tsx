import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface WalletActionsProps {
  wallet: any;
  onCreateWallet: () => void;
  onReceive: () => void;
  onSend: () => void;
}

export function WalletActions({ wallet, onCreateWallet, onReceive, onSend }: WalletActionsProps) {
  return (
    <View style={styles.buttonsContainer}>
      {!wallet ? (
        <TouchableOpacity 
          style={[styles.button, styles.testButton]} 
          onPress={onCreateWallet}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Create Wallet</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.walletActions}>
          <TouchableOpacity 
            style={[styles.button, styles.receiveButton]} 
            onPress={onReceive}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Receive</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.sendButton]} 
            onPress={onSend}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonsContainer: {
    marginTop: 40,
    marginHorizontal: 20,
  },
  walletActions: {
    flexDirection: 'row',
    gap: 15,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  testButton: {
    backgroundColor: '#2196F3',
  },
  receiveButton: {
    backgroundColor: '#4CAF50',
    flex: 1,
  },
  sendButton: {
    backgroundColor: '#FF9800',
    flex: 1,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
}); 