import React, { useState, useEffect, useMemo } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { SafeAreaView as SafeAreaViewContext } from 'react-native-safe-area-context';
import { NostrClientService, LoginType } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { SecureStorageService } from '../services/SecureStorageService';
import { useEvents } from '../hooks/useEvents';
import { useCalendars } from '../hooks/useCalendars';
import type { CalendarEvent } from '../hooks/useEvents';
import type { Calendar } from '../hooks/useCalendars';
import { Header } from './Header';
import { EventList } from './EventList';
import { CalendarList } from './CalendarList';
import { CreateEventModal } from './CreateEventModal';
import { styles } from '../App.styles';
import { Client, Keys, SecretKey } from 'kashir';

interface EventsScreenProps {
  isLoggedIn: boolean;
  userNpub: string;
  navigation: any; // Navigation prop from parent
}

export function EventsScreen({
  isLoggedIn,
  userNpub,
  navigation,
}: EventsScreenProps) {
  const [isClientReady, setIsClientReady] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [isCreateEventModalVisible, setIsCreateEventModalVisible] =
    useState(false);
  const [currentView, setCurrentView] = useState<'events' | 'calendars'>('events');
  const [_userKeys, setUserKeys] = useState<Keys | null>(null);

  // Initialize services
  const clientService = useMemo(() => NostrClientService.getInstance(), []);
  const profileService = useMemo(() => new ProfileService(), []);
  const session = clientService.getCurrentSession();

  // Use events and calendars hooks
  const {
    events,
    loading: eventsLoading,
    fetchEvents,
  } = useEvents(client, profileService);

  const {
    calendars,
    loading: calendarsLoading,
    fetchCalendars,
  } = useCalendars(client, profileService);

  // Monitor client readiness
  useEffect(() => {
    const checkClientReady = () => {
      const currentClient = clientService.getClient();
      const ready = clientService.isReady();

      if (ready && currentClient) {
        setClient(currentClient);
        setIsClientReady(true);
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkClientReady()) {
      return () => {};
    }

    // Set up polling for readiness
    const interval = setInterval(() => {
      if (checkClientReady()) {
        clearInterval(interval);
      }
    }, 100);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [clientService]);

  // Load user keys for signing
  useEffect(() => {
    const loadKeys = async () => {
      try {
        const privateKey = await SecureStorageService.getNostrPrivateKey();
        if (privateKey) {
          const secretKey = SecretKey.parse(privateKey);
          const keys = new Keys(secretKey);
          setUserKeys(keys);
        }
      } catch (error) {
        console.error('Failed to load user keys:', error);
      }
    };

    if (isLoggedIn && session?.type === LoginType.PrivateKey) {
      loadKeys();
    }
  }, [isLoggedIn, session?.type]);

  // Fetch events and calendars when client is ready
  useEffect(() => {
    if (isClientReady && !eventsLoading && !calendarsLoading) {
      if (currentView === 'events' && events.length === 0) {
        fetchEvents(userNpub);
      } else if (currentView === 'calendars' && calendars.length === 0) {
        fetchCalendars(userNpub);
      }
    }
  }, [isClientReady, currentView, events.length, calendars.length, eventsLoading, calendarsLoading, fetchEvents, fetchCalendars, userNpub]);

  const handleEventPress = (event: CalendarEvent) => {
    navigation.navigate('EventDetail', {
      event,
      userNpub,
      isLoggedIn,
    });
  };

  const handleCalendarPress = (calendar: Calendar) => {
    navigation.navigate('CalendarDetail', {
      calendar,
      userNpub,
      isLoggedIn,
    });
  };

  const handleMapPress = () => {
    navigation.navigate('EventMap', {
      userNpub,
      onEventSelect: handleEventPress,
    });
  };

  const handleCalendarModePress = () => {
    setCurrentView('calendars');
    if (calendars.length === 0 && !calendarsLoading) {
      fetchCalendars(userNpub);
    }
  };

  const handleEventsModePress = () => {
    setCurrentView('events');
    if (events.length === 0 && !eventsLoading) {
      fetchEvents(userNpub);
    }
  };

  const handleCreateEvent = () => {
    setIsCreateEventModalVisible(true);
  };

  const handleEventCreated = () => {
    // Refresh events list after creating a new event
    fetchEvents(userNpub);
  };

  const handleNavigateToMyEvents = () => {
    navigation.navigate('MyEvents', {
      userNpub,
      isLoggedIn,
    });
  };

  return (
    <SafeAreaViewContext style={styles.container}>
      <Header />

      {currentView === 'events' ? (
        <EventList
          events={events}
          loading={eventsLoading}
          profileService={profileService}
          title="Events"
          onEventPress={handleEventPress}
          onMapPress={handleMapPress}
          onMyEventsPress={isLoggedIn ? handleNavigateToMyEvents : undefined}
          onCalendarModePress={handleCalendarModePress}
        />
      ) : (
        <CalendarList
          calendars={calendars.filter(calendar => 
            calendar.eventCoordinates && calendar.eventCoordinates.length > 0
          )}
          loading={calendarsLoading}
          profileService={profileService}
          title="Calendars"
          onCalendarPress={handleCalendarPress}
          onEventsModePress={handleEventsModePress}
        />
      )}

      {/* Floating Action Button - only show when logged in */}
      {isLoggedIn && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleCreateEvent}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Create Event Modal */}
      <CreateEventModal
        visible={isCreateEventModalVisible}
        onClose={() => setIsCreateEventModalVisible(false)}
        onEventCreated={handleEventCreated}
        isLoggedIn={isLoggedIn}
      />
    </SafeAreaViewContext>
  );
}
