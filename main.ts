import { app, BrowserWindow, ipcMain, safeStorage, shell } from "electron";
import path from "path";
import fs from "fs";
import { AppData, OAuthUser, ErrorCodes, SoundEventId } from "./types/shared";
import Store from "electron-store";
import pkceChallenge from "pkce-challenge";
import dotenv from "dotenv";
import {
  startLoopbackRedirectServer,
  waitForAuthorizationCode,
  buildAuthUrl,
  exchangeAuthorizationCodeForTokens,
  decodeJwtPayload,
  refreshAccessToken,
} from "./utils/auth";

import {
  findAppDataFileIdByName,
  createAppDataFile,
  updateAppDataFileContent,
  downloadAppDataFileContent,
  deleteAppDataFile,
} from "./utils/drive";

import {
  CanceledError,
  CryptoError,
  NotAuthenticatedError,
  OAuthConfigError,
  TokenRefreshFailedError,
  NotFoundError,
  UnknownMainProcessError,
  MainProcessError,
  SafeStorageError,
} from "./utils/main-process-errors";

// TODO: Will need to split this into multiple files, I can't tell what's going on anymore.

dotenv.config();

// Global reference to window to prevent GC (?).
let mainWindow: BrowserWindow | null = null;

// Key for storing the encrypted password in electron-store.
const SYNC_PASSWORD_KEY = "syncPassword" as const;
const OAUTH_REFRESH_TOKEN_KEY = "oauthRefreshToken" as const;
const OAUTH_USER_INFO_KEY = "oauthUser" as const;

interface StoreSchema {
  [SYNC_PASSWORD_KEY]: string;
  [OAUTH_REFRESH_TOKEN_KEY]?: string;
  oauthUser?: OAuthUser;
}

// Initialise electron-store.
const store = new Store<StoreSchema>();

// Wrapper to serialize typed errors across IPC
function toIpcErrorWrapper(error: unknown): {
  code: string;
  message?: string;
  status?: number;
} {
  if (error instanceof MainProcessError) {
    return { code: error.code, message: error.message, status: error.status };
  } else if (error instanceof Error) {
    return { code: ErrorCodes.Unknown, message: error.message };
  } else {
    return { code: ErrorCodes.Unknown, message: String(error) };
  }
}

function handleInvoke<T>(
  channel: string,
  handler: (...args: any[]) => Promise<T> | T
) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      const data = await handler(...args);
      return { ok: true, data } as const;
    } catch (error) {
      return { ok: false, error: toIpcErrorWrapper(error) } as const;
    }
  });
}

function setupPasswordIpc() {
  // Save the password securely.
  handleInvoke("save-password", async (password: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new CryptoError("Safe storage is not available on this system.");
    }

    try {
      const encryptedPassword = safeStorage.encryptString(password);

      // Store the encrypted password as a base64 string.
      store.set(SYNC_PASSWORD_KEY, encryptedPassword.toString("base64"));
    } catch (error) {
      console.error(
        "[password] Failed to encrypt password for storage: ",
        error
      );
      throw new SafeStorageError("Failed to encrypt password for storage.", {
        cause: error,
      });
    }
  });

  handleInvoke("get-password", async () => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new CryptoError("Safe storage is not available on this system.");
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

  handleInvoke("clear-password", async () => {
    store.delete(SYNC_PASSWORD_KEY);
  });
}

