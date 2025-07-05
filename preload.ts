import { contextBridge, ipcRenderer } from "electron";
import { IElectronAPI } from "./types/electron";

// Define the API we are exposing
const api: IElectronAPI = {
  minimize: () => {
    ipcRenderer.send("minimize-app");
  },
  maximize: () => {
    ipcRenderer.send("maximize-app");
  },
  close: () => {
    ipcRenderer.send("close-app");
  },
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on("window-maximized", (_event, isMaximized) =>
      callback(isMaximized)
    );

    return () => {
      ipcRenderer.removeAllListeners("window-maximized");
    };
  },
  saveData: (data) => ipcRenderer.invoke("save-data", data),
  loadData: () => ipcRenderer.invoke("load-data"),
};

// Expose the API to the renderer process
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error("[Preload] Failed to expose API:", error);
  }
} else {
  // Fallback for development
  (window as any).api = api;
}
