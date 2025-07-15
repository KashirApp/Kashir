import { Linking } from 'react-native';
import IntentLauncher, { AppUtils } from '@yz1311/react-native-intent-launcher';

interface AmberServiceInterface {
  getPublicKey(permissions: string): Promise<string>;
}

class ReactNativeAmberService implements AmberServiceInterface {
  async getPublicKey(permissions: string): Promise<string> {
    console.log('AmberService: Making getPublicKey request with permissions:', permissions);

    try {
      // Check if Amber is installed first
      const isInstalled = await AppUtils.isAppInstalled('com.greenart7c3.nostrsigner');
      if (!isInstalled) {
        throw new Error('Amber app is not installed');
      }

      // Use the same approach as Kotlin - base URI with extras
      const result = await IntentLauncher.startActivity({
        action: 'android.intent.action.VIEW',
        data: 'nostrsigner:',
        packageName: 'com.greenart7c3.nostrsigner',
        extra: {
          type: 'get_public_key',
          permissions: permissions  // Pass as string like Kotlin does
        }
      } as any);

      console.log('AmberService: Received result from Amber:', result);

      // Extract result from the response
      if (result && result.extra && result.extra.result) {
        return result.extra.result;
      } else {
        throw new Error('No result received from Amber');
      }
    } catch (error) {
      console.error('AmberService: Failed to get public key:', error);
      throw new Error(`Failed to launch Amber: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export a singleton instance
const amberService = new ReactNativeAmberService();

export default amberService as AmberServiceInterface;
