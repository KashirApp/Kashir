import React, { useState, useEffect, useMemo } from 'react';
import { SafeAreaView as SafeAreaViewContext } from 'react-native-safe-area-context';
import { NostrClientService } from '../services/NostrClient';
import { ProfileService } from '../services/ProfileService';
import type { CalendarEvent } from '../hooks/useEvents';
import type { Calendar } from '../hooks/useCalendars';
import { EventList } from './EventList';
import { styles } from '../App.styles';
import { Client, Filter, Kind } from 'kashir';
import type { EventInterface } from 'kashir';
import { tagsToArray } from '../services/NostrUtils';

interface CalendarDetailProps {
  route: {
    params: {
      calendar: Calendar;
      userNpub: string;
      isLoggedIn: boolean;
    };
  };
  navigation: any;
}

export function CalendarDetail({ route, navigation }: CalendarDetailProps) {
  const { calendar, userNpub, isLoggedIn } = route.params;
  const [client, setClient] = useState<Client | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  // Initialize services
  const clientService = useMemo(() => NostrClientService.getInstance(), []);
  const profileService = useMemo(() => new ProfileService(), []);

  // Monitor client readiness
  useEffect(() => {
    const currentClient = clientService.getClient();
    if (currentClient) {
      setClient(currentClient);
    }
  }, [clientService]);

  // Fetch the specific events referenced by this calendar
  useEffect(() => {
    const fetchCalendarEvents = async () => {
      if (
        !client ||
        !calendar.eventCoordinates ||
        calendar.eventCoordinates.length === 0
      ) {
        return;
      }

      setLoading(true);

      try {
        // Parse event coordinates and group by author to minimize requests
        const authorGroups = new Map<
          string,
          { kind: string; dTags: string[] }
        >();

        calendar.eventCoordinates.forEach((coord) => {
          const parts = coord.split(':');
          if (parts.length === 3) {
            const [kind, pubkey, dTag] = parts;
            const key = `${kind}:${pubkey}`;

            if (!authorGroups.has(key)) {
              authorGroups.set(key, { kind, dTags: [] });
            }
            authorGroups.get(key)!.dTags.push(dTag);
          }
        });

        // Fetch events using grouped filters
        const allEvents: EventInterface[] = [];

        for (const [key, { kind, dTags }] of authorGroups) {
          try {
            const [, pubkey] = key.split(':');
            const { PublicKey } = require('kashir');
            const authorPubkey = PublicKey.parse(pubkey);

            const filter = new Filter()
              .kinds([new Kind(parseInt(kind, 10))])
              .author(authorPubkey)
              .limit(BigInt(200));

            const responseEvents = await client.fetchEvents(filter, 10000);
            if (responseEvents) {
              const eventsArray = responseEvents.toVec();

              // Filter events by dTags we're looking for
              const filteredEvents = eventsArray.filter((event) => {
                const tags = tagsToArray(event.tags());
                const eventDTag = tags.find((tag) => tag[0] === 'd')?.[1];
                const eventId = event.id().toHex();

                // Check if the event matches either by d-tag or event ID
                const matchesByDTag = eventDTag && dTags.includes(eventDTag);
                const matchesById = dTags.includes(eventId);
                return matchesByDTag || matchesById;
              });

              allEvents.push(...filteredEvents);
            }
          } catch (error) {
            console.error(
              'Error fetching events for author group:',
              key,
              error
            );
          }
        }

        console.log(`CalendarDetail: Found ${allEvents.length} events`);

        // Process events and convert to CalendarEvent format
        const processedEvents: CalendarEvent[] = allEvents.map((event) => {
          const tags = tagsToArray(event.tags());
          const title =
            tags.find((tag) => tag[0] === 'title')?.[1] || 'Untitled Event';
          const description =
            event.content() ||
            tags.find((tag) => tag[0] === 'description')?.[1] ||
            '';
          const location = tags.find((tag) => tag[0] === 'location')?.[1] || '';
          const startDate = tags.find((tag) => tag[0] === 'start')?.[1] || '';
          const endDate = tags.find((tag) => tag[0] === 'end')?.[1] || '';
          const image = tags.find((tag) => tag[0] === 'image')?.[1] || '';
          const categories = tags
            .filter((tag) => tag[0] === 't')
            .map((tag) => tag[1]);

          return {
            id: event.id().toHex(),
            pubkey: event.author().toHex(),
            kind: Number(event.kind()),
            content: event.content(),
            tags: tags,
            created_at: Number(event.createdAt().asSecs()),
            title,
            description,
            location,
            startDate,
            endDate,
            image,
            categories,
          } as CalendarEvent;
        });

        console.log(
          `CalendarDetail: Processed ${processedEvents.length} events`
        );
        setCalendarEvents(processedEvents);
      } catch (error) {
        console.error('Error fetching calendar events:', error);
      } finally {
        setLoading(false);
      }
    };

    if (client) {
      fetchCalendarEvents();
    }
  }, [client, calendar.eventCoordinates]);

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
    });
  };

  return (
    <SafeAreaViewContext style={styles.container}>
      <EventList
        events={calendarEvents}
        loading={loading}
        profileService={profileService}
        title={`Events in ${calendar.title || 'Calendar'}`}
        onEventPress={handleEventPress}
        onMapPress={handleMapPress}
        showMyEventsOnly={true}
      />
    </SafeAreaViewContext>
  );
}
