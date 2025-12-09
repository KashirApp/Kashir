import { useState, useCallback } from 'react';
import { Client, Filter, Kind, NostrPublicKey as PublicKey } from 'kashir';
import type { EventInterface } from 'kashir';
import { ProfileService } from '../services/ProfileService';
import { tagsToArray } from '../services/NostrUtils';

export interface CalendarEvent {
  id: string;
  pubkey: string;
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  title?: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  image?: string;
  categories?: string[];
  dTag?: string; // d tag for replaceable events
}

export function useEvents(
  client: Client | null,
  profileService: ProfileService
) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const fetchEvents = useCallback(
    async (currentUserPubkey?: string, myEventsOnly: boolean = false) => {
      if (!client) {
        return;
      }

      setLoading(true);
      setEvents([]);

      try {
        let eventsFilter = new Filter()
          .kinds([new Kind(31922), new Kind(31923)]) // NIP-52 calendar event kinds
          .limit(BigInt(50));

        // If filtering for my events only and we have a user pubkey, add author filter
        if (myEventsOnly && currentUserPubkey) {
          const authorPubkey = PublicKey.parse(currentUserPubkey);
          eventsFilter = eventsFilter.author(authorPubkey);
        }

        let responseEvents = await client.fetchEvents(eventsFilter, 15000);

        // Convert EventsInterface to array using toVec() method
        let eventsArray: EventInterface[] = [];
        if (responseEvents) {
          try {
            eventsArray = responseEvents.toVec();
          } catch (e) {
            console.error('Error converting events to array:', e);
            eventsArray = [];
          }
        }

        // Process events and extract calendar data
        const calendarEvents: CalendarEvent[] = eventsArray.map((event) => {
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
          const dTag = tags.find((tag) => tag[0] === 'd')?.[1] || '';
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
            dTag,
            categories,
          };
        });

        // Sort by proximity to current time (closest upcoming events first, then recent past events)
        calendarEvents.sort((a, b) => {
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

          const aTime = getEventTime(a);
          const bTime = getEventTime(b);

          // Calculate absolute difference from current time
          const aDiff = Math.abs(aTime - now);
          const bDiff = Math.abs(bTime - now);

          // If one is future and one is past, prioritize future events
          const aIsFuture = aTime > now;
          const bIsFuture = bTime > now;

          if (aIsFuture && !bIsFuture) return -1; // a is future, b is past
          if (!aIsFuture && bIsFuture) return 1; // a is past, b is future

          // If both are future or both are past, sort by proximity to current time
          return aDiff - bDiff;
        });

        setEvents(calendarEvents);

        // Fetch profiles for event organizers
        if (calendarEvents.length > 0) {
          setProfilesLoading(true);
          try {
            const uniquePubkeys = [
              ...new Set(calendarEvents.map((event) => event.pubkey)),
            ];
            const publicKeys = uniquePubkeys.map((pubkey) => {
              return PublicKey.parse(pubkey);
            });
            await profileService.fetchProfilesForPubkeys(client, publicKeys);
          } catch (error) {
            console.error('Error fetching event organizer profiles:', error);
          } finally {
            setProfilesLoading(false);
          }
        }
      } catch (error) {
        console.error('Error fetching calendar events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    },
    [client, profileService]
  );

  return {
    events,
    loading,
    profilesLoading,
    fetchEvents,
  };
}
