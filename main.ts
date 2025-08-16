import { app, BrowserWindow, ipcMain, safeStorage, shell } from "electron";
import path from "path";
import fs from "fs";
import { AppData, OAuthUser } from "./types/shared";
import Store from "electron-store";
import pkceChallenge from "pkce-challenge";
import { createServer } from "http";
import { AddressInfo } from "net";
import dotenv from "dotenv";

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

function decodeJwtPayload(idToken: string): any {
  const parts = idToken.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const payload = Buffer.from(parts[1], "base64").toString("utf8");
  return JSON.parse(payload);
}

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

function setupAuthIpc() {
  // TODO: This is pretty hard to follow, break it down into multiple functions.
  ipcMain.handle("auth-start", async () => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;

    if (!clientId) {
      throw new Error("Missing GOOGLE_AUTH_CLIENT_ID in .env");
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Safe storage is not available on this system.");
    }

    // Create PKCE verifier/challenge.
    const { code_verifier, code_challenge } = await pkceChallenge();

    // Start loopback server for redirect capture.
    const server = createServer();
    const codePromise: Promise<string> = new Promise((resolve, reject) => {
      // Close the server on timeout.
      const timeout = setTimeout(() => {
        try {
          server.close();
        } catch {}
        reject(new Error("OAuth timed out."));
      }, 120_000);

      server.on("request", (req, res) => {
        try {
          if (!req.url) {
            return;
          }

          const url = new URL(req.url, "http://127.0.0.1");
          if (url.pathname !== "/callback") {
            return;
          }

          const code = url.searchParams.get("code");
          const err = url.searchParams.get("error");

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><p>Authentication complete. You can close this window.</p><script>window.close();</script></body></html>"
          );

          clearTimeout(timeout);
          try {
            server.close();
          } catch {}

          if (err) {
            return reject(new Error(String(err)));
          }

          if (!code) {
            return reject(new Error("Missing authorization code"));
          }

          resolve(code);
        } catch (e) {
          clearTimeout(timeout);
          try {
            server.close();
          } catch {}
          reject(e);
        }
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });

    const address = server.address() as AddressInfo;
    const redirectUri = `http://127.0.0.1:${address.port}/callback`;

    // Launch consent URL in system browser
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set(
      "scope",
      "https://www.googleapis.com/auth/drive.appdata"
    );
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("code_challenge", code_challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    await shell.openExternal(authUrl.toString());

    // Wait for code and exchange for tokens
    const code = await codePromise;

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: code_verifier,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      throw new Error(`Token exchange failed: ${tokenResp.status} ${text}`);
    }

    const tokens = (await tokenResp.json()) as {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
    };

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

    // Decode and store minimal user info.
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
  });

  ipcMain.handle("auth-sign-out", () => {
    store.delete(OAUTH_REFRESH_TOKEN_KEY);
    store.delete(OAUTH_USER_INFO_KEY);
  });

  ipcMain.handle("auth-status", () => {
    try {
      const enc = store.get(OAUTH_REFRESH_TOKEN_KEY);
      if (!enc || typeof enc !== "string") {
        return {
          isAuthenticated: false,
          user: null as OAuthUser | null,
        };
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
