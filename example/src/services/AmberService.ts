import IntentLauncher, { AppUtils } from './IntentLauncher';
import { AMBER_PACKAGE, createAmberErrorMessage } from './AmberUtils';

interface AmberServiceInterface {
  getPublicKey(permissions: string): Promise<string>;
  signEvent(event: string, currentUser?: string): Promise<string>;
  nip44Encrypt(
    pubkey: string,
    plaintext: string,
    currentUser?: string
  ): Promise<string>;
  nip44Decrypt(
    pubkey: string,
    ciphertext: string,
    currentUser?: string
  ): Promise<string>;
}

class ReactNativeAmberService implements AmberServiceInterface {
  async getPublicKey(permissions: string): Promise<string> {
    try {
      const isInstalled = await AppUtils.isAppInstalled(AMBER_PACKAGE);
      if (!isInstalled) {
        throw new Error('Amber app is not installed');
      }

      const result = await IntentLauncher.startActivity({
        action: 'android.intent.action.VIEW',
        data: 'nostrsigner:',
        packageName: AMBER_PACKAGE,
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
      throw new Error(createAmberErrorMessage('launch Amber', error));
    }
  }

  async signEvent(event: string, currentUser?: string): Promise<string> {
    try {
      const isInstalled = await AppUtils.isAppInstalled(AMBER_PACKAGE);

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
      } catch {
        // Fall back to UI launcher if content resolver fails
      }

      // Fall back to UI launcher if content resolver is unavailable or returns undecided
      const result = await IntentLauncher.startActivity({
        action: 'android.intent.action.VIEW',
        data: `nostrsigner:${event}`,
        packageName: AMBER_PACKAGE,
        extra: {
          type: 'sign_event',
          ...(currentUser && { current_user: currentUser }),
        },
      } as any);

      const signedEvent = result?.extra?.event || (result as any)?.event;
      if (!signedEvent) {
        throw new Error('No signed event received from Amber');
      }
      return signedEvent;
    } catch (error) {
      throw new Error(createAmberErrorMessage('launch Amber', error));
    }
  }

  async nip44Encrypt(
    pubkey: string,
    plaintext: string,
    currentUser?: string
  ): Promise<string> {
    try {
      const isInstalled = await AppUtils.isAppInstalled(AMBER_PACKAGE);

      if (!isInstalled) {
        throw new Error('Amber app is not installed');
      }

      // First try content resolver for automatic encryption (overlay)
      try {
        if (!IntentLauncher.queryContentResolver) {
          throw new Error('queryContentResolver method not available');
        }

        // Try content resolver queries for NIP-44 encryption
        const queries = [
          {
            uri: 'content://com.greenart7c3.nostrsigner.NIP44_ENCRYPT',
            projection: [plaintext, pubkey, currentUser || ''],
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

          if (contentResult && contentResult.result) {
            return contentResult.result;
          } else if (contentResult && contentResult.rejected) {
            throw new Error('NIP-44 encryption was rejected by Amber');
          }
        }
      } catch {
        // Fall back to UI launcher if content resolver fails
      }

      // Fall back to UI launcher (overlay) if content resolver is unavailable
      const result = await IntentLauncher.startActivity({
        action: 'android.intent.action.VIEW',
        data: 'nostrsigner:',
        packageName: AMBER_PACKAGE,
        extra: {
          type: 'nip44_encrypt',
          pubkey: pubkey,
          plaintext: plaintext,
          ...(currentUser && { current_user: currentUser }),
        },
      } as any);

      const encryptedResult = result?.extra?.result || (result as any)?.result;
      if (!encryptedResult) {
        throw new Error('No encrypted result received from Amber');
      }
      return encryptedResult;
    } catch (error) {
      throw new Error(
        createAmberErrorMessage('launch Amber for NIP-44 encryption', error)
      );
    }
  }

  async nip44Decrypt(
    pubkey: string,
    ciphertext: string,
    currentUser?: string
  ): Promise<string> {
    try {
      const isInstalled = await AppUtils.isAppInstalled(AMBER_PACKAGE);

      if (!isInstalled) {
        throw new Error('Amber app is not installed');
      }

      // First try content resolver for automatic decryption (overlay)
      try {
        if (!IntentLauncher.queryContentResolver) {
          throw new Error('queryContentResolver method not available');
        }

        // Try content resolver queries for NIP-44 decryption
        const queries = [
          {
            uri: 'content://com.greenart7c3.nostrsigner.NIP44_DECRYPT',
            projection: [ciphertext, pubkey, currentUser || ''],
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

          if (contentResult && contentResult.result) {
            return contentResult.result;
          } else if (contentResult && contentResult.rejected) {
            throw new Error('NIP-44 decryption was rejected by Amber');
          }
        }
      } catch {
        // Fall back to UI launcher if content resolver fails
      }

      // Fall back to UI launcher (overlay) if content resolver is unavailable
      const result = await IntentLauncher.startActivity({
        action: 'android.intent.action.VIEW',
        data: 'nostrsigner:',
        packageName: AMBER_PACKAGE,
        extra: {
          type: 'nip44_decrypt',
          pubkey: pubkey,
          ciphertext: ciphertext,
          ...(currentUser && { current_user: currentUser }),
        },
      } as any);

      const decryptedResult = result?.extra?.result || (result as any)?.result;
      if (!decryptedResult) {
        throw new Error('No decrypted result received from Amber');
      }
      return decryptedResult;
    } catch (error) {
      throw new Error(
        createAmberErrorMessage('launch Amber for NIP-44 decryption', error)
      );
    }
  }
}

// Export a singleton instance
const amberService = new ReactNativeAmberService();

export default amberService as AmberServiceInterface;
