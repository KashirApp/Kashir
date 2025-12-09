import {
  Client,
  Filter,
  Kind,
  KindStandard,
  NostrPublicKey as PublicKey,
  PublicKeyInterface,
  EventBuilder,
  Keys,
  EventId,
  EventDeletionRequest,
  Tag,
  nip44Encrypt,
  nip44Decrypt,
  Nip44Version,
} from 'kashir';

import { LoginType } from './NostrClient';
import { tagsToArray } from './NostrUtils';
import { getNostrKeys } from '../utils/nostrUtils';
import AmberService from './AmberService';

export interface FollowSet {
  identifier: string;
  publicKeys: PublicKeyInterface[];
  privateKeys?: PublicKeyInterface[]; // New: private keys from encrypted content
  createdAt: number;
  eventId: string;
  isPrivate?: boolean; // New: indicates if this is a private-only follow set
}

export class ListService {
  private static instance: ListService | null = null;

  private constructor() {}

  static getInstance(): ListService {
    if (!ListService.instance) {
      ListService.instance = new ListService();
    }
    return ListService.instance;
  }

  /**
   * Fetch user's contact list (kind 3) and NIP-51 follow sets (kind 30000)
   * If loginType is provided, will attempt to decrypt private members
   */
  async fetchUserFollowSets(
    client: Client,
    npub: string,
    loginType?: LoginType
  ): Promise<FollowSet[]> {
    try {
      const publicKey = PublicKey.parse(npub);

      // Auto-detect login type if not provided
      if (!loginType) {
        const { NostrClientService } = await import('./NostrClient');
        const clientService = NostrClientService.getInstance();
        const session = clientService.getCurrentSession();
        if (session) {
          loginType = session.type;
        }
      }

      const followSets: FollowSet[] = [];

      // First, fetch the kind 3 contact list (main following list)
      try {
        const contactListFilter = new Filter()
          .author(publicKey)
          .kinds([Kind.fromStd(KindStandard.ContactList)])
          .limit(1n);

        const contactEvents = await client.fetchEvents(
          contactListFilter,
          10000 as any
        );
        const contactEventArray = contactEvents.toVec();

        if (contactEventArray.length > 0) {
          const contactListEvent = contactEventArray[0];
          if (contactListEvent) {
            const tags = contactListEvent.tags();
            const tagArrays = tagsToArray(tags);
            const publicKeys: PublicKey[] = [];

            for (const tagArray of tagArrays) {
              if (tagArray.length >= 2 && tagArray[0] === 'p') {
                try {
                  const hexPubkey = tagArray[1];
                  let pubkey: PublicKey | null = null;

                  try {
                    pubkey = PublicKey.parse(hexPubkey);
                  } catch {
                    try {
                      pubkey = PublicKey.parse('hex:' + hexPubkey);
                    } catch {
                      console.warn(
                        'ListService: Invalid public key in contact list:',
                        hexPubkey
                      );
                    }
                  }

                  if (pubkey) {
                    publicKeys.push(pubkey);
                  }
                } catch {
                  console.warn(
                    'ListService: Error parsing pubkey from contact list'
                  );
                }
              }
            }

            // Add the main following list as the first entry
            followSets.push({
              identifier: 'Following',
              publicKeys,
              createdAt: Number(contactListEvent.createdAt().asSecs()),
              eventId: contactListEvent.id().toHex(),
            });
          }
        }
      } catch (error) {
        console.warn('ListService: Error fetching contact list:', error);
      }

      // Then, fetch NIP-51 follow sets (kind 30000)
      const filter = new Filter()
        .author(publicKey)
        .kind(Kind.fromStd(KindStandard.FollowSet))
        .limit(100n); // Get up to 100 follow sets

      const events = await client.fetchEvents(filter, 10000 as any);
      const eventArray = events.toVec();
      for (const event of eventArray) {
        try {
          // Extract identifier from 'd' tag
          const tags = event.tags();
          const tagArrays = tagsToArray(tags);
          let identifier = '';
          const publicKeys: PublicKey[] = [];

          // Check content before processing
          const content = event.content();
          for (const tagArray of tagArrays) {
            if (tagArray.length >= 2) {
              const tagType = tagArray[0];
              const tagValue = tagArray[1];

              if (tagType === 'd') {
                identifier = tagValue;
              } else if (tagType === 'p') {
                try {
                  const pk = PublicKey.parse(tagValue);
                  publicKeys.push(pk);
                } catch {
                  console.warn(
                    'ListService: Invalid public key in follow set:',
                    tagValue
                  );
                }
              }
            }
          }

          // Try to decrypt private keys from content field if available
          let privateKeys: PublicKeyInterface[] = [];

          if (content && content.trim() && loginType) {
            // Only try to decrypt if we have encrypted content and loginType
            try {
              privateKeys = await this.decryptPrivateKeys(
                content,
                loginType,
                client
              );
            } catch (error) {
              console.warn(
                `ListService: Failed to decrypt private keys for follow set "${identifier}":`,
                String(error) // Convert error to string to avoid stack getter issues
              );
              // Continue with just public keys if decryption fails
            }
          }

          if (identifier) {
            const followSet = {
              identifier,
              publicKeys,
              privateKeys: privateKeys.length > 0 ? privateKeys : undefined,
              createdAt: Number(event.createdAt().asSecs()),
              eventId: event.id().toHex(),
              isPrivate: privateKeys.length > 0 && publicKeys.length === 0, // Private-only if no public keys
            };

            followSets.push(followSet);
          }
        } catch (error) {
          console.warn(
            'ListService: Error processing follow set event:',
            error
          );
        }
      }

      // Sort by creation date (newest first), but keep "Following" at the top
      const mainFollowing = followSets.find(
        (set) => set.identifier === 'Following'
      );
      const otherSets = followSets.filter(
        (set) => set.identifier !== 'Following'
      );
      otherSets.sort((a, b) => b.createdAt - a.createdAt);

      const sortedFollowSets = mainFollowing
        ? [mainFollowing, ...otherSets]
        : otherSets;

      return sortedFollowSets;
    } catch (error) {
      console.error('ListService: Failed to fetch user follow sets:', error);
      return [];
    }
  }

