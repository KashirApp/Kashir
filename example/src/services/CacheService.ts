/**
 * Cache Service
 * Provides enhanced Nostr functionality through cache servers
 */
import type { EventInterface } from 'kashir';
import type {
  ContentEventStats,
  CacheFilter,
  PostWithStats,
} from '../types/EventStats';

export class CacheService {
  private static instance: CacheService | null = null;
  private wsClient: WebSocket | null = null;
  private readonly CACHE_URL = 'wss://cache1.primal.net/v1';
  private readonly EVENT_STATS_KIND = 10000100;

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Connect to cache server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wsClient = new WebSocket(this.CACHE_URL);

        this.wsClient.onopen = () => {
          console.log('Connected to cache server');
          resolve();
        };

        this.wsClient.onerror = (error) => {
          console.error('Cache connection error:', error);
          reject(new Error('Failed to connect to cache server'));
        };

        this.wsClient.onclose = () => {
          console.log('Cache connection closed');
          this.wsClient = null;
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate a unique subscription ID similar to Android client
   */
  private generateSubscriptionId(): string {
    // Simple UUID v4 generator similar to Android client format
    return `web-${Math.random().toString(36).substring(2)}-${Date.now().toString(36)}`;
  }

  /**
   * Send a query to cache and get response
   */
  private async queryCache(
    verb: string,
    options?: Record<string, any>
  ): Promise<any[]> {
    // Create a fresh connection for each query
    await this.connect();

    return new Promise((resolve, reject) => {
      if (!this.wsClient) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const subscriptionId = this.generateSubscriptionId();
      const filter: CacheFilter = {
        cache: options ? [verb, options] : [verb],
      };

      const request = ['REQ', subscriptionId, filter];
      const events: any[] = [];

      const cleanup = () => {
        this.wsClient?.removeEventListener('message', messageHandler);
        // Disconnect after each query to avoid persistent connection issues
        this.disconnect();
      };

      const messageHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          const [type, subId, data] = message;

          if (subId !== subscriptionId) return;

          if (type === 'EVENT') {
            events.push(data);
          } else if (type === 'EOSE') {
            cleanup();
            resolve(events);
          } else if (type === 'NOTICE') {
            console.warn('Cache notice:', data);
            // If we get an error notice, reject the promise
            if (
              data &&
              typeof data === 'string' &&
              data.toLowerCase().includes('error')
            ) {
              cleanup();
              reject(new Error(`Cache error: ${data}`));
              return;
            }
          }
        } catch (error) {
          console.error('Error parsing cache message:', error);
          cleanup();
          reject(error);
        }
      };

      // Set up timeout to prevent hanging connections
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Cache query timeout'));
      }, 30000); // 30 second timeout (increased from 10 seconds)

      this.wsClient.addEventListener('message', messageHandler);

      // Send request
      this.wsClient.send(JSON.stringify(request));

