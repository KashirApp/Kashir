import React, { useState, useEffect, useMemo } from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { SafeAreaView as SafeAreaViewContext } from 'react-native-safe-area-context';
import { NostrClientService } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { useEvents } from '../hooks/useEvents';
import { useCalendars } from '../hooks/useCalendars';
import type { CalendarEvent } from '../hooks/useEvents';
import type { Calendar } from '../hooks/useCalendars';
import { Header } from './Header';
import { EventList } from './EventList';
import { CalendarList } from './CalendarList';
import { CreateEventModal } from './CreateEventModal';
import { CreateCalendarModal } from './CreateCalendarModal';
import { styles } from '../App.styles';
import { Client } from 'kashir';

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
  const [isCreateCalendarModalVisible, setIsCreateCalendarModalVisible] =
    useState(false);
  const [currentView, setCurrentView] = useState<'events' | 'calendars'>(
    'events'
  );
  const clientService = useMemo(() => NostrClientService.getInstance(), []);
  const profileService = useMemo(() => new ProfileService(), []);

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

  // Initialize services
  useEffect(() => {
    if (isClientReady && !eventsLoading && !calendarsLoading) {
      if (currentView === 'events' && events.length === 0) {
        fetchEvents(userNpub);
      } else if (currentView === 'calendars' && calendars.length === 0) {
        fetchCalendars(userNpub);
      }
    }
  }, [
    isClientReady,
    currentView,
    events.length,
    calendars.length,
    eventsLoading,
    calendarsLoading,
    fetchEvents,
    fetchCalendars,
    userNpub,
  ]);

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

  const handleCreateCalendar = () => {
    setIsCreateCalendarModalVisible(true);
  };

  const handleCreate = () => {
    if (currentView === 'events') {
      handleCreateEvent();
    } else {
      handleCreateCalendar();
    }
  };

  const handleEventCreated = () => {
    // Refresh events list after creating a new event
    fetchEvents(userNpub);
  };

  const handleCalendarCreated = () => {
    // Refresh calendars list after creating a new calendar
    // Fetch all calendars (not filtered by user) for the general calendar view
    fetchCalendars();

    // Small delay to ensure the calendar is published to relays before refetching
    setTimeout(() => {
      fetchCalendars();
    }, 1500);
  };

  const handleNavigateToMyEvents = () => {
    navigation.navigate('MyEvents', {
      userNpub,
      isLoggedIn,
    });
  };

  const handleNavigateToMyCalendars = () => {
    navigation.navigate('MyCalendars', {
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
          calendars={calendars.filter(
            (calendar) =>
              calendar.eventCoordinates && calendar.eventCoordinates.length > 0
          )}
          loading={calendarsLoading}
          profileService={profileService}
          title="Calendars"
          onCalendarPress={handleCalendarPress}
          onMyCalendarsPress={
            isLoggedIn ? handleNavigateToMyCalendars : undefined
          }
          userNpub={userNpub}
          onEventsModePress={handleEventsModePress}
        />
      )}

      {/* Floating Action Button - only show when logged in */}
      {isLoggedIn && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleCreate}
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

      {/* Create Calendar Modal */}
      <CreateCalendarModal
        visible={isCreateCalendarModalVisible}
        onClose={() => setIsCreateCalendarModalVisible(false)}
        onCalendarCreated={handleCalendarCreated}
        isLoggedIn={isLoggedIn}
        userNpub={userNpub}
      />
    </SafeAreaViewContext>
  );
}