  /**
   * Create a new follow set with both public and private members
   * Private members are encrypted using NIP-44 encryption
   */
  async createMixedFollowSet(
    client: Client,
    loginType: LoginType,
    identifier: string,
    publicKeys: PublicKeyInterface[],
    privateKeys?: PublicKeyInterface[]
  ): Promise<boolean> {
    // If no private keys, just create a regular follow set
    if (!privateKeys || privateKeys.length === 0) {
      return this.createFollowSet(client, loginType, identifier, publicKeys);
    }

    try {
      console.log(
        `ListService: Creating mixed follow set "${identifier}" with ${publicKeys.length} public and ${privateKeys.length} private users`
      );

      // Encrypt private keys using NIP-44 self-encryption
      let encryptedContent: string;

      if (loginType === LoginType.PrivateKey) {
        // Use stored keys for NIP-44 encryption
        const keys = await getNostrKeys();
        if (!keys) {
          throw new Error(
            'Private follow set members require stored private key for encryption. Please ensure your private key is available.'
          );
        }

        // Create the private keys array for encryption
        const privateKeysArray = privateKeys.map((pk) => ['p', pk.toHex()]);
        const privateKeysJson = JSON.stringify(privateKeysArray);

        // Encrypt to self using NIP-44
        const secretKey = keys.secretKey();
        const publicKey = keys.publicKey();
        encryptedContent = nip44Encrypt(
          secretKey,
          publicKey,
          privateKeysJson,
          Nip44Version.V2
        );
      } else if (loginType === LoginType.Amber) {
        // Use AmberService for NIP-44 encryption (will show Amber overlay if needed)
        const signer = await client.signer();
        if (!signer) {
          throw new Error('Amber signer not available');
        }

        // Get user's public key for self-encryption
        const userPublicKey = await signer.getPublicKey();
        if (!userPublicKey) {
          throw new Error('Unable to get public key from Amber signer');
        }

        // Create the private keys array for encryption
        const privateKeysArray = privateKeys.map((pk) => ['p', pk.toHex()]);
        const privateKeysJson = JSON.stringify(privateKeysArray);

        // Use AmberService's NIP-44 encryption (should show overlay, not external app)
        encryptedContent = await AmberService.nip44Encrypt(
          userPublicKey.toHex(),
          privateKeysJson,
          userPublicKey.toHex() // currentUser
        );
      } else {
        throw new Error('Unsupported login type for creating mixed follow set');
      }

      // Create the follow set event manually with encrypted content
      // Follow sets use Kind 30000 with 'd' tag for identifier and 'p' tags for public keys
      const followSetKind = new Kind(30000);

      // Add 'd' tag for identifier (required for replaceable events)
      const dTag = Tag.parse(['d', identifier]);
      const tags = [dTag];

      // Add 'p' tags for public keys
      publicKeys.forEach((pk) => {
        const pTag = Tag.parse(['p', pk.toHex()]);
        tags.push(pTag);
      });

      // Create EventBuilder with chained tags (proper builder pattern)
      const eventBuilder = new EventBuilder(
        followSetKind,
        encryptedContent
      ).tags(tags);

      let event: any;
      if (loginType === LoginType.PrivateKey) {
        // Sign with stored keys
        const keys = await this.getStoredKeys();
        if (!keys) {
          throw new Error('No stored keys found for signing');
        }
        event = eventBuilder.signWithKeys(keys);
      } else if (loginType === LoginType.Amber) {
        // Sign with Amber
        const signer = await client.signer();
        if (!signer) {
          throw new Error('Amber signer not available');
        }
        event = await eventBuilder.sign(signer);
      } else {
        throw new Error('Unsupported login type for creating mixed follow set');
      }

      await client.sendEvent(event);
      return true;
    } catch (error) {
      console.error(
        'ListService: Failed to create mixed follow set:',
        String(error)
      );
      return false;
    }
  }

