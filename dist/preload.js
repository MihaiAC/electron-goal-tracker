"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Define the API we are exposing
const api = {
    minimize: () => {
        electron_1.ipcRenderer.send("minimize-app");
    },
    maximize: () => {
        electron_1.ipcRenderer.send("maximize-app");
    },
    close: () => {
        electron_1.ipcRenderer.send("close-app");
    },
    onWindowStateChange: (callback) => {
        electron_1.ipcRenderer.on("window-maximized", (_event, isMaximized) => callback(isMaximized));
        return () => {
            electron_1.ipcRenderer.removeAllListeners("window-maximized");
        };
    },
    saveData: (data) => electron_1.ipcRenderer.invoke("save-data", data),
    loadData: () => electron_1.ipcRenderer.invoke("load-data"),
    savePassword: (password) => electron_1.ipcRenderer.invoke("save-password", password),
    getPassword: () => electron_1.ipcRenderer.invoke("get-password"),
    clearPassword: () => electron_1.ipcRenderer.invoke("clear-password"),
    // OAuth for Google Drive
    startGoogleAuth: () => electron_1.ipcRenderer.invoke("auth-start"),
    cancelGoogleAuth: () => electron_1.ipcRenderer.invoke("auth-cancel"),
    getAuthStatus: () => electron_1.ipcRenderer.invoke("auth-status"),
    authSignOut: () => electron_1.ipcRenderer.invoke("auth-sign-out"),
};
// Expose the API to the renderer process
if (process.contextIsolated) {
    try {
        electron_1.contextBridge.exposeInMainWorld("api", api);
    }
    catch (error) {
        console.error("[Preload] Failed to expose API:", error);
    }
}
else {
    // Fallback for development
    window.api = api;
}
//# sourceMappingURL=preload.js.map