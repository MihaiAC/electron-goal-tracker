import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { AppData } from "./types/shared";

// Global reference to window to prevent GC (?).
let mainWindow: BrowserWindow | null = null;

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

  // Listener to handle saving progress bar data.
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

  // Show window when ready.
  mainWindow.once("ready-to-show", () => {
    if (mainWindow) {
      mainWindow.show();
    }
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

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
app.on("before-quit", () => {});

// Handle any uncaught exceptions.
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception: ", error);
});
