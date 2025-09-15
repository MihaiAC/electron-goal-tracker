import { ipcMain, BrowserWindow, dialog } from "electron";
import fs from "fs/promises";
import path from "path";
import { app } from "electron";

/**
 * Window Controls IPC Handlers
 */

// Flag to track if sync is in progress during close
let syncInProgressDuringClose = false;
// Timeout for auto-sync (in milliseconds)
const AUTO_SYNC_TIMEOUT = 15000;

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
  ipcMain.on("close-app", async () => {
    if (!mainWindow) {
      return;
    }

    try {
      // Check if we're authenticated with Dropbox
      const userDataPath = app.getPath("userData");
      const storeFilePath = path.join(userDataPath, "config.json");

      let isAuthenticated = false;
      try {
        const fileContent = await fs.readFile(storeFilePath, "utf-8");
        const storeData = JSON.parse(fileContent);
        isAuthenticated = !!storeData.oauthRefreshToken;
      } catch (error) {
        console.error("[window-controls] Error checking auth status:", error);
        // If we can't read the file or parse it, assume not authenticated
        isAuthenticated = false;
      }

      if (!isAuthenticated) {
        // If not authenticated, just close the window normally
        mainWindow.close();
        return;
      }

      // Set sync in progress flag and send a single event to start auto-sync
      syncInProgressDuringClose = true;
      mainWindow.webContents.send(
        "start-auto-sync",
        "Syncing before closing..."
      );

      // Set a timeout to ensure the app closes even if sync fails
      const closeTimeout = setTimeout(() => {
        console.info(
          "[window-controls] Auto-sync timeout reached, closing app"
        );
        syncInProgressDuringClose = false;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.close();
        }
      }, AUTO_SYNC_TIMEOUT);

      // Listen for sync completion
      const syncCompleteListener = (_event: any, success: boolean) => {
        clearTimeout(closeTimeout);
        console.info("[window-controls] Auto-sync completed, closing app");

        // Reset the flag to allow window to close
        syncInProgressDuringClose = false;

        // Remove the listener to avoid memory leaks
        ipcMain.removeListener("auto-sync-complete", syncCompleteListener);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.close();
        }
      };

      // Register the listener
      ipcMain.once("auto-sync-complete", syncCompleteListener);
    } catch (error) {
      console.error("[window-controls] Error during auto-sync:", error);
      // If anything goes wrong, reset flag and close the window
      syncInProgressDuringClose = false;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
      }
    }
  });

  // Handle before-close event to prevent immediate closing if sync is in progress
  if (mainWindow) {
    mainWindow.on("close", (event) => {
      if (syncInProgressDuringClose) {
        // If sync is in progress, prevent the default close behavior
        // The window will be closed after sync completes or times out
        event.preventDefault();
      }
    });
  }
}
