import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { RelayItem } from './RelayItem';
import { UserRelayInfo, RelayListService } from '../../services';

interface EnhancedRelaysListProps {
  relays: string[];
  userRelayInfo: UserRelayInfo[];
  hasUserRelayList: boolean;
  isLoadingUserRelays: boolean;
  onRemove: (url: string) => void;
  onAddRelay: () => void;
}

export function EnhancedRelaysList({ 
  relays, 
  userRelayInfo, 
  hasUserRelayList, 
  isLoadingUserRelays, 
  onRemove, 
  onAddRelay 
}: EnhancedRelaysListProps) {
  const relayListService = RelayListService.getInstance();

  if (isLoadingUserRelays) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#81b0ff" />
        <Text style={styles.loadingText}>Loading your relay list...</Text>
      </View>
    );
  }

  if (relays.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No relays configured</Text>
        <TouchableOpacity onPress={onAddRelay} style={styles.addRelayButton}>
          <Text style={styles.addRelayButtonText}>Add Your First Relay</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getRelayMetadata = (url: string) => {
    if (!hasUserRelayList || userRelayInfo.length === 0) return undefined;
    return userRelayInfo.find(info => info.url === url)?.metadata;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.sectionTitle}>
          {hasUserRelayList ? '📡 Your Relay List (NIP-65)' : 'Connected Relays'} ({relays.length})
        </Text>
        {hasUserRelayList && (
          <Text style={styles.subtitleText}>
            Automatically loaded from your Nostr profile
          </Text>
        )}
      </View>

      {hasUserRelayList && userRelayInfo.length > 0 && (
        <View style={styles.relayTypesContainer}>
          {(() => {
            const grouped = relayListService.groupRelaysByType(userRelayInfo);
            return (
              <View style={styles.relayTypesInfo}>
                {grouped.readWrite.length > 0 && (
                  <Text style={styles.relayTypeText}>
                    🔄 {grouped.readWrite.length} Read/Write
                  </Text>
                )}
                {grouped.read.length > 0 && (
                  <Text style={styles.relayTypeText}>
                    📖 {grouped.read.length} Read Only
                  </Text>
                )}
                {grouped.write.length > 0 && (
                  <Text style={styles.relayTypeText}>
                    ✍️ {grouped.write.length} Write Only
                  </Text>
                )}
              </View>
            );
          })()}
        </View>
      )}

      {relays.map((relayUrl, index) => {
        const metadata = getRelayMetadata(relayUrl);
        return (
          <View key={`${relayUrl}-${index}`} style={styles.relayItemContainer}>
            <RelayItem
              relayUrl={relayUrl}
              onRemove={onRemove}
              canRemove={relays.length > 1}
            />
            {hasUserRelayList && (
              <Text style={styles.metadataText}>
                {relayListService.getMetadataDisplayName(metadata)}
              </Text>
            )}
          </View>
        );
      })}

      <TouchableOpacity onPress={onAddRelay} style={styles.addRelayButton}>
        <Text style={styles.addRelayButtonText}>
          {hasUserRelayList ? '+ Add Custom Relay' : '+ Add Another Relay'}
        </Text>
      </TouchableOpacity>

      {hasUserRelayList && (
        <Text style={styles.warningText}>
          ⚠️ Adding custom relays will override your NIP-65 relay list
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Removed flex: 1 to prevent expansion and overlap issues
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
  },
  headerContainer: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  relayTypesContainer: {
    marginBottom: 16,
  },
  relayTypesInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  relayTypeText: {
    fontSize: 12,
    color: '#81b0ff',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  relayItemContainer: {
    marginBottom: 8,
  },
  metadataText: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    marginLeft: 12,
    fontStyle: 'italic',
  },
  addRelayButton: {
    backgroundColor: '#81b0ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  addRelayButtonText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '500',
  },
  warningText: {
    fontSize: 11,
    color: '#ff9800',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});