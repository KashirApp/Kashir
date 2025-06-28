import type { PublicKey } from '../../../src';

export type TabType = 'your-posts' | 'following';
export type MainTabType = 'nostr' | 'wallet';

export interface ProfileData {
  name: string;
  loaded: boolean;
}

export interface ProfileCache {
  [key: string]: ProfileData;
} 