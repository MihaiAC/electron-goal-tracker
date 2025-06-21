import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      contextIsolation: true,
    },
  });

  // Add IPC listeners to control the window
  ipcMain.on("minimize-app", () => {
    win.minimize();
  });

  ipcMain.on("maximize-app", () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on("close-app", () => {
    win.close();
  });

  // Listen for window state changes and notify the renderer
  win.on("maximize", () => win.webContents.send("window-maximized", true));
  win.on("unmaximize", () => win.webContents.send("window-maximized", false));

  win.on("ready-to-show", () => {
    win.show();
  });

  if (process.env.NODE_ENV === "development") {
    win.loadURL("http://localhost:5173");
  } else {
    // In production, load the build index.html from the frontend.
    win.loadFile(path.join(__dirname, "../frontend/dist/index.html"));
  }

  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

app.whenReady().then(createWindow);
