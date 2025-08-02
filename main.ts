import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import path from "path";
import fs from "fs";
import { AppData } from "./types/shared";
import Store from "electron-store";

// Global reference to window to prevent GC (?).
let mainWindow: BrowserWindow | null = null;

// Key for storing the encrypted password in electron-store.
const SYNC_PASSWORD_KEY = "syncPassword" as const;

interface StoreSchema {
  [SYNC_PASSWORD_KEY]: string;
}

// Initialise electron-store.
const store = new Store<StoreSchema>();

function setupPasswordIpc() {
  // Save the password securely.
  ipcMain.handle("save-password", (_, password: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Safe storage is not available on this system.");
    }

    try {
      const encryptedPassword = safeStorage.encryptString(password);

      // Store the encrypted password as a base64 string.
      store.set(SYNC_PASSWORD_KEY, encryptedPassword.toString("base64"));
    } catch (error) {
      console.error("Failed to save error: ", error);
      throw error;
    }
  });

  ipcMain.handle("get-password", () => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Safe storage is not available on this system.");
    }

    try {
      const encryptedPasswordBase64 = store.get(SYNC_PASSWORD_KEY);
      if (
        !encryptedPasswordBase64 ||
        typeof encryptedPasswordBase64 !== "string"
      ) {
        return null;
      }

      const encryptedPassword = Buffer.from(encryptedPasswordBase64, "base64");
      return safeStorage.decryptString(encryptedPassword);
    } catch (error) {
      console.error(
        "Failed to get password, clearing potentially corrupt entry.",
        error
      );
      store.delete(SYNC_PASSWORD_KEY);
      return null;
    }
  });

  ipcMain.handle("clear-password", () => {
    store.delete(SYNC_PASSWORD_KEY);
  });
}

// Listener to handle saving progress bar data.
// TODO: Group-up related handlers, as above.
ipcMain.handle("save-data", async (_event, data) => {
  const filePath = path.join(app.getPath("userData"), "my-data.json");
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  return { success: true, path: filePath };
});

// Handle loading bar data from local storage on app start.
ipcMain.handle("load-data", async () => {
  const filePath = path.join(app.getPath("userData"), "my-data.json");
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data) as AppData;
    } else {
    }
  } catch (error) {
    // TODO: need proper logging.
    console.error("Error loading data: ", error);
  }

  return { bars: [] };
});

// Handle window controls.
ipcMain.on("minimize-app", () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on("maximize-app", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("close-app", () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    show: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Load the app.
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../frontend/dist/index.html"));
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

app.whenReady().then(() => {
  setupPasswordIpc();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
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
