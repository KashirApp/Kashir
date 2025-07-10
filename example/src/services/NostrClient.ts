import { Client } from '../../../src';

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

      // Add some popular Nostr relays
      await newClient.addRelay('wss://relay.damus.io');
      await newClient.addRelay('wss://nos.lol');
      await newClient.addRelay('wss://relay.nostr.band');
      await newClient.addRelay('wss://relay.nostr.info');
      await newClient.addRelay('wss://nostr.wine');
      await newClient.addRelay('wss://relay.snort.social');

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
}

export { NostrClientService };
