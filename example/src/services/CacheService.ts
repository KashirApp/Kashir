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
    if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

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
      let eoseReceived = false;

      const messageHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          const [type, subId, data] = message;

          if (subId !== subscriptionId) return;

          if (type === 'EVENT') {
            events.push(data);
          } else if (type === 'EOSE') {
            eoseReceived = true;
            this.wsClient?.removeEventListener('message', messageHandler);
            resolve(events);
          } else if (type === 'NOTICE') {
            console.warn('Cache notice:', data);
            // If we get an error notice, reject the promise
            if (
              data &&
              typeof data === 'string' &&
              data.toLowerCase().includes('error')
            ) {
              this.wsClient?.removeEventListener('message', messageHandler);
              reject(new Error(`Cache error: ${data}`));
              return;
            }
          }
        } catch (error) {
          console.error('Error parsing cache message:', error);
        }
      };

      this.wsClient.addEventListener('message', messageHandler);

      // Send request
      this.wsClient.send(JSON.stringify(request));

      // Timeout after 15 seconds
      setTimeout(() => {
        if (!eoseReceived) {
          this.wsClient?.removeEventListener('message', messageHandler);
          reject(new Error('Cache request timeout'));
        }
      }, 15000);
    });
  }

  /**
   * Fetch engagement statistics for specific event IDs using cache API
   * Based on Android client implementation that uses 'events' verb
   */
  async fetchEventStats(eventIds: string[]): Promise<ContentEventStats[]> {
    try {
      console.log(
        `Fetching engagement stats for ${eventIds.length} events from cache...`
      );

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

      console.log(
        `Successfully fetched stats for ${eventStats.length}/${eventIds.length} events`
      );
      return eventStats;
    } catch (error) {
      console.error('Error fetching event stats from cache:', error);
      throw error;
    }
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
          // Return as-is if no stats available
          return event;
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
