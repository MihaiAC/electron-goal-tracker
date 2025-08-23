"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const shared_1 = require("./types/shared");
const electron_store_1 = __importDefault(require("electron-store"));
const pkce_challenge_1 = __importDefault(require("pkce-challenge"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./utils/auth");
const drive_1 = require("./utils/drive");
const main_process_errors_1 = require("./utils/main-process-errors");
dotenv_1.default.config();
// Global reference to window to prevent GC (?).
let mainWindow = null;
// Key for storing the encrypted password in electron-store.
const SYNC_PASSWORD_KEY = "syncPassword";
const OAUTH_REFRESH_TOKEN_KEY = "oauthRefreshToken";
const OAUTH_USER_INFO_KEY = "oauthUser";
// Initialise electron-store.
const store = new electron_store_1.default();
// Wrapper to serialize typed errors across IPC
function toIpcErrorWrapper(error) {
    if (error instanceof main_process_errors_1.MainProcessError) {
        return { code: error.code, message: error.message, status: error.status };
    }
    else if (error instanceof Error) {
        return { code: shared_1.ErrorCodes.Unknown, message: error.message };
    }
    else {
        return { code: shared_1.ErrorCodes.Unknown, message: String(error) };
    }
}
function handleInvoke(channel, handler) {
    electron_1.ipcMain.handle(channel, async (_event, ...args) => {
        try {
            const data = await handler(...args);
            return { ok: true, data };
        }
        catch (error) {
            return { ok: false, error: toIpcErrorWrapper(error) };
        }
    });
}
function setupPasswordIpc() {
    // Save the password securely.
    handleInvoke("save-password", async (password) => {
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new main_process_errors_1.CryptoError("Safe storage is not available on this system.");
        }
        try {
            const encryptedPassword = electron_1.safeStorage.encryptString(password);
            // Store the encrypted password as a base64 string.
            store.set(SYNC_PASSWORD_KEY, encryptedPassword.toString("base64"));
        }
        catch (error) {
            console.error("[password] Failed to encrypt password for storage: ", error);
            throw new main_process_errors_1.SafeStorageError("Failed to encrypt password for storage.", {
                cause: error,
            });
        }
    });
    handleInvoke("get-password", async () => {
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new main_process_errors_1.CryptoError("Safe storage is not available on this system.");
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
    handleInvoke("clear-password", async () => {
        store.delete(SYNC_PASSWORD_KEY);
    });
}
// TODO: Nicer screen for authentication success.
// TODO: Can the URL be cleaned up a little bit?
function setupAuthIpc() {
    // Local controller to cancel an in-flight OAuth attempt.
    let authController = null;
    const ensurePreconditions = () => {
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const oauthClientSecretRaw = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        const oauthClientSecret = typeof oauthClientSecretRaw === "string" &&
            oauthClientSecretRaw.trim().length > 0
            ? oauthClientSecretRaw.trim()
            : undefined;
        if (!clientId) {
            throw new main_process_errors_1.OAuthConfigError("Missing GOOGLE_OAUTH_CLIENT_ID in .env");
        }
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new main_process_errors_1.CryptoError("Safe storage is not available on this system.");
        }
        return { clientId, oauthClientSecret };
    };
    const storeTokensAndUser = (tokens) => {
        const refresh = tokens.refresh_token;
        if (refresh) {
            if (!electron_1.safeStorage.isEncryptionAvailable()) {
                throw new main_process_errors_1.CryptoError("Safe storage is not available on this system.");
            }
            try {
                const encrypted = electron_1.safeStorage.encryptString(refresh);
                store.set(OAUTH_REFRESH_TOKEN_KEY, encrypted.toString("base64"));
            }
            catch (error) {
                console.error("[auth] Failed to encrypt refresh token: ", error);
                throw new main_process_errors_1.SafeStorageError("Failed to encrypt refresh token.", {
                    cause: error,
                });
            }
        }
        else {
            const encExisting = store.get(OAUTH_REFRESH_TOKEN_KEY);
            if (!encExisting || typeof encExisting !== "string") {
                throw new main_process_errors_1.OAuthConfigError("No refresh_token returned. Please try again.");
            }
        }
        if (tokens.id_token) {
            try {
                const payload = (0, auth_1.decodeJwtPayload)(tokens.id_token);
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
    };
    handleInvoke("auth-start", async () => {
        const { clientId, oauthClientSecret } = ensurePreconditions();
        // PKCE
        const { code_verifier, code_challenge } = await (0, pkce_challenge_1.default)();
        // Abort previous attempt, create fresh controller
        if (authController) {
            authController.abort();
        }
        authController = new AbortController();
        const signal = authController.signal;
        // Loopback server + auth URL
        const { server, redirectUri } = await (0, auth_1.startLoopbackRedirectServer)();
        const url = (0, auth_1.buildAuthUrl)(clientId, redirectUri, code_challenge);
        await electron_1.shell.openExternal(url);
        // Wait for code (abortable, with timeout)
        let code;
        try {
            code = await (0, auth_1.waitForAuthorizationCode)(server, signal);
        }
        finally {
            try {
                server.close();
            }
            catch { }
        }
        // Exchange tokens and store
        console.info(`[auth] Token exchange will include client_secret: ${oauthClientSecret ? "yes" : "no"}`);
        const tokens = await (0, auth_1.exchangeAuthorizationCodeForTokens)({
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
                return { isAuthenticated: false, user: null };
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
function setupDriveIpc() {
    let driveSyncController = null;
    let driveRestoreController = null;
    const getDecryptedRefreshToken = () => {
        // TODO: Rather than repeating this stupid thing everywhere, just check on boot
        // and stop the application if encryption is not available.
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new main_process_errors_1.CryptoError("Safe storage is not available on this system.");
        }
        const enc = store.get(OAUTH_REFRESH_TOKEN_KEY);
        if (!enc || typeof enc !== "string") {
            throw new main_process_errors_1.NotAuthenticatedError("Not authenticated.");
        }
        try {
            return electron_1.safeStorage.decryptString(Buffer.from(enc, "base64"));
        }
        catch (error) {
            console.error("[auth] Failed to decrypt refresh token: ", error);
            throw new main_process_errors_1.SafeStorageError("Failed to decrypt refresh token.", {
                cause: error,
            });
        }
    };
    const getAccessToken = async (signal) => {
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        if (!clientId) {
            throw new main_process_errors_1.OAuthConfigError("Missing GOOGLE_OAUTH_CLIENT_ID in .env");
        }
        const raw = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        // TODO: This could be a util function.
        const oauthClientSecret = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
        const refreshToken = getDecryptedRefreshToken();
        const refreshed = await (0, auth_1.refreshAccessToken)(clientId, refreshToken, oauthClientSecret, signal);
        const accessToken = refreshed.access_token;
        if (!accessToken) {
            throw new main_process_errors_1.TokenRefreshFailedError("Failed to obtain access token.");
        }
        return accessToken;
    };
    handleInvoke("drive-sync", async (args) => {
        // Guard against user spamming actions.
        if (driveSyncController) {
            driveSyncController.abort();
        }
        driveSyncController = new AbortController();
        const signal = driveSyncController.signal;
        const accessToken = await getAccessToken(signal);
        const { fileName, content, contentType } = args;
        const existingId = await (0, drive_1.findAppDataFileIdByName)(accessToken, fileName, signal);
        let createdNewFileId = null;
        let targetFileId;
        if (existingId) {
            targetFileId = existingId;
        }
        else {
            createdNewFileId = await (0, drive_1.createAppDataFile)(accessToken, fileName, signal);
            targetFileId = createdNewFileId;
        }
        try {
            await (0, drive_1.updateAppDataFileContent)(accessToken, targetFileId, content, contentType, signal);
        }
        catch (error) {
            if (createdNewFileId) {
                try {
                    await (0, drive_1.deleteAppDataFile)(accessToken, createdNewFileId, signal);
                }
                catch { }
            }
            throw error;
        }
        finally {
            driveSyncController = null;
        }
    });
    handleInvoke("drive-restore", async (args) => {
        if (driveRestoreController) {
            driveRestoreController.abort();
        }
        driveRestoreController = new AbortController();
        const signal = driveRestoreController.signal;
        const accessToken = await getAccessToken(signal);
        const { fileName } = args;
        const fileId = await (0, drive_1.findAppDataFileIdByName)(accessToken, fileName, signal);
        if (!fileId) {
            driveRestoreController = null;
            throw new main_process_errors_1.NotFoundError("No backup found in Drive.");
        }
        const bytes = await (0, drive_1.downloadAppDataFileContent)(accessToken, fileId, signal);
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
// Listener to handle saving progress bar data.
// TODO: Group-up related handlers, as above.
handleInvoke("save-data", async (data) => {
    const filePath = path_1.default.join(electron_1.app.getPath("userData"), "my-data.json");
    // If lastSynced is not provided by the renderer, preserve the existing value
    // from the current AppData on disk to avoid wiping it on ordinary saves.
    let lastSyncedToPersist = null;
    if (typeof data.lastSynced !== "undefined") {
        lastSyncedToPersist = data.lastSynced ?? null;
    }
    else {
        if (fs_1.default.existsSync(filePath)) {
            try {
                const existingJson = fs_1.default.readFileSync(filePath, "utf-8");
                const existingAppData = JSON.parse(existingJson);
                if (existingAppData &&
                    typeof existingAppData.lastSynced !== "undefined") {
                    lastSyncedToPersist = existingAppData.lastSynced ?? null;
                }
            }
            catch (error) {
                // Ignore parse errors; fall back to null.
            }
        }
    }
    const dataToSave = {
        bars: Array.isArray(data.bars) ? data.bars : [],
        lastSynced: lastSyncedToPersist,
    };
    fs_1.default.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2), "utf-8");
    return { success: true, path: filePath };
});
// Handle loading bar data from local storage on app start.
handleInvoke("load-data", async () => {
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
    return { bars: [], lastSynced: null };
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
    setupDriveIpc();
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