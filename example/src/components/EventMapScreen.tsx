import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Dimensions,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import type { CalendarEvent } from '../hooks/useEvents';
import { useEvents } from '../hooks/useEvents';
import { ProfileService } from '../services/ProfileService';
import { EventLocationParser } from '../services/EventLocationParser';
import { NostrClientService } from '../services/NostrClient';
import type { NostrStackParamList } from './NostrNavigator';

type EventMapScreenProps = NativeStackScreenProps<
  NostrStackParamList,
  'EventMap'
>;

const { width, height } = Dimensions.get('window');

interface EventMarker {
  event: CalendarEvent;
  coordinate: {
    latitude: number;
    longitude: number;
  };
}

export function EventMapScreen({ route, navigation }: EventMapScreenProps) {
  const { userNpub, onEventSelect } = route.params;

  // Initialize services
  const clientService = useMemo(() => NostrClientService.getInstance(), []);
  const profileService = useMemo(() => new ProfileService(), []);
  const [client, setClient] = useState(clientService.getClient());

  const {
    events,
    loading: eventsLoading,
    fetchEvents,
  } = useEvents(client, profileService);
  const [eventMarkers, setEventMarkers] = useState<EventMarker[]>([]);
  const [processingEvents, setProcessingEvents] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Initialize client on mount
  useEffect(() => {
    const initClient = async () => {
      try {
        const newClient = await clientService.initialize();
        setClient(newClient);
      } catch (error) {
        console.error('Error initializing client for EventMapScreen:', error);
      }
    };

    if (!client) {
      initClient();
    }
  }, [clientService, client]);

  // Fetch events when client is ready
  useEffect(() => {
    if (client) {
      fetchEvents();
    }
  }, [client, fetchEvents]);

  useEffect(() => {
    const processEvents = async () => {
      setProcessingEvents(true);

      console.log(
        'EventMapScreen: Processing events, total count:',
        events.length
      );

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

      // Filter out past events - only show future events
      const futureEvents = events.filter((event) => {
        const eventTime = getEventTime(event);
        return eventTime > now; // Only future events
      });

      console.log(
        'EventMapScreen: Future events count:',
        futureEvents.length,
        'out of',
        events.length
      );

      const markers: EventMarker[] = [];

      for (const event of futureEvents) {
        console.log(
          'EventMapScreen: Checking event:',
          event.title,
          'has location:',
          !!event.location,
          'has g tag:',
          !!(event.tags && event.tags.some((tag) => tag[0] === 'g'))
        );

        if (
          event.location ||
          (event.tags && event.tags.some((tag) => tag[0] === 'g'))
        ) {
          const coords = EventLocationParser.parseEventLocation(event);
          console.log('EventMapScreen: Parsed coordinates:', coords);

          if (coords) {
            markers.push({
              event,
              coordinate: coords,
            });
          }
        }
      }

      console.log('EventMapScreen: Total markers created:', markers.length);
      setEventMarkers(markers);
      setProcessingEvents(false);
    };

    if (events.length > 0) {
      processEvents();
    } else if (!eventsLoading) {
      // Events loaded but no events found
      setEventMarkers([]);
      setProcessingEvents(false);
    }
  }, [events, eventsLoading]);

  const formatEventDate = (event: CalendarEvent) => {
    if (!event.startDate) return 'Date TBD';

    try {
      let eventTime: number;
      let displayDate: string;

      if (event.kind === 31922) {
        const date = new Date(event.startDate + 'T12:00:00Z');
        eventTime = date.getTime();
        displayDate = date.toLocaleDateString();
      } else {
        const date = new Date(parseInt(event.startDate, 10) * 1000);
        eventTime = date.getTime();
        displayDate = date.toLocaleString();
      }

      return displayDate;
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getOrganizerName = (pubkey: string) => {
    const cached = profileService.getProfileCache().get(pubkey);
    return cached?.name || `${pubkey.substring(0, 8)}...`;
  };

  const isLoading = eventsLoading || processingEvents;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {eventsLoading
              ? 'Loading events...'
              : 'Processing event locations...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (eventMarkers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>🗺️ No mappable events found</Text>
          <Text style={styles.emptySubtext}>
            Events need location coordinates (latitude, longitude) to appear on
            the map
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        showsUserLocation={true}
        showsMyLocationButton={true}
        onMapReady={() => {
          setMapReady(true);
        }}
      >
        {eventMarkers.map((marker, index) => (
          <Marker
            key={`${marker.event.id}-${index}`}
            coordinate={marker.coordinate}
            title={marker.event.title || 'Untitled Event'}
            description={marker.event.location}
          >
            <Callout
              onPress={() => onEventSelect?.(marker.event)}
              style={styles.callout}
            >
              <View style={styles.calloutContent}>
                <Text style={styles.calloutTitle} numberOfLines={2}>
                  {marker.event.title || 'Untitled Event'}
                </Text>
                <Text style={styles.calloutDate}>
                  {formatEventDate(marker.event)}
                </Text>
                <Text style={styles.calloutLocation} numberOfLines={2}>
                  📍 {marker.event.location}
                </Text>
                <Text style={styles.calloutOrganizer}>
                  by {getOrganizerName(marker.event.pubkey)}
                </Text>
                {marker.event.description && (
                  <Text style={styles.calloutDescription} numberOfLines={3}>
                    {marker.event.description}
                  </Text>
                )}
                <Text style={styles.calloutTapHint}>Tap for details</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  map: {
    flex: 1,
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
    lineHeight: 20,
  },
  callout: {
    width: width * 0.7,
    maxWidth: 280,
  },
  calloutContent: {
    padding: 8,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  calloutDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  calloutLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  calloutOrganizer: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  calloutDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    lineHeight: 16,
  },
  calloutTapHint: {
    fontSize: 11,
    color: '#81b0ff',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
});
