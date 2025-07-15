import type { PublicKey } from 'kashir';

export type TabType = 'your-posts' | 'following' | 'trending';
export type MainTabType = 'nostr' | 'wallet' | 'settings';

export interface ProfileData {
  name: string;
  loaded: boolean;
}

export interface ProfileCache {
  [key: string]: ProfileData;
}
