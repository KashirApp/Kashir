import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Client, PublicKey, Filter, Kind } from '../../../src';
import type { EventInterface } from '../../../src';
import { ProfileService } from '../services/ProfileService';

export function useFollowing(client: Client | null, profileService: ProfileService) {
  const [followingPosts, setFollowingPosts] = useState<EventInterface[]>([]);
  const [followingList, setFollowingList] = useState<PublicKey[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);

  const fetchFollowingList = useCallback(async (userNpub: string) => {
    if (!client) return [];

    try {
      const publicKey = PublicKey.parse(userNpub);

      // Create filter for kind 3 (contact list) events
      const contactListFilter = new Filter()
        .author(publicKey)
        .kinds([new Kind(3)])
        .limit(1n);

      console.log('Fetching following list...');

      const events = await client.fetchEvents(contactListFilter, 10000 as any);
      const eventArray = events.toVec();

      if (eventArray.length > 0) {
        const contactListEvent = eventArray[0];
        if (contactListEvent) {
          const tags = contactListEvent.tags();
          const followingPubkeys: PublicKey[] = [];

          // Extract public keys from p tags
          let tagArray: any[] = [];
          try {
            if (tags && typeof tags.toVec === 'function') {
              tagArray = tags.toVec();
            } else if (Array.isArray(tags)) {
              tagArray = tags;
            }
          } catch (e) {
            console.error('Error converting tags to array:', e);
          }

          console.log(`Processing ${tagArray.length} tags`);

          for (const tag of tagArray) {
            try {
              let tagData: any[] = [];
              if (Array.isArray(tag)) {
                tagData = tag;
              } else if (tag && typeof tag.as_vec === 'function') {
                tagData = tag.as_vec();
              } else if (tag && typeof tag.asVec === 'function') {
                tagData = tag.asVec();
              } else if (tag && typeof tag.toVec === 'function') {
                tagData = tag.toVec();
              }

              if (tagData.length > 1 && tagData[0] === 'p') {
                try {
                  const hexPubkey = tagData[1] as string;
                  let pubkey = null;

                  if (tag && typeof tag.publicKey === 'function') {
                    pubkey = tag.publicKey();
                  } else if (tag && typeof tag.public_key === 'function') {
                    pubkey = tag.public_key();
                  } else {
                    try {
                      pubkey = PublicKey.parse(hexPubkey);
                    } catch (e1) {
                      try {
                        pubkey = PublicKey.parse('hex:' + hexPubkey);
                      } catch (e2) {
                        // Could not parse hex pubkey directly
                      }
                    }
                  }

                  if (pubkey) {
                    followingPubkeys.push(pubkey);
                  }
                } catch (error) {
                  console.error('Error parsing pubkey from tag:', error);
                }
              }
            } catch (tagError) {
              console.error('Error processing tag:', tagError);
            }
          }

          console.log(`Found ${followingPubkeys.length} people in following list`);
          setFollowingList(followingPubkeys);
          return followingPubkeys;
        }
      }

      return [];
    } catch (error) {
      console.error('Error fetching following list:', error);
      return [];
    }
  }, [client]);

  const fetchFollowingPosts = useCallback(async (userNpub: string) => {
    if (!client) {
      Alert.alert('Error', 'Client not ready. Please wait and try again.');
      return;
    }

    setFollowingLoading(true);
    setFollowingPosts([]);

    try {
      // First fetch the following list if we don't have it
      let following = followingList;
      if (following.length === 0) {
        const fetchedFollowing = await fetchFollowingList(userNpub);
        following = fetchedFollowing || [];
      }

      if (following.length === 0) {
        Alert.alert('No Following', 'You are not following anyone yet.');
        setFollowingLoading(false);
        return;
      }

      console.log(`Fetching posts from ${following.length} people...`);

      // Create filter for posts from following
      const followingFilter = new Filter()
        .authors(following)
        .kinds([new Kind(1)])
        .limit(100n);

      console.log('Fetching following posts...');

      const events = await client.fetchEvents(followingFilter, 30000 as any);
      const eventArray = events.toVec();

      console.log(`Fetched ${eventArray.length} posts from following`);

      if (eventArray.length > 0) {
        // Sort by timestamp
        eventArray.sort((a, b) => {
          const timeA = a.createdAt().asSecs();
          const timeB = b.createdAt().asSecs();
          return Number(timeB - timeA);
        });

        setFollowingPosts(eventArray);

        // Fetch profiles for all unique authors
        const uniqueAuthors = new Set<string>();
        eventArray.forEach((event) => {
          uniqueAuthors.add(event.author().toHex());
        });

        const authorPubkeys = Array.from(uniqueAuthors)
          .map((hex) => {
            try {
              return eventArray
                .find((e) => e.author().toHex() === hex)
                ?.author();
            } catch (e) {
              return null;
            }
          })
          .filter((pk) => pk !== null && pk !== undefined) as PublicKey[];

        // Fetch profiles in background
        profileService.fetchProfilesForPubkeys(client, authorPubkeys).catch((err) =>
          console.error('Error fetching profiles:', err)
        );
      } else {
        Alert.alert(
          'No posts found',
          'No recent posts from people you follow.'
        );
      }
    } catch (error) {
      console.error('Error fetching following posts:', error);
      Alert.alert(
        'Error',
        `Failed to fetch posts from following: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setFollowingLoading(false);
    }
  }, [client, followingList, fetchFollowingList, profileService]);

  return {
    followingPosts,
    followingList,
    followingLoading,
    fetchFollowingList,
    fetchFollowingPosts,
  };
} 