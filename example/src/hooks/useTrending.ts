import { useState, useCallback, useMemo } from 'react';
import type { Client, Keys, PublicKey } from 'kashir';
import { DVMService } from '../services/DVMService';
import { ProfileService } from '../services/ProfileService';
import { CacheService } from '../services/CacheService';
import type { PostWithStats } from '../types/EventStats';

interface UseTrendingResult {
  trendingPosts: PostWithStats[];
  trendingEventIds: string[];
  trendingLoading: boolean;
  profilesLoading: boolean;
  fetchTrendingPosts: (keys: Keys | null) => Promise<void>;
}

export function useTrending(
  client: Client | null,
  profileService: ProfileService
): UseTrendingResult {
  const [trendingPosts, setTrendingPosts] = useState<PostWithStats[]>([]);
  const [trendingEventIds, setTrendingEventIds] = useState<string[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const dvmService = useMemo(() => new DVMService(), []);
  const cacheService = CacheService.getInstance();

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
            // Enhance posts with engagement statistics
            try {
              console.log(
                `Enhancing ${events.length} trending posts with stats...`
              );
              const eventIds = events.map((event) => event.id().toHex());
              const eventStats = await cacheService.fetchEventStats(eventIds);

              const enhancedPosts = cacheService.enhanceEventsWithStats(
                events,
                eventStats
              );
              console.log(
                `Successfully enhanced ${eventStats.length}/${events.length} trending posts`
              );

              // Keep DVM trending order (don't sort by time)
              setTrendingPosts(enhancedPosts);
            } catch (error) {
              console.warn(
                'Failed to enhance trending posts with stats:',
                error
              );
              // Fallback to posts without stats (convert EventInterface to PostWithStats format)
              const fallbackPosts = events.map((event) => ({
                event: {
                  id: event.id().toHex(),
                  pubkey: event.author().toHex(),
                  content: event.content(),
                  created_at: Number(event.createdAt().asSecs()),
                },
                originalEvent: event,
                stats: undefined,
              }));
              setTrendingPosts(fallbackPosts);
            }

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
    [client, dvmService, profileService, cacheService]
  );

  return {
    trendingPosts,
    trendingEventIds,
    trendingLoading,
    profilesLoading,
    fetchTrendingPosts,
  };
}
