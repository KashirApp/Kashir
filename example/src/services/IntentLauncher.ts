import { NativeModules } from 'react-native';

const { IntentLauncher } = NativeModules;

export interface IntentOptions {
  action: string;
  data?: string;
  packageName?: string;
  extra?: Record<string, any>;
}

export interface ActivityResult {
  resultCode: number;
  data: string;
  extra: Record<string, any>;
}

export interface AppUtils {
  isAppInstalled(packageName: string): Promise<boolean>;
}

export const AppUtils: AppUtils = {
  isAppInstalled: (packageName: string): Promise<boolean> => {
    if (!IntentLauncher) {
      return Promise.resolve(false);
    }
    return IntentLauncher.isAppInstalled(packageName);
  },
};

interface IntentLauncherInterface {
  startActivity(options: IntentOptions): Promise<ActivityResult>;
  queryContentResolver(
    uri: string,
    projection?: string[],
    selection?: string,
    selectionArgs?: string[]
  ): Promise<any>;
}

const IntentLauncherModule: IntentLauncherInterface = {
  startActivity: (options: IntentOptions): Promise<ActivityResult> => {
    if (!IntentLauncher) {
      return Promise.reject(
        new Error('IntentLauncher native module not available')
      );
    }
    return IntentLauncher.startActivity(options);
  },

  queryContentResolver: (
    uri: string,
    projection?: string[],
    selection?: string,
    selectionArgs?: string[]
  ): Promise<any> => {
    if (!IntentLauncher) {
      return Promise.reject(
        new Error('IntentLauncher native module not available')
      );
    }
    if (!IntentLauncher.queryContentResolver) {
      return Promise.reject(
        new Error('IntentLauncher.queryContentResolver method not available')
      );
    }
    return IntentLauncher.queryContentResolver(
      uri,
      projection,
      selection,
      selectionArgs
    );
  },
};

export default IntentLauncherModule;
