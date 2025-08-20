import React, { useState, useEffect, useMemo } from 'react';
import { SafeAreaView as SafeAreaViewContext } from 'react-native-safe-area-context';
import { NostrClientService } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { useEvents } from '../hooks/useEvents';
import type { CalendarEvent } from '../hooks/useEvents';
import { Header } from './Header';
import { EventList } from './EventList';
import { CreateEventModal } from './CreateEventModal';
import { styles } from '../App.styles';
import { Client } from 'kashir';

interface MyEventsScreenProps {
  route: {
    params: {
      userNpub: string;
      isLoggedIn: boolean;
    };
  };
  navigation: any;
}

export function MyEventsScreen({ route, navigation }: MyEventsScreenProps) {
  const { userNpub, isLoggedIn } = route.params;
  const [isClientReady, setIsClientReady] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);

  // Initialize services
  const clientService = useMemo(() => NostrClientService.getInstance(), []);
  const profileService = useMemo(() => new ProfileService(), []);

  // Use events hook with My Events filter always enabled
  const {
    events,
    loading: eventsLoading,
    fetchEvents,
  } = useEvents(client, profileService);

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

  // Fetch user's events when client is ready
  useEffect(() => {
    if (isClientReady && userNpub) {
      fetchEvents(userNpub, true); // true indicates we want only user's events
    }
  }, [isClientReady, userNpub, fetchEvents]);

  const handleEventPress = (event: CalendarEvent) => {
    navigation.navigate('EventDetail', {
      event,
      userNpub,
      isLoggedIn,
    });
  };

  const handleMapPress = () => {
    navigation.navigate('EventMap', {
      userNpub,
      onEventSelect: handleEventPress,
      myEventsOnly: true, // Pass flag to map to show only user's events
    });
  };

  const handleEventEdit = (event: CalendarEvent) => {
    setEventToEdit(event);
    setIsEditModalVisible(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalVisible(false);
    setEventToEdit(null);
  };

  const handleEventUpdated = () => {
    // Refresh events list after updating an event
    if (isClientReady && userNpub) {
      fetchEvents(userNpub, true);
    }
    handleEditModalClose();
  };

  return (
    <SafeAreaViewContext style={styles.container}>
      <Header />

      <EventList
        events={events}
        loading={eventsLoading}
        profileService={profileService}
        title="My Events"
        onEventPress={handleEventPress}
        onMapPress={handleMapPress}
        showMyEventsOnly={true}
        onEventEdit={handleEventEdit}
        userNpub={userNpub}
      />

      <CreateEventModal
        visible={isEditModalVisible}
        onClose={handleEditModalClose}
        onEventCreated={handleEventUpdated}
        isLoggedIn={isLoggedIn}
        existingEvent={eventToEdit}
      />
    </SafeAreaViewContext>
  );
}
