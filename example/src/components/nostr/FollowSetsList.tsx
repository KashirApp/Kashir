import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { FollowSetItem } from './FollowSetItem';
import type { FollowSet } from '../../services/ListService';

interface FollowSetsListProps {
  followSets: FollowSet[];
  isLoading: boolean;
  onEdit: (followSet: FollowSet) => void;
  onDelete: (followSet: FollowSet) => void;
  onCreateNew: () => void;
  onSetAsActive: (followSet: FollowSet) => void;
  activeFollowSetEventId: string | null;
}

export function FollowSetsList({
  followSets,
  isLoading,
  onEdit,
  onDelete,
  onCreateNew,
  onSetAsActive,
  activeFollowSetEventId,
}: FollowSetsListProps) {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#81b0ff" />
        <Text style={styles.loadingText}>Loading your follow sets...</Text>
      </View>
    );
  }

  if (followSets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Follow Sets</Text>
        <Text style={styles.emptyText}>
          Create follow sets to organize users you're interested in following.
          Follow sets are like Twitter lists that help you organize your
          timeline.
        </Text>
        <TouchableOpacity
          onPress={onCreateNew}
          style={styles.createFirstButton}
        >
          <Text style={styles.createFirstButtonText}>
            Create Your First Follow Set
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Follow Sets</Text>
          <Text style={styles.subtitle}>
            {followSets.length} {followSets.length === 1 ? 'set' : 'sets'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onCreateNew} style={styles.createButton}>
            <Text style={styles.createButtonText}>Create New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={[
          styles.listContainer,
          // Dynamic height based on number of items, with reasonable limits
          {
            maxHeight: Math.min(Math.max(followSets.length * 120, 200), 800),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {followSets.map((followSet) => (
          <FollowSetItem
            key={followSet.eventId}
            followSet={followSet}
            onEdit={onEdit}
            onDelete={onDelete}
            onSetAsActive={onSetAsActive}
            isActive={
              followSet.eventId === activeFollowSetEventId ||
              (followSet.identifier === 'Following' &&
                activeFollowSetEventId === null)
            }
          />
        ))}
      </ScrollView>

      <Text style={styles.helpText}>
        Follow sets are stored on Nostr using NIP-51. They help you organize
        users into different categories and can be used by compatible clients.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#888',
  },
  emptyContainer: {
    backgroundColor: '#2a2a2a',
    padding: 30,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  createFirstButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
  },
  createFirstButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
  },
  headerActions: {
    flexDirection: 'row',
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  createButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  listContainer: {
    marginBottom: 15,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
