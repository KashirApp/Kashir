import { useState, useCallback, useMemo } from 'react';
import type { Client, Keys, PublicKey } from 'kashir';
import { EventId, Filter } from 'kashir';
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

  const fetchEventsProgressively = useCallback(
    async (clientInstance: Client, eventIds: string[]) => {
      const fetchedEvents: any[] = [];
      const allAuthorPubkeys = new Set<string>();

      for (let i = 0; i < eventIds.length; i++) {
        const eventId = eventIds[i];
        if (!eventId) continue;

        try {
          // Fetch single event (reusing DVMService logic)
          const parsedEventId = EventId.parse(eventId);
          const workingFilter = new Filter().id(parsedEventId).limit(BigInt(1));

          const fetchedEventsResult = await clientInstance.fetchEvents(
            workingFilter,
            5000
          );

          if (fetchedEventsResult) {
            const eventsArray = fetchedEventsResult.toVec();

            if (eventsArray.length > 0) {
              const event = eventsArray[0];
              if (event) {
                fetchedEvents.push(event);
                allAuthorPubkeys.add(event.author().toHex());

                // Create the new post
                const eventIdHex = event.id().toHex();
                const newPost = {
                  event: {
                    id: eventIdHex,
                    pubkey: event.author().toHex(),
                    content: event.content(),
                    created_at: Number(event.createdAt().asSecs()),
                  },
                  originalEvent: event,
                  stats: undefined,
                  isLoadingStats: true,
                  isLoadingContent: false, // Content is now loaded
                };

                // Fetch profiles for this specific post's nprofile mentions BEFORE updating state
                await fetchNprofileUsers(clientInstance, profileService, [
                  newPost,
                ]);

                // Update posts immediately with this new event (now with nprofiles loaded)
                setTrendingPosts((currentPosts) => {
                  const updatedPosts = [...currentPosts];
                  const postIndex = updatedPosts.findIndex(
                    (post) => post.event.id === eventId
                  );

                  if (postIndex !== -1) {
                    updatedPosts[postIndex] = newPost;
                  }

                  return updatedPosts;
                });
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch event ${eventId}:`, error);
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // After all events are loaded, fetch profiles and stats in background
      if (fetchedEvents.length > 0) {
        // Fetch profiles for all authors
        setProfilesLoading(true);
        const authorPubkeys = Array.from(allAuthorPubkeys)
          .map((hex) => {
            try {
              return fetchedEvents
                .find((e) => e.author().toHex() === hex)
                ?.author();
            } catch {
              return null;
            }
          })
          .filter((pk) => pk !== null && pk !== undefined) as PublicKey[];

        const profilePromise =
          authorPubkeys.length > 0
            ? profileService
                .fetchProfilesForPubkeys(client, authorPubkeys)
                .then(() => {
                  setProfilesLoading(false);
                  // Force re-render to pick up loaded profiles
                  setTrendingPosts((currentPosts) => [...currentPosts]);
                })
                .catch((_err) => {
                  setProfilesLoading(false);
                })
            : Promise.resolve().then(() => {
                setProfilesLoading(false);
              });

        // Enhance posts with engagement statistics
        try {
          const fetchedEventIds = fetchedEvents.map((event) =>
            event.id().toHex()
          );
          const eventStats =
            await cacheService.fetchEventStats(fetchedEventIds);

          const enhancedPosts = cacheService.enhanceEventsWithStats(
            fetchedEvents,
            eventStats
          );

          // Update posts with stats
          setTrendingPosts((currentPosts) => {
            return currentPosts.map((post) => {
              const enhanced = enhancedPosts.find(
                (ep) => ep.event.id === post.event.id
              );
              return enhanced || { ...post, isLoadingStats: false };
            });
          });

          // Wait for profiles to complete
          await profilePromise;

          // Final render with both profiles and stats loaded
          setTrendingPosts((currentPosts) => [...currentPosts]);
        } catch (error) {
          console.warn('Failed to enhance trending posts with stats:', error);
          // Mark posts as not loading stats since we failed
          setTrendingPosts((currentPosts) =>
            currentPosts.map((post) => ({ ...post, isLoadingStats: false }))
          );

          // Still wait for profiles to complete
          await profilePromise;
        }
      }
    },
    [client, profileService, cacheService]
  );

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

          // Fetch events progressively - update UI as each event loads
          await fetchEventsProgressively(client, dvmResponse.eventIds);
        } else {
          // Show a single informational post when no trending data is available
          const fallbackPost = {
            event: {
              id: 'fallback-trending',
              pubkey: '',
              content:
                '📈 No trending content available at this time.\n\nTrending data is provided by Data Vending Machines (DVMs) on the Nostr network. Please check back later for trending posts.',
              created_at: Math.floor(Date.now() / 1000),
            },
            originalEvent: null,
            stats: undefined,
            isLoadingStats: false,
            isLoadingContent: false,
          };

          setTrendingPosts([fallbackPost]);
          setTrendingEventIds([]);
        }
      } catch (error) {
        console.error('Error fetching trending posts:', error);

        // Show error message instead of empty state
        const errorPost = {
          event: {
            id: 'error-trending',
            pubkey: '',
            content:
              '⚠️ Error loading trending content.\n\nPlease check your connection and try again.',
            created_at: Math.floor(Date.now() / 1000),
          },
          originalEvent: null,
          stats: undefined,
          isLoadingStats: false,
          isLoadingContent: false,
        };

        setTrendingPosts([errorPost]);
        setTrendingEventIds([]);
      } finally {
        setTrendingLoading(false);
      }
    },
    [client, dvmService, fetchEventsProgressively]
  );

  return {
    trendingPosts,
    trendingEventIds,
    trendingLoading,
    profilesLoading,
    fetchTrendingPosts,
  };
}
