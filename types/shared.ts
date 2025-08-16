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

export interface AuthStatus {
  isAuthenticated: boolean;
  user: OAuthUser | null;
}
