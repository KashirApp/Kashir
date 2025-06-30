import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { MintInfo, MintUrlModal, useWallet } from './wallet';

export function SettingsScreen() {
  const {
    mintUrl,
    showMintUrlModal,
    promptForMintUrl,
    handleMintUrlSubmit,
    handleMintUrlModalClose,
  } = useWallet();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Wallet Settings</Text>
          
          <View style={styles.mintInfoContainer}>
            <MintInfo mintUrl={mintUrl} onChangeMint={promptForMintUrl} />
          </View>
        </View>
      </View>

      <MintUrlModal
        visible={showMintUrlModal}
        onClose={handleMintUrlModalClose}
        onSubmit={handleMintUrlSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  mintInfoContainer: {
    position: 'relative',
    minHeight: 100,
  },
}); 