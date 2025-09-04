import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import type { FollowSet } from '../../services/ListService';

interface FollowSetItemProps {
  followSet: FollowSet;
  onEdit: (followSet: FollowSet) => void;
  onDelete: (followSet: FollowSet) => void;
  onSetAsActive: (followSet: FollowSet) => void;
  isActive: boolean;
}

export function FollowSetItem({
  followSet,
  onEdit,
  onDelete,
  onSetAsActive,
  isActive,
}: FollowSetItemProps) {
  const isMainFollowing = followSet.identifier === 'Following';

  const handleDelete = () => {
    Alert.alert(
      'Delete Follow Set',
      `Are you sure you want to delete "${followSet.identifier}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(followSet),
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={[styles.container, isActive && styles.activeContainer]}>
      <View style={styles.titleContainer}>
        <View style={styles.identifierRow}>
          <Text style={styles.identifier}>{followSet.identifier}</Text>
        </View>
        <Text style={styles.userCount}>
          {followSet.publicKeys.length}{' '}
          {followSet.publicKeys.length === 1 ? 'user' : 'users'}
        </Text>
        <Text style={styles.dateText}>
          {isMainFollowing
            ? `Last updated ${formatDate(followSet.createdAt)}`
            : `Created ${formatDate(followSet.createdAt)}`}
        </Text>
        {isActive && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <View style={styles.buttonRow}>
          {!isActive && (
            <TouchableOpacity
              style={styles.setActiveButton}
              onPress={() => onSetAsActive(followSet)}
            >
              <Text style={styles.setActiveButtonText}>Set Active</Text>
            </TouchableOpacity>
          )}
          {!isMainFollowing && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => onEdit(followSet)}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        {!isMainFollowing && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.deleteButton,
                isActive && styles.deleteButtonDisabled,
              ]}
              onPress={handleDelete}
              disabled={isActive}
            >
              <Text
                style={[
                  styles.deleteButtonText,
                  isActive && styles.deleteButtonTextDisabled,
                ]}
              >
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeContainer: {
    borderColor: '#007AFF',
    backgroundColor: '#1a2332',
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  identifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  identifier: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  activeBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  userCount: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setActiveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  setActiveButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff9500',
    borderRadius: 4,
  },
  editButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ff6b6b',
    borderRadius: 4,
  },
  deleteButtonDisabled: {
    backgroundColor: '#444',
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
  },
  deleteButtonTextDisabled: {
    color: '#888',
  },
  dateText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
