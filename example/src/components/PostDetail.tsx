import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Client, Filter, Kind, EventId } from 'kashir';
import { NostrClientService } from '../services/NostrClient';
import { sharedProfileService } from '../services/ProfileService';
import { CacheService } from '../services/CacheService';
import { Post } from './Post';
import type { PostWithStats } from '../types/EventStats';
import type { NostrStackParamList } from './NostrNavigator';
import { styles } from '../App.styles';

type PostDetailProps = NativeStackScreenProps<
  NostrStackParamList,
  'PostDetail'
>;

export function PostDetail({
  route,
  navigation: _navigation,
}: PostDetailProps) {
  const { post } = route.params;
  const [replies, setReplies] = useState<PostWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  const [_profilesLoaded, setProfilesLoaded] = useState(false);

  const clientService = NostrClientService.getInstance();
  const profileService = sharedProfileService;
  const cacheService = CacheService.getInstance();

  // Reset state when navigating to a different post
  useEffect(() => {
    if (post.event.id !== currentPostId) {
      setCurrentPostId(post.event.id);
      setHasLoaded(false);
      setReplies([]);
      setLoading(true);
      setProfilesLoaded(false);
    }
  }, [post.event.id, currentPostId]);

  // Get client when ready
  useEffect(() => {
    const checkClientReadiness = () => {
      if (clientService.isReady() && !client) {
        setClient(clientService.getClient());
      }
    };

    checkClientReadiness();

    if (!clientService.isReady()) {
      const interval = setInterval(checkClientReadiness, 500);
      return () => clearInterval(interval);
    }

    return undefined; // Explicit return for when client is ready
  }, [clientService, client]);

  // Fetch replies when client is ready
  const fetchReplies = useCallback(async () => {
    if (!client || !post || hasLoaded) return;

    setLoading(true);
    setHasLoaded(true);

    try {
      // Filter events that have 'e' tags referencing this post ID
      let replyEvents: any[] = [];

      try {
        // Use Filter.events() to find replies by event ID
        const eventIdObj = EventId.parse(post.event.id);

        const replyFilter = new Filter()
          .kinds([new Kind(1)]) // Text notes only
          .events([eventIdObj]) // Find events with 'e' tags referencing this post
          .limit(1000n); // Allow for many replies

        const events = await client.fetchEvents(replyFilter, 20000);
        replyEvents = events.toVec();
      } catch (filterError) {
        console.error(
          'Failed to fetch replies using Filter.events():',
          filterError
        );
        replyEvents = [];
      }

      if (replyEvents.length > 0) {
        // Sort by creation time (newest first)
        replyEvents.sort((a, b) => {
          const timeA = a.createdAt().asSecs();
          const timeB = b.createdAt().asSecs();
          return Number(timeB - timeA);
        });

        // Convert to PostWithStats format
        const repliesWithStats: PostWithStats[] = replyEvents.map((event) => ({
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

        // Set replies immediately with loading state
        setReplies(repliesWithStats);
        setLoading(false); // Stop loading indicator as soon as replies are shown

        // Enhance replies with engagement statistics
        try {
          const eventIds = repliesWithStats.map((reply) => reply.event.id);
          const eventStats = await cacheService.fetchEventStats(eventIds);
          const enhancedReplies = cacheService.enhanceEventsWithStats(
            replyEvents,
            eventStats
          );
          setReplies(enhancedReplies);
        } catch (error) {
          console.warn('Failed to enhance replies with stats:', error);
          // Mark replies as not loading stats since we failed to fetch them
          const repliesWithFailedStats = repliesWithStats.map((reply) => ({
            ...reply,
            isLoadingStats: false,
          }));
          setReplies(repliesWithFailedStats);
        }

        // Fetch author profiles for replies
        try {
          const uniqueAuthors = new Set<string>();
          replyEvents.forEach((event) => {
            uniqueAuthors.add(event.author().toHex());
          });

          const authorPubkeys = Array.from(uniqueAuthors)
            .map((hex) => {
              try {
                return replyEvents
                  .find((e) => e.author().toHex() === hex)
                  ?.author();
              } catch {
                return null;
              }
            })
            .filter((pk) => pk !== null && pk !== undefined);

          if (authorPubkeys.length > 0) {
            await profileService.fetchProfilesForPubkeys(client, authorPubkeys);

            // Trigger re-render to show usernames
            setProfilesLoaded(true);
          }
        } catch (error) {
          console.warn('Failed to fetch profiles for replies:', error);
        }
      } else {
        setReplies([]);
        setLoading(false); // Stop loading indicator when no replies found
      }
    } catch (error) {
      console.error('Failed to fetch replies:', error);
      Alert.alert('Error', 'Failed to fetch replies. Please try again.');
      setLoading(false); // Stop loading indicator on error
    }
  }, [client, post, hasLoaded, cacheService, profileService]);

  useEffect(() => {
    if (client && post && !hasLoaded && currentPostId === post.event.id) {
      fetchReplies();
    }
  }, [client, post, hasLoaded, currentPostId, fetchReplies]);

  const getAuthorName = useCallback(
    (replyPost: PostWithStats): string => {
      const pubkey = replyPost.event.pubkey;
      const cached = profileService.getProfileCache().get(pubkey);

      if (cached && cached.name) {
        return cached.name;
      }
      return pubkey.substring(0, 8) + '...';
    },
    [profileService]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.postsContainer}>
        {/* Original Post */}
        <View style={styles.originalPost}>
          <Post
            post={post}
            index={0}
            totalPosts={1}
            authorName={post.authorName}
            showAuthor={true}
            profileService={profileService}
          />
        </View>

        {/* Replies Section */}
        <View style={styles.repliesSection}>
          <Text style={styles.repliesHeader}>
            {loading ? 'Loading replies...' : `Replies (${replies.length})`}
          </Text>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
            </View>
          )}

          {!loading && replies.length === 0 && (
            <View style={styles.noRepliesContainer}>
              <Text style={styles.noRepliesText}>No replies yet</Text>
              <Text style={styles.noRepliesSubtext}>
                Be the first to reply to this post!
              </Text>
            </View>
          )}

          {replies.map((reply, index) => (
            <View key={reply.event.id} style={styles.replyContainer}>
              <Post
                post={reply}
                index={index}
                totalPosts={replies.length}
                authorName={getAuthorName(reply)}
                showAuthor={true}
                profileService={profileService}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
