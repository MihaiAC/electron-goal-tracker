"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Helper: invoke IPC channel and unwrap the standard IpcResult wrapper
async function invokeAndUnwrap(channel, ...args) {
    const result = (await electron_1.ipcRenderer.invoke(channel, ...args));
    if (!result || typeof result !== "object" || !("ok" in result)) {
        // Back-compat: if main returned a raw value, just pass it through
        return result;
    }
    if (result.ok) {
        // Some handlers may not return data (void)
        return result.data ?? undefined;
    }
    // Error path: forward minimal error wrapper { code, message, status }
    throw result.error;
}
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
    saveData: (data) => invokeAndUnwrap("save-data", data),
    savePartialData: (data) => invokeAndUnwrap("save-partial-data", data),
    loadData: () => invokeAndUnwrap("load-data"),
    savePassword: (password) => invokeAndUnwrap("save-password", password),
    getPassword: () => invokeAndUnwrap("get-password"),
    clearPassword: () => invokeAndUnwrap("clear-password"),
    // OAuth for Google Drive
    startGoogleAuth: () => invokeAndUnwrap("auth-start"),
    cancelGoogleAuth: () => invokeAndUnwrap("auth-cancel"),
    getAuthStatus: () => invokeAndUnwrap("auth-status"),
    authSignOut: () => invokeAndUnwrap("auth-sign-out"),
    // GDrive syncing operations
    driveSync: (params) => invokeAndUnwrap("drive-sync", params),
    driveRestore: (params) => invokeAndUnwrap("drive-restore", params),
    driveCancel: () => invokeAndUnwrap("drive-cancel"),
    /** Save a user-uploaded .mp3 sound under a canonical filename for the event. */
    saveSoundForEvent: (eventId, content) => invokeAndUnwrap("sounds-save", eventId, content),
    /** Read raw .mp3 bytes for a given event from disk. */
    readSoundForEvent: (eventId) => invokeAndUnwrap("sounds-read", eventId),
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