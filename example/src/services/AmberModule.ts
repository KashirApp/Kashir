import { NativeModules } from 'react-native';

interface AmberModuleInterface {
  getPublicKey(permissions: string): Promise<string>;
}

const { AmberModule } = NativeModules;

if (!AmberModule) {
  console.warn('AmberModule is not available. Make sure you have rebuilt the Android app after adding the native module.');
}

export default AmberModule as AmberModuleInterface | null;