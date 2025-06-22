"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Let's log immediately to see if the import worked.
// This will show up in the DevTools console.
console.log("[Preload] ipcRenderer object:", electron_1.ipcRenderer);
// Define the API we are exposing
const api = {
    minimize: () => {
        // This log is the most important one.
        console.log('[Preload] Calling ipcRenderer.send with "minimize-app"');
        electron_1.ipcRenderer.send("minimize-app");
    },
    maximize: () => {
        console.log('[Preload] Calling ipcRenderer.send with "maximize-app"');
        electron_1.ipcRenderer.send("maximize-app");
    },
    close: () => {
        console.log('[Preload] Calling ipcRenderer.send with "close-app"');
        electron_1.ipcRenderer.send("close-app");
    },
    onWindowStateChange: (callback) => {
        // This listener part seems to work, which makes the issue even stranger.
        electron_1.ipcRenderer.on("window-maximized", (_event, isMaximized) => callback(isMaximized));
    },
};
// Expose the API to the renderer process
try {
    electron_1.contextBridge.exposeInMainWorld("api", api);
    console.log("[Preload] API exposed successfully");
}
catch (error) {
    console.error("[Preload] Failed to expose API:", error);
}
//# sourceMappingURL=preload.js.map