import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Client, Filter, Kind } from 'kashir';
import type { PublicKeyInterface } from 'kashir';
import { ProfileService } from '../services/ProfileService';
import { StorageService } from '../services/StorageService';
import { postProcessingUtils } from '../utils/postProcessingUtils';
import type { PostWithStats } from '../types/EventStats';
import { ListService } from '../services/ListService';

export function useFollowing(
  client: Client | null,
  profileService: ProfileService
) {
  const [followingPosts, setFollowingPosts] = useState<PostWithStats[]>([]);
  const [followingList, setFollowingList] = useState<PublicKeyInterface[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [currentFollowSetInfo, setCurrentFollowSetInfo] = useState<{
    identifier: string;
    eventId: string;
  } | null>(null);

  const listService = ListService.getInstance();

  // Active follow set changes are now handled directly in PostsScreen
  // No need for polling interval since changes are immediate

  const fetchFollowingList = useCallback(
    async (userNpub: string) => {
      if (!client) return [];

      try {
        // First, check if there's an active follow set configured
        const activeFollowSet = await StorageService.loadActiveFollowSet();

        if (activeFollowSet) {
          // Use the configured follow set
          setCurrentFollowSetInfo(activeFollowSet);

          const followSets = await listService.fetchUserFollowSets(
            client,
            userNpub
          );
          const targetSet = followSets.find(
            (set) => set.eventId === activeFollowSet.eventId
          );

          if (targetSet) {
            // Update with actual follow set info
            setCurrentFollowSetInfo({
              identifier: targetSet.identifier,
              eventId: targetSet.eventId,
            });

            // Combine both public and private keys for the following list
            const allKeys = [
              ...targetSet.publicKeys,
              ...(targetSet.privateKeys || []),
            ];
            setFollowingList(allKeys);
            return allKeys;
          } else {
            // Fall through to kind 3 logic
          }
        } else {
          setCurrentFollowSetInfo({
            identifier: 'Following',
            eventId: 'kind3',
          });
        }

        const followSets = await listService.fetchUserFollowSets(
          client,
          userNpub
        );

        // Find the "Following" set (kind 3 contact list)
        const followingSet = followSets.find(
          (set) => set.identifier === 'Following'
        );

        if (followingSet) {
          setFollowingList(followingSet.publicKeys);
          return followingSet.publicKeys;
        }

        return [];
      } catch {
        return [];
      }
    },
    [client, listService]
  );

  const fetchFollowingPosts = useCallback(
    async (userNpub: string, forcedFollowingList?: PublicKeyInterface[]) => {
      if (!client) {
        Alert.alert('Error', 'Client not ready. Please wait and try again.');
        return;
      }

      setFollowingLoading(true);
      setFollowingPosts([]);

      try {
        // Use forced following list if provided, otherwise use current or fetch new
        let following = forcedFollowingList || followingList;
        if (following.length === 0) {
          const fetchedFollowing = await fetchFollowingList(userNpub);
          following = fetchedFollowing || [];
        }

        if (following.length === 0) {
          Alert.alert('No Following', 'You are not following anyone yet.');
          return;
        }

        // Create filter for posts from following
        const followingFilter = new Filter()
          .authors(following)
          .kinds([new Kind(1)])
          .limit(10n);

        const events = await client.fetchEvents(followingFilter, 30000 as any);
        const eventArray = events.toVec();

        if (eventArray.length > 0) {
          // Sort by timestamp
          eventArray.sort((a, b) => {
            const timeA = a.createdAt().asSecs();
            const timeB = b.createdAt().asSecs();
            return Number(timeB - timeA);
          });

          // Convert EventInterface to PostWithStats format
          const postsWithStats: PostWithStats[] = eventArray.map((event) => ({
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

          // Set posts immediately with loading state
          setFollowingPosts(postsWithStats);

          // Process profiles and enhance with stats (including embedded post stats)
          try {
            const enhancedPosts =
              await postProcessingUtils.processPostsComplete(
                client,
                profileService,
                postsWithStats as any[], // Cast to match extended interface
                {
                  fetchAuthorProfiles: true,
                  includeEmbeddedStats: true,
                }
              );
            setFollowingPosts(enhancedPosts);
          } catch {
            // Mark posts as not loading stats since we failed to fetch them
            const postsWithFailedStats = postsWithStats.map((post) => ({
              ...post,
              isLoadingStats: false,
            }));
            setFollowingPosts(postsWithFailedStats);
          }
        } else {
          Alert.alert(
            'No posts found',
            'No recent posts from people you follow.'
          );
        }
      } catch (error) {
        Alert.alert(
          'Error',
          `Failed to fetch posts from following: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } finally {
        setFollowingLoading(false);
      }
    },
    [client, followingList, fetchFollowingList, profileService]
  );

  return {
    followingPosts,
    followingList,
    followingLoading,
    fetchFollowingList,
    fetchFollowingPosts,
    currentFollowSetInfo,
    setCurrentFollowSetInfo,
    setFollowingList,
  };
}
