import { Filter, Kind } from '../../../src';
import { NostrClient } from './NostrClient';
import { tagsToArray } from './NostrUtils';

export interface MintRecommendation {
  url: string;
  count: number;
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

  async fetchMintRecommendations(): Promise<MintRecommendation[]> {
    if (this.isFetching) {
      return this.recommendations;
    }

    this.isFetching = true;

    try {
      // Get the existing Nostr client
      const clientService = NostrClient.getInstance();
      let client = clientService.getClient();
      
      // Initialize if not already done
      if (!client) {
        client = await clientService.initialize();
      }

      if (!client) {
        console.error('Failed to get Nostr client');
        return [];
      }

      const filter = new Filter()
        .kinds([new Kind(38000)])
        .limit(2000n);

      console.log('Fetching mint recommendations...');

      const events = await client.fetchEvents(filter, 30000 as any);
      const eventArray = events.toVec();

      console.log(`Found ${eventArray.length} mint announcement events`);

      const mintUrls: string[] = [];

              // Process events to extract mint URLs
        for (const event of eventArray) {
          try {
            const tags = event.tags();
            const tagArrays = tagsToArray(tags);

            // Look for tags with k=38172 and u=mintUrl
            let hasCorrectKind = false;
            let mintUrl = '';

            for (const tagData of tagArrays) {
              if (tagData.length >= 2) {
                if (tagData[0] === 'k' && tagData[1] === '38172') {
                  hasCorrectKind = true;
                } else if (tagData[0] === 'u' && typeof tagData[1] === 'string') {
                  mintUrl = tagData[1];
                }
              }
            }

            // If both conditions are met, add the mint URL
            if (hasCorrectKind && mintUrl && mintUrl.startsWith('https://')) {
              mintUrls.push(mintUrl);
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

      // Convert to array and sort by count (show all with at least 1 recommendation)
      const recommendations: MintRecommendation[] = Array.from(mintUrlCounts.entries())
        .map(([url, count]) => ({ url, count }))
        .filter(({ count }) => count >= 1) // Only include mints with at least 1 recommendation
        .sort((a, b) => b.count - a.count); // Sort by recommendation count (highest first)

      this.recommendations = recommendations;
      console.log(`Generated ${recommendations.length} mint recommendations`);

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
} 