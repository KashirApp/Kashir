import {
  EventBuilder,
  EventId,
  PublicKey,
  Tag,
  Keys,
  SecretKey,
  Kind,
  ZapRequestData,
} from 'kashir';
import { NostrClientService, LoginType } from './NostrClient';
import { SecureStorageService } from './SecureStorageService';
import { ProfileService } from './ProfileService';
import { LNURLService } from './LNURLService';
import type { EventInterface } from 'kashir';

export class PostActionService {
  private static instance: PostActionService | null = null;
  private profileService = new ProfileService();
  private lnurlService = new LNURLService();

  private constructor() {}

  static getInstance(): PostActionService {
    if (!PostActionService.instance) {
      PostActionService.instance = new PostActionService();
    }
    return PostActionService.instance;
  }

  private async publishReactionEvent(
    client: any,
    signedEvent: any,
    postId: string
  ): Promise<void> {
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

  async repostPost(
    postId: string,
    originalEvent: EventInterface
  ): Promise<void> {
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

  async zapPost(
    postId: string,
    originalEvent: EventInterface,
    amount: number = 10,
    message?: string,
    sendPaymentCallback?: (invoice: string) => Promise<boolean>
  ): Promise<void> {
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

      // Get the author's public key from the original event
      const authorPubkey = originalEvent.author();

      // Step 1: Get the recipient's Lightning address from their profile
      const lightningAddress =
        await this.profileService.fetchLightningAddressForPubkey(
          client,
          authorPubkey
        );

      if (!lightningAddress) {
        throw new Error(
          'Recipient does not have a Lightning address set in their profile'
        );
      }

      console.log('Found Lightning address for recipient:', lightningAddress);

      // TODO: Get relays from user preferences or use default relays
      const relays = [
        'wss://relay.damus.io',
        'wss://nostr.wine',
        'wss://relay.nostr.band',
      ];

      // Step 2: Create zap request data
      const zapRequestData = new ZapRequestData(authorPubkey, relays);
      zapRequestData.amount(BigInt(amount * 1000)); // Convert sats to millisats
      zapRequestData.eventId(originalEvent.id());

      if (message) {
        zapRequestData.message(message);
      }

      // Step 3: Create and sign the zap request event
      let zapRequestEvent;
      if (session.type === LoginType.Amber) {
        // For Amber users, create a public zap request and sign it with Amber
        const signer = await client.signer();
        if (!signer) {
          throw new Error('Amber signer not available');
        }
        const eventBuilder = EventBuilder.publicZapRequest(zapRequestData);
        zapRequestEvent = await eventBuilder.sign(signer);
      } else if (session.type === LoginType.PrivateKey) {
        const privateKeyHex = await SecureStorageService.getNostrPrivateKey();
        if (!privateKeyHex) {
          throw new Error('Private key not found in secure storage');
        }
        const secretKey = SecretKey.parse(privateKeyHex);
        const keys = new Keys(secretKey);
        // Create a normal zap request event manually
        const eventBuilder = EventBuilder.publicZapRequest(zapRequestData);
        zapRequestEvent = await eventBuilder.sign(keys);
      } else {
        throw new Error('Unsupported login method for zaps');
      }

      // Step 4: Create Lightning invoice via LNURL-pay
      console.log('Creating Lightning invoice for zap...');

      // Convert the zap request event to JSON for the LNURL request
      const zapRequestJson = JSON.stringify({
        id: zapRequestEvent.id().toHex(),
        pubkey: zapRequestEvent.author().toHex(),
        created_at: Number(zapRequestEvent.createdAt().asSecs()),
        kind: zapRequestEvent.kind().asU16(),
        tags: zapRequestEvent
          .tags()
          .toVec()
          .map((tag) => tag.asVec()),
        content: zapRequestEvent.content(),
        sig: zapRequestEvent.signature(),
      });

      const invoice = await this.lnurlService.createZapInvoice(
        lightningAddress,
        amount,
        zapRequestJson
      );

      console.log('Lightning invoice created successfully');

      // Step 5: Pay the invoice using the wallet
      if (sendPaymentCallback) {
        console.log('Sending payment via wallet...');
        const paymentSuccess = await sendPaymentCallback(invoice);

        if (paymentSuccess) {
          console.log(`Successfully zapped ${amount} sats to post: ${postId}`);
          // Note: The zap receipt will be published by the Lightning service
          // when the payment is confirmed
        } else {
          console.log('Payment dialog shown, user needs to confirm manually');
          // Don't throw an error, just log that the payment dialog was shown
          // The user will see the confirmation dialog and can complete the payment
        }
      } else {
        // Fallback: just publish the zap request without payment
        console.log(
          'No payment callback provided, publishing zap request only...'
        );
        await client.sendEvent(zapRequestEvent);
        console.log(
          `Successfully created zap request for post: ${postId} with amount: ${amount} sats`
        );
      }
    } catch (error) {
      console.error('Failed to zap post:', error);
      throw error;
    }
  }
}
