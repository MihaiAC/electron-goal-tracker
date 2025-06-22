import { contextBridge, ipcRenderer } from "electron";

// console.log("[Preload] ipcRenderer object:", ipcRenderer);

// Define the API we are exposing
const api = {
  minimize: () => {
    // console.log('[Preload] Calling ipcRenderer.send with "minimize-app"');
    ipcRenderer.send("minimize-app");
  },
  maximize: () => {
    // console.log('[Preload] Calling ipcRenderer.send with "maximize-app"');
    ipcRenderer.send("maximize-app");
  },
  close: () => {
    // console.log('[Preload] Calling ipcRenderer.send with "close-app"');
    ipcRenderer.send("close-app");
  },
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on("window-maximized", (_event, isMaximized) =>
      callback(isMaximized)
    );
  },
};

// Expose the API to the renderer process
try {
  contextBridge.exposeInMainWorld("api", api);
  console.log("[Preload] API exposed successfully");
} catch (error) {
  console.error("[Preload] Failed to expose API:", error);
}
