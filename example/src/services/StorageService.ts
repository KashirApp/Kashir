import AsyncStorage from '@react-native-async-storage/async-storage';

const NPUB_STORAGE_KEY = '@npub_key';

export class StorageService {
  /**
   * Save npub to async storage
   */
  static async saveNpub(npub: string): Promise<void> {
    try {
      await AsyncStorage.setItem(NPUB_STORAGE_KEY, npub);
      console.log('Npub saved to storage');
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
        console.log('Npub loaded from storage');
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
      console.log('Npub removed from storage');
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
}
