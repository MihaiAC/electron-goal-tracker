export interface ProgressBarData {
  id: string;
  title: string;
  current: number;
  max: number;
  unit: string;
  incrementDelta: number;
  completedColor: string;
  remainingColor: string;
  /** Hex color used to render the hover glow when incrementing (right side). */
  incrementHoverGlowHex?: string;
  /** Hex color used to render the hover glow when decrementing (left side). */
  decrementHoverGlowHex?: string;
}

// BarsPayload removed: AppData is the single canonical shape. Dropbox uses
// subsets of AppData (encrypted bars, plaintext settings) without an extra type.

export interface AppData {
  bars: ProgressBarData[];
  lastSynced?: string | null;
  sounds?: SoundsData;
  /** Optional theme saved locally. */
  theme?: ThemeData;
}

export interface SaveResult {
  success: boolean;
  path?: string;
  error?: string;
}

export interface OAuthUser {
  email?: string;
  name?: string;
  picture?: string;
}

export type OAuthTokens = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
};

export interface AuthStatus {
  isAuthenticated: boolean;
  user: OAuthUser | null;
}

// Shared error codes (used by main <-> preload <-> renderer wrappers)
export const ErrorCodes = {
  Canceled: "Canceled",
  NotAuthenticated: "NotAuthenticated",
  OAuthConfig: "OAuthConfig",
  TokenRefreshFailed: "TokenRefreshFailed",
  DropboxApi: "DropboxApi",
  Network: "Network",
  NotFound: "NotFound",
  Crypto: "Crypto",
  SafeStorage: "SafeStorage",
  Filesystem: "Filesystem",
  Unknown: "Unknown",
} as const;

/** Canonical UI sound events. */
export type SoundEventId =
  | "progressIncrement"
  | "progressDecrement"
  | "progressComplete";

/**
 * Preferences for UI sounds persisted in app data.
 * eventFiles contain canonical filenames per event (e.g., ui_increment.mp3) or an empty string if unset.
 * No base64/data URLs are stored in app data.
 */
export interface SoundsData {
  preferences: {
    masterVolume: number;
    muteAll: boolean;
    eventFiles: Record<SoundEventId, string>;
  };
}

/** Theme data persisted in app data and included in cloud sync (hex colors). */
export interface ThemeData {
  backgroundHex: string;
  foregroundHex: string;
  buttonPrimaryHex: string;
  buttonSecondaryHex: string;
  buttonDestructiveHex: string;
}
