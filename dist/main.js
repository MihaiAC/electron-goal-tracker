"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_store_1 = __importDefault(require("electron-store"));
const pkce_challenge_1 = __importDefault(require("pkce-challenge"));
const http_1 = require("http");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Global reference to window to prevent GC (?).
let mainWindow = null;
// Key for storing the encrypted password in electron-store.
const SYNC_PASSWORD_KEY = "syncPassword";
const OAUTH_REFRESH_TOKEN_KEY = "oauthRefreshToken";
const OAUTH_USER_INFO_KEY = "oauthUser";
// Initialise electron-store.
const store = new electron_store_1.default();
function decodeJwtPayload(idToken) {
    const parts = idToken.split(".");
    if (parts.length !== 3) {
        return null;
    }
    const payload = Buffer.from(parts[1], "base64").toString("utf8");
    return JSON.parse(payload);
}
function setupPasswordIpc() {
    // Save the password securely.
    electron_1.ipcMain.handle("save-password", (_, password) => {
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new Error("Safe storage is not available on this system.");
        }
        try {
            const encryptedPassword = electron_1.safeStorage.encryptString(password);
            // Store the encrypted password as a base64 string.
            store.set(SYNC_PASSWORD_KEY, encryptedPassword.toString("base64"));
        }
        catch (error) {
            console.error("Failed to save error: ", error);
            throw error;
        }
    });
    electron_1.ipcMain.handle("get-password", () => {
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new Error("Safe storage is not available on this system.");
        }
        try {
            const encryptedPasswordBase64 = store.get(SYNC_PASSWORD_KEY);
            if (!encryptedPasswordBase64 ||
                typeof encryptedPasswordBase64 !== "string") {
                return null;
            }
            const encryptedPassword = Buffer.from(encryptedPasswordBase64, "base64");
            return electron_1.safeStorage.decryptString(encryptedPassword);
        }
        catch (error) {
            console.error("Failed to get password, clearing potentially corrupt entry.", error);
            store.delete(SYNC_PASSWORD_KEY);
            return null;
        }
    });
    electron_1.ipcMain.handle("clear-password", () => {
        store.delete(SYNC_PASSWORD_KEY);
    });
}
function setupAuthIpc() {
    // TODO: This is pretty hard to follow, break it down into multiple functions.
    electron_1.ipcMain.handle("auth-start", async () => {
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        if (!clientId) {
            throw new Error("Missing GOOGLE_AUTH_CLIENT_ID in .env");
        }
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new Error("Safe storage is not available on this system.");
        }
        // Create PKCE verifier/challenge.
        const { code_verifier, code_challenge } = await (0, pkce_challenge_1.default)();
        // Start loopback server for redirect capture.
        const server = (0, http_1.createServer)();
        const codePromise = new Promise((resolve, reject) => {
            // Close the server on timeout.
            const timeout = setTimeout(() => {
                try {
                    server.close();
                }
                catch { }
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
                    res.end("<html><body><p>Authentication complete. You can close this window.</p><script>window.close();</script></body></html>");
                    clearTimeout(timeout);
                    try {
                        server.close();
                    }
                    catch { }
                    if (err) {
                        return reject(new Error(String(err)));
                    }
                    if (!code) {
                        return reject(new Error("Missing authorization code"));
                    }
                    resolve(code);
                }
                catch (e) {
                    clearTimeout(timeout);
                    try {
                        server.close();
                    }
                    catch { }
                    reject(e);
                }
            });
        });
        await new Promise((resolve) => {
            server.listen(0, "127.0.0.1", () => resolve());
        });
        const address = server.address();
        const redirectUri = `http://127.0.0.1:${address.port}/callback`;
        // Launch consent URL in system browser
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/drive.appdata");
        authUrl.searchParams.set("include_granted_scopes", "true");
        authUrl.searchParams.set("prompt", "consent");
        authUrl.searchParams.set("code_challenge", code_challenge);
        authUrl.searchParams.set("code_challenge_method", "S256");
        await electron_1.shell.openExternal(authUrl.toString());
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
        const tokens = (await tokenResp.json());
        const refresh = tokens.refresh_token;
        if (refresh) {
            const encrypted = electron_1.safeStorage.encryptString(refresh);
            store.set(OAUTH_REFRESH_TOKEN_KEY, encrypted.toString("base64"));
        }
        else {
            const encExisting = store.get(OAUTH_REFRESH_TOKEN_KEY);
            if (!encExisting || typeof encExisting !== "string") {
                throw new Error("No refresh_token returned. Please try again.");
            }
        }
        // Decode and store minimal user info.
        if (tokens.id_token) {
            try {
                const payload = decodeJwtPayload(tokens.id_token);
                const user = {
                    email: payload?.email,
                    name: payload?.name,
                    picture: payload?.picture,
                };
                store.set(OAUTH_USER_INFO_KEY, user);
            }
            catch {
                store.delete(OAUTH_USER_INFO_KEY);
            }
        }
        else {
            store.delete(OAUTH_USER_INFO_KEY);
        }
    });
    electron_1.ipcMain.handle("auth-sign-out", () => {
        store.delete(OAUTH_REFRESH_TOKEN_KEY);
        store.delete(OAUTH_USER_INFO_KEY);
    });
    electron_1.ipcMain.handle("auth-status", () => {
        try {
            const enc = store.get(OAUTH_REFRESH_TOKEN_KEY);
            if (!enc || typeof enc !== "string") {
                return {
                    isAuthenticated: false,
                    user: null,
                };
            }
            // Throws if corrupt.
            electron_1.safeStorage.decryptString(Buffer.from(enc, "base64"));
            const user = store.get(OAUTH_USER_INFO_KEY) ?? null;
            return { isAuthenticated: true, user };
        }
        catch {
            return { isAuthenticated: false, user: null };
        }
    });
}
// Listener to handle saving progress bar data.
// TODO: Group-up related handlers, as above.
electron_1.ipcMain.handle("save-data", async (_event, data) => {
    const filePath = path_1.default.join(electron_1.app.getPath("userData"), "my-data.json");
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    return { success: true, path: filePath };
});
// Handle loading bar data from local storage on app start.
electron_1.ipcMain.handle("load-data", async () => {
    const filePath = path_1.default.join(electron_1.app.getPath("userData"), "my-data.json");
    try {
        if (fs_1.default.existsSync(filePath)) {
            const data = fs_1.default.readFileSync(filePath, "utf-8");
            return JSON.parse(data);
        }
        else {
        }
    }
    catch (error) {
        // TODO: need proper logging.
        console.error("Error loading data: ", error);
    }
    return { bars: [] };
});
// Handle window controls.
electron_1.ipcMain.on("minimize-app", () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});
electron_1.ipcMain.on("maximize-app", () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow.maximize();
        }
    }
});
electron_1.ipcMain.on("close-app", () => {
    if (mainWindow) {
        mainWindow.close();
    }
});
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1000,
        height: 800,
        show: false,
        frame: false,
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
        },
    });
    // Load the app.
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, "../frontend/dist/index.html"));
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
electron_1.app.whenReady().then(() => {
    setupPasswordIpc();
    setupAuthIpc();
    createWindow();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", () => {
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
//# sourceMappingURL=main.js.map