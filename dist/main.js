"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Global reference to window to prevent GC (?).
let mainWindow = null;
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
    // Listener to handle saving progress bar data.
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
                return null;
            }
        }
        catch (error) {
            // TODO: need proper logging.
            console.error("Error loading data: ", error);
            return null;
        }
    });
    // Show window when ready.
    mainWindow.once("ready-to-show", () => {
        if (mainWindow) {
            mainWindow.show();
        }
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
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(createWindow);
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
electron_1.app.on("before-quit", () => { });
// Handle any uncaught exceptions.
process.on("uncaughtException", (error) => {
    console.error("Uncaught exception: ", error);
});
//# sourceMappingURL=main.js.map