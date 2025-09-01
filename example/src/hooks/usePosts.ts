import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Client, PublicKey, Filter, Kind } from 'kashir';
import type { EventInterface } from 'kashir';
import { CacheService } from '../services/CacheService';
import { sharedProfileService } from '../services/ProfileService';
import { fetchNprofileUsers } from '../utils/nostrUtils';
import type { PostWithStats } from '../types/EventStats';

export function usePosts(client: Client | null) {
  const [posts, setPosts] = useState<PostWithStats[]>([]);
  const [loading, setLoading] = useState(false);

  const cacheService = CacheService.getInstance();

  const fetchPosts = useCallback(
    async (userNpub: string) => {
      if (!client) {
        Alert.alert('Error', 'Client not ready. Please wait and try again.');
        return;
      }

      setLoading(true);
      setPosts([]);

      try {
        // Parse the npub key
        const publicKey = PublicKey.parse(userNpub);

        // Create filter with chaining
        const filter = new Filter()
          .author(publicKey)
          .kinds([new Kind(1)])
          .limit(50n);

        let allEvents: EventInterface[] = [];

        try {
          // Try with milliseconds as integer
          const timeoutMs = 30000; // 30 seconds in milliseconds
          const events = await client.fetchEvents(filter, timeoutMs as any);

          const eventArray = events.toVec();

          if (eventArray.length > 0) {
            allEvents = eventArray;
          }
        } catch (fetchError) {
          console.error('Error during fetch:', fetchError);

          // Try alternative approaches
          try {
            const duration = { secs: 30n, nanos: 0 };
            const events2 = await client.fetchEvents(filter, duration as any);
            const eventArray2 = events2.toVec();

            if (eventArray2.length > 0) {
              allEvents = eventArray2;
            }
          } catch (fetchError2) {
            console.error('Error during second fetch attempt:', fetchError2);
          }
        }

        // Sort and set posts
        if (allEvents.length > 0) {
          allEvents.sort((a, b) => {
            const timeA = a.createdAt().asSecs();
            const timeB = b.createdAt().asSecs();
            return Number(timeB - timeA);
          });

          // Convert EventInterface to PostWithStats format
          const postsWithStats: PostWithStats[] = allEvents.map((event) => ({
            event: {
              id: event.id().toHex(),
              pubkey: event.author().toHex(),
              content: event.content(),
              created_at: Number(event.createdAt().asSecs()),
            },
            originalEvent: event,
            stats: undefined,
            isLoadingStats: true,
          }));

          // Fetch profiles for users mentioned in nprofiles BEFORE setting posts
          await fetchNprofileUsers(
            client,
            sharedProfileService,
            postsWithStats
          );

          // Set posts immediately with loading state (profiles now loaded)
          setPosts(postsWithStats);

          // Enhance posts with engagement statistics
          try {
            const eventIds = postsWithStats.map((post) => post.event.id);
            const eventStats = await cacheService.fetchEventStats(eventIds);

            const enhancedPosts = cacheService.enhanceEventsWithStats(
              allEvents,
              eventStats
            );

            // Profiles already fetched above, just update posts with stats
            // await fetchNprofileUsers(
            //   client,
            //   sharedProfileService,
            //   enhancedPosts
            // );

            // Force re-render by setting posts again after profiles are loaded
            setPosts([...enhancedPosts]); // Spread to create new array reference
          } catch (error) {
            console.warn('Failed to enhance user posts with stats:', error);
            // Mark posts as not loading stats since we failed to fetch them
            const postsWithFailedStats = postsWithStats.map((post) => ({
              ...post,
              isLoadingStats: false,
            }));

            // Profiles were already fetched above, no need to fetch again
            // await fetchNprofileUsers(
            //   client,
            //   sharedProfileService,
            //   postsWithFailedStats
            // );

            // Force re-render by setting posts again after profiles are loaded
            setPosts([...postsWithFailedStats]); // Spread to create new array reference
          }
        } else {
          Alert.alert(
            'No posts found',
            'This could be because:\n' +
              '1. You have no posts yet\n' +
              '2. The relays might not have your data\n' +
              '3. The connection might be slow\n\n' +
              'Try refreshing in a few seconds.'
          );
        }
      } catch (error) {
        console.error('Error fetching posts:', error);
        Alert.alert(
          'Error',
          `Failed to fetch posts: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again.`
        );
      } finally {
        setLoading(false);
      }
    },
    [client, cacheService]
  );

  return {
    posts,
    loading,
    fetchPosts,
  };
}
