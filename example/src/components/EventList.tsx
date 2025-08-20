import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { ProfileService } from '../services/ProfileService';
import { LocationService } from '../services/LocationService';
import { EventLocationParser } from '../services/EventLocationParser';
import type { CalendarEvent } from '../hooks/useEvents';
import type { Coordinates } from '../services/LocationService';

type SortOption = 'time' | 'distance';

interface EventListProps {
  events: CalendarEvent[];
  loading: boolean;
  profileService: ProfileService;
  title?: string;
  onEventPress?: (event: CalendarEvent) => void;
  onMapPress?: () => void;
  showMyEventsOnly?: boolean;
  onMyEventsPress?: () => void;
  onEventEdit?: (event: CalendarEvent) => void; // Callback for editing events
  userNpub?: string; // Add userNpub to check permissions
}

export function EventList({
  events,
  loading,
  profileService,
  title = 'Calendar Events (by time)',
  onEventPress,
  onMapPress,
  showMyEventsOnly = false,
  onMyEventsPress,
  onEventEdit,
  userNpub,
}: EventListProps) {
  const [sortOption, setSortOption] = React.useState<SortOption>('time');
  const [userLocation, setUserLocation] = React.useState<Coordinates | null>(
    null
  );
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [sortedEvents, setSortedEvents] =
    React.useState<CalendarEvent[]>(events);
  const locationService = React.useMemo(
    () => LocationService.getInstance(),
    []
  );
  const formatEventDate = (event: CalendarEvent) => {
    if (!event.startDate) return 'Date TBD';

    try {
      let displayDate: string;

      if (event.kind === 31922) {
        // Date-based event: startDate is in YYYY-MM-DD format
        const date = new Date(event.startDate + 'T12:00:00Z');
        displayDate = date.toLocaleDateString();
      } else {
        // Time-based event: startDate is Unix timestamp
        const startDate = new Date(parseInt(event.startDate, 10) * 1000);

        // Format start time
        displayDate = startDate.toLocaleString();

        // Add end time if available
        if (event.endDate) {
          const endDate = new Date(parseInt(event.endDate, 10) * 1000);
          const startTime = startDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          const endTime = endDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          // Check if same day
          if (startDate.toDateString() === endDate.toDateString()) {
            displayDate = `${startDate.toLocaleDateString()} ${startTime} - ${endTime}`;
          } else {
            displayDate = `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`;
          }
        }
      }

      return displayDate;
    } catch {
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
    } catch {
      return styles.eventDate;
    }
  };

  const getOrganizerName = (pubkey: string) => {
    const cached = profileService.getProfileCache().get(pubkey);
    return cached?.name || `${pubkey.substring(0, 8)}...`;
  };

  // Sort events based on current sort option
  React.useEffect(() => {
    let sorted = [...events];
    const now = Date.now();

    const getEventTime = (event: CalendarEvent) => {
      if (!event.startDate) return 0;
      if (event.kind === 31922) {
        // Date-based event: treat as noon on that date
        return new Date(event.startDate + 'T12:00:00Z').getTime();
      } else {
        // Time-based event: Unix timestamp in seconds
        return parseInt(event.startDate, 10) * 1000;
      }
    };

    // Filter out past events - only show future events (unless showing My Events)
    if (!showMyEventsOnly) {
      sorted = sorted.filter((event) => {
        const eventTime = getEventTime(event);
        return eventTime > now; // Only future events
      });
    }

    if (sortOption === 'time') {
      if (showMyEventsOnly) {
        // For My Events, show all events sorted by time (future first, then past in reverse order)
        sorted.sort((a, b) => {
          const aTime = getEventTime(a);
          const bTime = getEventTime(b);

          const aIsFuture = aTime > now;
          const bIsFuture = bTime > now;

          if (aIsFuture && !bIsFuture) return -1; // a is future, b is past
          if (!aIsFuture && bIsFuture) return 1; // a is past, b is future

          if (aIsFuture && bIsFuture) {
            // Both future - sort chronologically (earliest first)
            return aTime - bTime;
          } else {
            // Both past - sort reverse chronologically (most recent first)
            return bTime - aTime;
          }
        });
      } else {
        // Sort future events by proximity to current time (closest upcoming first)
        sorted.sort((a, b) => {
          const aTime = getEventTime(a);
          const bTime = getEventTime(b);
          return aTime - bTime; // Chronological order for future events
        });
      }
    } else if (sortOption === 'distance' && userLocation) {
      // Distance sorting
      // First filter out events without location
      sorted = sorted.filter((event) => {
        const coords = EventLocationParser.parseEventLocation(event);
        return coords !== null;
      });

      // If not showing My Events, also filter out past events for distance sorting
      if (!showMyEventsOnly) {
        sorted = sorted.filter((event) => {
          const eventTime = getEventTime(event);
          return eventTime > now; // Only future events for regular distance sorting
        });
      }

      sorted.sort((a, b) => {
        const coordsA = EventLocationParser.parseEventLocation(a)!; // We know it exists from filter
        const coordsB = EventLocationParser.parseEventLocation(b)!; // We know it exists from filter

        const distanceA = locationService.calculateDistance(
          userLocation,
          coordsA
        );
        const distanceB = locationService.calculateDistance(
          userLocation,
          coordsB
        );

        return distanceA - distanceB;
      });
    }

    setSortedEvents(sorted);
  }, [events, sortOption, userLocation, locationService, showMyEventsOnly]);

  const handleSortByDistance = async () => {
    if (sortOption === 'distance') {
      setSortOption('time');
      return;
    }

    setLocationLoading(true);
    try {
      const hasPermission = await locationService.requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Location permission is needed to sort events by distance.'
        );
        setLocationLoading(false);
        return;
      }

      const location = await locationService.getCurrentLocation();
      setUserLocation(location);
      setSortOption('distance');
    } catch {
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please check your location settings.'
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const getDistanceText = (event: CalendarEvent): string | null => {
    if (sortOption !== 'distance' || !userLocation) return null;

    const coords = EventLocationParser.parseEventLocation(event);
    if (!coords) return null;

    const distance = locationService.calculateDistance(userLocation, coords);
    return locationService.formatDistance(distance);
  };

  // Helper function to check if user can edit this event
  const canEditEvent = (event: CalendarEvent): boolean => {
    if (!showMyEventsOnly || !userNpub || !onEventEdit) return false;

    // Convert userNpub to hex for comparison
    try {
      const { PublicKey } = require('kashir');
      const userPubkey = PublicKey.parse(userNpub);
      return event.pubkey === userPubkey.toHex();
    } catch {
      return false;
    }
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
        <View style={styles.leftButtons}>
          {onMyEventsPress && (
            <TouchableOpacity
              style={styles.myEventsButton}
              onPress={onMyEventsPress}
              activeOpacity={0.7}
            >
              <Text style={styles.myEventsButtonText}>My Events</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerText}>
          {getEventTypeIndicator(events[0]?.kind || 31922)}{' '}
          {sortOption === 'distance' ? 'Events by Distance' : title} (
          {sortedEvents.length})
        </Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[
              styles.sortButton,
              sortOption === 'distance' && styles.sortButtonActive,
              locationLoading && styles.sortButtonLoading,
            ]}
            onPress={handleSortByDistance}
            disabled={locationLoading}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.sortButtonText,
                sortOption === 'distance' && styles.sortButtonTextActive,
              ]}
            >
              {locationLoading
                ? '📍⏳'
                : sortOption === 'distance'
                  ? '📍✓'
                  : '📍'}
            </Text>
          </TouchableOpacity>
          {onMapPress &&
            events.some(
              (event) =>
                event.location ||
                (event.tags && event.tags.some((tag) => tag[0] === 'g'))
            ) && (
              <TouchableOpacity
                style={styles.mapButton}
                onPress={onMapPress}
                activeOpacity={0.7}
              >
                <Text style={styles.mapButtonText}>🗺️ Map</Text>
              </TouchableOpacity>
            )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {sortedEvents.map((event) => (
          <TouchableOpacity
            key={event.id}
            style={styles.eventItem}
            onPress={() => onEventPress?.(event)}
            activeOpacity={0.7}
          >
            <View style={styles.eventRow}>
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
                  <View style={styles.locationContainer}>
                    <Text style={styles.eventLocation} numberOfLines={1}>
                      📍 {event.location}
                    </Text>
                    {getDistanceText(event) && (
                      <Text style={styles.distanceText}>
                        {getDistanceText(event)}
                      </Text>
                    )}
                  </View>
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
                  {event.kind === 31922 && (
                    <Text style={styles.eventKind}>All Day</Text>
                  )}
                </View>
              </View>

              {canEditEvent(event) && (
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => onEventEdit?.(event)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editButtonText}>⚙️</Text>
                </TouchableOpacity>
              )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  myEventsButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  myEventsButtonActive: {
    backgroundColor: '#ff6b66',
  },
  myEventsButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  myEventsButtonTextActive: {
    color: '#000',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortButton: {
    backgroundColor: '#333',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  sortButtonActive: {
    backgroundColor: '#66ff81',
  },
  sortButtonLoading: {
    backgroundColor: '#555',
  },
  sortButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sortButtonTextActive: {
    color: '#000',
  },
  headerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  mapButton: {
    backgroundColor: '#81b0ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 14,
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
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eventContent: {
    flex: 1,
    paddingRight: 12,
  },
  editButton: {
    padding: 8,
    marginTop: 4,
  },
  editButtonText: {
    fontSize: 18,
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
  locationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventLocation: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
  },
  distanceText: {
    color: '#66ff81',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
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
