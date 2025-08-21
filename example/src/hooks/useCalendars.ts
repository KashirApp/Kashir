import { useState, useCallback } from 'react';
import { Client, Filter, Kind } from 'kashir';
import type { EventInterface } from 'kashir';
import { ProfileService } from '../services/ProfileService';
import { tagsToArray } from '../services/NostrUtils';

export interface Calendar {
  id: string;
  pubkey: string;
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
  title?: string;
  description?: string;
  uuid?: string;
  eventCoordinates?: string[]; // List of calendar events this calendar contains
}

export function useCalendars(
  client: Client | null,
  profileService: ProfileService
) {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCalendars = useCallback(
    async (currentUserPubkey?: string, myCalendarsOnly: boolean = false) => {
      if (!client) {
        console.log('Client not available for calendars fetch');
        return;
      }

      setLoading(true);
      setCalendars([]);

      try {
        console.log('Fetching calendars (NIP-52 kind 31924)...');

        let calendarsFilter = new Filter()
          .kinds([new Kind(31924)]) // Calendar list event kind
          .limit(BigInt(50));

        // If filtering for my calendars only and we have a user pubkey, add author filter
        if (myCalendarsOnly && currentUserPubkey) {
          const { PublicKey } = require('kashir');
          try {
            const userPubkey = PublicKey.parse(currentUserPubkey);
            calendarsFilter = calendarsFilter.authors([userPubkey]);
          } catch (error) {
            console.error('Error parsing user pubkey for calendar filter:', error);
          }
        }

        const responseEvents = await client.fetchEvents(calendarsFilter, 15000);

        // Convert EventsInterface to array using toVec() method
        let calendarsArray: EventInterface[] = [];
        if (responseEvents) {
          calendarsArray = responseEvents.toVec();
        }
        console.log(`Found ${calendarsArray.length} raw calendar events`);

        const parsedCalendars = calendarsArray.map((event: EventInterface) => {
          const tags = tagsToArray(event.tags());
          
          // Extract calendar metadata from tags
          const titleTag = tags.find(tag => tag[0] === 'title');
          const dTag = tags.find(tag => tag[0] === 'd'); // UUID identifier
          
          // Extract event coordinates (a tags pointing to calendar events)
          const eventCoordinates = tags
            .filter(tag => tag[0] === 'a')
            .map(tag => tag[1]);

          return {
            id: event.id().toHex(),
            pubkey: event.author().toHex(),
            kind: Number(event.kind()),
            content: event.content(),
            tags,
            created_at: Number(event.createdAt().asSecs()),
            title: titleTag ? titleTag[1] : undefined,
            description: event.content() || undefined,
            uuid: dTag ? dTag[1] : undefined,
            eventCoordinates,
          } as Calendar;
        });

        console.log(`Parsed ${parsedCalendars.length} calendars`);
        setCalendars(parsedCalendars);

        // TODO: Fix profile loading for calendar creators
        // The ProfileService expects PublicKeyInterface objects, but we have hex strings
        // Need to find the correct method to convert hex to PublicKeyInterface

      } catch (error) {
        console.error('Error fetching calendars:', error);
      } finally {
        setLoading(false);
      }
    },
    [client, profileService]
  );

  return {
    calendars,
    loading,
    fetchCalendars,
  };
}