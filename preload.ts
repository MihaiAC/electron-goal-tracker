import { contextBridge, ipcRenderer } from "electron";

// Define the API we are exposing
const api = {
  minimize: () => ipcRenderer.send("minimize-app"),
  maximize: () => ipcRenderer.send("maximize-app"),
  close: () => ipcRenderer.send("close-app"),
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on("window-maximized", (_event, isMaximized) =>
      callback(isMaximized)
    );
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld("api", api);
