import { Linking } from 'react-native';
import { SignerBackend, PublicKey, Event } from 'kashir';
import type {
  CustomNostrSigner,
  PublicKeyInterface,
  UnsignedEventInterface,
  EventInterface,
} from 'kashir';
import AmberService from './AmberService';
import { createAmberUrl, createAmberErrorMessage } from './AmberUtils';
import IntentLauncher from './IntentLauncher';

export interface AmberResponse {
  id: string;
  result?: string;
  error?: string;
}

export class AmberSigner implements CustomNostrSigner {
  private pendingRequests: Map<
    string,
    { resolve: Function; reject: Function }
  > = new Map();
  private currentUser?: string;

  constructor(currentUser?: string) {
    this.currentUser = currentUser;
    this.setupDeepLinkListener();
  }

  backend(): SignerBackend {
    return new SignerBackend.Custom({ backend: 'amber' });
  }

  private setupDeepLinkListener(): void {
    // Handle incoming URLs when app is already running
    Linking.addEventListener('url', this.handleDeepLink.bind(this));

    // Handle initial URL when app is launched via deep link
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          this.handleDeepLink({ url });
        }
      })
      .catch((error) => {
        console.error('AmberSigner: Error getting initial URL:', error);
      });
  }

  private handleDeepLink({ url }: { url: string }): void {
    try {
      if (url.startsWith('nostrsigner:')) {
        const jsonPart = url.substring('nostrsigner:'.length);
        const decoded = decodeURIComponent(jsonPart);

        try {
          const response = JSON.parse(decoded);

          if (response.result && this.pendingRequests.size > 0) {
            const firstId = Array.from(this.pendingRequests.keys())[0];
            if (firstId) {
              const { resolve } = this.pendingRequests.get(firstId)!;
              this.pendingRequests.delete(firstId);
              resolve(response.result);
              return;
            }
          }

          if (response.id && this.pendingRequests.has(response.id)) {
            const { resolve, reject } = this.pendingRequests.get(response.id)!;
            this.pendingRequests.delete(response.id);

            if (response.error) {
              reject(new Error(response.error));
            } else if (response.result) {
              resolve(response.result);
            } else {
              reject(new Error('No result received from Amber'));
            }
          }
        } catch (parseError) {
          console.error('Failed to parse response JSON:', parseError);
        }
      }
    } catch (error) {
      console.error('Error handling deep link:', error);
    }
  }

  private async makeAmberRequest(
    type: string,
    data: any = {}
  ): Promise<string> {
    const id = Math.random().toString(36).substring(7);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      let requestData: any;

      if (type === 'get_public_key') {
        requestData = {
          type,
          permissions: data.permissions || [],
        };
      } else {
        requestData = {
          id,
          type,
          returnUrl: `kashir://amber-response?id=${id}`,
          ...data,
        };

        if (this.currentUser) {
          requestData.current_user = this.currentUser;
        }
      }

      const amberUrl = createAmberUrl(requestData);

      Linking.openURL(amberUrl)
        .then(() => {
          // Success
        })
        .catch((error) => {
          this.pendingRequests.delete(id);
          reject(new Error(createAmberErrorMessage('open Amber', error)));
        });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Amber request timed out'));
        }
      }, 60000);
    });
  }

  async getPublicKey(): Promise<PublicKeyInterface | undefined> {
    // If we have currentUser (from storage), parse it directly
    if (this.currentUser) {
      try {
        return PublicKey.parse(this.currentUser);
      } catch (error) {
        console.error(
          'AmberSigner: Failed to parse currentUser as public key:',
          error
        );
      }
    }

    // Try AmberService (overlay) first, fallback to external ActivityResult
    try {
      const permissions = [
        {
          type: 'sign_event',
          kind: 37818,
        },
        {
          type: 'sign_event',
          kind: 30078,
        },
      ];

      if (AmberService) {
        try {
          const permissionsJson = JSON.stringify(permissions);
          const result = await AmberService.getPublicKey(permissionsJson);

          if (result) {
            this.currentUser = result;
            return PublicKey.parse(result);
          }
        } catch {
          // Fallback to external ActivityResult approach
        }
      }

      return this.getPublicKeyWithActivityResult(permissions);
    } catch (error) {
      console.error('Error getting public key from Amber:', error);
    }
    return undefined;
  }

  private async getPublicKeyWithActivityResult(
    permissions: any[]
  ): Promise<PublicKeyInterface | undefined> {
    try {
      const permissionsJson = JSON.stringify(permissions);
      const result = await IntentLauncher.startActivity({
        action: 'android.intent.action.VIEW',
        data: 'nostrsigner:',
        extra: {
          permissions: permissionsJson,
          type: 'get_public_key',
        },
      });

      // Extract public key from result - Amber returns it in 'signature' field for get_public_key
      const npubOrPubkey = result.extra.signature;
      if (!npubOrPubkey) {
        throw new Error('No public key received from Amber');
      }

      this.currentUser = npubOrPubkey;
      return PublicKey.parse(npubOrPubkey);
    } catch (error) {
      throw new Error(
        createAmberErrorMessage('get public key via ActivityResult', error)
      );
    }
  }

  private async signEventWithActivityResult(
    eventJson: string,
    eventId?: string,
    currentUser?: string
  ): Promise<EventInterface | undefined> {
    try {
      const result = await IntentLauncher.startActivity({
        action: 'android.intent.action.VIEW',
        data: `nostrsigner:${eventJson}`,
        extra: {
          type: 'sign_event',
          id: eventId || '',
          current_user: currentUser || this.currentUser || '',
        },
      });

      // Extract signature from result - Amber returns just the signature for sign_event
      const signature = result.extra.signature;
      if (!signature) {
        throw new Error('No signature received from Amber');
      }

      // Parse the original event JSON to get event data
      const eventData = JSON.parse(eventJson);

      // Reconstruct the complete signed event
      const signedEventData = {
        id: eventId || '',
        ...eventData,
        sig: signature,
      };

      return Event.fromJson(JSON.stringify(signedEventData));
    } catch (error) {
      throw new Error(
        createAmberErrorMessage('sign event via ActivityResult', error)
      );
    }
  }

  async signEvent(
    unsignedEvent: UnsignedEventInterface
  ): Promise<EventInterface | undefined> {
    try {
      if (!this.currentUser) {
        throw new Error('No user logged in with Amber');
      }

      const eventData = {
        created_at: unsignedEvent.createdAt(),
        kind: unsignedEvent.kind(),
        tags: unsignedEvent.tags(),
        content: unsignedEvent.content(),
        pubkey: unsignedEvent.author().toHex(),
      };

      let timestamp;
      try {
        timestamp = eventData.created_at?.asSecs
          ? Number(eventData.created_at.asSecs())
          : (eventData.created_at as any)?.seconds
            ? Number((eventData.created_at as any).seconds)
            : eventData.created_at
              ? Number(eventData.created_at)
              : Math.floor(Date.now() / 1000);
      } catch {
        timestamp = Math.floor(Date.now() / 1000);
      }

      let kind;
      try {
        kind = eventData.kind?.asU16
          ? Number(eventData.kind.asU16())
          : (eventData.kind as any)?.value
            ? Number((eventData.kind as any).value)
            : eventData.kind
              ? Number(eventData.kind)
              : 1;
      } catch {
        kind = 1;
      }

      // Convert Tags FFI object to JavaScript array for Amber
      let tagsArray = [];
      try {
        if (eventData.tags && typeof eventData.tags.toVec === 'function') {
          const tagsVec = eventData.tags.toVec();
          tagsArray = tagsVec.map((tag: any) => {
            try {
              return tag.asVec();
            } catch (e) {
              console.log(
                'AmberSigner: Error converting tag to vec:',
                e.message
              );
              return [];
            }
          });
        }
      } catch (e) {
        console.log('AmberSigner: Error processing tags:', e.message);
        tagsArray = [];
      }

      const eventJson = JSON.stringify({
        created_at: timestamp,
        kind: kind,
        tags: tagsArray,
        content: eventData.content,
        pubkey: eventData.pubkey,
      });

      // Try AmberService (overlay) first, fallback to ActivityResult (external)
      try {
        const result = await AmberService.signEvent(
          eventJson,
          this.currentUser
        );
        if (result) {
          return Event.fromJson(result);
        }
      } catch (overlayError) {
        // Fallback to ActivityResult approach
        try {
          const eventId = unsignedEvent.id()?.toHex();
          return await this.signEventWithActivityResult(
            eventJson,
            eventId,
            this.currentUser
          );
        } catch (activityError) {
          throw new Error(
            `Both overlay and external signing failed. Overlay: ${overlayError.message}, External: ${activityError.message}`
          );
        }
      }
    } catch (error) {
      throw new Error(createAmberErrorMessage('sign event with Amber', error));
    }
    return undefined;
  }

  getCurrentUser(): string | undefined {
    return this.currentUser;
  }

  disconnect(): void {
    this.currentUser = undefined;
    this.pendingRequests.clear();
  }
}
