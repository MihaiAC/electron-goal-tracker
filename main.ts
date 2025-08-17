import { app, BrowserWindow, ipcMain, safeStorage, shell } from "electron";
import path from "path";
import fs from "fs";
import { AppData, OAuthUser } from "./types/shared";
import Store from "electron-store";
import pkceChallenge from "pkce-challenge";
import dotenv from "dotenv";
import {
  startLoopbackRedirectServer,
  waitForAuthorizationCode,
  buildAuthUrl,
  exchangeAuthorizationCodeForTokens,
  decodeJwtPayload,
} from "./auth-helpers";

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
      throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID in .env");
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Safe storage is not available on this system.");
    }
    return { clientId, oauthClientSecret };
  };

  const storeTokensAndUser = (tokens: {
    refresh_token?: string;
    id_token?: string;
  }) => {
    const refresh = tokens.refresh_token;
    if (refresh) {
      const encrypted = safeStorage.encryptString(refresh);
      store.set(OAUTH_REFRESH_TOKEN_KEY, encrypted.toString("base64"));
    } else {
      const encExisting = store.get(OAUTH_REFRESH_TOKEN_KEY);
      if (!encExisting || typeof encExisting !== "string") {
        throw new Error("No refresh_token returned. Please try again.");
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

  ipcMain.handle("auth-start", async () => {
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

  ipcMain.handle("auth-cancel", () => {
    authController?.abort();
    authController = null;
  });

  ipcMain.handle("auth-sign-out", () => {
    store.delete(OAUTH_REFRESH_TOKEN_KEY);
    store.delete(OAUTH_USER_INFO_KEY);
  });

  ipcMain.handle("auth-status", () => {
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
  setupAuthIpc();
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
