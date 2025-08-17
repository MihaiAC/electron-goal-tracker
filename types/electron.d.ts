import { AppData, AuthStatus, SaveResult } from "./shared";

export interface IElectronAPI {
  // Window controls.
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => void;

  // Saving data locally.
  saveData: (data: AppData) => Promise<SaveResult>;
  loadData: () => Promise<AppData | null>;

  // Encryption password management.
  savePassword: (password: string) => Promise<void>;
  getPassword: () => Promise<string | null>;
  clearPassword: () => Promise<void>;

  // OAuth
  startGoogleAuth: () => Promise<void>;
  cancelGoogleAuth: () => Promise<void>;
  getAuthStatus: () => Promise<AuthStatus>;
  authSignOut: () => Promise<void>;
}

interface Window {
  api: IElectronAPI;
}

export type SecureStoreData = {
  syncPassword: string;
};
