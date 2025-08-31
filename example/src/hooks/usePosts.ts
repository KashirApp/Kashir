import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Client, PublicKey, Filter, Kind } from 'kashir';
import type { EventInterface } from 'kashir';
import { CacheService } from '../services/CacheService';
import { sharedProfileService } from '../services/ProfileService';
import { extractPubkeysFromNprofiles } from '../utils/nostrUtils';
import type { PostWithStats } from '../types/EventStats';

export function usePosts(client: Client | null) {
  const [posts, setPosts] = useState<PostWithStats[]>([]);
  const [loading, setLoading] = useState(false);

  const cacheService = CacheService.getInstance();

  // Helper function to extract nprofiles from content and fetch their profiles
  const fetchNprofileUsers = useCallback(
    async (postsToProcess: PostWithStats[]) => {
      if (!client) return;

      const pubkeysToFetch = new Set<string>();

      // Extract all nprofiles from post contents using the shared utility
      postsToProcess.forEach((post) => {
        const pubkeys = extractPubkeysFromNprofiles(post.event.content);
        pubkeys.forEach((pubkey) => pubkeysToFetch.add(pubkey));
      });

      // Convert hex strings back to PublicKey objects and fetch profiles
      if (pubkeysToFetch.size > 0) {
        try {
          const validPubkeys: string[] = [];

          // Validate each pubkey before trying to parse it
          Array.from(pubkeysToFetch).forEach((hex) => {
            if (hex && hex.length === 64 && /^[0-9a-fA-F]{64}$/.test(hex)) {
              validPubkeys.push(hex);
            }
          });

          if (validPubkeys.length > 0) {
            // Parse hex strings to PublicKey objects
            const pubkeyObjects: any[] = [];

            for (const hex of validPubkeys) {
              try {
                // Try with 'hex:' prefix first
                const pk = PublicKey.parse('hex:' + hex);
                pubkeyObjects.push(pk);
              } catch {
                try {
                  // Fallback to parsing directly as hex
                  const pk = PublicKey.parse(hex);
                  pubkeyObjects.push(pk);
                } catch {
                  // Skip invalid pubkeys silently
                }
              }
            }

            if (pubkeyObjects.length > 0) {
              await sharedProfileService.fetchProfilesForPubkeys(
                client,
                pubkeyObjects
              );
            }
          }
        } catch (error) {
          console.error('Error fetching nprofile user profiles:', error);
        }
      }
    },
    [client]
  );

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
          console.log(`Fetched ${eventArray.length} events`);

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
          }));

          // Enhance posts with engagement statistics
          try {
            console.log(
              `Enhancing ${postsWithStats.length} user posts with stats...`
            );
            const eventIds = postsWithStats.map((post) => post.event.id);
            const eventStats = await cacheService.fetchEventStats(eventIds);

            const enhancedPosts = cacheService.enhanceEventsWithStats(
              allEvents,
              eventStats
            );
            console.log(
              `Successfully enhanced ${eventStats.length}/${postsWithStats.length} user posts`
            );

            // Fetch profiles for users mentioned in nprofiles
            await fetchNprofileUsers(enhancedPosts);

            setPosts(enhancedPosts);
          } catch (error) {
            console.warn('Failed to enhance user posts with stats:', error);
            // Fetch profiles for users mentioned in nprofiles even in fallback
            await fetchNprofileUsers(postsWithStats);
            // Fallback to posts without stats
            setPosts(postsWithStats);
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
    [client, cacheService, fetchNprofileUsers]
  );

  return {
    posts,
    loading,
    fetchPosts,
  };
}
