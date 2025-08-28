import { contextBridge, ipcRenderer } from "electron";
import {
  DriveRestoreParameters,
  DriveSyncParameters,
  IElectronAPI,
} from "./types/electron";
import { AuthStatus } from "./types/shared";
import type { IpcResult } from "./types/electron";
import type { AppData, SaveResult } from "./types/shared";

// Helper: invoke IPC channel and unwrap the standard IpcResult wrapper
async function invokeAndUnwrap<T>(channel: string, ...args: any[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>;

  if (!result || typeof result !== "object" || !("ok" in result)) {
    // Back-compat: if main returned a raw value, just pass it through
    return result as unknown as T;
  }

  if (result.ok) {
    // Some handlers may not return data (void)
    return (result.data as T) ?? (undefined as unknown as T);
  }

  // Error path: forward minimal error wrapper { code, message, status }
  throw result.error;
}

// Define the API we are exposing
const api: IElectronAPI = {
  minimize: () => {
    ipcRenderer.send("minimize-app");
  },
  maximize: () => {
    ipcRenderer.send("maximize-app");
  },
  close: () => {
    ipcRenderer.send("close-app");
  },
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on("window-maximized", (_event, isMaximized) =>
      callback(isMaximized)
    );

    return () => {
      ipcRenderer.removeAllListeners("window-maximized");
    };
  },
  saveData: (data: AppData) => invokeAndUnwrap<SaveResult>("save-data", data),
  savePartialData: (data: Partial<AppData>) =>
    invokeAndUnwrap<SaveResult>("save-partial-data", data),
  loadData: () => invokeAndUnwrap<AppData | null>("load-data"),
  savePassword: (password: string) =>
    invokeAndUnwrap<void>("save-password", password),
  getPassword: () => invokeAndUnwrap<string | null>("get-password"),
  clearPassword: () => invokeAndUnwrap<void>("clear-password"),

  // OAuth for Google Drive
  startGoogleAuth: () => invokeAndUnwrap<void>("auth-start"),
  cancelGoogleAuth: () => invokeAndUnwrap<void>("auth-cancel"),
  getAuthStatus: () => invokeAndUnwrap<AuthStatus>("auth-status"),
  authSignOut: () => invokeAndUnwrap<void>("auth-sign-out"),

  // GDrive syncing operations
  driveSync: (params: DriveSyncParameters) =>
    invokeAndUnwrap<void>("drive-sync", params),
  driveRestore: (params: DriveRestoreParameters) =>
    invokeAndUnwrap<Uint8Array>("drive-restore", params),
  driveCancel: () => invokeAndUnwrap<void>("drive-cancel"),

  /** Save a user-uploaded .mp3 sound under a canonical filename for the event. */
  saveSoundForEvent: (eventId, content) =>
    invokeAndUnwrap<void>("sounds-save", eventId, content),
};

// Expose the API to the renderer process
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error("[Preload] Failed to expose API:", error);
  }
} else {
  // Fallback for development
  (window as any).api = api;
}