      // Clear timeout when promise resolves/rejects
      const originalResolve = resolve;
      const originalReject = reject;
      resolve = (value) => {
        clearTimeout(timeoutId);
        originalResolve(value);
      };
      reject = (error) => {
        clearTimeout(timeoutId);
        originalReject(error);
      };
    });
  }

  /**
   * Fetch engagement statistics for specific event IDs using cache API
   * Based on Android client implementation that uses 'events' verb
   */
  async fetchEventStats(eventIds: string[]): Promise<ContentEventStats[]> {
    // Split into smaller batches to avoid timeouts with large requests
    const BATCH_SIZE = 50;
    const allStats: ContentEventStats[] = [];

    if (eventIds.length === 0) return allStats;

    console.log(
      `Fetching engagement stats for ${eventIds.length} events from cache...`
    );

    try {
      // Process in batches to avoid overwhelming the cache server
      for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
        const batch = eventIds.slice(i, i + BATCH_SIZE);
        console.log(
          `Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
            eventIds.length / BATCH_SIZE
          )} (${batch.length} events)`
        );

        try {
          const batchStats = await this.fetchEventStatsBatch(batch);
          allStats.push(...batchStats);
        } catch (error) {
          console.warn(
            `Failed to fetch stats for batch ${
              Math.floor(i / BATCH_SIZE) + 1
            }:`,
            error
          );
          // Continue with remaining batches even if one fails
        }

        // Small delay between batches to be respectful to the cache server
        if (i + BATCH_SIZE < eventIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      console.log(
        `Successfully fetched stats for ${allStats.length}/${eventIds.length} events`
      );
      return allStats;
    } catch (error) {
      console.error('Error fetching event stats from cache:', error);
      return allStats; // Return whatever stats we managed to fetch
    }
  }

  /**
   * Fetch stats for a single batch of event IDs
   */
  private async fetchEventStatsBatch(
    eventIds: string[]
  ): Promise<ContentEventStats[]> {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Use the 'events' verb with exact same format as Android client
        // NotesRequestBody uses @SerialName("event_ids") and @SerialName("extended_response")
        const response = await this.queryCache('events', {
          event_ids: eventIds, // Correct field name from Android client
          extended_response: true, // Correct field name from Android client
        });

        const eventStats: ContentEventStats[] = [];

        response.forEach((event) => {
          if (event.kind === this.EVENT_STATS_KIND) {
            try {
              const stats = JSON.parse(event.content) as ContentEventStats;
              // Only include stats for events we requested
              if (eventIds.includes(stats.event_id)) {
                eventStats.push(stats);
              }
            } catch (error) {
              console.error('Error parsing event stats:', error);
            }
          }
        });

        return eventStats;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Cache request attempt ${attempt}/${MAX_RETRIES} failed:`,
          error
        );

        if (attempt < MAX_RETRIES) {
          // Exponential backoff: wait longer between retries
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Enhance regular EventInterface objects with statistics
   */
  enhanceEventsWithStats(
    events: EventInterface[],
    eventStats: ContentEventStats[]
  ): (EventInterface | PostWithStats)[] {
    // Create a map of event ID to stats for quick lookup
    const statsMap = new Map<string, ContentEventStats>();
    eventStats.forEach((stat) => {
      statsMap.set(stat.event_id, stat);
    });

    // Enhance events with their stats where available
    return events.map((event) => {
      try {
        // Check if this is actually an EventInterface object
        if (
          !event ||
          typeof event !== 'object' ||
          typeof event.id !== 'function'
        ) {
          console.warn(
            'enhanceEventsWithStats received non-EventInterface object:',
            event
          );
          return event; // Return as-is if not an EventInterface
        }

        const eventId = event.id().toHex();
        const stats = statsMap.get(eventId);

        if (stats) {
          // Return as PostWithStats format, but preserve the original EventInterface
          return {
            originalEvent: event, // Keep the original EventInterface for actions
            event: {
              id: eventId,
              pubkey: event.author().toHex(),
              created_at: Number(event.createdAt().asSecs()),
              kind: Number(event.kind()),
              content: event.content(),
              tags: [], // Would need to extract tags properly
              sig: '', // Would need to get signature
            },
            stats,
          } as PostWithStats & { originalEvent: EventInterface };
        } else {
          // Convert EventInterface to PostWithStats format even without stats
          return {
            originalEvent: event,
            event: {
              id: eventId,
              pubkey: event.author().toHex(),
              created_at: Number(event.createdAt().asSecs()),
              kind: Number(event.kind()),
              content: event.content(),
              tags: [],
              sig: '',
            },
            stats: undefined,
          } as PostWithStats & { originalEvent: EventInterface };
        }
      } catch (error) {
        console.error(
          'Error enhancing event with stats:',
          error,
          'Event:',
          event
        );
        return event; // Return as-is if there's an error
      }
    });
  }

  /**
   * Disconnect from cache server
   */
  disconnect(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
  }
}
