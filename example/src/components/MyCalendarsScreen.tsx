import React, { useState, useEffect, useMemo } from 'react';
import { SafeAreaView as SafeAreaViewContext } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NostrClientService } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import { useCalendars } from '../hooks/useCalendars';
import type { Calendar } from '../hooks/useCalendars';
import { Header } from './Header';
import { CalendarList } from './CalendarList';
import { CreateCalendarModal } from './CreateCalendarModal';
import { styles } from '../App.styles';
import { Client } from 'kashir';

interface MyCalendarsScreenProps {
  route: {
    params: {
      userNpub: string;
      isLoggedIn: boolean;
    };
  };
  navigation: any;
}

export function MyCalendarsScreen({
  route,
  navigation,
}: MyCalendarsScreenProps) {
  const { userNpub, isLoggedIn } = route.params;
  const [isClientReady, setIsClientReady] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [calendarToEdit, setCalendarToEdit] = useState<Calendar | null>(null);

  // Initialize services
  const clientService = useMemo(() => NostrClientService.getInstance(), []);
  const profileService = useMemo(() => new ProfileService(), []);

  // Use calendars hook with My Calendars filter always enabled
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

  // Refresh calendars when screen comes into focus (like iOS app)
  useFocusEffect(
    React.useCallback(() => {
      if (isClientReady && userNpub) {
        fetchCalendars(userNpub, true);
      }
    }, [isClientReady, userNpub, fetchCalendars])
  );

  // Fetch user's calendars when client is ready
  useEffect(() => {
    if (isClientReady && userNpub) {
      fetchCalendars(userNpub, true); // true indicates we want only user's calendars
    }
  }, [isClientReady, userNpub, fetchCalendars]);

  const handleCalendarPress = (calendar: Calendar) => {
    navigation.navigate('CalendarDetail', {
      calendar,
      userNpub,
      isLoggedIn,
    });
  };

  const handleEditCalendar = (calendar: Calendar) => {
    setCalendarToEdit(calendar);
    setIsEditModalVisible(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalVisible(false);
    setCalendarToEdit(null);
  };

  const handleCalendarUpdated = () => {
    // Refresh calendars list after updating a calendar
    if (isClientReady && userNpub) {
      fetchCalendars(userNpub, true);
    }
    handleEditModalClose();
  };

  return (
    <SafeAreaViewContext style={styles.container}>
      <Header />

      <CalendarList
        calendars={calendars}
        loading={calendarsLoading}
        profileService={profileService}
        title="My Calendars"
        onCalendarPress={handleCalendarPress}
        onEditCalendar={handleEditCalendar}
        showMyCalendarsOnly={true}
        userNpub={userNpub}
      />

      <CreateCalendarModal
        visible={isEditModalVisible}
        onClose={handleEditModalClose}
        onCalendarCreated={handleCalendarUpdated}
        isLoggedIn={isLoggedIn}
        userNpub={userNpub}
        existingCalendar={calendarToEdit}
      />
    </SafeAreaViewContext>
  );
}
