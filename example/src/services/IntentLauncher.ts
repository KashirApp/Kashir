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
      console.warn('IntentLauncher native module not available');
      return Promise.resolve(false);
    }
    console.log('IntentLauncher module found:', IntentLauncher);
    return IntentLauncher.isAppInstalled(packageName);
  }
};

interface IntentLauncherInterface {
  startActivity(options: IntentOptions): Promise<ActivityResult>;
}

const IntentLauncherModule: IntentLauncherInterface = {
  startActivity: (options: IntentOptions): Promise<ActivityResult> => {
    if (!IntentLauncher) {
      console.warn('IntentLauncher native module not available');
      return Promise.reject(new Error('IntentLauncher native module not available'));
    }
    console.log('IntentLauncher module found:', IntentLauncher);
    return IntentLauncher.startActivity(options);
  }
};

export default IntentLauncherModule;