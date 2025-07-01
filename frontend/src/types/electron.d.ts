/* eslint-disable @typescript-eslint/no-explicit-any */
// TODO: Why is this duplicated with the WindowAPI interface?
export interface IElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => void;
  saveData: (data: any) => Promise<{ success: boolean; path: string }>;
  loadData: () => Promise<any>;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
