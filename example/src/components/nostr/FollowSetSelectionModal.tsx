import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import type { FollowSet } from '../../services/ListService';
import { PrivatePill } from './PrivatePill';

interface FollowSetSelectionModalProps {
  visible: boolean;
  followSets: FollowSet[];
  activeFollowSetId?: string;
  loading?: boolean;
  onClose: () => void;
  onSelect: (followSet: FollowSet | null) => void; // null for main following list
}

export function FollowSetSelectionModal({
  visible,
  followSets,
  activeFollowSetId,
  loading = false,
  onClose,
  onSelect,
}: FollowSetSelectionModalProps) {
  const handleSelect = (followSet: FollowSet | null) => {
    onSelect(followSet);
    onClose();
  };

  const isActiveSet = (followSet: FollowSet | null) => {
    if (!followSet && !activeFollowSetId) return true; // Main following is active
    if (!followSet || !activeFollowSetId) return false;
    return followSet.eventId === activeFollowSetId;
  };

  const getTotalUserCount = (followSet: FollowSet) => {
    return followSet.publicKeys.length + (followSet.privateKeys?.length || 0);
  };

  const getBreakdown = (followSet: FollowSet) => {
    const publicCount = followSet.publicKeys.length;
    const privateCount = followSet.privateKeys?.length || 0;

    if (publicCount > 0 && privateCount > 0) {
      return `${publicCount} public, ${privateCount} private`;
    } else if (privateCount > 0) {
      return `${privateCount} private`;
    } else {
      return `${publicCount} public`;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Select Follow Set</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            Choose which follow set to use for your Following tab
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading follow sets...</Text>
            </View>
          ) : (
            <>
              {/* Main Following List */}
              {followSets
                .filter((set) => set.identifier === 'Following')
                .map((followSet) => (
                  <TouchableOpacity
                    key="main-following"
                    style={[
                      styles.followSetItem,
                      isActiveSet(followSet) && styles.activeFollowSetItem,
                    ]}
                    onPress={() => handleSelect(null)} // null = use main following
                  >
                    <View style={styles.followSetInfo}>
                      <Text style={styles.followSetName}>Following</Text>
                      <Text style={styles.followSetDetails}>
                        {followSet.publicKeys.length} users • Your core Nostr
                        contacts
                      </Text>
                    </View>
                    {isActiveSet(followSet) && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Active</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

              {/* Custom Follow Sets */}
              {followSets
                .filter((set) => set.identifier !== 'Following')
                .map((followSet) => (
                  <TouchableOpacity
                    key={followSet.eventId}
                    style={[
                      styles.followSetItem,
                      isActiveSet(followSet) && styles.activeFollowSetItem,
                    ]}
                    onPress={() => handleSelect(followSet)}
                  >
                    <View style={styles.followSetInfo}>
                      <View style={styles.followSetNameRow}>
                        <Text style={styles.followSetName}>
                          {followSet.identifier}
                        </Text>
                        {followSet.isPrivate && <PrivatePill size="small" />}
                      </View>
                      <Text style={styles.followSetDetails}>
                        {getTotalUserCount(followSet)} users •{' '}
                        {getBreakdown(followSet)}
                      </Text>
                    </View>
                    {isActiveSet(followSet) && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Active</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

              {followSets.filter((set) => set.identifier !== 'Following')
                .length === 0 &&
                !loading && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      No custom follow sets found
                    </Text>
                    <Text style={styles.emptyStateSubtext}>
                      Create follow sets in Settings to organize your timeline
                    </Text>
                  </View>
                )}
            </>
          )}
        </ScrollView>
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
  placeholder: {
    width: 50, // Balance the cancel button
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  followSetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  activeFollowSetItem: {
    borderColor: '#007AFF',
    backgroundColor: '#1a2332',
  },
  followSetInfo: {
    flex: 1,
    marginRight: 12,
  },
  followSetNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  followSetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  followSetDetails: {
    fontSize: 13,
    color: '#888',
  },
  activeBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#888',
  },
});
