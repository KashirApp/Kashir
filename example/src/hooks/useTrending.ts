import { useState, useCallback } from 'react';
import type { EventInterface, Client, Keys, PublicKey } from '../../../src';
import { DVMService } from '../services/DVMService';
import { ProfileService } from '../services/ProfileService';

interface UseTrendingResult {
  trendingPosts: EventInterface[];
  trendingEventIds: string[];
  trendingLoading: boolean;
  profilesLoading: boolean;
  fetchTrendingPosts: (keys: Keys) => Promise<void>;
}

export function useTrending(
  client: Client | null,
  profileService: ProfileService
): UseTrendingResult {
  const [trendingPosts, setTrendingPosts] = useState<EventInterface[]>([]);
  const [trendingEventIds, setTrendingEventIds] = useState<string[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const dvmService = new DVMService();

  const fetchTrendingPosts = useCallback(
    async (keys: Keys) => {
      if (!client || !keys) {
        console.log('Client or keys not available for trending posts');
        return;
      }

      setTrendingLoading(true);
      try {
        console.log('Fetching trending posts via DVM...');

        // Request trending content from DVM
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
                } catch (e) {
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
                .catch((err) => {
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
