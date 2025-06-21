export interface IElectronAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => void;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
