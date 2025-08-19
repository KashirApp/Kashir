export type TabType = 'following' | 'trending';
export type MainTabType = 'nostr' | 'wallet' | 'events' | 'settings';

export interface ProfileData {
  name: string;
  loaded: boolean;
}

export interface ProfileCache {
  [key: string]: ProfileData;
}
