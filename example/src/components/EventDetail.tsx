import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ProfileService } from '../services/ProfileService';
import type { CalendarEvent } from '../hooks/useEvents';
import type { NostrStackParamList } from './NostrNavigator';

type EventDetailScreenProps = NativeStackScreenProps<
  NostrStackParamList,
  'EventDetail'
>;

interface EventDetailProps extends EventDetailScreenProps {
  onRSVP?: (status: 'accepted' | 'declined' | 'tentative') => void;
}

export function EventDetail({ route, navigation, onRSVP }: EventDetailProps) {
  const { event, userNpub } = route.params;
  const profileService = useMemo(() => new ProfileService(), []);
  const [selectedRSVPStatus, setSelectedRSVPStatus] = useState<
    'accepted' | 'declined' | 'tentative'
  >('accepted');
  const [isSubmittingRSVP, setIsSubmittingRSVP] = useState(false);

  const formatEventDate = (event: CalendarEvent) => {
    if (!event.startDate) return 'Date TBD';

    try {
      if (event.kind === 31922) {
        // Date-based event: startDate is in YYYY-MM-DD format
        const date = new Date(event.startDate + 'T12:00:00Z');
        return date.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } else {
        // Time-based event: startDate is Unix timestamp
        const startDate = new Date(parseInt(event.startDate, 10) * 1000);

        if (event.endDate) {
          const endDate = new Date(parseInt(event.endDate, 10) * 1000);

          // Check if same day
          if (startDate.toDateString() === endDate.toDateString()) {
            return `${startDate.toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })} from ${startDate.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })} to ${endDate.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}`;
          } else {
            return `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`;
          }
        }

        return startDate.toLocaleString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getEventTypeDisplay = (kind: number) => {
    return kind === 31922 ? 'All Day Event' : 'Timed Event';
  };

  const getOrganizerName = (pubkey: string) => {
    const cached = profileService.getProfileCache().get(pubkey);
    return cached?.name || `${pubkey.substring(0, 8)}...`;
  };

  const handleLocationPress = () => {
    if (event.location) {
      const encodedLocation = encodeURIComponent(event.location);
      const url = `https://maps.google.com/?q=${encodedLocation}`;
      Linking.openURL(url).catch(() => {
        Alert.alert('Error', 'Could not open location in maps');
      });
    }
  };

  const handleRSVPSubmit = async () => {
    if (!onRSVP) return;

    setIsSubmittingRSVP(true);
    try {
      await onRSVP(selectedRSVPStatus);
      Alert.alert('Success', `RSVP submitted as ${selectedRSVPStatus}!`);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit RSVP');
    } finally {
      setIsSubmittingRSVP(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return '#66ff81';
      case 'tentative':
        return '#ffb366';
      case 'declined':
        return '#ff6666';
      default:
        return '#81b0ff';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted':
        return '✅ Going';
      case 'tentative':
        return '❓ Maybe';
      case 'declined':
        return "❌ Can't Go";
      default:
        return status;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Event Title */}
        <View style={styles.section}>
          <Text style={styles.eventTitle}>
            {event.title || 'Untitled Event'}
          </Text>
          <Text style={styles.eventType}>
            {getEventTypeDisplay(event.kind)}
          </Text>
        </View>

        {/* Event Date & Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📅 Date & Time</Text>
          <Text style={styles.eventDate}>{formatEventDate(event)}</Text>
        </View>

        {/* Location */}
        {event.location && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Location</Text>
            <TouchableOpacity onPress={handleLocationPress} activeOpacity={0.7}>
              <Text style={styles.eventLocation}>{event.location}</Text>
              <Text style={styles.locationHint}>Tap to open in maps</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Description */}
        {event.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Description</Text>
            <Text style={styles.eventDescription}>{event.description}</Text>
          </View>
        )}

        {/* Categories */}
        {event.categories && event.categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏷️ Categories</Text>
            <View style={styles.categoriesContainer}>
              {event.categories.map((category, index) => (
                <Text key={index} style={styles.categoryTag}>
                  #{category}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Organizer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Organizer</Text>
          <Text style={styles.organizer}>{getOrganizerName(event.pubkey)}</Text>
          <Text style={styles.organizerPubkey}>{event.pubkey}</Text>
        </View>

        {/* RSVP Section */}
        {onRSVP && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎉 RSVP</Text>
            <Text style={styles.rsvpLabel}>Will you attend this event?</Text>

            <View style={styles.rsvpOptions}>
              {['accepted', 'tentative', 'declined'].map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.rsvpOption,
                    selectedRSVPStatus === status && styles.rsvpOptionSelected,
                    { borderColor: getStatusColor(status) },
                  ]}
                  onPress={() => setSelectedRSVPStatus(status as any)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.rsvpOptionText,
                      selectedRSVPStatus === status && {
                        color: getStatusColor(status),
                      },
                    ]}
                  >
                    {getStatusLabel(status)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.rsvpSubmitButton,
                { backgroundColor: getStatusColor(selectedRSVPStatus) },
              ]}
              onPress={handleRSVPSubmit}
              disabled={isSubmittingRSVP}
              activeOpacity={0.7}
            >
              {isSubmittingRSVP ? (
                <View style={styles.rsvpSubmitLoading}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.rsvpSubmitButtonText}>Submitting...</Text>
                </View>
              ) : (
                <Text style={styles.rsvpSubmitButtonText}>Submit RSVP</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Event Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ Event Info</Text>
          <Text style={styles.metadata}>Event ID: {event.id}</Text>
          <Text style={styles.metadata}>Event Kind: {event.kind}</Text>
          <Text style={styles.metadata}>
            Created: {new Date(event.created_at * 1000).toLocaleString()}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
    marginBottom: 4,
  },
  eventType: {
    color: '#81b0ff',
    fontSize: 14,
    fontWeight: '500',
  },
  eventDate: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  eventLocation: {
    color: '#81b0ff',
    fontSize: 16,
    lineHeight: 24,
    textDecorationLine: 'underline',
  },
  locationHint: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  eventDescription: {
    color: '#ccc',
    fontSize: 16,
    lineHeight: 24,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryTag: {
    color: '#81b0ff',
    fontSize: 14,
    backgroundColor: '#2a2a3a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  organizer: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  organizerPubkey: {
    color: '#999',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  rsvpLabel: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 16,
  },
  rsvpOptions: {
    marginBottom: 20,
  },
  rsvpOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
  },
  rsvpOptionSelected: {
    backgroundColor: '#333',
  },
  rsvpOptionText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  rsvpSubmitButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  rsvpSubmitLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rsvpSubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  metadata: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});
