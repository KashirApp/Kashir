import {
  Nip19,
  Nip19Enum_Tags,
  NostrPublicKey as PublicKey,
  EventId,
  Filter,
  NostrKeys as Keys,
  NostrSecretKey as SecretKey,
} from 'kashir';
import { ProfileService } from '../services/ProfileService';
import { CacheService } from '../services/CacheService';
import type { PostWithStats } from '../types/EventStats';
import type { Client } from 'kashir';

/**
 * Reusable utility to get Nostr keys from secure storage
 * Used by PostActionService, RelayListService, ListService, etc.
 */
export async function getNostrKeys(): Promise<Keys | null> {
  try {
    const { SecureStorageService } = await import(
      '../services/SecureStorageService'
    );
    const privateKeyHex = await SecureStorageService.getNostrPrivateKey();

    if (!privateKeyHex) {
      return null;
    }

    const secretKey = SecretKey.parse(privateKeyHex);
    return new Keys(secretKey);
  } catch (error) {
    console.error('Failed to get Nostr keys:', error);
    return null;
  }
}

/**
 * Extracts pubkeys from nostr URIs (nprofile and npub) in content
 */
export function extractPubkeysFromNprofiles(content: string): string[] {
  // Match both nprofile and npub formats
  const nostrRegex = /nostr:(nprofile1[a-z0-9]+|npub1[a-z0-9]+)/g;
  const pubkeys: string[] = [];
  const matches = content.match(nostrRegex);

  if (!matches) {
    return pubkeys;
  }

  matches.forEach((nostrUri) => {
    try {
      const bech32 = nostrUri.replace('nostr:', '');
      const nip19 = Nip19.fromBech32(bech32);
      const nip19Enum = nip19.asEnum();

      if (nip19Enum.tag === Nip19Enum_Tags.Profile) {
        // Handle nprofile format
        const profile = nip19Enum.inner.nprofile;
        const publicKey = profile.publicKey();
        const pubkeyHex = publicKey.toHex();
        pubkeys.push(pubkeyHex);
      } else if (nip19Enum.tag === Nip19Enum_Tags.Pubkey) {
        // Handle npub format
        const publicKey = nip19Enum.inner.npub;
        const pubkeyHex = publicKey.toHex();
        pubkeys.push(pubkeyHex);
      }
    } catch {
      // Skip invalid nostr URIs
    }
  });

  return pubkeys;
}

/**
 * Extracts event IDs from nostr:nevent URIs in content
 */
export function extractEventIdsFromNevents(content: string): string[] {
  const neventRegex = /nostr:nevent1[a-z0-9]+/g;
  const eventIds: string[] = [];
  const matches = content.match(neventRegex);

  if (!matches) {
    return eventIds;
  }

  matches.forEach((nostrUri) => {
    try {
      const bech32 = nostrUri.replace('nostr:', '');
      const nip19 = Nip19.fromBech32(bech32);
      const nip19Enum = nip19.asEnum();

      if (nip19Enum.tag === Nip19Enum_Tags.Event) {
        // Handle nevent format - the property is 'event', not 'nevent'
        const event = nip19Enum.inner.event;
        if (event && typeof event.eventId === 'function') {
          const eventId = event.eventId();
          const eventIdHex = eventId.toHex();
          eventIds.push(eventIdHex);
        }
      }
    } catch (error) {
      console.error('Error processing nevent URI:', nostrUri, error);
    }
  });

  return eventIds;
}

/**
 * Parses nostr:nprofile, nostr:npub, and nostr:nevent URIs
 * Replaces nprofile/npub with @username format and removes nevents (they'll be shown as embedded posts)
 */
export function parseNostrContent(
  content: string,
  profileService: ProfileService
): string {
  let parsedContent = content;

  // First handle nprofile format (existing working code)
  const nprofileRegex = /nostr:nprofile1[a-z0-9]+/g;
  const nprofileMatches = parsedContent.match(nprofileRegex);

  if (nprofileMatches) {
    nprofileMatches.forEach((nprofileUri) => {
      try {
        const username = getUsernameFromNprofile(nprofileUri, profileService);
        if (username) {
          parsedContent = parsedContent.replace(nprofileUri, `@${username}`);
        }
      } catch {
        // Keep the original nprofile if parsing fails
      }
    });
  }

  // Then handle npub format (new addition)
  const npubRegex = /nostr:npub1[a-z0-9]+/g;
  const npubMatches = parsedContent.match(npubRegex);

  if (npubMatches) {
    npubMatches.forEach((npubUri) => {
      try {
        const username = getUsernameFromNpub(npubUri, profileService);
        if (username) {
          parsedContent = parsedContent.replace(npubUri, `@${username}`);
        }
      } catch {
        // Keep the original npub if parsing fails
      }
    });
  }

  // Handle nevent format - remove them since they'll be shown as embedded posts
  const neventRegex = /nostr:nevent1[a-z0-9]+/g;
  parsedContent = parsedContent.replace(neventRegex, '').trim();

  // Clean up multiple spaces and newlines
  parsedContent = parsedContent.replace(/\s+/g, ' ').trim();

  return parsedContent;
}

/**
 * Extracts username from nprofile URI using Kashir's NIP19 decoder and profile service
 */
