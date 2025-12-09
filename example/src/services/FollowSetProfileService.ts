import { Client, NostrPublicKey as PublicKey, Filter, Kind } from 'kashir';
import { FollowSetsStorageService } from './FollowSetsStorageService';
import type { StoredUser } from './FollowSetsStorageService';
import type { FollowSet } from './ListService';

export class FollowSetProfileService {
  private static instance: FollowSetProfileService | null = null;

  private constructor() {}

  static getInstance(): FollowSetProfileService {
    if (!FollowSetProfileService.instance) {
      FollowSetProfileService.instance = new FollowSetProfileService();
    }
    return FollowSetProfileService.instance;
  }

  /**
   * Fetch and store profiles for all users in follow sets
   */
  async fetchAndStoreProfilesForFollowSets(
    client: Client,
    followSets: FollowSet[],
    userNpub: string
  ): Promise<void> {
    try {
      // Load stored follow sets to check lastProfilesFetched timestamps
      const storedFollowSets =
        await FollowSetsStorageService.loadFollowSets(userNpub);

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      for (const followSet of followSets) {
        // Check if this follow set's profiles need updating
        const storedSet = storedFollowSets.find(
          (s) => s.eventId === followSet.eventId
        );
        const needsUpdate =
          !storedSet?.lastProfilesFetched ||
          storedSet.lastProfilesFetched < oneDayAgo;

        if (!needsUpdate) {
          continue;
        }

        // Collect all unique public keys for this follow set
        const allPubkeys = new Set<string>();

        followSet.publicKeys.forEach((pk) => {
          try {
            const hex = pk.toHex();
            allPubkeys.add(hex);
          } catch {
            // Skip invalid keys silently
          }
        });

        followSet.privateKeys?.forEach((pk) => {
          try {
            const hex = pk.toHex();
            allPubkeys.add(hex);
          } catch {
            // Skip invalid keys silently
          }
        });

        if (allPubkeys.size === 0) {
          continue;
        }

        // Fetch profiles for this follow set
        const hexPubkeys = Array.from(allPubkeys);
        const updatedUsers: StoredUser[] = [];

        for (let i = 0; i < hexPubkeys.length; i += 20) {
          const batch = hexPubkeys.slice(i, i + 20);
          const batchUsers = await this.fetchProfileBatch(client, batch);
          updatedUsers.push(...batchUsers);
        }

        // Update storage with new profiles
        if (updatedUsers.length > 0) {
          const existingUsers =
            await FollowSetsStorageService.loadUsers(userNpub);
          const allUsers = { ...existingUsers };

          updatedUsers.forEach((user) => {
            allUsers[user.npub] = user;
          });

          const usersArray = Object.values(allUsers);
          await FollowSetsStorageService.saveUsers(usersArray, userNpub);
        }

        // Update the lastProfilesFetched timestamp for this follow set
        await FollowSetsStorageService.updateFollowSetProfilesTimestamp(
          followSet.eventId,
          userNpub
        );
      }
    } catch {
      // Don't throw error - profile fetching is optional
    }
  }

