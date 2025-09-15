import { AppData, AuthStatus, SaveResult, SoundEventId } from "./shared";

// Parameters for Dropbox IPC methods
export type DropboxSyncParameters = {
  fileName: string;
  content: Uint8Array;
  contentType?: string;
};

export type DropboxRestoreParameters = {
  fileName: string;
};

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message?: string; status?: number } };

export interface IElectronAPI {
  // Window controls
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => () => void;

  // Data persistence
  saveData: (data: AppData) => Promise<SaveResult>;
  savePartialData: (data: Partial<AppData>) => Promise<SaveResult>;
  loadData: () => Promise<AppData | null>;

  // Password management
  savePassword: (password: string) => Promise<void>;
  getPassword: () => Promise<string | null>;
  clearPassword: () => Promise<void>;

  // OAuth (keeping same names for UI compatibility)
  startDropboxAuth: () => Promise<void>;
  cancelDropboxAuth: () => Promise<void>;
  getAuthStatus: () => Promise<AuthStatus>;
  authSignOut: () => Promise<void>;

  // Dropbox sync/restore (keeping same names for UI compatibility)
  driveSync: (params: DropboxSyncParameters) => Promise<void>;
  driveRestore: (params: DropboxRestoreParameters) => Promise<Uint8Array>;
  driveCancel: () => Promise<void>;
  autoSyncOnClose: (params: DropboxSyncParameters) => Promise<void>;

  // Auto-sync event handlers - simplified
  onStartAutoSync: (callback: (message: string) => void) => () => void;
  sendAutoSyncComplete: (success: boolean) => void;

  // Sound management
  saveSoundForEvent: (
    eventId: SoundEventId,
    content: Uint8Array
  ) => Promise<void>;
  readSoundForEvent: (eventId: SoundEventId) => Promise<Uint8Array | null>;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
