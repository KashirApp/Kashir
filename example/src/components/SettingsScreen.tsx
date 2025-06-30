import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Clipboard,
} from 'react-native';
import { MintInfo, MintUrlModal, useWallet } from './wallet';
import { SecureStorageService } from '../services';

export function SettingsScreen() {
  const {
    mintUrl,
    showMintUrlModal,
    promptForMintUrl,
    handleMintUrlSubmit,
    handleMintUrlModalClose,
  } = useWallet();

  const handleViewSeedPhrase = async () => {
    try {
      const seedPhrase = await SecureStorageService.getSeedPhrase();
      if (seedPhrase) {
        Alert.alert(
          'Seed Phrase',
          seedPhrase,
          [
            {
              text: 'Copy to Clipboard',
              onPress: () => {
                Clipboard.setString(seedPhrase);
                Alert.alert('Copied!', 'Seed phrase copied to clipboard');
              }
            },
            { text: 'Close', style: 'cancel' }
          ]
        );
      } else {
        Alert.alert('No Seed Phrase', 'No seed phrase found in secure storage');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to retrieve seed phrase. Authentication may have been cancelled.');
    }
  };

  const handleRemoveSeedPhrase = async () => {
    Alert.alert(
      'Remove Seed Phrase',
      'Are you sure you want to remove the stored seed phrase? You should have it backed up elsewhere.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const removed = await SecureStorageService.removeSeedPhrase();
              if (removed) {
                Alert.alert('Success', 'Seed phrase removed from secure storage');
              } else {
                Alert.alert('Error', 'Failed to remove seed phrase');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to remove seed phrase');
            }
          }
        }
      ]
    );
  };

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <TouchableOpacity style={styles.settingButton} onPress={handleViewSeedPhrase}>
            <Text style={styles.settingButtonText}>View Seed Phrase</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingButton} onPress={handleRemoveSeedPhrase}>
            <Text style={[styles.settingButtonText, styles.dangerText]}>Remove Stored Seed Phrase</Text>
          </TouchableOpacity>
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
  settingButton: {
    paddingVertical: 15,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  settingButtonText: {
    fontSize: 16,
    color: '#81b0ff',
  },
  dangerText: {
    color: '#ff6b6b',
  },
}); 