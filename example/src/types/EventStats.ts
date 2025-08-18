/**
 * Event Statistics
 * Based on kind 10,000,100 events that provide pre-computed engagement metrics
 */
export interface ContentEventStats {
  event_id: string;
  likes: number;
  replies: number;
  mentions: number;
  reposts: number;
  zaps: number;
  satszapped: number; // Total sats zapped
  score: number; // Trust-weighted overall score
  score24h: number; // 24-hour rolling score
}

/**
 * Enhanced post interface that includes engagement statistics
 */
export interface PostWithStats {
  event: any; // Original Nostr event
  stats?: ContentEventStats;
  authorName?: string;
}

/**
 * Cache filter for requesting enhanced feed data
 */
export interface CacheFilter {
  cache: [string, Record<string, any>?];
}
