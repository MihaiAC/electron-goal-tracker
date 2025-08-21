export interface ProgressBarData {
  id: string;
  title: string;
  current: number;
  max: number;
  unit: string;
  incrementDelta: number;
  completedColor: string;
  remainingColor: string;
}

export interface VersionedAppData {
  version: number;
  lastSynced: string;
  bars: ProgressBarData[];
}

export interface AppData {
  bars: ProgressBarData[];
}

export interface SaveResult {
  success: boolean;
  path: string;
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

// Shared error codes (used by main <-> preload <-> renderer envelopes)
export const ErrorCodes = {
  Canceled: "Canceled",
  NotAuthenticated: "NotAuthenticated",
  OAuthConfig: "OAuthConfig",
  TokenRefreshFailed: "TokenRefreshFailed",
  DriveApi: "DriveApi",
  Network: "Network",
  NotFound: "NotFound",
  Crypto: "Crypto",
  SafeStorage: "SafeStorage",
  Unknown: "Unknown",
} as const;
