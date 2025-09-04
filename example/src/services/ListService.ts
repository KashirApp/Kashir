import {
  Client,
  Filter,
  Kind,
  KindStandard,
  PublicKey,
  PublicKeyInterface,
  EventBuilder,
  Keys,
  EventId,
  EventDeletionRequest,
} from 'kashir';

import { LoginType } from './NostrClient';
import { tagsToArray } from './NostrUtils';
import { getNostrKeys } from '../utils/nostrUtils';

export interface FollowSet {
  identifier: string;
  publicKeys: PublicKeyInterface[];
  createdAt: number;
  eventId: string;
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
   */
  async fetchUserFollowSets(
    client: Client,
    npub: string
  ): Promise<FollowSet[]> {
    try {
      console.log('ListService: Creating public key from npub:', npub);

      const publicKey = PublicKey.parse(npub);
      console.log('ListService: Successfully created PublicKey');

      const followSets: FollowSet[] = [];

      // First, fetch the kind 3 contact list (main following list)
      try {
        const contactListFilter = new Filter()
          .author(publicKey)
          .kinds([Kind.fromStd(KindStandard.ContactList)])
          .limit(1n);

        console.log('ListService: Querying for contact list...');
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

            console.log(
              `ListService: Found main following list with ${publicKeys.length} users`
            );
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

      console.log('ListService: Querying for follow sets...');

      const events = await client.fetchEvents(filter, 10000 as any);
      const eventArray = events.toVec();
      console.log(`ListService: Found ${eventArray.length} follow set events`);

      for (const event of eventArray) {
        try {
          // Extract identifier from 'd' tag
          const tags = event.tags();
          const tagArrays = tagsToArray(tags);
          let identifier = '';
          const publicKeys: PublicKey[] = [];

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

          if (identifier) {
            followSets.push({
              identifier,
              publicKeys,
              createdAt: Number(event.createdAt().asSecs()),
              eventId: event.id().toHex(),
            });
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

      console.log(
        `ListService: Successfully parsed ${sortedFollowSets.length} follow sets (including main following list)`
      );
      return sortedFollowSets;
    } catch (error) {
      console.error('ListService: Failed to fetch user follow sets:', error);
      return [];
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
      console.log(
        `ListService: Creating follow set "${identifier}" with ${publicKeys.length} users`
      );

      // Create the follow set event
      const eventBuilder = EventBuilder.followSet(identifier, publicKeys);

      let event;
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

      // Send the event
      await client.sendEvent(event);
      console.log('ListService: Successfully created and sent follow set');
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
    identifier: string,
    eventId: string
  ): Promise<boolean> {
    try {
      console.log(`ListService: Deleting follow set "${identifier}"`);

      // Create deletion request (NIP-09)
      const deletionRequest: EventDeletionRequest = {
        ids: [EventId.parse(eventId)],
        coordinates: [],
        reason: undefined,
      };

      const eventBuilder = EventBuilder.delete_(deletionRequest);

      let event;
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
      console.log('ListService: Successfully deleted follow set');
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
      console.log(
        `ListService: Updating follow set "${identifier}" with ${publicKeys.length} users`
      );

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
        console.log('ListService: User already in follow set');
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
   * Helper method to get stored keys (uses reusable utility)
   */
  private async getStoredKeys(): Promise<Keys | null> {
    return getNostrKeys();
  }
}
