import type { Client, EventInterface } from 'kashir';
import { ProfileService } from '../services/ProfileService';
import { CacheService } from '../services/CacheService';
import { fetchNprofileUsers, extractEventIdsFromNevents } from './nostrUtils';
import type { PostWithStats } from '../types/EventStats';

// Extended interface for posts with originalEvent
interface PostWithOriginalEvent extends PostWithStats {
  originalEvent?: EventInterface;
}

/**
 * Comprehensive post processing utility that handles:
 * - nostr:nprofile and nostr:npub URI processing
 * - Profile fetching for post authors
 * - Engagement statistics enhancement
 * - Embedded post statistics (for nevent URIs)
 */
export class PostProcessingUtils {
  private static instance: PostProcessingUtils;

  static getInstance(): PostProcessingUtils {
    if (!PostProcessingUtils.instance) {
      PostProcessingUtils.instance = new PostProcessingUtils();
    }
    return PostProcessingUtils.instance;
  }

  /**
   * Process posts with all required enhancements:
   * 1. Fetch profiles for nostr:nprofile/npub mentions
   * 2. Fetch author profiles
   * 3. Enhance with engagement statistics
   * 4. Handle embedded post statistics
   */
  async processPostsComplete(
    client: Client,
    profileService: ProfileService,
    posts: PostWithOriginalEvent[],
    options: {
      fetchAuthorProfiles?: boolean;
      includeEmbeddedStats?: boolean;
    } = {}
  ): Promise<PostWithOriginalEvent[]> {
    const {
      fetchAuthorProfiles = true,
      includeEmbeddedStats = true, // Changed default to true to fix embedded post loading
    } = options;

    if (!client || posts.length === 0) {
      return posts;
    }

    const cacheService = CacheService.getInstance();

    try {
      // Step 1: Fetch profiles for nostr:nprofile/npub mentions in post content
      await this.fetchNprofileUsers(client, profileService, posts);

      // Step 2: Fetch author profiles if requested
      if (fetchAuthorProfiles) {
        await this.fetchAuthorProfiles(client, profileService, posts);
      }

      // Step 3: Enhance with engagement statistics
      const eventIds = posts.map((post) => post.event.id);

      // Step 4: If including embedded stats, collect embedded event IDs
      let allEventIdsForStats = eventIds;
      if (includeEmbeddedStats) {
        const embeddedEventIds = this.extractAllEmbeddedEventIds(posts);
        allEventIdsForStats = [...eventIds, ...embeddedEventIds];
      }

      const eventStats =
        await cacheService.fetchEventStats(allEventIdsForStats);

      // Convert posts to format expected by CacheService
      const eventsForEnhancement = posts
        .map((post) => post.originalEvent)
        .filter((event) => event !== null && event !== undefined);

      const enhancedResults = cacheService.enhanceEventsWithStats(
        eventsForEnhancement,
        eventStats
      );

      // Convert the mixed results to PostWithOriginalEvent format
      const enhancedPosts: PostWithOriginalEvent[] = enhancedResults.map(
        (result) => {
          // If it's already a PostWithStats (has 'event' property), return it
          if ('event' in result) {
            return result as PostWithOriginalEvent;
          }
          // If it's an EventInterface, convert it to PostWithStats format
          else {
            const eventInterface = result as EventInterface;
            return {
              event: {
                id: eventInterface.id().toHex(),
                pubkey: eventInterface.author().toHex(),
                content: eventInterface.content(),
                created_at: Number(eventInterface.createdAt().asSecs()),
              },
              originalEvent: eventInterface,
              stats: undefined,
              isLoadingStats: false,
            } as PostWithOriginalEvent;
          }
        }
      );

      return enhancedPosts;
    } catch (error) {
      console.warn('Error during post processing:', error);
      // Return posts with loading stats disabled on error
      return posts.map((post) => ({
        ...post,
        isLoadingStats: false,
      }));
    }
  }

  /**
   * Fetch profiles for users mentioned in nostr:nprofile/npub URIs
   */
  async fetchNprofileUsers(
    client: Client,
    profileService: ProfileService,
    posts: PostWithOriginalEvent[]
  ): Promise<void> {
    try {
      await fetchNprofileUsers(client, profileService, posts);
    } catch (error) {
      console.warn('Failed to fetch nprofile users:', error);
    }
  }

