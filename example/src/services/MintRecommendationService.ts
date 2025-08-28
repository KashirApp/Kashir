import { Filter, Kind, PublicKey } from 'kashir';
import { NostrClientService } from './NostrClient';
import { tagsToArray } from './NostrUtils';

export interface MintComment {
  pubkey: string;
  content: string;
  createdAt: number;
  npub: string;
  rating?: number;
  review?: string;
}

export interface MintRecommendation {
  url: string;
  count: number;
  comments: MintComment[];
}

export class MintRecommendationService {
  private static instance: MintRecommendationService | null = null;
  private recommendations: MintRecommendation[] = [];
  private isFetching = false;

  private constructor() {}

  static getInstance(): MintRecommendationService {
    if (!MintRecommendationService.instance) {
      MintRecommendationService.instance = new MintRecommendationService();
    }
    return MintRecommendationService.instance;
  }

  async fetchMintRecommendations(
    forceRefresh: boolean = false
  ): Promise<MintRecommendation[]> {
    if (this.isFetching && !forceRefresh) {
      return this.recommendations;
    }

    // If force refresh, clear cache first
    if (forceRefresh) {
      this.recommendations = [];
      this.isFetching = false;
    }

    this.isFetching = true;

    try {
      // Get the existing Nostr client
      const clientService = NostrClientService.getInstance();
      let client = clientService.getClient();

      // Initialize if not already done
      if (!client) {
        client = await clientService.initialize();
      }

      if (!client) {
        console.error('Failed to get Nostr client');
        return [];
      }

      const filter = new Filter().kinds([new Kind(38000)]).limit(2000n);

      const events = await client.fetchEvents(filter, 30000 as any);
      const eventArray = events.toVec();

      const mintUrls: string[] = [];
      const mintComments = new Map<string, MintComment[]>();

      // Process events to extract mint URLs AND collect comments
      for (const event of eventArray) {
        try {
          const tags = event.tags();
          const tagArrays = tagsToArray(tags);

          // Look for NIP-87 recommendation events (kind 38000) that reference mint info events
          let hasCorrectKind = false;
          const eventMintUrls: string[] = [];

          for (const tagData of tagArrays) {
            if (tagData.length >= 2) {
              // 'a' tag format: "38172:pubkey:identifier" for Cashu mint info
              if (tagData[0] === 'a' && typeof tagData[1] === 'string') {
                const aParts = tagData[1].split(':');
                if (aParts[0] === '38172') {
                  hasCorrectKind = true;
                }
              } else if (tagData[0] === 'k' && typeof tagData[1] === 'string') {
                // 'k' tag for kind being recommended (38172 for Cashu mint info)
                if (tagData[1] === '38172') {
                  hasCorrectKind = true;
                }
              } else if (tagData[0] === 'u' && typeof tagData[1] === 'string') {
                // For Cashu mints, u tag should be HTTPS URL
                if (tagData[1].startsWith('https://')) {
                  eventMintUrls.push(tagData[1]);
                }
              }
            }
          }

          if (hasCorrectKind && eventMintUrls.length > 0) {
            for (const mintUrl of eventMintUrls) {
              mintUrls.push(mintUrl);

              // Collect comment data
              let pubkey;
              try {
                pubkey = event.author().toHex();
              } catch {
                pubkey = null;
              }
              const content = event.content() || '';

              if (pubkey && typeof pubkey === 'string' && pubkey.length > 0) {
                try {
                  const npub = PublicKey.parse(pubkey).toBech32();
                  const createdAt = Number(event.createdAt().asSecs());

                  // Parse rating and review from content
                  const ratingMatch = content.match(/\[(\d)\/5\]/);
                  const rating = ratingMatch
                    ? parseInt(ratingMatch[1], 10)
                    : undefined;
                  const review = content.replace(/\[(\d)\/5\]/, '').trim();

                  // Skip comments that have neither rating nor review text
                  if (!rating && (!review || review.length === 0)) {
                    continue;
                  }

                  const comment: MintComment = {
                    pubkey,
                    content,
                    createdAt,
                    npub,
                    rating,
                    review: review.length > 0 ? review : undefined,
                  };

                  if (!mintComments.has(mintUrl)) {
                    mintComments.set(mintUrl, []);
                  }
                  mintComments.get(mintUrl)!.push(comment);
                } catch {
                  // Fallback for invalid pubkey format
                  const ratingMatch = content.match(/\[(\d)\/5\]/);
                  const rating = ratingMatch
                    ? parseInt(ratingMatch[1], 10)
                    : undefined;
                  const review = content.replace(/\[(\d)\/5\]/, '').trim();

                  // Skip comments that have neither rating nor review text
                  if (!rating && (!review || review.length === 0)) {
                    continue;
                  }

                  const comment: MintComment = {
                    pubkey,
                    content,
                    createdAt: Number(event.createdAt().asSecs()),
                    npub: pubkey.substring(0, 16) + '...',
                    rating,
                    review: review.length > 0 ? review : undefined,
                  };

                  if (!mintComments.has(mintUrl)) {
                    mintComments.set(mintUrl, []);
                  }
                  mintComments.get(mintUrl)!.push(comment);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing event:', error);
        }
      }

      // Count occurrences of each mint URL
      const mintUrlCounts = new Map<string, number>();
      for (const url of mintUrls) {
        mintUrlCounts.set(url, (mintUrlCounts.get(url) || 0) + 1);
      }

      // Convert to array and sort by count, adding comments
      const recommendations: MintRecommendation[] = Array.from(
        mintUrlCounts.entries()
      )
        .map(([url, count]) => {
          const comments = (mintComments.get(url) || []).sort(
            (a, b) => b.createdAt - a.createdAt
          );
          return {
            url,
            count,
            comments,
          };
        })
        .filter(({ count }) => count >= 1)
        .sort((a, b) => b.count - a.count);

      this.recommendations = recommendations;
      return recommendations;
    } catch (error) {
      console.error('Error fetching mint recommendations:', error);
      return [];
    } finally {
      this.isFetching = false;
    }
  }

  getRecommendations(): MintRecommendation[] {
    return this.recommendations;
  }

  // Clear cached data to force fresh fetch
  clearCache(): void {
    this.recommendations = [];
    this.isFetching = false;
  }
}
