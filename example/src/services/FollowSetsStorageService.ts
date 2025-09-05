import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FollowSet } from './ListService';

const FOLLOW_SETS_KEY = '@follow_sets';
const FOLLOW_SET_USERS_KEY = '@follow_set_users';

export interface StoredUser {
  npub: string;
  username?: string;
}

export interface StoredFollowSet {
  identifier: string;
  eventId: string;
  createdAt: number;
  isPrivate?: boolean;
  publicUserIds: string[]; // npubs instead of hex
  privateUserIds?: string[]; // npubs instead of hex
  lastSynced: number;
  lastProfilesFetched?: number; // When profiles were last fetched for this set
}

export class FollowSetsStorageService {
  /**
   * Save follow sets to local storage
   */
  static async saveFollowSets(
    followSets: FollowSet[],
    userNpub: string
  ): Promise<void> {
    try {
      const storageKey = `${FOLLOW_SETS_KEY}_${userNpub}`;

      const storedSets: StoredFollowSet[] = followSets.map((set) => {
        const publicUserIds = set.publicKeys.map((pk) => pk.toBech32()); // Convert to npub
        const privateUserIds = set.privateKeys?.map((pk) => pk.toBech32()); // Convert to npub

        return {
          identifier: set.identifier,
          eventId: set.eventId,
          createdAt: set.createdAt,
          isPrivate: set.isPrivate,
          publicUserIds,
          privateUserIds,
          lastSynced: Date.now(),
        };
      });

      await AsyncStorage.setItem(storageKey, JSON.stringify(storedSets));
    } catch (error) {
      console.error(
        'FollowSetsStorageService: Error saving follow sets:',
        error
      );
      throw error;
    }
  }

  /**
   * Load follow sets from local storage
   */
  static async loadFollowSets(userNpub: string): Promise<StoredFollowSet[]> {
    try {
      const storageKey = `${FOLLOW_SETS_KEY}_${userNpub}`;

      const storedSetsJson = await AsyncStorage.getItem(storageKey);

      if (storedSetsJson) {
        const storedSets = JSON.parse(storedSetsJson);
        return storedSets;
      }

      return [];
    } catch (error) {
      console.error(
        'FollowSetsStorageService: Error loading follow sets from storage:',
        error
      );
      return [];
    }
  }

  /**
   * Save user profiles to local storage
   */
  static async saveUsers(users: StoredUser[], userNpub: string): Promise<void> {
    try {
      const storageKey = `${FOLLOW_SET_USERS_KEY}_${userNpub}`;

      const usersMap: Record<string, StoredUser> = {};

      // Convert array to map using npub as key for efficient lookups
      users.forEach((user) => {
        usersMap[user.npub] = user;
      });

      await AsyncStorage.setItem(storageKey, JSON.stringify(usersMap));
    } catch (error) {
      console.error(
        'FollowSetsStorageService: Error saving users to storage:',
        error
      );
      throw error;
    }
  }

  /**
   * Load user profiles from local storage
   */
  static async loadUsers(
    userNpub: string
  ): Promise<Record<string, StoredUser>> {
    try {
      const storageKey = `${FOLLOW_SET_USERS_KEY}_${userNpub}`;
      const usersJson = await AsyncStorage.getItem(storageKey);

      if (usersJson) {
        return JSON.parse(usersJson);
      }

      return {};
    } catch (error) {
      console.error('Error loading users from storage:', error);
      return {};
    }
  }

  /**
   * Update or add a single user profile
   */
  static async updateUser(user: StoredUser, userNpub: string): Promise<void> {
    try {
      const existingUsers = await this.loadUsers(userNpub);
      existingUsers[user.npub] = user;

      const storageKey = `${FOLLOW_SET_USERS_KEY}_${userNpub}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(existingUsers));
    } catch (error) {
      console.error('Error updating user in storage:', error);
      throw error;
    }
  }

  /**
   * Get users for a specific follow set
   */
  static async getUsersForFollowSet(
    followSetEventId: string,
    userNpub: string
  ): Promise<StoredUser[]> {
    try {
      const followSets = await this.loadFollowSets(userNpub);
      const targetSet = followSets.find(
        (set) => set.eventId === followSetEventId
      );

      if (!targetSet) {
        return [];
      }

      const allUsers = await this.loadUsers(userNpub);
      const setUsers: StoredUser[] = [];

      // Get public users (npubs are already stored in npub format)
      targetSet.publicUserIds.forEach((npubPubkey) => {
        const user = allUsers[npubPubkey];
        if (user) {
          setUsers.push(user);
        }
      });

      // Get private users if they exist (npubs are already stored in npub format)
      targetSet.privateUserIds?.forEach((npubPubkey) => {
        const user = allUsers[npubPubkey];
        if (user) {
          setUsers.push(user);
        }
      });

      return setUsers;
    } catch (error) {
      console.error('Error getting users for follow set:', error);
      return [];
    }
  }

  /**
   * Clear all stored data for a user (useful for logout)
   */
  static async clearUserData(userNpub: string): Promise<void> {
    try {
      const followSetsKey = `${FOLLOW_SETS_KEY}_${userNpub}`;
      const usersKey = `${FOLLOW_SET_USERS_KEY}_${userNpub}`;

      await Promise.all([
        AsyncStorage.removeItem(followSetsKey),
        AsyncStorage.removeItem(usersKey),
      ]);
    } catch (error) {
      console.error('Error clearing user data from storage:', error);
      throw error;
    }
  }

  /**
   * Get follow sets count for a user
   */
  static async getFollowSetsCount(userNpub: string): Promise<number> {
    try {
      const followSets = await this.loadFollowSets(userNpub);
      return followSets.length;
    } catch (error) {
      console.error('Error getting follow sets count:', error);
      return 0;
    }
  }

  /**
   * Get total users count across all follow sets
   */
  static async getTotalUsersCount(userNpub: string): Promise<number> {
    try {
      const users = await this.loadUsers(userNpub);
      return Object.keys(users).length;
    } catch (error) {
      console.error('Error getting total users count:', error);
      return 0;
    }
  }

  /**
   * Update lastProfilesFetched timestamp for a follow set
   */
  static async updateFollowSetProfilesTimestamp(
    followSetEventId: string,
    userNpub: string
  ): Promise<void> {
    try {
      const followSets = await this.loadFollowSets(userNpub);
      const updatedSets = followSets.map((set) =>
        set.eventId === followSetEventId
          ? { ...set, lastProfilesFetched: Date.now() }
          : set
      );

      const storageKey = `${FOLLOW_SETS_KEY}_${userNpub}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify(updatedSets));
    } catch (error) {
      console.error('Error updating follow set profiles timestamp:', error);
      throw error;
    }
  }
}
