import { ipcMain, BrowserWindow } from "electron";

/**
 * Window Controls IPC Handlers
 */

/**
 * Sets up all window control IPC handlers.
 * Call this function during app initialization to register the handlers.
 *
 * @param mainWindow - Reference to the main BrowserWindow instance
 */
export function setupWindowControlsIpc(mainWindow: BrowserWindow | null) {
  // Minimize the application window
  ipcMain.on("minimize-app", () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  // Toggle between maximized and restored window state
  ipcMain.on("maximize-app", () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  // Close the application window
  ipcMain.on("close-app", () => {
    if (mainWindow) {
      mainWindow.close();
    }
  });
}
