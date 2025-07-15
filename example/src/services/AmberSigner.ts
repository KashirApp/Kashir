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
          console.log('AmberSigner: Initial URL received:', url);
          this.handleDeepLink({ url });
        }
      })
      .catch((error) => {
        console.error('AmberSigner: Error getting initial URL:', error);
      });
  }

  private handleDeepLink({ url }: { url: string }): void {
    console.log('AmberSigner: Received deep link:', url);
    try {
      // Handle both kashir:// and nostrsigner:// schemes
      if (url.startsWith('kashir://')) {
        // Our return URL format
        const urlObj = new URL(url);
        console.log(
          'AmberSigner: Parsed URL:',
          urlObj.protocol,
          urlObj.pathname,
          urlObj.search
        );

        if (
          urlObj.pathname === '/amber-response' ||
          urlObj.pathname === '//amber-response'
        ) {
          const params = new URLSearchParams(urlObj.search);
          const id = params.get('id');
          const result = params.get('result');
          const error = params.get('error');

          console.log(
            'AmberSigner: Parsed params - id:',
            id,
            'result:',
            result,
            'error:',
            error
          );
          console.log(
            'AmberSigner: Pending requests:',
            Array.from(this.pendingRequests.keys())
          );

          if (id && this.pendingRequests.has(id)) {
            const { resolve, reject } = this.pendingRequests.get(id)!;
            this.pendingRequests.delete(id);

            if (error) {
              console.log('AmberSigner: Rejecting with error:', error);
              reject(new Error(error));
            } else if (result) {
              console.log('AmberSigner: Resolving with result:', result);
              resolve(result);
            } else {
              console.log('AmberSigner: No result received');
              reject(new Error('No result received from Amber'));
            }
          } else {
            console.log(
              'AmberSigner: No matching pending request found for id:',
              id
            );
          }
        }
      } else if (url.startsWith('nostrsigner:')) {
        // Direct Amber response format - parse the JSON
        console.log('AmberSigner: Processing nostrsigner response');
        const jsonPart = url.substring('nostrsigner:'.length);
        const decoded = decodeURIComponent(jsonPart);
        console.log('AmberSigner: Decoded response:', decoded);

        try {
          const response = JSON.parse(decoded);
          console.log('AmberSigner: Parsed response:', response);

          // For get_public_key responses, there might not be an ID
          // In this case, resolve the first pending get_public_key request
          if (response.result && this.pendingRequests.size > 0) {
            console.log(
              'AmberSigner: Resolving pending request with result:',
              response.result
            );

            // Find the first pending request (should be our get_public_key)
            const firstId = Array.from(this.pendingRequests.keys())[0];
            if (firstId) {
              const { resolve } = this.pendingRequests.get(firstId)!;
              this.pendingRequests.delete(firstId);
              resolve(response.result);
              return;
            }
          }

          // Traditional ID-based matching
          if (response.id && this.pendingRequests.has(response.id)) {
            const { resolve, reject } = this.pendingRequests.get(response.id)!;
            this.pendingRequests.delete(response.id);

            if (response.error) {
              console.log('AmberSigner: Rejecting with error:', response.error);
              reject(new Error(response.error));
            } else if (response.result) {
              console.log(
                'AmberSigner: Resolving with result:',
                response.result
              );
              resolve(response.result);
            } else {
              console.log('AmberSigner: No result in response');
              reject(new Error('No result received from Amber'));
            }
          } else {
            console.log(
              'AmberSigner: No matching pending request found for id:',
              response.id
            );
            console.log('AmberSigner: Response:', response);
            console.log(
              'AmberSigner: Pending requests:',
              Array.from(this.pendingRequests.keys())
            );
          }
        } catch (parseError) {
          console.error(
            'AmberSigner: Failed to parse response JSON:',
            parseError
          );
        }
      } else {
        console.log('AmberSigner: URL does not match expected pattern:', url);
      }
    } catch (error) {
      console.error('AmberSigner: Error handling deep link:', error);
    }
  }

  private async makeAmberRequest(
    type: string,
    data: any = {}
  ): Promise<string> {
    const id = Math.random().toString(36).substring(7);

    console.log('AmberSigner: Making request with id:', id, 'type:', type);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      let requestData: any;

      if (type === 'get_public_key') {
        // For get_public_key, use simplified format without returnUrl
        requestData = {
          type,
          permissions: data.permissions || [],
        };
      } else {
        // For other requests, include full format
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
      console.log('AmberSigner: Opening Amber URL:', amberUrl);
      console.log('AmberSigner: Request data:', requestData);

      Linking.openURL(amberUrl)
        .then(() => {
          console.log('AmberSigner: Successfully opened Amber');
        })
        .catch((error) => {
          console.error('AmberSigner: Failed to open Amber:', error);
          this.pendingRequests.delete(id);
          reject(new Error(`Failed to open Amber: ${error.message}`));
        });

      // Set a timeout for the request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          console.log('AmberSigner: Request timed out for id:', id);
          this.pendingRequests.delete(id);
          reject(new Error('Amber request timed out'));
        }
      }, 60000); // 60 second timeout
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
          kind: 37818, // PrimalWalletOperation
        },
        {
          type: 'sign_event',
          kind: 30078, // ApplicationSpecificData
        },
      ];

      // Try native module first if available
      if (AmberService) {
        console.log('AmberSigner: Using AmberService to get public key');
        console.log('AmberSigner: Permissions:', permissions);

        try {
          const permissionsJson = JSON.stringify(permissions);
          const result = await AmberService.getPublicKey(permissionsJson);

          if (result) {
            console.log(
              'AmberSigner: Received public key result from AmberService:',
              result
            );
            this.currentUser = result;

            // Handle both hex and npub formats
            let publicKey: PublicKeyInterface;
            if (result.startsWith('npub')) {
              publicKey = PublicKey.parse(result);
            } else {
              publicKey = PublicKey.parse(result);
            }

            return publicKey;
          }
        } catch (error) {
          console.error('AmberSigner: AmberService failed:', error);
          console.log('AmberSigner: Falling back to URL approach');
        }
      } else {
        console.log(
          'AmberSigner: AmberService not available, using URL approach'
        );
      }

      // Fallback to URL approach
      return this.getPublicKeyWithUrl(permissions);
    } catch (error) {
      console.error('AmberSigner: Error getting public key from Amber:', error);
    }
    return undefined;
  }

  private async getPublicKeyWithUrl(
    permissions: any[]
  ): Promise<PublicKeyInterface | undefined> {
    try {
      console.log(
        'AmberSigner: Using URL approach with permissions:',
        permissions
      );

      // Try the JSON approach like Primal's sign_event
      const requestData = {
        type: 'get_public_key',
        permissions: permissions,
      };

      const amberUrl = `nostrsigner:${encodeURIComponent(JSON.stringify(requestData))}`;
      console.log('AmberSigner: Opening Amber URL:', amberUrl);

      return new Promise((resolve, reject) => {
        const id = 'url_' + Math.random().toString(36).substring(7);
        this.pendingRequests.set(id, { resolve, reject });

        Linking.openURL(amberUrl)
          .then(() => {
            console.log('AmberSigner: Successfully opened Amber URL');
          })
          .catch((error) => {
            console.error('AmberSigner: Failed to open Amber:', error);
            this.pendingRequests.delete(id);
            reject(new Error(`Failed to open Amber: ${error.message}`));
          });

        setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            console.log('AmberSigner: URL approach timed out');
            this.pendingRequests.delete(id);
            reject(new Error('Amber request timed out'));
          }
        }, 30000);
      });
    } catch (error) {
      console.error('AmberSigner: URL approach error:', error);
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

      const eventJson = JSON.stringify({
        created_at: unsignedEvent.createdAt(),
        kind: unsignedEvent.kind(),
        tags: unsignedEvent.tags(),
        content: unsignedEvent.content(),
        pubkey: unsignedEvent.author().toHex(),
      });

      const result = await this.makeAmberRequest('sign_event', {
        event: eventJson,
      });

      if (result) {
        // Parse the signed event from Amber
        const signedEventData = JSON.parse(result);
        return Event.fromJson(JSON.stringify(signedEventData));
      }
    } catch (error) {
      console.error('Error signing event with Amber:', error);
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