// TODO: Nicer screen for authentication success.
// TODO: Can the URL be cleaned up a little bit?
function setupAuthIpc() {
  // Local controller to cancel an in-flight OAuth attempt.
  let authController: AbortController | null = null;

  const ensurePreconditions = (): {
    clientId: string;
    oauthClientSecret?: string;
  } => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const oauthClientSecretRaw = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const oauthClientSecret =
      typeof oauthClientSecretRaw === "string" &&
      oauthClientSecretRaw.trim().length > 0
        ? oauthClientSecretRaw.trim()
        : undefined;

    if (!clientId) {
      throw new OAuthConfigError("Missing GOOGLE_OAUTH_CLIENT_ID in .env");
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new CryptoError("Safe storage is not available on this system.");
    }
    return { clientId, oauthClientSecret };
  };

  const storeTokensAndUser = (tokens: {
    refresh_token?: string;
    id_token?: string;
  }) => {
    const refresh = tokens.refresh_token;
    if (refresh) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new CryptoError("Safe storage is not available on this system.");
      }

      try {
        const encrypted = safeStorage.encryptString(refresh);
        store.set(OAUTH_REFRESH_TOKEN_KEY, encrypted.toString("base64"));
      } catch (error) {
        console.error("[auth] Failed to encrypt refresh token: ", error);
        throw new SafeStorageError("Failed to encrypt refresh token.", {
          cause: error,
        });
      }
    } else {
      const encExisting = store.get(OAUTH_REFRESH_TOKEN_KEY);
      if (!encExisting || typeof encExisting !== "string") {
        throw new OAuthConfigError(
          "No refresh_token returned. Please try again."
        );
      }
    }

    if (tokens.id_token) {
      try {
        const payload = decodeJwtPayload(tokens.id_token);
        const user: OAuthUser = {
          email: payload?.email,
          name: payload?.name,
          picture: payload?.picture,
        };
        store.set(OAUTH_USER_INFO_KEY, user);
      } catch {
        store.delete(OAUTH_USER_INFO_KEY);
      }
    } else {
      store.delete(OAUTH_USER_INFO_KEY);
    }
  };

  handleInvoke("auth-start", async () => {
    const { clientId, oauthClientSecret } = ensurePreconditions();

    // PKCE
    const { code_verifier, code_challenge } = await pkceChallenge();

    // Abort previous attempt, create fresh controller
    if (authController) {
      authController.abort();
    }

    authController = new AbortController();
    const signal = authController.signal;

    // Loopback server + auth URL
    const { server, redirectUri } = await startLoopbackRedirectServer();
    const url = buildAuthUrl(clientId, redirectUri, code_challenge);
    await shell.openExternal(url);

    // Wait for code (abortable, with timeout)
    let code: string;
    try {
      code = await waitForAuthorizationCode(server, signal);
    } finally {
      try {
        server.close();
      } catch {}
    }

    // Exchange tokens and store
    console.info(
      `[auth] Token exchange will include client_secret: ${oauthClientSecret ? "yes" : "no"}`
    );
    const tokens = await exchangeAuthorizationCodeForTokens({
      clientId,
      authorizationCode: code,
      pkceCodeVerifier: code_verifier,
      redirectUri,
      clientSecret: oauthClientSecret,
    });
    storeTokensAndUser(tokens);

    authController = null;
  });

  handleInvoke("auth-cancel", async () => {
    authController?.abort();
    authController = null;
  });

  handleInvoke("auth-sign-out", async () => {
    store.delete(OAUTH_REFRESH_TOKEN_KEY);
    store.delete(OAUTH_USER_INFO_KEY);
  });

  handleInvoke("auth-status", async () => {
    try {
      const enc = store.get(OAUTH_REFRESH_TOKEN_KEY);
      if (!enc || typeof enc !== "string") {
        return { isAuthenticated: false, user: null as OAuthUser | null };
      }

      // Throws if corrupt.
      safeStorage.decryptString(Buffer.from(enc, "base64"));
      const user = store.get(OAUTH_USER_INFO_KEY) ?? null;
      return { isAuthenticated: true, user };
    } catch {
      return { isAuthenticated: false, user: null as OAuthUser | null };
    }
  });
}

function setupDriveIpc() {
  let driveSyncController: AbortController | null = null;
  let driveRestoreController: AbortController | null = null;

  const getDecryptedRefreshToken = (): string => {
    // TODO: Rather than repeating this stupid thing everywhere, just check on boot
    // and stop the application if encryption is not available.
    if (!safeStorage.isEncryptionAvailable()) {
      throw new CryptoError("Safe storage is not available on this system.");
    }

    const enc = store.get(OAUTH_REFRESH_TOKEN_KEY);
    if (!enc || typeof enc !== "string") {
      throw new NotAuthenticatedError("Not authenticated.");
    }

    try {
      return safeStorage.decryptString(Buffer.from(enc, "base64"));
    } catch (error) {
      console.error("[auth] Failed to decrypt refresh token: ", error);
      throw new SafeStorageError("Failed to decrypt refresh token.", {
        cause: error,
      });
    }
  };

  const getAccessToken = async (signal?: AbortSignal): Promise<string> => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;

    if (!clientId) {
      throw new OAuthConfigError("Missing GOOGLE_OAUTH_CLIENT_ID in .env");
    }

    const raw = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    // TODO: This could be a util function.
    const oauthClientSecret =
      typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
    const refreshToken = getDecryptedRefreshToken();

    const refreshed = await refreshAccessToken(
      clientId,
      refreshToken,
      oauthClientSecret,
      signal
    );

    const accessToken = refreshed.access_token;
    if (!accessToken) {
      throw new TokenRefreshFailedError("Failed to obtain access token.");
    }

    return accessToken;
  };

  handleInvoke(
    "drive-sync",
    async (args: {
      fileName: string;
      content: Uint8Array;
      contentType?: string;
    }) => {
      // Guard against user spamming actions.
      if (driveSyncController) {
        driveSyncController.abort();
      }

      driveSyncController = new AbortController();
      const signal = driveSyncController.signal;

      const accessToken = await getAccessToken(signal);
      const { fileName, content, contentType } = args;

      const existingId = await findAppDataFileIdByName(
        accessToken,
        fileName,
        signal
      );

      let createdNewFileId: string | null = null;
      let targetFileId: string;

      if (existingId) {
        targetFileId = existingId;
      } else {
        createdNewFileId = await createAppDataFile(
          accessToken,
          fileName,
          signal
        );
        targetFileId = createdNewFileId;
      }

      try {
        await updateAppDataFileContent(
          accessToken,
          targetFileId,
          content,
          contentType,
          signal
        );
      } catch (error) {
        if (createdNewFileId) {
          try {
            await deleteAppDataFile(accessToken, createdNewFileId, signal);
          } catch {}
        }
        throw error;
      } finally {
        driveSyncController = null;
      }
    }
  );

  handleInvoke("drive-restore", async (args: { fileName: string }) => {
    if (driveRestoreController) {
      driveRestoreController.abort();
    }

    driveRestoreController = new AbortController();
    const signal = driveRestoreController.signal;

    const accessToken = await getAccessToken(signal);
    const { fileName } = args;

    const fileId = await findAppDataFileIdByName(accessToken, fileName, signal);

    if (!fileId) {
      driveRestoreController = null;
      throw new NotFoundError("No backup found in Drive.");
    }

    const bytes = await downloadAppDataFileContent(accessToken, fileId, signal);

    driveRestoreController = null;
    return bytes;
  });

  handleInvoke("drive-cancel", async () => {
    if (driveSyncController) {
      driveSyncController.abort();
    }

    if (driveRestoreController) {
      driveRestoreController.abort();
    }

    driveSyncController = null;
    driveRestoreController = null;
  });
}

