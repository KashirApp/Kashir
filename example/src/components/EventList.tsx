import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ProfileService } from '../services/ProfileService';
import type { CalendarEvent } from '../hooks/useEvents';

interface EventListProps {
  events: CalendarEvent[];
  loading: boolean;
  profileService: ProfileService;
  title?: string;
  onEventPress?: (event: CalendarEvent) => void;
}

export function EventList({
  events,
  loading,
  profileService,
  title = 'Calendar Events (by time)',
  onEventPress,
}: EventListProps) {
  const formatEventDate = (event: CalendarEvent) => {
    if (!event.startDate) return 'Date TBD';

    try {
      const now = Date.now();
      let eventTime: number;
      let displayDate: string;

      if (event.kind === 31922) {
        // Date-based event: startDate is in YYYY-MM-DD format
        const date = new Date(event.startDate + 'T12:00:00Z');
        eventTime = date.getTime();
        displayDate = date.toLocaleDateString();
      } else {
        // Time-based event: startDate is Unix timestamp
        const date = new Date(parseInt(event.startDate, 10) * 1000);
        eventTime = date.getTime();
        displayDate = date.toLocaleString();
      }

      // Add timing context
      const timeDiff = eventTime - now;
      const absTimeDiff = Math.abs(timeDiff);
      const daysDiff = Math.floor(absTimeDiff / (1000 * 60 * 60 * 24));
      const hoursDiff = Math.floor(absTimeDiff / (1000 * 60 * 60));
      const minutesDiff = Math.floor(absTimeDiff / (1000 * 60));

      let timeContext = '';
      
      if (timeDiff > 0) {
        // Future event
        if (daysDiff > 0) {
          timeContext = ` (in ${daysDiff} day${daysDiff > 1 ? 's' : ''})`;
        } else if (hoursDiff > 0) {
          timeContext = ` (in ${hoursDiff} hour${hoursDiff > 1 ? 's' : ''})`;
        } else if (minutesDiff > 0) {
          timeContext = ` (in ${minutesDiff} min)`;
        } else {
          timeContext = ' (starting soon!)';
        }
      } else {
        // Past event
        if (daysDiff > 0) {
          timeContext = ` (${daysDiff} day${daysDiff > 1 ? 's' : ''} ago)`;
        } else if (hoursDiff > 0) {
          timeContext = ` (${hoursDiff} hour${hoursDiff > 1 ? 's' : ''} ago)`;
        } else if (minutesDiff > 0) {
          timeContext = ` (${minutesDiff} min ago)`;
        } else {
          timeContext = ' (happening now!)';
        }
      }

      return displayDate + timeContext;
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getEventTypeIndicator = (kind: number) => {
    return kind === 31922 ? '📅' : '⏰';
  };

  const getEventDateStyle = (event: CalendarEvent) => {
    if (!event.startDate) return styles.eventDate;

    try {
      const now = Date.now();
      let eventTime: number;

      if (event.kind === 31922) {
        eventTime = new Date(event.startDate + 'T12:00:00Z').getTime();
      } else {
        eventTime = parseInt(event.startDate, 10) * 1000;
      }

      const timeDiff = eventTime - now;
      const absTimeDiff = Math.abs(timeDiff);
      const hoursDiff = absTimeDiff / (1000 * 60 * 60);

      if (timeDiff > 0) {
        // Future event
        if (hoursDiff <= 24) {
          return styles.eventDateSoon; // Within 24 hours - urgent
        } else {
          return styles.eventDateUpcoming; // Future event
        }
      } else {
        // Past event
        if (hoursDiff <= 2) {
          return styles.eventDateNow; // Happening now or just finished
        } else {
          return styles.eventDatePast; // Past event
        }
      }
    } catch (error) {
      return styles.eventDate;
    }
  };

  const getOrganizerName = (pubkey: string) => {
    const cached = profileService.getProfileCache().get(pubkey);
    return cached?.name || `${pubkey.substring(0, 8)}...`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#81b0ff" />
        <Text style={styles.loadingText}>Loading calendar events...</Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>📅 No calendar events found</Text>
        <Text style={styles.emptySubtext}>
          Events will appear here when they are created
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {getEventTypeIndicator(events[0]?.kind || 31922)} {title} (
          {events.length})
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {events.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.eventItem}
            onPress={() => onEventPress?.(event)}
            activeOpacity={0.7}
          >
            <View style={styles.eventContent}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventTypeIndicator}>
                  {getEventTypeIndicator(event.kind)}
                </Text>
                <Text style={styles.eventTitle} numberOfLines={2}>
                  {event.title || 'Untitled Event'}
                </Text>
              </View>

              <Text style={getEventDateStyle(event)}>
                {formatEventDate(event)}
              </Text>

              {event.location && (
                <Text style={styles.eventLocation} numberOfLines={1}>
                  📍 {event.location}
                </Text>
              )}

              {event.description && (
                <Text style={styles.eventDescription} numberOfLines={2}>
                  {event.description}
                </Text>
              )}

              {event.categories && event.categories.length > 0 && (
                <View style={styles.categoriesContainer}>
                  {event.categories.slice(0, 3).map((category, index) => (
                    <Text key={index} style={styles.categoryTag}>
                      #{category}
                    </Text>
                  ))}
                  {event.categories.length > 3 && (
                    <Text style={styles.categoryTag}>
                      +{event.categories.length - 3} more
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.eventFooter}>
                <Text style={styles.organizer}>
                  by {getOrganizerName(event.pubkey)}
                </Text>
                <Text style={styles.eventKind}>
                  {event.kind === 31922 ? 'All Day' : 'Timed'}
                </Text>
              </View>
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTypeIndicator: {
    fontSize: 18,
    marginRight: 8,
    marginTop: 2,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },
  eventDate: {
    color: '#81b0ff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  eventDateUpcoming: {
    color: '#81b0ff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  eventDateSoon: {
    color: '#ffb366',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDateNow: {
    color: '#66ff81',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventDatePast: {
    color: '#999',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 4,
  },
  eventLocation: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
  },
  eventDescription: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  categoryTag: {
    color: '#81b0ff',
    fontSize: 12,
    backgroundColor: '#2a2a3a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  organizer: {
    color: '#999',
    fontSize: 12,
  },
  eventKind: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
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