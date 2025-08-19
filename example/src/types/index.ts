export type TabType = 'following' | 'trending';
export type MainTabType = 'nostr' | 'wallet' | 'events' | 'settings';

// Event creation types
export interface CalendarEventData {
  title: string;
  summary?: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  imageUrl?: string;
  isDateBased: boolean; // true for kind 31922 (date-based), false for kind 31923 (time-based)
}

export type EventType = 'date-based' | 'time-based';

export interface ProfileData {
  name: string;
  loaded: boolean;
}

export interface ProfileCache {
  [key: string]: ProfileData;
}
