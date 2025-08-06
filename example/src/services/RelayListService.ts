import { Client, Filter, Kind, PublicKey, extractRelayList, RelayMetadata } from 'kashir';

export interface UserRelayInfo {
  url: string;
  metadata?: RelayMetadata;
}

export class RelayListService {
  private static instance: RelayListService | null = null;

  private constructor() {}

  static getInstance(): RelayListService {
    if (!RelayListService.instance) {
      RelayListService.instance = new RelayListService();
    }
    return RelayListService.instance;
  }

  /**
   * Fetch user's NIP-65 relay list from the network
   */
  async fetchUserRelayList(client: Client, npub: string): Promise<UserRelayInfo[]> {
    try {
      console.log('RelayListService: Creating public key from npub:', npub);
      
      const publicKey = PublicKey.parse(npub);
      console.log('RelayListService: Successfully created PublicKey');
      
      // Create filter for NIP-65 relay list metadata (kind 10002)
      const filter = new Filter()
        .author(publicKey)
        .kind(new Kind(10002))
        .limit(1n);

      console.log('RelayListService: Created filter for relay list, fetching events...');
      
      // Query relays for the user's relay list
      const events = await client.fetchEvents(filter, 10000 as any); // 10 second timeout
      const eventArray = events.toVec();

      console.log(`RelayListService: Received ${eventArray.length} events`);

      if (eventArray.length === 0) {
        console.log('RelayListService: No relay list found for user');
        return [];
      }

      // Get the most recent relay list event
      const relayListEvent = eventArray[0];
      if (!relayListEvent) {
        console.log('RelayListService: No valid relay list event found');
        return [];
      }
      
      console.log('RelayListService: Found relay list event:', relayListEvent.id().toHex());
      
      // Extract relay information using the NIP-65 function
      console.log('RelayListService: Extracting relay information...');
      const relayMap = extractRelayList(relayListEvent);
      
      console.log('RelayListService: Relay map size:', relayMap.size);
      
      // Convert to our format
      const userRelays: UserRelayInfo[] = [];
      relayMap.forEach((metadata, url) => {
        console.log(`RelayListService: Found relay ${url} with metadata:`, metadata);
        userRelays.push({
          url,
          metadata,
        });
      });

      console.log(`RelayListService: Extracted ${userRelays.length} relays from user's relay list`);
      return userRelays;
    } catch (error) {
      console.error('RelayListService: Failed to fetch user relay list:', error);
      return [];
    }
  }

  /**
   * Convert user relay info to simple URL array for the existing storage system
   */
  relayInfoToUrls(relayInfo: UserRelayInfo[]): string[] {
    return relayInfo.map(info => info.url);
  }

  /**
   * Group relays by their metadata type
   */
  groupRelaysByType(relayInfo: UserRelayInfo[]): {
    readWrite: UserRelayInfo[];
    read: UserRelayInfo[];
    write: UserRelayInfo[];
  } {
    const readWrite: UserRelayInfo[] = [];
    const read: UserRelayInfo[] = [];
    const write: UserRelayInfo[] = [];

    relayInfo.forEach(info => {
      if (!info.metadata) {
        // No metadata means read/write
        readWrite.push(info);
      } else {
        // Convert to string to compare
        const metadataStr = String(info.metadata);
        if (metadataStr.includes('Read') || metadataStr === '0') {
          read.push(info);
        } else if (metadataStr.includes('Write') || metadataStr === '1') {
          write.push(info);
        } else {
          // Fallback to read/write for unknown types
          readWrite.push(info);
        }
      }
    });

    return { readWrite, read, write };
  }

  /**
   * Get display name for relay metadata
   */
  getMetadataDisplayName(metadata?: RelayMetadata): string {
    if (!metadata) return 'Read/Write';
    
    // Convert to string to safely compare
    const metadataStr = String(metadata);
    if (metadataStr.includes('Read') || metadataStr === '0') {
      return 'Read Only';
    } else if (metadataStr.includes('Write') || metadataStr === '1') {
      return 'Write Only';
    }
    return 'Unknown';
  }
}