import type { PublicKey } from '../../../src';

export type TabType = 'your-posts' | 'following';
export type MainTabType = 'nostr' | 'wallet' | 'settings';

export interface ProfileData {
  name: string;
  loaded: boolean;
}

export interface ProfileCache {
  [key: string]: ProfileData;
}
