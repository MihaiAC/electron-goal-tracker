import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";

ipcMain.on("minimize-app", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    console.log("--- Main Process: Minimizing window ---");
    win.minimize();
  }
});

ipcMain.on("maximize-app", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    console.log("--- Main Process: Maximizing/Restoring window ---");
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on("close-app", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    console.log("--- Main Process: Closing window ---");
    win.close();
  }
});

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
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