  /**
   * Create a new follow set
   */
  async createFollowSet(
    client: Client,
    loginType: LoginType,
    identifier: string,
    publicKeys: PublicKeyInterface[]
  ): Promise<boolean> {
    try {
      // Create the follow set event
      const eventBuilder = EventBuilder.followSet(identifier, publicKeys);

      let event: any;
      if (loginType === LoginType.PrivateKey) {
        // Sign with stored keys
        const keys = await this.getStoredKeys();
        if (!keys) {
          throw new Error('No stored keys found for signing');
        }
        event = eventBuilder.signWithKeys(keys);
      } else if (loginType === LoginType.Amber) {
        // Sign with Amber
        const signer = await client.signer();
        if (!signer) {
          throw new Error('Amber signer not available');
        }
        event = await eventBuilder.sign(signer);
      } else {
        throw new Error('Unsupported login type for creating follow set');
      }

      await client.sendEvent(event);
      return true;
    } catch (error) {
      console.error('ListService: Failed to create follow set:', error);
      return false;
    }
  }

  /**
   * Delete a follow set by publishing a deletion event
   */
  async deleteFollowSet(
    client: Client,
    loginType: LoginType,
    _identifier: string,
    eventId: string
  ): Promise<boolean> {
    try {
      // Create deletion request (NIP-09)
      const deletionRequest: EventDeletionRequest = {
        ids: [EventId.parse(eventId)],
        coordinates: [],
        reason: undefined,
      };

      const eventBuilder = EventBuilder.delete_(deletionRequest);

      let event: any;
      if (loginType === LoginType.PrivateKey) {
        const keys = await this.getStoredKeys();
        if (!keys) {
          throw new Error('No stored keys found for signing');
        }
        event = eventBuilder.signWithKeys(keys);
      } else if (loginType === LoginType.Amber) {
        const signer = await client.signer();
        if (!signer) {
          throw new Error('Amber signer not available');
        }
        event = await eventBuilder.sign(signer);
      } else {
        throw new Error('Unsupported login type for deleting follow set');
      }

      await client.sendEvent(event);
      return true;
    } catch (error) {
      console.error('ListService: Failed to delete follow set:', error);
      return false;
    }
  }

  /**
   * Update an existing follow set with new public keys
   */
  async updateFollowSet(
    client: Client,
    loginType: LoginType,
    identifier: string,
    publicKeys: PublicKeyInterface[]
  ): Promise<boolean> {
    try {
      // Create a new follow set event with the same identifier (replaces the old one)
      return await this.createFollowSet(
        client,
        loginType,
        identifier,
        publicKeys
      );
    } catch (error) {
      console.error('ListService: Failed to update follow set:', error);
      return false;
    }
  }

