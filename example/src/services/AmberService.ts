import IntentLauncher, { AppUtils } from './IntentLauncher';

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

      // First try content resolver for automatic signing (no UI)
      try {
        if (!IntentLauncher.queryContentResolver) {
          throw new Error('queryContentResolver method not available');
        }

        // Try content resolver queries - primary method should be the uppercase URI
        const queries = [
          {
            uri: 'content://com.greenart7c3.nostrsigner.SIGN_EVENT',
            projection: [event, '', currentUser || ''],
            selection: '1',
            selectionArgs: undefined,
          },
          {
            uri: 'content://com.greenart7c3.nostrsigner.sign_event',
            projection: [event, '', currentUser || ''],
            selection: '1',
            selectionArgs: undefined,
          },
        ];

        for (const query of queries) {
          const contentResult = await IntentLauncher.queryContentResolver(
            query.uri,
            query.projection,
            query.selection,
            query.selectionArgs
          );

          if (contentResult && contentResult.event) {
            return contentResult.event;
          } else if (contentResult && contentResult.rejected) {
            throw new Error('Signing was rejected by Amber');
          }
        }
      } catch (contentError) {
        // Fall back to UI launcher if content resolver fails
      }

      // Fall back to UI launcher if content resolver is unavailable or returns undecided
      const result = await IntentLauncher.startActivity({
        action: 'android.intent.action.VIEW',
        data: `nostrsigner:${event}`,
        packageName: 'com.greenart7c3.nostrsigner',
        extra: {
          type: 'sign_event',
          silent: true, // Try to minimize UI
          auto_approve: true, // Try to auto-approve if permission exists
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
