import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import * as geohash from 'ngeohash';
import type { CalendarEvent } from '../hooks/useEvents';
import { ProfileService } from '../services/ProfileService';

interface EventMapScreenProps {
  events: CalendarEvent[];
  profileService: ProfileService;
  onBack: () => void;
  onEventPress?: (event: CalendarEvent) => void;
}

const { width, height } = Dimensions.get('window');

interface EventMarker {
  event: CalendarEvent;
  coordinate: {
    latitude: number;
    longitude: number;
  };
}

export function EventMapScreen({
  events,
  profileService,
  onBack,
  onEventPress,
}: EventMapScreenProps) {
  const [eventMarkers, setEventMarkers] = useState<EventMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<MapView>(null);

  const parseLocationToCoordinates = (event: CalendarEvent): { latitude: number; longitude: number } | null => {
    if (event.tags) {
      const geohashTag = event.tags.find(tag => tag[0] === 'g');
      if (geohashTag && geohashTag[1]) {
        try {
          const decoded = geohash.decode(geohashTag[1]);
          
          if (decoded.latitude >= -90 && decoded.latitude <= 90 && 
              decoded.longitude >= -180 && decoded.longitude <= 180 &&
              !isNaN(decoded.latitude) && !isNaN(decoded.longitude)) {
            return {
              latitude: decoded.latitude,
              longitude: decoded.longitude,
            };
          }
        } catch (error) {
          // Silently handle geohash decode errors
        }
      }
    }

    const location = event.location;
    if (!location) return null;

    const coordRegex = /(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/;
    const match = location.match(coordRegex);
    
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }

    const geoUriMatch = location.match(/geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/i);
    if (geoUriMatch) {
      const lat = parseFloat(geoUriMatch[1]);
      const lng = parseFloat(geoUriMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }

    const parenMatch = location.match(/\((-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\)/);
    if (parenMatch) {
      const lat = parseFloat(parenMatch[1]);
      const lng = parseFloat(parenMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }

    return null;
  };

  useEffect(() => {
    const processEvents = async () => {
      setLoading(true);
      
      const markers: EventMarker[] = [];
      
      for (const event of events) {
        if (event.location || (event.tags && event.tags.some(tag => tag[0] === 'g'))) {
          const coords = parseLocationToCoordinates(event);
          if (coords) {
            markers.push({
              event,
              coordinate: coords,
            });
          }
        }
      }
      
      setEventMarkers(markers);
      setLoading(false);
    };

    processEvents();
  }, [events]);

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

  const focusOnMarkers = () => {
    if (eventMarkers.length > 0 && mapRef.current) {
      const coordinates = eventMarkers.map(marker => marker.coordinate);
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      });
    }
  };

  useEffect(() => {
    if (eventMarkers.length > 0 && mapReady) {
      const timer = setTimeout(() => {
        focusOnMarkers();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [eventMarkers, mapReady]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event Map</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Processing event locations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (eventMarkers.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>  
          <Text style={styles.headerTitle}>Event Map</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>🗺️ No mappable events found</Text>
          <Text style={styles.emptySubtext}>
            Events need location coordinates (latitude, longitude) to appear on the map
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Map ({eventMarkers.length} events)</Text>
        <TouchableOpacity onPress={focusOnMarkers} style={styles.focusButton}>
          <Text style={styles.focusButtonText}>Focus</Text>
        </TouchableOpacity>
      </View>

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
              onPress={() => onEventPress?.(marker.event)}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#81b0ff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  focusButton: {
    backgroundColor: '#81b0ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  focusButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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