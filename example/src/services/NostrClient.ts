import { Client, NostrSigner, PublicKey } from 'kashir';
import type { NostrSignerInterface } from 'kashir';
import { StorageService } from './StorageService';
import { SecureStorageService } from './SecureStorageService';
import { AmberSigner } from './AmberSigner';

export enum LoginType {
  Amber = 'amber',
  PrivateKey = 'privatekey',
}

export interface UserSession {
  type: LoginType;
  publicKey?: string;
}

class NostrClientService {
  private static instance: NostrClientService | null = null;
  private client: Client | null = null;
  private currentSession: UserSession | null = null;
  private amberSigner: AmberSigner | null = null;

  private constructor() {}

  static getInstance(): NostrClientService {
    if (!NostrClientService.instance) {
      NostrClientService.instance = new NostrClientService();
    }
    return NostrClientService.instance;
  }

  async initialize(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    try {
      // Create signer based on session type
      let signer: NostrSignerInterface | undefined;
      if (this.currentSession?.type === LoginType.Amber) {
        // Ensure AmberSigner is available
        if (!this.amberSigner) {
          this.amberSigner = new AmberSigner();
        }
        signer = NostrSigner.custom(this.amberSigner);
      }

      // Create a new client (with signer if available)
      const newClient = signer ? new Client(signer) : new Client();

      // Load relays from storage
      const relays = await StorageService.loadRelays();

      // Add all relays
      for (const relay of relays) {
        try {
          await newClient.addRelay(relay);
        } catch (error) {
          console.error(`Failed to add relay ${relay}:`, error);
        }
      }

      // Connect to relays
      await newClient.connect();

      // Wait a bit for connections to stabilize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.client = newClient;
      return newClient;
    } catch (error) {
      console.error('Failed to initialize client:', error);
      throw new Error('Failed to connect to Nostr relays');
    }
  }

  async loginWithAmber(): Promise<string> {
    try {
      if (!this.amberSigner) {
        this.amberSigner = new AmberSigner();
      }

      // Get public key from Amber
      const publicKey = await this.amberSigner.getPublicKey();
      if (!publicKey) {
        throw new Error('Failed to get public key from Amber');
      }

      const publicKeyHex = publicKey.toHex();

      // Create simplified session (no signer saved)
      this.currentSession = {
        type: LoginType.Amber,
        publicKey: publicKeyHex,
      };

      // Store only the npub - login type will be inferred
      const npub = publicKey.toBech32();
      await StorageService.saveNpub(npub);

      // Update AmberSigner with the npub
      this.amberSigner = new AmberSigner(npub);

      // Create signer for current session only
      const signer = NostrSigner.custom(this.amberSigner);

      // Reinitialize client with the new signer
      this.disconnect();
      await this.initialize();

      console.log('Successfully logged in with Amber:', publicKeyHex);
      return publicKeyHex;
    } catch (error) {
      console.error('Failed to login with Amber:', error);
      throw error;
    }
  }

  async loadStoredSession(): Promise<UserSession | null> {
    try {
      // Check for private key first (takes precedence)
      const hasPrivateKey = await SecureStorageService.hasNostrPrivateKey();

      if (hasPrivateKey) {
        const npub = await StorageService.loadNpub();
        if (npub) {
          const publicKey = PublicKey.parse(npub);
          const publicKeyHex = publicKey.toHex();

          this.currentSession = {
            type: LoginType.PrivateKey,
            publicKey: publicKeyHex,
          };

          return this.currentSession;
        }
      }

      // Check for npub only (Amber login)
      const npub = await StorageService.loadNpub();

      if (npub) {
        const publicKey = PublicKey.parse(npub);
        const publicKeyHex = publicKey.toHex();

        this.currentSession = {
          type: LoginType.Amber,
          publicKey: publicKeyHex,
        };

        // Recreate AmberSigner for Amber login
        if (!this.amberSigner) {
          this.amberSigner = new AmberSigner(npub);
        }

        return this.currentSession;
      }

      // No login found
      return null;
    } catch (error) {
      console.error('Failed to load stored session:', error);
      return null;
    }
  }

  getCurrentSession(): UserSession | null {
    return this.currentSession;
  }

  getClient(): Client | null {
    return this.client;
  }

  logout(): void {
    if (this.amberSigner) {
      this.amberSigner.disconnect();
      this.amberSigner = null;
    }

    this.currentSession = null;
    StorageService.removeNpub();
    SecureStorageService.removeNostrPrivateKey();

    this.disconnect();
  }

  disconnect(): void {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }

  async reconnectWithNewRelays(): Promise<Client> {
    // Disconnect existing client
    this.disconnect();

    // Re-initialize with new relays
    return this.initialize();
  }
}

export { NostrClientService };
