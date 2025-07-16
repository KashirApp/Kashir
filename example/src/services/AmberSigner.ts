import { Linking } from 'react-native';
import { SignerBackend, PublicKey, Event } from 'kashir';
import type {
  CustomNostrSigner,
  PublicKeyInterface,
  UnsignedEventInterface,
  EventInterface,
} from 'kashir';
import AmberService from './AmberService';

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

  constructor() {
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

      const amberUrl = `nostrsigner:${encodeURIComponent(JSON.stringify(requestData))}`;

      Linking.openURL(amberUrl)
        .then(() => {
          // Success
        })
        .catch((error) => {
          this.pendingRequests.delete(id);
          reject(new Error(`Failed to open Amber: ${error.message}`));
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
    try {
      const permissions = [
        {
          type: 'nip04_encrypt',
        },
        {
          type: 'nip04_decrypt',
        },
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

            let publicKey: PublicKeyInterface;
            if (result.startsWith('npub')) {
              publicKey = PublicKey.parse(result);
            } else {
              publicKey = PublicKey.parse(result);
            }

            return publicKey;
          }
        } catch (error) {
          // Fallback to URL approach
        }
      }

      return this.getPublicKeyWithUrl(permissions);
    } catch (error) {
      console.error('Error getting public key from Amber:', error);
    }
    return undefined;
  }

  private async getPublicKeyWithUrl(
    permissions: any[]
  ): Promise<PublicKeyInterface | undefined> {
    try {
      const requestData = {
        type: 'get_public_key',
        permissions: permissions,
      };

      const amberUrl = `nostrsigner:${encodeURIComponent(JSON.stringify(requestData))}`;

      return new Promise((resolve, reject) => {
        const id = 'url_' + Math.random().toString(36).substring(7);
        this.pendingRequests.set(id, { resolve, reject });

        Linking.openURL(amberUrl)
          .then(() => {
            // Success
          })
          .catch((error) => {
            this.pendingRequests.delete(id);
            reject(new Error(`Failed to open Amber: ${error.message}`));
          });

        setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            this.pendingRequests.delete(id);
            reject(new Error('Amber request timed out'));
          }
        }, 30000);
      });
    } catch (error) {
      console.error('URL approach error:', error);
      throw error;
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
        timestamp = eventData.created_at?.asSecs ? Number(eventData.created_at.asSecs()) : 
                   eventData.created_at?.seconds ? Number(eventData.created_at.seconds) :
                   eventData.created_at ? Number(eventData.created_at) :
                   Math.floor(Date.now() / 1000);
      } catch (e) {
        timestamp = Math.floor(Date.now() / 1000);
      }

      let kind;
      try {
        kind = eventData.kind?.asU16 ? Number(eventData.kind.asU16()) :
               eventData.kind?.value ? Number(eventData.kind.value) :
               eventData.kind ? Number(eventData.kind) : 1;
      } catch (e) {
        kind = 1;
      }

      const eventJson = JSON.stringify({
        created_at: timestamp,
        kind: kind,
        tags: Array.isArray(eventData.tags) ? eventData.tags : [],
        content: eventData.content,
        pubkey: eventData.pubkey,
      });
      
      const result = await AmberService.signEvent(eventJson, this.currentUser);

      if (result) {
        const signedEventData = JSON.parse(result);
        return Event.fromJson(JSON.stringify(signedEventData));
      }
    } catch (error) {
      throw new Error(`Failed to sign event with Amber: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return undefined;
  }

  async nip04Encrypt(
    publicKey: PublicKeyInterface,
    content: string
  ): Promise<string> {
    try {
      if (!this.currentUser) {
        throw new Error('No user logged in with Amber');
      }

      const result = await this.makeAmberRequest('nip04_encrypt', {
        pubkey: publicKey.toHex(),
        plaintext: content,
      });

      return result;
    } catch (error) {
      console.error('Error encrypting with Amber:', error);
      throw error;
    }
  }

  async nip04Decrypt(
    publicKey: PublicKeyInterface,
    encryptedContent: string
  ): Promise<string> {
    try {
      if (!this.currentUser) {
        throw new Error('No user logged in with Amber');
      }

      const result = await this.makeAmberRequest('nip04_decrypt', {
        pubkey: publicKey.toHex(),
        ciphertext: encryptedContent,
      });

      return result;
    } catch (error) {
      console.error('Error decrypting with Amber:', error);
      throw error;
    }
  }

  async nip44Encrypt(
    publicKey: PublicKeyInterface,
    content: string
  ): Promise<string> {
    try {
      if (!this.currentUser) {
        throw new Error('No user logged in with Amber');
      }

      const result = await this.makeAmberRequest('nip44_encrypt', {
        pubkey: publicKey.toHex(),
        plaintext: content,
      });

      return result;
    } catch (error) {
      console.error('Error encrypting with NIP-44 via Amber:', error);
      throw error;
    }
  }

  async nip44Decrypt(
    publicKey: PublicKeyInterface,
    payload: string
  ): Promise<string> {
    try {
      if (!this.currentUser) {
        throw new Error('No user logged in with Amber');
      }

      const result = await this.makeAmberRequest('nip44_decrypt', {
        pubkey: publicKey.toHex(),
        ciphertext: payload,
      });

      return result;
    } catch (error) {
      console.error('Error decrypting with NIP-44 via Amber:', error);
      throw error;
    }
  }

  getCurrentUser(): string | undefined {
    return this.currentUser;
  }

  disconnect(): void {
    this.currentUser = undefined;
    this.pendingRequests.clear();
  }
}