/** Canonical file names for .mp3 sounds per event. */
const SOUND_FILE_NAMES: Record<SoundEventId, string> = {
  progressIncrement: "ui_increment.mp3",
  progressDecrement: "ui_decrement.mp3",
  progressComplete: "ui_complete.mp3",
};

/** Ensure a directory exists, creating parents as needed. */
function ensureDirSync(dir: string): void {
  if (fs.existsSync(dir) === false) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Resolve the sounds folder under userData. */
function getSoundsDir(): string {
  return path.join(app.getPath("userData"), "sounds");
}

// Save a user-uploaded .mp3 sound under a canonical filename for the event.
handleInvoke(
  "sounds-save",
  async (eventId: SoundEventId, content: Uint8Array) => {
    const name = SOUND_FILE_NAMES[eventId];
    if (typeof name !== "string") {
      throw new UnknownMainProcessError("Invalid sound event id");
    }

    const dir = getSoundsDir();
    ensureDirSync(dir);

    const filePath = path.join(dir, name);

    try {
      const buffer = Buffer.from(content);
      fs.writeFileSync(filePath, buffer);
    } catch (error) {
      throw new UnknownMainProcessError(
        `Failed to save sound for ${String(eventId)}`
      );
    }
  }
);

// Listener to handle saving progress bar data.
// TODO: Group-up related handlers, as above.
handleInvoke("save-data", async (data: AppData) => {
  const filePath = path.join(app.getPath("userData"), "my-data.json");

  // If lastSynced is not provided by the renderer, preserve the existing value
  // from the current AppData on disk to avoid wiping it on ordinary saves.
  let lastSyncedToPersist: string | null = null;
  if (typeof data.lastSynced !== "undefined") {
    lastSyncedToPersist = data.lastSynced ?? null;
  } else {
    if (fs.existsSync(filePath)) {
      try {
        const existingJson = fs.readFileSync(filePath, "utf-8");
        const existingAppData = JSON.parse(existingJson) as AppData;
        if (
          existingAppData &&
          typeof existingAppData.lastSynced !== "undefined"
        ) {
          lastSyncedToPersist = existingAppData.lastSynced ?? null;
        }
      } catch (error) {
        // Ignore parse errors; fall back to null.
      }
    }
  }

  // If sounds is not provided, preserve existing sounds on disk.
  let soundsToPersist = data.sounds;
  if (typeof soundsToPersist === "undefined") {
    if (fs.existsSync(filePath)) {
      try {
        const existingJson = fs.readFileSync(filePath, "utf-8");
        const existingAppData = JSON.parse(existingJson) as AppData;
        if (existingAppData && typeof existingAppData.sounds !== "undefined") {
          soundsToPersist = existingAppData.sounds;
        }
      } catch (error) {
        // Ignore parse errors; fall back to undefined.
      }
    }
  }

  const dataToSave: AppData = {
    bars: Array.isArray(data.bars) ? data.bars : [],
    lastSynced: lastSyncedToPersist,
    sounds: soundsToPersist,
  };

  fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), "utf-8");
  return { success: true, path: filePath };
});

// Handle loading bar data from local storage on app start.
handleInvoke("load-data", async () => {
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

  return { bars: [], lastSynced: null, sounds: undefined } as AppData;
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
  setupAuthIpc();
  setupDriveIpc();
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
