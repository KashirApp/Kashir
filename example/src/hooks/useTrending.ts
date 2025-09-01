import { useState, useCallback, useMemo } from 'react';
import type { Client, Keys, PublicKey } from 'kashir';
import { DVMService } from '../services/DVMService';
import { ProfileService } from '../services/ProfileService';
import { CacheService } from '../services/CacheService';
import { fetchNprofileUsers } from '../utils/nostrUtils';
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

          // Create placeholder posts immediately with just event IDs
          const placeholderPosts = dvmResponse.eventIds.map(
            (eventId, index) => ({
              event: {
                id: eventId,
                pubkey: '', // Will be filled when event is fetched
                content: '⏳', // Loading indicator for content
                created_at: Date.now() / 1000 - index, // Approximate timestamp to maintain order
              },
              originalEvent: null, // Will be filled when event is fetched
              stats: undefined,
              isLoadingStats: true,
              isLoadingContent: true, // New flag for content loading
            })
          );

          // Set placeholder posts immediately so UI shows them
          setTrendingPosts(placeholderPosts);

          // Set loading to false so PostList renders posts instead of loading spinner
          setTrendingLoading(false);

          // Fetch the actual events in background
          const events = await dvmService.fetchEventsByIds(
            client,
            dvmResponse.eventIds
          );

          if (events.length > 0) {
            // Create real posts with actual event content (no longer loading content)
            const realPosts = events.map((event) => ({
              event: {
                id: event.id().toHex(),
                pubkey: event.author().toHex(),
                content: event.content(),
                created_at: Number(event.createdAt().asSecs()),
              },
              originalEvent: event,
              stats: undefined,
              isLoadingStats: true,
              isLoadingContent: false, // Content is now loaded
            }));

            // Fetch profiles for users mentioned in nprofiles/npub URIs BEFORE setting posts
            await fetchNprofileUsers(client, profileService, realPosts);

            // Update posts with real content (profiles now loaded)
            setTrendingPosts(realPosts);

            // Enhance posts with engagement statistics in background
            try {
              const eventIds = events.map((event) => event.id().toHex());
              const eventStats = await cacheService.fetchEventStats(eventIds);

              const enhancedPosts = cacheService.enhanceEventsWithStats(
                events,
                eventStats
              );

              // Keep DVM trending order (don't sort by time)
              setTrendingPosts(enhancedPosts);

              // Profiles already fetched above
              // await fetchNprofileUsers(client, profileService, enhancedPosts);

              // Force re-render by setting posts again after profiles are loaded
              setTrendingPosts([...enhancedPosts]); // Spread to create new array reference
            } catch (error) {
              console.warn(
                'Failed to enhance trending posts with stats:',
                error
              );
              // Mark real posts as not loading stats since we failed to fetch them
              const fallbackPosts = realPosts.map((post) => ({
                ...post,
                isLoadingStats: false,
              }));
              setTrendingPosts(fallbackPosts);

              // Profiles were already fetched above
              // await fetchNprofileUsers(client, profileService, fallbackPosts);

              // Force re-render by setting posts again after profiles are loaded
              setTrendingPosts([...fallbackPosts]); // Spread to create new array reference
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
