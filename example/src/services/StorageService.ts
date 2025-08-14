import AsyncStorage from '@react-native-async-storage/async-storage';

const NPUB_STORAGE_KEY = '@npub_key';
const NOSTR_RELAYS_KEY = '@nostr_relays';
const ZAP_AMOUNT_KEY = '@zap_amount';

// Default relays to use if none are configured
const DEFAULT_RELAYS = ['wss://relay.damus.io'];

export class StorageService {
  /**
   * Save npub to async storage
   */
  static async saveNpub(npub: string): Promise<void> {
    try {
      await AsyncStorage.setItem(NPUB_STORAGE_KEY, npub);
    } catch (error) {
      console.error('Error saving npub to storage:', error);
      throw error;
    }
  }

  /**
   * Load npub from async storage
   */
  static async loadNpub(): Promise<string | null> {
    try {
      const npub = await AsyncStorage.getItem(NPUB_STORAGE_KEY);
      if (npub) {
        return npub;
      }
      return null;
    } catch (error) {
      console.error('Error loading npub from storage:', error);
      return null;
    }
  }

  /**
   * Remove npub from async storage (for logout)
   */
  static async removeNpub(): Promise<void> {
    try {
      await AsyncStorage.removeItem(NPUB_STORAGE_KEY);
    } catch (error) {
      console.error('Error removing npub from storage:', error);
      throw error;
    }
  }

  /**
   * Check if npub exists in storage
   */
  static async hasStoredNpub(): Promise<boolean> {
    try {
      const npub = await AsyncStorage.getItem(NPUB_STORAGE_KEY);
      return npub !== null;
    } catch (error) {
      console.error('Error checking stored npub:', error);
      return false;
    }
  }

  /**
   * Save Nostr relays to async storage
   */
  static async saveRelays(relays: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(NOSTR_RELAYS_KEY, JSON.stringify(relays));
    } catch (error) {
      console.error('Error saving relays to storage:', error);
      throw error;
    }
  }

  /**
   * Load Nostr relays from async storage
   */
  static async loadRelays(): Promise<string[]> {
    try {
      const relaysJson = await AsyncStorage.getItem(NOSTR_RELAYS_KEY);
      if (relaysJson) {
        const relays = JSON.parse(relaysJson);
        return relays;
      }
      // Return default relays if none are stored
      return DEFAULT_RELAYS;
    } catch (error) {
      console.error('Error loading relays from storage:', error);
      // Return default relays on error
      return DEFAULT_RELAYS;
    }
  }

  /**
   * Add a new relay to storage
   */
  static async addRelay(relay: string): Promise<void> {
    try {
      const relays = await StorageService.loadRelays();
      // Check if relay already exists (case-insensitive)
      const exists = relays.some(
        (r) => r.toLowerCase() === relay.toLowerCase()
      );
      if (!exists) {
        relays.push(relay);
        await StorageService.saveRelays(relays);
      }
    } catch (error) {
      console.error('Error adding relay:', error);
      throw error;
    }
  }

  /**
   * Remove a relay from storage
   */
  static async removeRelay(relay: string): Promise<boolean> {
    try {
      const relays = await StorageService.loadRelays();
      const filteredRelays = relays.filter(
        (r) => r.toLowerCase() !== relay.toLowerCase()
      );

      // Don't allow removing all relays
      if (filteredRelays.length === 0) {
        console.warn('Cannot remove last relay');
        return false;
      }

      await StorageService.saveRelays(filteredRelays);
      return true;
    } catch (error) {
      console.error('Error removing relay:', error);
      return false;
    }
  }

  /**
   * Get default relays
   */
  static getDefaultRelays(): string[] {
    return [...DEFAULT_RELAYS];
  }

  /**
   * Save default zap amount to async storage
   */
  static async saveZapAmount(amount: number): Promise<void> {
    try {
      await AsyncStorage.setItem(ZAP_AMOUNT_KEY, amount.toString());
    } catch (error) {
      console.error('Error saving zap amount to storage:', error);
      throw error;
    }
  }

  /**
   * Load default zap amount from async storage
   */
  static async loadZapAmount(): Promise<number> {
    try {
      const amountString = await AsyncStorage.getItem(ZAP_AMOUNT_KEY);
      if (amountString) {
        const amount = parseInt(amountString, 10);
        return isNaN(amount) ? 21 : amount; // Default to 21 if invalid
      }
      return 21; // Default zap amount
    } catch (error) {
      console.error('Error loading zap amount from storage:', error);
      return 21; // Default zap amount on error
    }
  }
}
