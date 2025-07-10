import { Client } from '../../../src';
import { StorageService } from './StorageService';

class NostrClientService {
  private static instance: NostrClientService | null = null;
  private client: Client | null = null;

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
      // Create a new client without signer (we're just reading)
      const newClient = new Client();

      // Load relays from storage
      const relays = await StorageService.loadRelays();
      console.log(`Loading ${relays.length} relays from storage`);

      // Add all relays
      for (const relay of relays) {
        try {
          await newClient.addRelay(relay);
          console.log(`Added relay: ${relay}`);
        } catch (error) {
          console.error(`Failed to add relay ${relay}:`, error);
        }
      }

      // Connect to relays
      await newClient.connect();

      // Wait a bit for connections to stabilize
      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.client = newClient;
      console.log('Client initialized and connected to relays');
      return newClient;
    } catch (error) {
      console.error('Failed to initialize client:', error);
      throw new Error('Failed to connect to Nostr relays');
    }
  }

  getClient(): Client | null {
    return this.client;
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
