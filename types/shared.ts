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
  /** ISO timestamp when this bar was created. If missing (older data), treat as now when rendering. */
  createdAt?: string;
  /** User-authored notes for this bar (max 50 enforced by UI). Oldest may be pruned; createdAt is not part of notes. */
  notes?: BarNote[];
  /** ID of the pattern to use for the progress bar (e.g., "diagonal-lines"). */
  patternId?: string;
  /** Color for the pattern (defaults to black if not specified). */
  patternColorHex?: string;
}

/**
 * A single user-authored journal note attached to a progress bar.
 * Stored with ISO timestamp and rendered in UI as EEE, dd/MMM/yy.
 */
export interface BarNote {
  /** Stable id for the note (e.g., timestamp-based). */
  id: string;
  /** ISO timestamp when the note was added. */
  at: string;
  /** Freeform text entered by the user. */
  message: string;
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
  neutralHex: string;
}
