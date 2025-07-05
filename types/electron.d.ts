import { AppData, SaveResult } from "./shared";

export interface IElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => void;
  saveData: (data: AppData) => Promise<SaveResult>;
  loadData: () => Promise<AppData | null>;
}

interface Window {
  api: IElectronAPI;
}
