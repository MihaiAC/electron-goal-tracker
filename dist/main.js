"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const password_1 = require("./ipc/password");
const auth_1 = require("./ipc/auth");
const dropbox_1 = require("./ipc/dropbox");
const sounds_1 = require("./ipc/sounds");
const data_1 = require("./ipc/data");
const window_controls_1 = require("./ipc/window-controls");
/**
 * Main Electron Process
 *
 * This is the main entry point for the Electron application.
 * It handles app lifecycle, window creation, and IPC handler setup.
 *
 * The IPC handlers have been modularized into separate files for better organization:
 * - ipc/password.ts: Secure password storage using safeStorage
 * - ipc/auth.ts: OAuth authentication flow with Dropbox
 * - ipc/dropbox.ts: Cloud sync operations with Dropbox API
 * - ipc/sounds.ts: Sound file management for UI events
 * - ipc/data.ts: Local application data persistence
 * - ipc/window-controls.ts: Window minimize/maximize/close operations
 */
dotenv_1.default.config();
// Global reference to window to prevent garbage collection
let mainWindow = null;
/**
 * Creates the main application window with security-focused web preferences.
 * Loads either the Vite dev server or the built frontend based on environment.
 */
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1000,
        height: 800,
        minWidth: 900,
        minHeight: 700,
        show: false,
        frame: false,
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
        },
    });
    // Load the appropriate frontend based on environment
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, "../frontend/dist/index.html"));
    }
    // Show window when ready to prevent visual flash
    mainWindow.once("ready-to-show", () => {
        if (mainWindow) {
            mainWindow.show();
        }
    });
    // Clean up reference when window is closed
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
// Initialize all IPC handlers and create window when app is ready
electron_1.app.whenReady().then(() => {
    (0, password_1.setupPasswordIpc)();
    (0, auth_1.setupAuthIpc)();
    (0, dropbox_1.setupDropboxIpc)();
    (0, sounds_1.setupSoundsIpc)();
    (0, data_1.setupDataIpc)();
    createWindow();
    (0, window_controls_1.setupWindowControlsIpc)(mainWindow);
});
// Quit when all windows are closed
electron_1.app.on("window-all-closed", () => {
    electron_1.app.quit();
});
// Handle any uncaught exceptions to prevent crashes
process.on("uncaughtException", (error) => {
    console.error("Uncaught exception: ", error);
});
//# sourceMappingURL=main.js.map