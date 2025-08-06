import { Client, NostrSigner, PublicKey } from 'kashir';
import type { NostrSignerInterface } from 'kashir';
import { StorageService } from './StorageService';
import { SecureStorageService } from './SecureStorageService';
import { AmberSigner } from './AmberSigner';
import { RelayListService } from './RelayListService';

export enum LoginType {
  Amber = 'amber',
  PrivateKey = 'privatekey',
}

export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error',
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
  private connectionState: ConnectionState = ConnectionState.Disconnected;
  private connectionStartTime: number = 0;
  private readonly CONNECTION_TIMEOUT = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): NostrClientService {
    if (!NostrClientService.instance) {
      NostrClientService.instance = new NostrClientService();
    }
    return NostrClientService.instance;
  }

  async initialize(customRelays?: string[], retryCount: number = 0): Promise<Client> {
    const maxRetries = 2;
    
    if (this.client && this.connectionState === ConnectionState.Connected) {
      return this.client;
    }

    this.connectionState = ConnectionState.Connecting;
    this.connectionStartTime = Date.now();
    console.log(`NostrClientService: Starting client initialization (attempt ${retryCount + 1}/${maxRetries + 1})...`);

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

      // Load relays - use custom relays if provided, otherwise load from storage
      const relays = customRelays || await StorageService.loadRelays();

      console.log(`NostrClientService: Initializing with ${relays.length} relays:`, relays);

      // Add relays with individual error handling
      let successfulRelays = 0;
      for (const relay of relays) {
        try {
          await newClient.addRelay(relay);
          successfulRelays++;
        } catch (error) {
          console.error(`Failed to add relay ${relay}:`, error);
        }
      }

      if (successfulRelays === 0) {
        throw new Error('Failed to add any relays to the client');
      }

      console.log(`NostrClientService: Added ${successfulRelays}/${relays.length} relays, connecting...`);

      // Connect to relays with timeout
      const connectTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 15000) // 15 second timeout
      );
      
      await Promise.race([
        newClient.connect(),
        connectTimeout
      ]);
      
      console.log('NostrClientService: Client connected to relays');

      // Wait for connections to stabilize
      const stabilizeTimeout = Math.min(3000 + (successfulRelays * 200), 8000); // Dynamic timeout based on relay count
      console.log(`NostrClientService: Waiting ${stabilizeTimeout}ms for connections to stabilize...`);
      await new Promise((resolve) => setTimeout(resolve, stabilizeTimeout));
      
      this.client = newClient;
      this.connectionState = ConnectionState.Connected;
      const totalTime = Date.now() - this.connectionStartTime;
      console.log(`NostrClientService: Client ready (${successfulRelays} relays, took ${totalTime}ms)`);
      
      return newClient;
    } catch (error) {
      console.error(`Failed to initialize client (attempt ${retryCount + 1}):`, error);
      this.connectionState = ConnectionState.Error;
      
      // Retry logic
      if (retryCount < maxRetries) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
        console.log(`NostrClientService: Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.initialize(customRelays, retryCount + 1);
      }
      
      throw new Error(`Failed to connect to Nostr relays after ${maxRetries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isReady(): boolean {
    return this.connectionState === ConnectionState.Connected && this.client !== null;
  }

  async waitForReady(timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (this.isReady()) {
        return true;
      }
      
      if (this.connectionState === ConnectionState.Error) {
        return false;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.warn('NostrClientService: Timeout waiting for client to be ready');
    return false;
  }

  getCurrentSession(): UserSession | null {
    return this.currentSession;
  }

  getClient(): Client | null {
    return this.client;
  }

  async logout(): Promise<void> {
    console.log('NostrClientService: Logging out user');
    
    if (this.amberSigner) {
      this.amberSigner.disconnect();
      this.amberSigner = null;
    }

    // Clear user session data
    this.currentSession = null;
    StorageService.removeNpub();
    SecureStorageService.removeNostrPrivateKey();

    // Disconnect from user's relays
    this.disconnect();

    // Restore default relays and reconnect for anonymous browsing
    try {
      console.log('NostrClientService: Restoring default relays after logout');
      const defaultRelays = StorageService.getDefaultRelays();
      
      // Force overwrite stored relays with defaults
      await StorageService.saveRelays(defaultRelays);
      
      // Initialize client with default relays (no user session)
      await this.initialize(defaultRelays);
    } catch (error) {
      console.error('NostrClientService: Failed to restore default relays after logout:', error);
      // Even if reconnection fails, ensure we've cleared the session
    }
  }

  disconnect(): void {
    console.log('NostrClientService: Disconnecting client');
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
    this.connectionState = ConnectionState.Disconnected;
  }

  async loadAndApplyUserRelays(): Promise<string[]> {
    try {
      console.log('NostrClientService: Loading user relay list...');
      
      // Get the current npub
      const npub = await StorageService.loadNpub();
      if (!npub) {
        console.log('NostrClientService: No npub found, using stored relays');
        return StorageService.loadRelays();
      }

      let clientToUse: Client | null = null;
      let shouldDisconnectAfter = false;

      try {
        // First, try to use the existing main client if it's ready
        if (this.client && this.connectionState === ConnectionState.Connected) {
          console.log('NostrClientService: Using existing connected client for relay list fetch');
          clientToUse = this.client;
        } else {
          // Create a temporary client with stored relays for fetching relay list
          console.log('NostrClientService: Creating temporary client for relay list fetch');
          const storedRelays = await StorageService.loadRelays();
          clientToUse = new Client();
          shouldDisconnectAfter = true;
          
          for (const relay of storedRelays) {
            try {
              await clientToUse.addRelay(relay);
            } catch (error) {
              console.error(`Failed to add temp relay ${relay}:`, error);
            }
          }
          
          await clientToUse.connect();
          console.log('NostrClientService: Temporary client connected for relay list fetch');
          // Shorter wait time for temporary client
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // Fetch user's relay list
        const relayListService = RelayListService.getInstance();
        const userRelayInfo = await relayListService.fetchUserRelayList(clientToUse, npub);
        
        if (userRelayInfo.length > 0) {
          console.log(`NostrClientService: Found ${userRelayInfo.length} relays in user's NIP-65 relay list`);
          const userRelays = relayListService.relayInfoToUrls(userRelayInfo);
          
          // Store the user's relay list for future use
          await StorageService.saveRelays(userRelays);
          
          return userRelays;
        } else {
          console.log('NostrClientService: No user relay list found, using stored relays');
          return StorageService.loadRelays();
        }
      } finally {
        // Only disconnect if we created a temporary client
        if (shouldDisconnectAfter && clientToUse) {
          console.log('NostrClientService: Disconnecting temporary client');
          clientToUse.disconnect();
        }
      }
    } catch (error) {
      console.error('NostrClientService: Failed to load user relay list:', error);
      // Fallback to stored relays
      return StorageService.loadRelays();
    }
  }

  async reconnectWithNewRelays(customRelays?: string[]): Promise<Client> {
    console.log('NostrClientService: Reconnecting with new relays...');
    // Disconnect existing client
    this.disconnect();

    // Re-initialize with new relays
    return this.initialize(customRelays);
  }
}

export { NostrClientService };
