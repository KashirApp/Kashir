import { Client, PublicKey, Filter, Kind } from 'kashir';
import type { PublicKeyInterface } from 'kashir';
import type { ProfileCache } from '../types';

export class ProfileService {
  private profileCache: Map<string, { name: string; loaded: boolean }> =
    new Map();

  async fetchProfileForPubkey(
    client: Client,
    pubkey: PublicKeyInterface
  ): Promise<string | null> {
    const hexKey = pubkey.toHex();

    // Check cache first
    const cached = this.profileCache.get(hexKey);
    if (cached && cached.loaded) {
      return cached.name || null;
    }

    try {
      // Create filter for kind 0 (metadata/profile) events
      const profileFilter = new Filter()
        .author(pubkey)
        .kinds([new Kind(0)])
        .limit(1n);

      const events = await client.fetchEvents(profileFilter, 10000 as any);
      const eventArray = events.toVec();

      if (eventArray.length > 0) {
        const profileEvent = eventArray[0];
        if (profileEvent) {
          const content = profileEvent.content();

          try {
            const profileData = JSON.parse(content);
            const name =
              profileData.name ||
              profileData.display_name ||
              profileData.username;

            if (name) {
              // Update cache
              this.profileCache.set(hexKey, { name, loaded: true });
              return name;
            }
          } catch (parseError) {
            console.error('Error parsing profile JSON:', parseError);
          }
        }
      }

      // Mark as loaded even if no name found
      this.profileCache.set(hexKey, { name: '', loaded: true });

      return null;
    } catch (error) {
      console.error('Error fetching profile for pubkey:', error);
      return null;
    }
  }

  async fetchProfilesForPubkeys(client: Client, pubkeys: PublicKeyInterface[]) {
    if (pubkeys.length === 0) return;

    // Filter out already cached profiles
    const uncachedPubkeys = pubkeys.filter((pk) => {
      const cached = this.profileCache.get(pk.toHex());
      return !cached || !cached.loaded;
    });

    if (uncachedPubkeys.length === 0) return;

    console.log(`Fetching profiles for ${uncachedPubkeys.length} users...`);

    // Fetch profiles in parallel (limit to 10 at a time to avoid overwhelming)
    const batchSize = 10;
    for (let i = 0; i < uncachedPubkeys.length; i += batchSize) {
      const batch = uncachedPubkeys.slice(i, i + batchSize);
      await Promise.all(
        batch.map((pk) => this.fetchProfileForPubkey(client, pk))
      );
    }
  }

  async fetchUserProfile(client: Client, userNpub: string): Promise<string> {
    try {
      const publicKey = PublicKey.parse(userNpub);

      // Create filter for kind 0 (metadata/profile) events
      const profileFilter = new Filter()
        .author(publicKey)
        .kinds([new Kind(0)])
        .limit(1n);

      console.log('Fetching user profile...');

      try {
        const events = await client.fetchEvents(profileFilter, 10000 as any);
        const eventArray = events.toVec();

        if (eventArray.length > 0) {
          const profileEvent = eventArray[0];
          if (profileEvent) {
            const content = profileEvent.content();

            try {
              const profileData = JSON.parse(content);
              const name =
                profileData.name ||
                profileData.display_name ||
                profileData.username;

              if (name) {
                console.log('Found user name:', name);
                return name;
              }
            } catch (parseError) {
              console.error('Error parsing profile JSON:', parseError);
            }
          }
        }
      } catch (fetchError) {
        console.error('Error fetching profile:', fetchError);
      }

      // Fallback to shortened npub
      return userNpub.substring(0, 8) + '...';
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      // Fallback to shortened npub
      return userNpub.substring(0, 8) + '...';
    }
  }

  async fetchLightningAddressForPubkey(
    client: Client,
    pubkey: PublicKeyInterface
  ): Promise<string | null> {
    try {
      // Create filter for kind 0 (metadata/profile) events
      const profileFilter = new Filter()
        .author(pubkey)
        .kinds([new Kind(0)])
        .limit(1n);

      const events = await client.fetchEvents(profileFilter, 10000 as any);
      const eventArray = events.toVec();

      if (eventArray.length > 0) {
        const profileEvent = eventArray[0];
        if (profileEvent) {
          const content = profileEvent.content();

          try {
            const profileData = JSON.parse(content);
            
            // Check for Lightning address (lud16) or LNURL (lud06)
            const lightningAddress = profileData.lud16;
            const lnurl = profileData.lud06;
            
            // Prefer Lightning address over LNURL
            if (lightningAddress) {
              console.log('Found Lightning address:', lightningAddress);
              return lightningAddress;
            } else if (lnurl) {
              console.log('Found LNURL:', lnurl);
              return lnurl;
            }
          } catch (parseError) {
            console.error('Error parsing profile JSON for Lightning info:', parseError);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error fetching Lightning address for pubkey:', error);
      return null;
    }
  }

  getProfileCache(): Map<string, { name: string; loaded: boolean }> {
    return this.profileCache;
  }
}
