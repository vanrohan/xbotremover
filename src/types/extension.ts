export interface CleaningSettings {
  maxFollowers: number | null;
  minFollowing: number | null;
  maxPosts: number | null;
  skipUntilUsername: string | null;
  usernameDigits: number | null;
  minPostAgeDays: number | null;
  bioMatchesText: string | null;
  isDryRun: boolean;
  removeBlacklistedCountries: boolean;
  blacklistedCountries: string[];
}

export interface CleaningState {
  isRunning: boolean;
  tabId: number | null;
  kept: number;
  removed: number;
  pageType?: 'followers' | 'following';
}

export interface FollowerStats {
  username: string;
  followers: number;
  following: number;
  bio?: string;
}

export interface ProfileData extends FollowerStats {
  posts: number | null;
  ratio: string;
  latestPostAgeDays: number | null;
}

export interface FollowerData {
  element: Element;
  username: string;
}

export interface FollowingData {
  element: Element;
  username: string;
}

export interface TechnicalSettings {
  scrollDelay: number;
  actionDelay: number;
  hoverDelay: number;
  profileLoadDelay: number;
  maxFollowerAttempts: number;
  maxHoverAttempts: number;
  maxScrollAttempts: number;
}

export interface StorageData {
  usernamesToRemove?: string;
  technicalSettings?: TechnicalSettings;
  blacklistedCountries?: string[];
}

// Message types for communication between background, content, and popup
export type BackgroundMessage = 
  | { action: 'startCleaning'; pageType: 'followers' | 'following' } & CleaningSettings
  | { action: 'stopCleaning' }
  | { action: 'getCleaningState' }
  | { action: 'updateProgress'; kept: number; removed: number }
  | { action: 'cleaningComplete'; kept: number; removed: number }
  | { action: 'cleaningError'; error: string }

export type ContentMessage =
  | { action: 'start'; pageType: 'followers' | 'following' } & CleaningSettings & { usernamesToRemove: string[] }
  | { action: 'stopCleaning' }
  | { action: 'cleaningError'; error: string }


export interface MessageResponse {
  success?: boolean;
  error?: string;
  received?: boolean;
  stopped?: boolean;
}