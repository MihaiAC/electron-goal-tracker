"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// console.log("[Preload] ipcRenderer object:", ipcRenderer);
// Define the API we are exposing
const api = {
    minimize: () => {
        // console.log('[Preload] Calling ipcRenderer.send with "minimize-app"');
        electron_1.ipcRenderer.send("minimize-app");
    },
    maximize: () => {
        // console.log('[Preload] Calling ipcRenderer.send with "maximize-app"');
        electron_1.ipcRenderer.send("maximize-app");
    },
    close: () => {
        // console.log('[Preload] Calling ipcRenderer.send with "close-app"');
        electron_1.ipcRenderer.send("close-app");
    },
    onWindowStateChange: (callback) => {
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