function getUsernameFromNprofile(
  nprofileUri: string,
  profileService: ProfileService
): string | null {
  try {
    // Remove 'nostr:' prefix to get the bech32 encoded nprofile
    const bech32Profile = nprofileUri.replace('nostr:', '');

    // Decode the nprofile using Kashir's NIP19 implementation
    const nip19 = Nip19.fromBech32(bech32Profile);
    const nip19Enum = nip19.asEnum();

    // Check if it's a profile type
    if (nip19Enum.tag === Nip19Enum_Tags.Profile) {
      const profile = nip19Enum.inner.nprofile;
      const publicKey = profile.publicKey();
      const pubkeyHex = publicKey.toHex();

      // Try to get the cached profile name
      const profileCache = profileService.getProfileCache();
      const cachedProfile = profileCache.get(pubkeyHex);

      if (cachedProfile && cachedProfile.name) {
        return cachedProfile.name;
      }

      // Return null if no name is available - profiles should have been fetched already
      return null;
    }

    return null;
  } catch {
    // Return null on any error - let the caller decide fallback
    return null;
  }
}

/**
 * Extracts username from npub URI using Kashir's NIP19 decoder and profile service
 */
function getUsernameFromNpub(
  npubUri: string,
  profileService: ProfileService
): string | null {
  try {
    // Remove 'nostr:' prefix to get the bech32 encoded npub
    const bech32Npub = npubUri.replace('nostr:', '');

    // Decode the npub using Kashir's NIP19 implementation
    const nip19 = Nip19.fromBech32(bech32Npub);
    const nip19Enum = nip19.asEnum();

    // Check if it's a pubkey type
    if (nip19Enum.tag === Nip19Enum_Tags.Pubkey) {
      const publicKey = nip19Enum.inner.npub;
      const pubkeyHex = publicKey.toHex();

      // Try to get the cached profile name
      const profileCache = profileService.getProfileCache();
      const cachedProfile = profileCache.get(pubkeyHex);

      if (cachedProfile && cachedProfile.name) {
        return cachedProfile.name;
      }

      // Return null if no name is available - profiles should have been fetched already
      return null;
    }

    return null;
  } catch {
    // Return null on any error - let the caller decide fallback
    return null;
  }
}

/**
 * Fetches profiles for users mentioned in nostr URIs within posts
 */
export async function fetchNprofileUsers(
  client: Client,
  profileService: ProfileService,
  postsToProcess: PostWithStats[]
): Promise<void> {
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
          await profileService.fetchProfilesForPubkeys(client, pubkeyObjects);
        }
      }
    } catch (error) {
      console.error('Error fetching nprofile user profiles:', error);
    }
  }
}

/**
 * Fetches embedded posts referenced by nevent URIs
 * Returns posts with loading state - parent component should handle stats fetching in batches
 */
export async function fetchEmbeddedPosts(
  client: Client,
  eventIds: string[],
  _onStatsUpdate?: (updatedPosts: Map<string, any>) => void
): Promise<Map<string, any>> {
  const embeddedPosts = new Map<string, any>();

  if (!client || eventIds.length === 0) {
    return embeddedPosts;
  }

  const cacheService = CacheService.getInstance();

  try {
    // Convert hex event IDs to EventId objects
    const eventIdObjects: any[] = [];

    eventIds.forEach((hexId) => {
      try {
        if (hexId && hexId.length === 64 && /^[0-9a-fA-F]{64}$/.test(hexId)) {
          const eventId = EventId.parse(hexId);
          eventIdObjects.push(eventId);
        }
      } catch (error) {
        console.error('Failed to parse event ID:', hexId, error);
      }
    });

    if (eventIdObjects.length === 0) {
      return embeddedPosts;
    }

    // Fetch events one by one (following DVMService pattern)
    for (let i = 0; i < eventIdObjects.length; i++) {
      try {
        const eventIdObj = eventIdObjects[i];
        const singleFilter = new Filter().id(eventIdObj).limit(BigInt(1));
        const responseEvents = await client.fetchEvents(singleFilter, 15000);

        if (responseEvents) {
          const eventsArray = responseEvents.toVec();

          if (eventsArray.length === 1) {
            const event = eventsArray[0];
            if (event) {
              try {
                const eventId = event.id().toHex();
                const authorHex = event.author().toHex();

                // Check if stats are already cached from the batch request
                const cachedStats = cacheService.getEmbeddedStats(eventId);

                const postData = {
                  event: {
                    id: eventId,
                    content: event.content(),
                    created_at: Number(event.createdAt().asSecs()),
                    pubkey: authorHex,
                    kind: Number(event.kind()),
                  },
                  stats: cachedStats, // Use cached stats if available
                  originalEvent: event,
                  isLoadingStats: !cachedStats, // Not loading if we have cached stats
                };
                embeddedPosts.set(eventId, postData);
              } catch (error) {
                console.error('Error processing embedded post:', error);
              }
            }
          }
        }
      } catch (fetchError) {
        console.error('Error during single event fetch:', fetchError);
      }
    }
  } catch (error) {
    console.error('Error fetching embedded posts:', error);
  }

  return embeddedPosts;
}
