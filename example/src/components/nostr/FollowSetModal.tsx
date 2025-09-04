import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { PublicKey, PublicKeyInterface } from 'kashir';
import type { FollowSet } from '../../services/ListService';

interface FollowSetModalProps {
  visible: boolean;
  followSet?: FollowSet; // If provided, we're editing; otherwise creating new
  onClose: () => void;
  onSave: (
    identifier: string,
    publicKeys: PublicKeyInterface[],
    privateKeys?: PublicKeyInterface[]
  ) => Promise<boolean>;
}

export function FollowSetModal({
  visible,
  followSet,
  onClose,
  onSave,
}: FollowSetModalProps) {
  const [identifier, setIdentifier] = useState('');
  const [publicKeyInput, setPublicKeyInput] = useState('');
  const [publicKeys, setPublicKeys] = useState<PublicKeyInterface[]>([]);
  const [privateKeys, setPrivateKeys] = useState<PublicKeyInterface[]>([]);
  const [addingToPrivate, setAddingToPrivate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inputError, setInputError] = useState('');

  const isEditing = !!followSet;

  // Initialize modal state when it opens or when followSet changes
  useEffect(() => {
    if (visible) {
      if (followSet) {
        // Editing existing follow set
        setIdentifier(followSet.identifier);
        setPublicKeys([...followSet.publicKeys]);
        setPrivateKeys([...(followSet.privateKeys || [])]);
      } else {
        // Creating new follow set
        setIdentifier('');
        setPublicKeys([]);
        setPrivateKeys([]);
      }
      setPublicKeyInput('');
      setAddingToPrivate(false);
      setInputError('');
    }
  }, [visible, followSet]);

  const handleAddPublicKey = () => {
    const input = publicKeyInput.trim();
    if (!input) return;

    setInputError('');

    try {
      // Try to parse as npub first, then as hex
      let publicKey: PublicKeyInterface;

      if (input.startsWith('npub1')) {
        publicKey = PublicKey.parse(input);
      } else if (input.length === 64 && /^[a-fA-F0-9]+$/.test(input)) {
        // Hex public key
        publicKey = PublicKey.fromHex(input);
      } else {
        throw new Error('Invalid format');
      }

      const targetArray = addingToPrivate ? privateKeys : publicKeys;
      const otherArray = addingToPrivate ? publicKeys : privateKeys;

      // Check if already in either list
      const alreadyInTarget = targetArray.some(
        (pk) => pk.toHex() === publicKey.toHex()
      );
      const alreadyInOther = otherArray.some(
        (pk) => pk.toHex() === publicKey.toHex()
      );

      if (alreadyInTarget) {
        setInputError(
          `This user is already in the ${addingToPrivate ? 'private' : 'public'} list`
        );
        return;
      }

      if (alreadyInOther) {
        setInputError(
          `This user is already in the ${addingToPrivate ? 'public' : 'private'} list`
        );
        return;
      }

      if (addingToPrivate) {
        setPrivateKeys((prev) => [...prev, publicKey]);
      } else {
        setPublicKeys((prev) => [...prev, publicKey]);
      }
      setPublicKeyInput('');
    } catch {
      setInputError(
        'Invalid public key. Use npub1... format or 64-character hex string'
      );
    }
  };

  const handleRemovePublicKey = (publicKeyToRemove: PublicKeyInterface) => {
    setPublicKeys((prev) =>
      prev.filter((pk) => pk.toHex() !== publicKeyToRemove.toHex())
    );
  };

  const handleRemovePrivateKey = (publicKeyToRemove: PublicKeyInterface) => {
    setPrivateKeys((prev) =>
      prev.filter((pk) => pk.toHex() !== publicKeyToRemove.toHex())
    );
  };

  const handleSave = async () => {
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier) {
      Alert.alert('Error', 'Please enter a name for your follow set');
      return;
    }

    const totalUsers = publicKeys.length + privateKeys.length;
    if (totalUsers === 0) {
      Alert.alert('Error', 'Please add at least one user to your follow set');
      return;
    }

    setIsSaving(true);
    try {
      const success = await onSave(
        trimmedIdentifier,
        publicKeys,
        privateKeys.length > 0 ? privateKeys : undefined
      );
      if (success) {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const formatPublicKey = (publicKey: PublicKeyInterface): string => {
    try {
      return publicKey.toBech32();
    } catch {
      // Fallback to hex if bech32 fails
      const hex = publicKey.toHex();
      return `${hex.substring(0, 8)}...${hex.substring(hex.length - 8)}`;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={isSaving}>
            <Text style={[styles.cancelText, isSaving && styles.disabledText]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {isEditing ? 'Edit Follow Set' : 'New Follow Set'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={isSaving}>
            <Text style={[styles.saveText, isSaving && styles.disabledText]}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Follow Set Name</Text>
            <TextInput
              style={styles.textInput}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="e.g., Bitcoin Developers, Close Friends, etc."
              placeholderTextColor="#666"
              editable={!isSaving}
              maxLength={50}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Users</Text>
            <Text style={styles.sectionSubtitle}>
              Enter npub1... addresses or hex public keys
            </Text>

            <View style={styles.addModeToggle}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  !addingToPrivate && styles.toggleButtonActive,
                ]}
                onPress={() => setAddingToPrivate(false)}
                disabled={isSaving}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    !addingToPrivate && styles.toggleButtonTextActive,
                  ]}
                >
                  Add Public
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  addingToPrivate && styles.toggleButtonActive,
                ]}
                onPress={() => setAddingToPrivate(true)}
                disabled={isSaving}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    addingToPrivate && styles.toggleButtonTextActive,
                  ]}
                >
                  Add Private
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.publicKeyInput}
                value={publicKeyInput}
                onChangeText={setPublicKeyInput}
                placeholder={`${addingToPrivate ? 'Private' : 'Public'} user: npub1... or hex public key`}
                placeholderTextColor="#666"
                multiline={true}
                editable={!isSaving}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleAddPublicKey}
              />
              <TouchableOpacity
                style={[
                  styles.addButton,
                  addingToPrivate && styles.addButtonPrivate,
                ]}
                onPress={handleAddPublicKey}
                disabled={isSaving || !publicKeyInput.trim()}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {inputError ? (
              <Text style={styles.errorText}>{inputError}</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Public Users ({publicKeys.length})
            </Text>

            {publicKeys.length === 0 ? (
              <View style={styles.emptyUsers}>
                <Text style={styles.emptyUsersText}>
                  No public users added yet
                </Text>
              </View>
            ) : (
              <View style={styles.usersList}>
                {publicKeys.map((publicKey, index) => (
                  <View key={index} style={styles.userItem}>
                    <Text style={styles.userKey} numberOfLines={1}>
                      {formatPublicKey(publicKey)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemovePublicKey(publicKey)}
                      disabled={isSaving}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Private Users ({privateKeys.length})
            </Text>

            {privateKeys.length === 0 ? (
              <View style={styles.emptyUsers}>
                <Text style={styles.emptyUsersText}>
                  No private users added yet
                </Text>
              </View>
            ) : (
              <View style={styles.usersList}>
                {privateKeys.map((publicKey, index) => (
                  <View key={index} style={styles.userItem}>
                    <Text style={styles.userKey} numberOfLines={1}>
                      {formatPublicKey(publicKey)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleRemovePrivateKey(publicKey)}
                      disabled={isSaving}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.helpSection}>
            <Text style={styles.helpText}>
              Follow sets are stored on the Nostr network and can be used by
              compatible clients to organize your timeline. Private users are
              encrypted and only visible to you.
            </Text>
          </View>
        </ScrollView>

        {isSaving && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#81b0ff" />
            <Text style={styles.loadingText}>
              {isEditing ? 'Updating follow set...' : 'Creating follow set...'}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cancelText: {
    fontSize: 16,
    color: '#81b0ff',
  },
  saveText: {
    fontSize: 16,
    color: '#81b0ff',
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
  },
  publicKeyInput: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 14,
    color: '#fff',
    minHeight: 45,
  },
  addButton: {
    backgroundColor: '#81b0ff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 45,
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    fontSize: 12,
    color: '#ff6b6b',
    marginTop: 5,
  },
  emptyUsers: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyUsersText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  usersList: {
    gap: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userKey: {
    flex: 1,
    fontSize: 13,
    color: '#fff',
    fontFamily: 'monospace',
  },
  removeButton: {
    backgroundColor: '#4a2929',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 10,
  },
  removeButtonText: {
    fontSize: 11,
    color: '#ff6b6b',
    fontWeight: '500',
  },
  helpSection: {
    marginTop: 30,
    marginBottom: 20,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fff',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  switchLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  addModeToggle: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#6366f1',
  },
  toggleButtonText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  toggleButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  addButtonPrivate: {
    backgroundColor: '#6366f1',
  },
});
