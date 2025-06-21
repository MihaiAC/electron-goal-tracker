"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Define the API we are exposing
const api = {
    minimize: () => electron_1.ipcRenderer.send("minimize-app"),
    maximize: () => electron_1.ipcRenderer.send("maximize-app"),
    close: () => electron_1.ipcRenderer.send("close-app"),
    onWindowStateChange: (callback) => {
        electron_1.ipcRenderer.on("window-maximized", (_event, isMaximized) => callback(isMaximized));
    },
};
// Expose the API to the renderer process
electron_1.contextBridge.exposeInMainWorld("api", api);
