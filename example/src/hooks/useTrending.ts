import { useState, useCallback, useMemo } from 'react';
import type { EventInterface, Client, Keys, PublicKey } from 'kashir';
import { DVMService } from '../services/DVMService';
import { ProfileService } from '../services/ProfileService';

interface UseTrendingResult {
  trendingPosts: EventInterface[];
  trendingEventIds: string[];
  trendingLoading: boolean;
  profilesLoading: boolean;
  fetchTrendingPosts: (keys: Keys | null) => Promise<void>;
}

export function useTrending(
  client: Client | null,
  profileService: ProfileService
): UseTrendingResult {
  const [trendingPosts, setTrendingPosts] = useState<EventInterface[]>([]);
  const [trendingEventIds, setTrendingEventIds] = useState<string[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const dvmService = useMemo(() => new DVMService(), []);

  const fetchTrendingPosts = useCallback(
    async (_keys: Keys | null) => {
      if (!client) {
        console.log('Client not available for trending posts');
        return;
      }

      setTrendingLoading(true);
      try {
        console.log('Fetching trending posts via DVM...');

        // Note: Current implementation just reads existing DVM responses,
        // doesn't publish new requests, so no signing required
        // Request trending content from DVM (reads existing responses)
        const dvmResponse = await dvmService.requestTrendingContent(client);

        if (dvmResponse && dvmResponse.eventIds.length > 0) {
          // Store the event IDs first
          setTrendingEventIds(dvmResponse.eventIds);

          // Fetch the actual events
          const events = await dvmService.fetchEventsByIds(
            client,
            dvmResponse.eventIds
          );

          if (events.length > 0) {
            // Keep DVM trending order (don't sort by time)
            setTrendingPosts(events);

            // Fetch profiles in background - don't block the UI
            setProfilesLoading(true);
            const uniqueAuthors = new Set<string>();
            events.forEach((event) => {
              uniqueAuthors.add(event.author().toHex());
            });

            const authorPubkeys = Array.from(uniqueAuthors)
              .map((hex) => {
                try {
                  return events
                    .find((e) => e.author().toHex() === hex)
                    ?.author();
                } catch {
                  return null;
                }
              })
              .filter((pk) => pk !== null && pk !== undefined) as PublicKey[];

            // Fetch profiles in background without affecting main loading state
            if (authorPubkeys.length > 0) {
              profileService
                .fetchProfilesForPubkeys(client, authorPubkeys)
                .then(() => {
                  setProfilesLoading(false);
                })
                .catch((_err) => {
                  setProfilesLoading(false);
                });
            } else {
              setProfilesLoading(false);
            }
          } else {
            setTrendingPosts([]);
          }
        } else {
          setTrendingPosts([]);
          setTrendingEventIds([]);
        }
      } catch (error) {
        console.error('Error fetching trending posts:', error);
        setTrendingPosts([]);
        setTrendingEventIds([]);
      } finally {
        setTrendingLoading(false);
      }
    },
    [client, dvmService, profileService]
  );

  return {
    trendingPosts,
    trendingEventIds,
    trendingLoading,
    profilesLoading,
    fetchTrendingPosts,
  };
}
