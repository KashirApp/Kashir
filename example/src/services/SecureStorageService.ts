import * as Keychain from 'react-native-keychain';

const SEED_PHRASE_KEY = 'wallet_seed_phrase';
const NOSTR_PRIVATE_KEY = 'nostr_private_key';
const SERVICE_NAME = 'KashirWallet';

export class SecureStorageService {
  /**
   * Check if keychain is available
   */
  private static async isKeychainAvailable(): Promise<boolean> {
    try {
      // Test if keychain module is properly linked
      if (
        !Keychain ||
        typeof Keychain.getSupportedBiometryType !== 'function'
      ) {
        return false;
      }
      await Keychain.getSupportedBiometryType();
      return true;
    } catch (error) {
      console.warn('Keychain not available:', error);
      return false;
    }
  }

  /**
   * Store the seed phrase securely using react-native-keychain
   */
  static async storeSeedPhrase(seedPhrase: string): Promise<boolean> {
    const available = await this.isKeychainAvailable();
    if (!available) {
      console.warn('Keychain not available, cannot store seed phrase securely');
      return false;
    }

    try {
      await Keychain.setInternetCredentials(
        SERVICE_NAME,
        SEED_PHRASE_KEY,
        seedPhrase,
        {
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }
      );
      return true;
    } catch (error) {
      console.error('Failed to store seed phrase:', error);
      return false;
    }
  }

  /**
   * Retrieve the seed phrase securely using react-native-keychain
   */
  static async getSeedPhrase(): Promise<string | null> {
    const available = await this.isKeychainAvailable();
    if (!available) {
      console.warn('Keychain not available, cannot retrieve seed phrase');
      return null;
    }

    try {
      const credentials = await Keychain.getInternetCredentials(SERVICE_NAME);

      if (credentials && credentials.password) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      console.error('Failed to retrieve seed phrase:', error);
      return null;
    }
  }

  /**
   * Check if a seed phrase exists in secure storage
   */
  static async hasSeedPhrase(): Promise<boolean> {
    const available = await this.isKeychainAvailable();
    if (!available) {
      return false;
    }

    try {
      // Updated API for react-native-keychain v10.0.0 - service is now part of options object
      const credentials = await Keychain.hasInternetCredentials({
        server: SERVICE_NAME,
      });
      return credentials;
    } catch (error) {
      console.warn(
        'SecureStorageService: Error checking for credentials:',
        error
      );
      // If we can't check (e.g., user cancelled biometric), assume it doesn't exist
      return false;
    }
  }

  /**
   * Remove the seed phrase from secure storage
   */
  static async removeSeedPhrase(): Promise<boolean> {
    const available = await this.isKeychainAvailable();
    if (!available) {
      return false;
    }

    try {
      // Updated API for react-native-keychain v10.0.0 - service is now part of options object
      await Keychain.resetInternetCredentials({ server: SERVICE_NAME });
      return true;
    } catch (error) {
      console.error('Failed to remove seed phrase:', error);
      return false;
    }
  }

  /**
   * Check if biometric authentication is available
   */
  static async isBiometricAvailable(): Promise<boolean> {
    const available = await this.isKeychainAvailable();
    if (!available) {
      return false;
    }

    try {
      const biometryType = await Keychain.getSupportedBiometryType();
      return biometryType !== null;
    } catch {
      return false;
    }
  }

  /**
   * Store the Nostr private key securely using react-native-keychain
   */
  static async storeNostrPrivateKey(privateKey: string): Promise<boolean> {
    const available = await this.isKeychainAvailable();
    if (!available) {
      console.warn(
        'Keychain not available, cannot store Nostr private key securely'
      );
      return false;
    }

    try {
      await Keychain.setInternetCredentials(
        `${SERVICE_NAME}_nostr`,
        NOSTR_PRIVATE_KEY,
        privateKey,
        {
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }
      );
      return true;
    } catch (error) {
      console.error('Failed to store Nostr private key:', error);
      return false;
    }
  }

  /**
   * Retrieve the Nostr private key securely using react-native-keychain
   */
  static async getNostrPrivateKey(): Promise<string | null> {
    const available = await this.isKeychainAvailable();
    if (!available) {
      console.warn('Keychain not available, cannot retrieve Nostr private key');
      return null;
    }

    try {
      const credentials = await Keychain.getInternetCredentials(
        `${SERVICE_NAME}_nostr`
      );

      if (credentials && credentials.password) {
        return credentials.password;
      }
      return null;
    } catch (error) {
      console.error('Failed to retrieve Nostr private key:', error);
      return null;
    }
  }

  /**
   * Check if a Nostr private key exists in secure storage
   */
  static async hasNostrPrivateKey(): Promise<boolean> {
    const available = await this.isKeychainAvailable();
    if (!available) {
      return false;
    }

    try {
      const credentials = await Keychain.hasInternetCredentials({
        server: `${SERVICE_NAME}_nostr`,
      });
      return credentials;
    } catch (error) {
      console.warn(
        'SecureStorageService: Error checking for Nostr credentials:',
        error
      );
      return false;
    }
  }

  /**
   * Remove the Nostr private key from secure storage
   */
  static async removeNostrPrivateKey(): Promise<boolean> {
    const available = await this.isKeychainAvailable();
    if (!available) {
      return false;
    }

    try {
      await Keychain.resetInternetCredentials({
        server: `${SERVICE_NAME}_nostr`,
      });
      return true;
    } catch (error) {
      console.error('Failed to remove Nostr private key:', error);
      return false;
    }
  }
}