  /**
   * Add a user to an existing follow set
   */
  async addUserToFollowSet(
    client: Client,
    loginType: LoginType,
    identifier: string,
    currentPublicKeys: PublicKeyInterface[],
    newPublicKey: PublicKeyInterface
  ): Promise<boolean> {
    try {
      // Check if user is already in the list
      const isAlreadyAdded = currentPublicKeys.some(
        (pk) => pk.toHex() === newPublicKey.toHex()
      );

      if (isAlreadyAdded) {
        return true;
      }

      const updatedPublicKeys = [...currentPublicKeys, newPublicKey];
      return await this.updateFollowSet(
        client,
        loginType,
        identifier,
        updatedPublicKeys
      );
    } catch (error) {
      console.error('ListService: Failed to add user to follow set:', error);
      return false;
    }
  }

  /**
   * Remove a user from an existing follow set
   */
  async removeUserFromFollowSet(
    client: Client,
    loginType: LoginType,
    identifier: string,
    currentPublicKeys: PublicKeyInterface[],
    publicKeyToRemove: PublicKeyInterface
  ): Promise<boolean> {
    try {
      const updatedPublicKeys = currentPublicKeys.filter(
        (pk) => pk.toHex() !== publicKeyToRemove.toHex()
      );

      return await this.updateFollowSet(
        client,
        loginType,
        identifier,
        updatedPublicKeys
      );
    } catch (error) {
      console.error(
        'ListService: Failed to remove user from follow set:',
        error
      );
      return false;
    }
  }

  /**
   * Decrypt private keys from encrypted content using NIP-44
   */
  private async decryptPrivateKeys(
    encryptedContent: string,
    loginType: LoginType,
    _client: Client
  ): Promise<PublicKeyInterface[]> {
    try {
      let decryptedJson: string;

      if (loginType === LoginType.PrivateKey) {
        // Use stored keys for NIP-44 decryption
        const keys = await getNostrKeys();
        if (!keys) {
          console.warn('ListService: No stored keys available for decryption');
          return [];
        }

        const secretKey = keys.secretKey();
        const publicKey = keys.publicKey();
        decryptedJson = nip44Decrypt(secretKey, publicKey, encryptedContent);
      } else if (loginType === LoginType.Amber) {
        // Use AmberService for NIP-44 decryption (will show Amber overlay if needed)
        const signer = await _client.signer();
        if (!signer) {
          console.warn(
            'ListService: Amber signer not available for decryption'
          );
          return [];
        }

        // Get user's public key for self-decryption
        const userPublicKey = await signer.getPublicKey();
        if (!userPublicKey) {
          console.warn(
            'ListService: Unable to get public key from Amber signer for decryption'
          );
          return [];
        }

        // Use AmberService's NIP-44 decryption (should show overlay, not external app)
        decryptedJson = await AmberService.nip44Decrypt(
          userPublicKey.toHex(),
          encryptedContent,
          userPublicKey.toHex() // currentUser
        );
      } else {
        console.warn('ListService: Unsupported login type for decryption');
        return [];
      }

      // Check if decryption failed
      if (
        !decryptedJson ||
        decryptedJson === 'Could not decrypt the message' ||
        decryptedJson.startsWith('Could not decrypt') ||
        decryptedJson.includes('error') ||
        decryptedJson.includes('Error')
      ) {
        console.warn('ListService: Amber decryption failed:', decryptedJson);
        return []; // Return empty array for failed decryption
      }

      // Parse the decrypted JSON to get private keys array
      const privateKeysArray = JSON.parse(decryptedJson) as string[][];
      const privateKeys: PublicKey[] = [];

      for (const tagArray of privateKeysArray) {
        if (tagArray.length >= 2 && tagArray[0] === 'p') {
          try {
            const hexPubkey = tagArray[1];
            let pubkey: PublicKey | null = null;

            try {
              pubkey = PublicKey.parse(hexPubkey);
            } catch {
              try {
                pubkey = PublicKey.parse('hex:' + hexPubkey);
              } catch {
                console.warn(
                  'ListService: Invalid private key in encrypted content:',
                  hexPubkey
                );
              }
            }

            if (pubkey) {
              privateKeys.push(pubkey);
            }
          } catch {
            console.warn(
              'ListService: Error parsing private key from encrypted content'
            );
          }
        }
      }

      return privateKeys;
    } catch (error) {
      console.error(
        'ListService: Failed to decrypt private keys:',
        String(error)
      );
      return [];
    }
  }
  private async getStoredKeys(): Promise<Keys | null> {
    return getNostrKeys();
  }
}
