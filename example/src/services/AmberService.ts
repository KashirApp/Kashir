import { Linking } from 'react-native';
import IntentLauncher, { AppUtils } from '@yz1311/react-native-intent-launcher';

interface AmberServiceInterface {
  getPublicKey(permissions: string): Promise<string>;
  signEvent(event: string, currentUser?: string): Promise<string>;
}

class ReactNativeAmberService implements AmberServiceInterface {
  async getPublicKey(permissions: string): Promise<string> {
    try {
      const isInstalled = await AppUtils.isAppInstalled(
        'com.greenart7c3.nostrsigner'
      );
      if (!isInstalled) {
        throw new Error('Amber app is not installed');
      }

      const result = await IntentLauncher.startActivity({
        action: 'android.intent.action.VIEW',
        data: 'nostrsigner:',
        packageName: 'com.greenart7c3.nostrsigner',
        extra: {
          type: 'get_public_key',
          permissions: permissions,
        },
      } as any);

      if (result && result.extra && result.extra.result) {
        return result.extra.result;
      } else {
        throw new Error('No result received from Amber');
      }
    } catch (error) {
      throw new Error(
        `Failed to launch Amber: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async signEvent(event: string, currentUser?: string): Promise<string> {
    try {
      const isInstalled = await AppUtils.isAppInstalled(
        'com.greenart7c3.nostrsigner'
      );
      if (!isInstalled) {
        throw new Error('Amber app is not installed');
      }

      const result = await IntentLauncher.startActivity({
        action: 'android.intent.action.VIEW',
        data: `nostrsigner:${event}`,
        packageName: 'com.greenart7c3.nostrsigner',
        extra: {
          type: 'sign_event',
          ...(currentUser && { current_user: currentUser }),
        },
      } as any);

      if (result && result.extra && result.extra.event) {
        return result.extra.event;
      } else if (result && result.extra && result.extra.result) {
        return result.extra.result;
      } else if (result && (result as any).event) {
        return (result as any).event;
      } else if (result && (result as any).result) {
        return (result as any).result;
      } else if (result && typeof result === 'string') {
        return result;
      } else {
        throw new Error('No signed event received from Amber');
      }
    } catch (error) {
      throw new Error(
        `Failed to launch Amber: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Export a singleton instance
const amberService = new ReactNativeAmberService();

export default amberService as AmberServiceInterface;
