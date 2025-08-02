import { AppData, SaveResult } from "./shared";

export interface IElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => void;
  saveData: (data: AppData) => Promise<SaveResult>;
  loadData: () => Promise<AppData | null>;
  savePassword: (password: string) => Promise<void>;
  getPassword: () => Promise<string | null>;
  clearPassword: () => Promise<void>;
}

interface Window {
  api: IElectronAPI;
}

export type SecureStoreData = {
  syncPassword: string;
};
