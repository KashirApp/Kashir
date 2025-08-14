import { EventBuilder, EventId, PublicKey, Tag, Keys, SecretKey, Kind } from 'kashir';
import { NostrClientService, LoginType } from './NostrClient';
import { SecureStorageService } from './SecureStorageService';
import type { EventInterface } from 'kashir';

export class PostActionService {
  private static instance: PostActionService | null = null;

  private constructor() {}

  static getInstance(): PostActionService {
    if (!PostActionService.instance) {
      PostActionService.instance = new PostActionService();
    }
    return PostActionService.instance;
  }

  private async publishReactionEvent(client: any, signedEvent: any, postId: string): Promise<void> {
    await client.sendEvent(signedEvent);
    console.log(`Successfully liked post: ${postId}`);
  }

  async likePost(postId: string, originalEvent: EventInterface): Promise<void> {
    try {
      const clientService = NostrClientService.getInstance();
      const client = clientService.getClient();
      const session = clientService.getCurrentSession();

      if (!client) {
        throw new Error('Client not available');
      }

      if (!session) {
        throw new Error('User not logged in');
      }

      // Create reaction event with proper NIP-25 tags
      const eventId = originalEvent.id().toHex();
      const authorPubkey = originalEvent.author().toHex();
      
      const eventTag = Tag.parse(['e', eventId]);
      const pubkeyTag = Tag.parse(['p', authorPubkey]);
      
      const reactionKind = new Kind(7); // Kind 7 for reactions
      const eventBuilder = new EventBuilder(reactionKind, '+')
        .tags([eventTag, pubkeyTag])
        .allowSelfTagging();

      let signedEvent;
      if (session.type === LoginType.Amber) {
        const signer = await client.signer();
        if (!signer) {
          throw new Error('Amber signer not available');
        }
        signedEvent = await eventBuilder.sign(signer);
      } else if (session.type === LoginType.PrivateKey) {
        const privateKeyHex = await SecureStorageService.getNostrPrivateKey();
        if (!privateKeyHex) {
          throw new Error('Private key not found in secure storage');
        }
        const secretKey = SecretKey.parse(privateKeyHex);
        const keys = new Keys(secretKey);
        signedEvent = eventBuilder.signWithKeys(keys);
      } else {
        throw new Error('No signing method available');
      }

      await this.publishReactionEvent(client, signedEvent, postId);
    } catch (error) {
      console.error('Failed to like post:', error);
      throw error;
    }
  }

  async repostPost(postId: string, originalEvent: EventInterface): Promise<void> {
    try {
      const clientService = NostrClientService.getInstance();
      const client = clientService.getClient();
      const session = clientService.getCurrentSession();

      if (!client) {
        throw new Error('Client not available');
      }

      if (!session) {
        throw new Error('User not logged in');
      }

      const eventBuilder = EventBuilder.repost(originalEvent);

      let signedEvent;
      if (session.type === LoginType.Amber) {
        const signer = await client.signer();
        if (!signer) {
          throw new Error('Amber signer not available');
        }
        signedEvent = await eventBuilder.sign(signer);
      } else if (session.type === LoginType.PrivateKey) {
        const privateKeyHex = await SecureStorageService.getNostrPrivateKey();
        if (!privateKeyHex) {
          throw new Error('Private key not found in secure storage');
        }
        const secretKey = SecretKey.parse(privateKeyHex);
        const keys = new Keys(secretKey);
        signedEvent = eventBuilder.signWithKeys(keys);
      } else {
        throw new Error('No signing method available');
      }

      await client.sendEvent(signedEvent);
      console.log(`Successfully reposted post: ${postId}`);
    } catch (error) {
      console.error('Failed to repost post:', error);
      throw error;
    }
  }
}