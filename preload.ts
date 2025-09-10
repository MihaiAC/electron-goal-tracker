import { contextBridge, ipcRenderer } from "electron";
import {
  DropboxRestoreParameters,
  DropboxSyncParameters,
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
  console.error("[preload] IPC error", {
    channel,
    code: result.error?.code,
    status: result.error?.status,
    message: result.error?.message,
  });
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

  // OAuth for Dropbox (keeping same API names for UI compatibility)
  startDropboxAuth: () => invokeAndUnwrap<void>("auth-start"),
  cancelDropboxAuth: () => invokeAndUnwrap<void>("auth-cancel"),
  getAuthStatus: () => invokeAndUnwrap<AuthStatus>("auth-status"),
  authSignOut: () => invokeAndUnwrap<void>("auth-sign-out"),

  // Dropbox syncing operations (keeping same API names for UI compatibility)
  driveSync: (params: DropboxSyncParameters) =>
    invokeAndUnwrap<void>("drive-sync", params),
  driveRestore: (params: DropboxRestoreParameters) =>
    invokeAndUnwrap<Uint8Array>("drive-restore", params),
  driveCancel: () => invokeAndUnwrap<void>("drive-cancel"),

  /** Save a user-uploaded .mp3 sound under a canonical filename for the event. */
  saveSoundForEvent: (eventId, content) =>
    invokeAndUnwrap<void>("sounds-save", eventId, content),
  /** Read raw .mp3 bytes for a given event from disk. */
  readSoundForEvent: (eventId) =>
    invokeAndUnwrap<Uint8Array | null>("sounds-read", eventId),
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