  /**
   * Fetch profiles for a batch of pubkeys
   */
  private async fetchProfileBatch(
    client: Client,
    hexPubkeys: string[]
  ): Promise<StoredUser[]> {
    try {
      // Convert hex pubkeys to PublicKey objects
      const publicKeys: PublicKey[] = [];
      const pubkeyMap = new Map<string, string>(); // hex -> hex mapping for lookup

      hexPubkeys.forEach((hexPubkey) => {
        try {
          // Try parsing without 'hex:' prefix first
          let pk: PublicKey;
          try {
            pk = PublicKey.parse(hexPubkey);
          } catch {
            // If that fails, try with 'hex:' prefix
            pk = PublicKey.parse('hex:' + hexPubkey);
          }

          publicKeys.push(pk);
          pubkeyMap.set(pk.toHex(), hexPubkey);
        } catch {
          console.log(
            `FollowSetProfileService: Failed to parse hex pubkey ${hexPubkey}`
          );
        }
      });

      if (publicKeys.length === 0) {
        return [];
      }

      // Create filter for kind 0 (metadata/profile) events
      const profileFilter = new Filter()
        .authors(publicKeys)
        .kinds([new Kind(0)])
        .limit(BigInt(publicKeys.length * 2)); // Get multiple events per author in case of updates

      const events = await client.fetchEvents(profileFilter, 15000 as any);
      const eventArray = events.toVec();

      // Process events and extract profiles
      const profileMap = new Map<string, StoredUser>();

      eventArray.forEach((event) => {
        if (!event) return;

        try {
          const authorHex = event.author().toHex();
          const content = event.content();

          let profileData: any = {};
          try {
            profileData = JSON.parse(content);
          } catch {
            console.warn(
              `FollowSetProfileService: Invalid JSON in profile for ${authorHex}`
            );
            return;
          }

          const username =
            profileData.name ||
            profileData.display_name ||
            profileData.username;

          // Convert hex to npub
          let npub: string;
          try {
            // Try parsing without 'hex:' prefix first (same fix as earlier)
            let pk: PublicKey;
            try {
              pk = PublicKey.parse(authorHex);
            } catch {
              // If that fails, try with 'hex:' prefix
              pk = PublicKey.parse('hex:' + authorHex);
            }
            npub = pk.toBech32();
          } catch {
            console.log(
              `FollowSetProfileService: Failed to convert hex to npub for ${authorHex}`
            );
            return;
          }

          const storedUser: StoredUser = {
            npub,
            username,
          };

          profileMap.set(authorHex, storedUser);
        } catch {
          console.log(`FollowSetProfileService: Error processing event`);
        }
      });

      // Create StoredUser objects for pubkeys that didn't have profiles
      const results: StoredUser[] = [];
      hexPubkeys.forEach((hexPubkey) => {
        const profile = profileMap.get(hexPubkey);
        if (profile) {
          results.push(profile);
        } else {
          // Create a minimal entry for users without profiles
          try {
            // Try parsing without 'hex:' prefix first
            let pk: PublicKey;
            try {
              pk = PublicKey.parse(hexPubkey);
            } catch {
              // If that fails, try with 'hex:' prefix
              pk = PublicKey.parse('hex:' + hexPubkey);
            }
            const npub = pk.toBech32();

            results.push({
              npub,
              username: undefined,
            });
          } catch {
            console.log(
              `FollowSetProfileService: Failed to create fallback user`
            );
          }
        }
      });

      return results;
    } catch {
      return [];
    }
  }

  /**
   * Get user profile from storage
   */
  async getStoredProfile(
    hexPubkey: string,
    userNpub: string
  ): Promise<StoredUser | null> {
    try {
      // Convert hex to npub for lookup
      let npub: string;
      try {
        let pk: PublicKey;
        try {
          pk = PublicKey.parse(hexPubkey);
        } catch {
          pk = PublicKey.parse('hex:' + hexPubkey);
        }
        npub = pk.toBech32();
      } catch {
        return null;
      }

      const users = await FollowSetsStorageService.loadUsers(userNpub);
      return users[npub] || null;
    } catch {
      return null;
    }
  }

  /**
   * Get display name for a user (username or truncated npub)
   */
  getDisplayName(user: StoredUser): string {
    if (user.username) {
      return user.username;
    }

    // Fallback to truncated npub
    if (user.npub.length > 16) {
      return (
        user.npub.substring(0, 8) +
        '...' +
        user.npub.substring(user.npub.length - 8)
      );
    }

    return user.npub;
  }

  /**
   * Get profiles for a specific follow set
   */
  async getProfilesForFollowSet(
    followSetEventId: string,
    userNpub: string
  ): Promise<StoredUser[]> {
    try {
      return await FollowSetsStorageService.getUsersForFollowSet(
        followSetEventId,
        userNpub
      );
    } catch {
      return [];
    }
  }
}
