import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

interface TrendingEventListProps {
  eventIds: string[];
  onEventPress?: (eventId: string) => void;
}

export function TrendingEventList({
  eventIds,
  onEventPress,
}: TrendingEventListProps) {
  if (eventIds.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No trending events found</Text>
        <Text style={styles.emptySubtext}>
          Check back later for trending content
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          📋 Trending Event IDs ({eventIds.length} total)
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {eventIds.map((eventId, index) => (
          <TouchableOpacity
            key={eventId}
            style={styles.eventItem}
            onPress={() => onEventPress?.(eventId)}
            activeOpacity={0.7}
          >
            <View style={styles.eventContent}>
              <Text style={styles.eventNumber}>{index + 1}.</Text>
              <Text style={styles.eventId}>{eventId}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#2a2a2a',
  },
  headerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  eventItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  eventContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventNumber: {
    color: '#81b0ff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
    minWidth: 30,
  },
  eventId: {
    color: '#ccc',
    fontSize: 14,
    fontFamily: 'monospace',
    flex: 1,
    lineHeight: 20,
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
