"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
electron_1.ipcMain.on("minimize-app", () => {
    const win = electron_1.BrowserWindow.getFocusedWindow();
    if (win) {
        console.log("--- Main Process: Minimizing window ---");
        win.minimize();
    }
});
electron_1.ipcMain.on("maximize-app", () => {
    const win = electron_1.BrowserWindow.getFocusedWindow();
    if (win) {
        console.log("--- Main Process: Maximizing/Restoring window ---");
        if (win.isMaximized()) {
            win.unmaximize();
        }
        else {
            win.maximize();
        }
    }
});
electron_1.ipcMain.on("close-app", () => {
    const win = electron_1.BrowserWindow.getFocusedWindow();
    if (win) {
        console.log("--- Main Process: Closing window ---");
        win.close();
    }
});
function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        autoHideMenuBar: true,
        titleBarStyle: "hidden",
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            sandbox: true,
            contextIsolation: true,
        },
    });
    // Listen for window state changes and notify the renderer
    win.on("maximize", () => win.webContents.send("window-maximized", true));
    win.on("unmaximize", () => win.webContents.send("window-maximized", false));
    win.on("ready-to-show", () => {
        win.show();
    });
    if (process.env.NODE_ENV === "development") {
        win.loadURL("http://localhost:5173");
    }
    else {
        // In production, load the build index.html from the frontend.
        win.loadFile(path_1.default.join(__dirname, "../frontend/dist/index.html"));
    }
}
electron_1.app.whenReady().then(createWindow);
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
//# sourceMappingURL=main.js.map