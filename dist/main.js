"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_store_1 = __importDefault(require("electron-store"));
// Global reference to window to prevent GC (?).
let mainWindow = null;
// Key for storing the encrypted password in electron-store.
const SYNC_PASSWORD_KEY = "syncPassword";
// Initialise electron-store.
const store = new electron_store_1.default();
function setupPasswordIpc() {
    // Save the password securely.
    electron_1.ipcMain.handle("save-password", (_, password) => {
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new Error("Safe storage is not available on this system.");
        }
        try {
            const encryptedPassword = electron_1.safeStorage.encryptString(password);
            // Store the encrypted password as a base64 string.
            store.set(SYNC_PASSWORD_KEY, encryptedPassword.toString("base64"));
        }
        catch (error) {
            console.error("Failed to save error: ", error);
            throw error;
        }
    });
    electron_1.ipcMain.handle("get-password", () => {
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new Error("Safe storage is not available on this system.");
        }
        try {
            const encryptedPasswordBase64 = store.get(SYNC_PASSWORD_KEY);
            if (!encryptedPasswordBase64 ||
                typeof encryptedPasswordBase64 !== "string") {
                return null;
            }
            const encryptedPassword = Buffer.from(encryptedPasswordBase64, "base64");
            return electron_1.safeStorage.decryptString(encryptedPassword);
        }
        catch (error) {
            console.error("Failed to get password, clearing potentially corrupt entry.", error);
            store.delete(SYNC_PASSWORD_KEY);
            return null;
        }
    });
    electron_1.ipcMain.handle("clear-password", () => {
        store.delete(SYNC_PASSWORD_KEY);
    });
}
// Listener to handle saving progress bar data.
// TODO: Group-up related handlers, as above.
electron_1.ipcMain.handle("save-data", async (_event, data) => {
    const filePath = path_1.default.join(electron_1.app.getPath("userData"), "my-data.json");
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return { success: true, path: filePath };
});
// Handle loading bar data from local storage on app start.
electron_1.ipcMain.handle("load-data", async () => {
    const filePath = path_1.default.join(electron_1.app.getPath("userData"), "my-data.json");
    try {
        if (fs_1.default.existsSync(filePath)) {
            const data = fs_1.default.readFileSync(filePath, "utf-8");
            return JSON.parse(data);
        }
        else {
        }
    }
    catch (error) {
        // TODO: need proper logging.
        console.error("Error loading data: ", error);
    }
    return { bars: [] };
});
// Handle window controls.
electron_1.ipcMain.on("minimize-app", () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});
electron_1.ipcMain.on("maximize-app", () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow.maximize();
        }
    }
});
electron_1.ipcMain.on("close-app", () => {
    if (mainWindow) {
        mainWindow.close();
    }
});
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1000,
        height: 800,
        show: false,
        frame: false,
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
        },
    });
    // Load the app.
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, "../frontend/dist/index.html"));
    }
    // Show window when ready.
    mainWindow.once("ready-to-show", () => {
        if (mainWindow) {
            mainWindow.show();
        }
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(() => {
    setupPasswordIpc();
    createWindow();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// Clean-up function if needed in the future.
// app.on("before-quit", () => {});
// Handle any uncaught exceptions.
process.on("uncaughtException", (error) => {
    console.error("Uncaught exception: ", error);
});
//# sourceMappingURL=main.js.map