  /**
   * Fetch profiles for post authors
   */
  async fetchAuthorProfiles(
    client: Client,
    profileService: ProfileService,
    posts: PostWithOriginalEvent[]
  ): Promise<void> {
    try {
      const uniqueAuthorPubkeys = new Set<string>();

      // Collect unique author pubkeys
      posts.forEach((post) => {
        if (post.originalEvent) {
          uniqueAuthorPubkeys.add(post.originalEvent.author().toHex());
        }
      });

      // Convert to PublicKey objects and fetch profiles
      const authorPubkeys = posts
        .map((post) => post.originalEvent?.author())
        .filter((pk) => pk !== null && pk !== undefined);

      if (authorPubkeys.length > 0) {
        await profileService.fetchProfilesForPubkeys(client, authorPubkeys);
      }
    } catch (error) {
      console.warn('Failed to fetch author profiles:', error);
    }
  }

  /**
   * Extract all embedded event IDs from nevent URIs in posts
   */
  private extractAllEmbeddedEventIds(posts: PostWithOriginalEvent[]): string[] {
    const allEmbeddedEventIds = new Set<string>();

    posts.forEach((post) => {
      const embeddedIds = extractEventIdsFromNevents(post.event.content);
      embeddedIds.forEach((id) => allEmbeddedEventIds.add(id));
    });

    return Array.from(allEmbeddedEventIds);
  }

  /**
   * Process a single post's profiles only (for progressive processing like trending)
   * Used when posts are loaded one-by-one and need immediate profile processing
   */
  async processSinglePostProfiles(
    client: Client,
    profileService: ProfileService,
    post: PostWithOriginalEvent,
    options: {
      fetchAuthorProfile?: boolean;
    } = {}
  ): Promise<void> {
    const { fetchAuthorProfile = true } = options;

    if (!client || !post) {
      return;
    }

    try {
      // Fetch nprofile/npub mentions in this post
      await this.fetchNprofileUsers(client, profileService, [post]);

      // Fetch author profile if requested and available
      if (fetchAuthorProfile && post.originalEvent) {
        try {
          await profileService.fetchProfilesForPubkeys(client, [
            post.originalEvent.author(),
          ]);
        } catch (error) {
          console.warn('Failed to fetch author profile:', error);
        }
      }
    } catch (error) {
      console.warn('Failed to process single post profiles:', error);
    }
  }

  /**
   * Enhance events with batch statistics (for final enhancement after progressive processing)
   * Used by trending tab after all posts are loaded progressively
   */
  async enhanceWithBatchStats(
    client: Client,
    events: any[], // EventInterface[]
    options: {
      includeEmbeddedStats?: boolean;
    } = {}
  ): Promise<any[]> {
    const { includeEmbeddedStats = true } = options;

    if (!client || events.length === 0) {
      return events;
    }

    const cacheService = CacheService.getInstance();

    try {
      // Get main event IDs
      const eventIds = events.map((event) => event.id().toHex());

      // Collect embedded post event IDs if requested
      let allEventIdsForStats = eventIds;
      if (includeEmbeddedStats) {
        const allEmbeddedEventIds = new Set<string>();
        events.forEach((event) => {
          const eventContent = event.content();
          const embeddedIds = extractEventIdsFromNevents(eventContent);
          embeddedIds.forEach((id) => allEmbeddedEventIds.add(id));
        });

        allEventIdsForStats = [...eventIds, ...Array.from(allEmbeddedEventIds)];
      }

      // Fetch stats for all events
      const eventStats =
        await cacheService.fetchEventStats(allEventIdsForStats);

      // Enhance events with stats
      const enhancedPosts = cacheService.enhanceEventsWithStats(
        events,
        eventStats
      );

      return enhancedPosts;
    } catch (error) {
      console.warn('Error during batch stats enhancement:', error);
      return events;
    }
  }

  /**
   * Simple profile processing only (for cases where stats aren't needed immediately)
   */
  async processProfilesOnly(
    client: Client,
    profileService: ProfileService,
    posts: PostWithOriginalEvent[],
    options: {
      fetchAuthorProfiles?: boolean;
    } = {}
  ): Promise<void> {
    const { fetchAuthorProfiles = true } = options;

    if (!client || posts.length === 0) {
      return;
    }

    // Fetch nprofile/npub mentions
    await this.fetchNprofileUsers(client, profileService, posts);

    // Fetch author profiles if requested
    if (fetchAuthorProfiles) {
      await this.fetchAuthorProfiles(client, profileService, posts);
    }
  }
}

// Export singleton instance for easy importing
export const postProcessingUtils = PostProcessingUtils.getInstance();
