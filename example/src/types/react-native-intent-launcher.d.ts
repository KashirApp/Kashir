declare module '@yz1311/react-native-intent-launcher' {
  // Interface for the intent launcher options
  export interface IntentOptions {
    action: string;
    data?: string;
    packageName?: string;
    extra?: Record<string, any>;
  }

  // Interface for the startActivity result
  export interface ActivityResult {
    resultCode: number;
    data: string;
    extra: Record<string, any>;
  }

  // AppUtils interface - only what we actually use
  export interface AppUtils {
    isAppInstalled(packageName: string): Promise<boolean>;
  }

  // Export the AppUtils instance
  export const AppUtils: AppUtils;

  // Default export - the IntentLauncher
  interface IntentLauncher {
    startActivity(options: IntentOptions): Promise<ActivityResult>;
  }

  const IntentLauncher: IntentLauncher;
  export default IntentLauncher;
}