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
const dropbox_1 = require("./utils/dropbox");
const main_process_errors_1 = require("./utils/main-process-errors");
// TODO: Will need to split this into multiple files, I can't tell what's going on anymore.
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
            // Log detailed main-process error info for diagnostics
            if (error instanceof main_process_errors_1.MainProcessError) {
                console.error(`[ipc:${channel}] main error`, {
                    code: error.code,
                    status: error.status,
                    message: error.message,
                });
            }
            else {
                console.error(`[ipc:${channel}] unknown error`, error);
            }
            return { ok: false, error: toIpcErrorWrapper(error) };
        }
    });
}
function setupPasswordIpc() {
    // Save the password securely.
    handleInvoke("save-password", async (password) => {
        console.info("[password] save-password invoked");
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new main_process_errors_1.CryptoError("Safe storage is not available on this system.");
        }
        try {
            const encryptedPassword = electron_1.safeStorage.encryptString(password);
            // Store the encrypted password as a base64 string.
            store.set(SYNC_PASSWORD_KEY, encryptedPassword.toString("base64"));
            console.info("[password] password saved (encrypted)");
        }
        catch (error) {
            console.error("[password] Failed to encrypt password for storage: ", error);
            throw new main_process_errors_1.SafeStorageError("Failed to encrypt password for storage.", {
                cause: error,
            });
        }
    });
    handleInvoke("get-password", async () => {
        console.info("[password] get-password invoked");
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new main_process_errors_1.CryptoError("Safe storage is not available on this system.");
        }
        try {
            const encryptedPasswordBase64 = store.get(SYNC_PASSWORD_KEY);
            if (!encryptedPasswordBase64 ||
                typeof encryptedPasswordBase64 !== "string") {
                console.info("[password] no password stored");
                return null;
            }
            const encryptedPassword = Buffer.from(encryptedPasswordBase64, "base64");
            const decrypted = electron_1.safeStorage.decryptString(encryptedPassword);
            console.info("[password] password retrieved (decrypted in-memory)");
            return decrypted;
        }
        catch (error) {
            console.error("Failed to get password, clearing potentially corrupt entry.", error);
            store.delete(SYNC_PASSWORD_KEY);
            return null;
        }
    });
    handleInvoke("clear-password", async () => {
        console.info("[password] clear-password invoked");
        store.delete(SYNC_PASSWORD_KEY);
    });
}
// TODO: Nicer screen for authentication success.
// TODO: Can the URL be cleaned up a little bit?
function setupAuthIpc() {
    // Local controller to cancel an in-flight OAuth attempt.
    let authController = null;
    const ensurePreconditions = () => {
        const appKey = process.env.DROPBOX_APP_KEY;
        if (!appKey) {
            throw new main_process_errors_1.OAuthConfigError("Missing DROPBOX_APP_KEY in .env");
        }
        if (!electron_1.safeStorage.isEncryptionAvailable()) {
            throw new main_process_errors_1.CryptoError("Safe storage is not available on this system.");
        }
        console.info("[auth] Preconditions OK (env and safeStorage)");
        return { appKey };
    };
    const storeTokensAndUser = async (tokens) => {
        const refresh = tokens.refresh_token;
        if (refresh) {
            if (!electron_1.safeStorage.isEncryptionAvailable()) {
                throw new main_process_errors_1.CryptoError("Safe storage is not available on this system.");
            }
            try {
                const encrypted = electron_1.safeStorage.encryptString(refresh);
                store.set(OAUTH_REFRESH_TOKEN_KEY, encrypted.toString("base64"));
                console.info("[auth] refresh token stored (encrypted)");
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
        if (tokens.access_token) {
            try {
                const user = await (0, auth_1.getDropboxUserInfo)(tokens.access_token);
                store.set(OAUTH_USER_INFO_KEY, user);
                console.info("[auth] user info fetched and stored", {
                    hasEmail: Boolean(user?.email),
                    hasName: Boolean(user?.name),
                });
            }
            catch {
                console.warn("[auth] failed to fetch user info; clearing stored user");
                store.delete(OAUTH_USER_INFO_KEY);
            }
        }
        else {
            store.delete(OAUTH_USER_INFO_KEY);
        }
    };
    handleInvoke("auth-start", async () => {
        console.info("[auth] Starting Dropbox OAuth flow");
        const { appKey } = ensurePreconditions();
        // PKCE
        const { code_verifier, code_challenge } = await (0, pkce_challenge_1.default)();
        console.info("[auth] PKCE challenge generated");
        // Abort previous attempt, create fresh controller
        if (authController) {
            console.info("[auth] Aborting previous OAuth attempt");
            authController.abort();
        }
        authController = new AbortController();
        const signal = authController.signal;
        // Loopback server + auth URL
        const { server, redirectUri } = await (0, auth_1.startLoopbackRedirectServer)();
        console.info("[auth] Loopback server started", { redirectUri });
        const url = (0, auth_1.buildAuthUrl)(appKey, redirectUri, code_challenge);
        console.info("[auth] Opening external auth URL");
        await electron_1.shell.openExternal(url);
        // Wait for code (abortable, with timeout)
        let code;
        try {
            console.info("[auth] Waiting for authorization code...");
            code = await (0, auth_1.waitForAuthorizationCode)(server, signal);
            console.info("[auth] Authorization code received (not logging value)");
        }
        finally {
            try {
                server.close();
                console.info("[auth] Loopback server closed");
            }
            catch { }
        }
        // Exchange tokens and store
        console.info("[auth] Exchanging code for tokens...");
        const tokens = await (0, auth_1.exchangeAuthorizationCodeForTokens)({
            appKey,
            authorizationCode: code,
            pkceCodeVerifier: code_verifier,
            redirectUri,
        });
        console.info("[auth] Token exchange successful (not logging tokens)");
        await storeTokensAndUser(tokens);
        authController = null;
        console.info("[auth] OAuth flow completed successfully");
    });
    handleInvoke("auth-cancel", async () => {
        console.info("[auth] OAuth cancel requested");
        authController?.abort();
        authController = null;
    });
    handleInvoke("auth-sign-out", async () => {
        console.info("[auth] Signing out and clearing stored tokens/user");
        store.delete(OAUTH_REFRESH_TOKEN_KEY);
        store.delete(OAUTH_USER_INFO_KEY);
    });
    handleInvoke("auth-status", async () => {
        try {
            const enc = store.get(OAUTH_REFRESH_TOKEN_KEY);
            if (!enc || typeof enc !== "string") {
                console.info("[auth] auth-status: not authenticated (no token)");
                return { isAuthenticated: false, user: null };
            }
            // Throws if corrupt.
            electron_1.safeStorage.decryptString(Buffer.from(enc, "base64"));
            const user = store.get(OAUTH_USER_INFO_KEY) ?? null;
            console.info("[auth] auth-status: authenticated", {
                hasUser: Boolean(user),
            });
            return { isAuthenticated: true, user };
        }
        catch {
            console.info("[auth] auth-status: not authenticated (decrypt failed)");
            return { isAuthenticated: false, user: null };
        }
    });
}
function setupDropboxIpc() {
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
        const appKey = process.env.DROPBOX_APP_KEY;
        if (!appKey) {
            throw new main_process_errors_1.OAuthConfigError("Missing DROPBOX_APP_KEY in .env");
        }
        console.info("[cloud] Refreshing access token...");
        const refreshToken = getDecryptedRefreshToken();
        const refreshed = await (0, auth_1.refreshAccessToken)(appKey, refreshToken, signal);
        const accessToken = refreshed.access_token;
        if (!accessToken) {
            throw new main_process_errors_1.TokenRefreshFailedError("Failed to obtain access token.");
        }
        console.info("[cloud] Access token obtained (not logging token)");
        return accessToken;
    };
    handleInvoke("drive-sync", async (args) => {
        // Guard against user spamming actions.
        if (driveSyncController) {
            console.info("[cloud] Aborting previous sync operation");
            driveSyncController.abort();
        }
        driveSyncController = new AbortController();
        const signal = driveSyncController.signal;
        const accessToken = await getAccessToken(signal);
        const { fileName, content } = args;
        console.info("[cloud] Sync starting", {
            fileName,
            bytes: content?.length ?? 0,
        });
        try {
            await (0, dropbox_1.uploadDropboxFile)(accessToken, fileName, content, signal);
            console.info("[cloud] Sync success", { fileName });
        }
        catch (error) {
            console.error("[cloud] Sync failed", { fileName, error });
            throw error;
        }
        finally {
            driveSyncController = null;
        }
    });
    handleInvoke("drive-restore", async (args) => {
        if (driveRestoreController) {
            console.info("[cloud] Aborting previous restore operation");
            driveRestoreController.abort();
        }
        driveRestoreController = new AbortController();
        const signal = driveRestoreController.signal;
        const accessToken = await getAccessToken(signal);
        const { fileName } = args;
        console.info("[cloud] Restore starting", { fileName });
        const fileExists = await (0, dropbox_1.dropboxFileExists)(accessToken, fileName, signal);
        console.info("[cloud] Restore existence check", { fileName, fileExists });
        if (!fileExists) {
            driveRestoreController = null;
            console.warn("[cloud] Restore file not found", { fileName });
            throw new main_process_errors_1.NotFoundError("No backup found in Dropbox.");
        }
        const bytes = await (0, dropbox_1.downloadDropboxFile)(accessToken, fileName, signal);
        console.info("[cloud] Restore success", { fileName, bytes: bytes.length });
        driveRestoreController = null;
        return bytes;
    });
    handleInvoke("drive-cancel", async () => {
        console.info("[cloud] Cancel requested for sync/restore");
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
const SOUND_FILE_NAMES = {
    progressIncrement: "ui_increment.mp3",
    progressDecrement: "ui_decrement.mp3",
    progressComplete: "ui_complete.mp3",
};
/** Ensure a directory exists, creating parents as needed. */
function ensureDirSync(dir) {
    if (fs_1.default.existsSync(dir) === false) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
/** Resolve the sounds folder under userData. */
function getSoundsDir() {
    return path_1.default.join(electron_1.app.getPath("userData"), "sounds");
}
// Save a user-uploaded .mp3 sound under a canonical filename for the event.
handleInvoke("sounds-save", async (eventId, content) => {
    const name = SOUND_FILE_NAMES[eventId];
    if (typeof name !== "string") {
        throw new main_process_errors_1.UnknownMainProcessError("Invalid sound event id");
    }
    const dir = getSoundsDir();
    ensureDirSync(dir);
    const filePath = path_1.default.join(dir, name);
    try {
        const buffer = Buffer.from(content);
        fs_1.default.writeFileSync(filePath, buffer);
        console.info("[local] sound saved", {
            eventId,
            filePath,
            bytes: buffer.length,
        });
    }
    catch (error) {
        console.error("[local] failed to save sound", {
            eventId,
            filePath,
            error,
        });
        throw new main_process_errors_1.UnknownMainProcessError(`Failed to save sound for ${String(eventId)}`);
    }
});
// Read the saved .mp3 bytes for a given event, or null if not found.
handleInvoke("sounds-read", async (eventId) => {
    const name = SOUND_FILE_NAMES[eventId];
    if (typeof name !== "string") {
        throw new main_process_errors_1.UnknownMainProcessError("Invalid sound event id");
    }
    const dir = getSoundsDir();
    const filePath = path_1.default.join(dir, name);
    try {
        if (fs_1.default.existsSync(filePath) === false) {
            console.info("[local] sound not found", { eventId, filePath });
            return null;
        }
        const buffer = fs_1.default.readFileSync(filePath);
        console.info("[local] sound read", {
            eventId,
            filePath,
            bytes: buffer.length,
        });
        return new Uint8Array(buffer);
    }
    catch (error) {
        console.error("[local] failed to read sound", {
            eventId,
            filePath,
            error,
        });
        return null;
    }
});
// Listener to handle saving progress bar data.
// TODO: Group-up related handlers, as above.
handleInvoke("save-data", async (data) => {
    const filePath = path_1.default.join(electron_1.app.getPath("userData"), "my-data.json");
    console.info("[local] save-data invoked", {
        path: filePath,
        bars: Array.isArray(data?.bars) ? data.bars.length : 0,
        hasSounds: typeof data?.sounds !== "undefined",
        hasTheme: typeof data?.theme !== "undefined",
        hasLastSynced: typeof data?.lastSynced !== "undefined",
    });
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
    // If sounds is not provided, preserve existing sounds on disk.
    let soundsToPersist = data.sounds;
    if (typeof soundsToPersist === "undefined") {
        if (fs_1.default.existsSync(filePath)) {
            try {
                const existingJson = fs_1.default.readFileSync(filePath, "utf-8");
                const existingAppData = JSON.parse(existingJson);
                if (existingAppData && typeof existingAppData.sounds !== "undefined") {
                    soundsToPersist = existingAppData.sounds;
                }
            }
            catch (error) {
                // Ignore parse errors; fall back to undefined.
            }
        }
    }
    // If theme is not provided, preserve existing theme on disk.
    let themeToPersist = data.theme;
    if (typeof themeToPersist === "undefined") {
        if (fs_1.default.existsSync(filePath)) {
            try {
                const existingJson = fs_1.default.readFileSync(filePath, "utf-8");
                const existingAppData = JSON.parse(existingJson);
                if (existingAppData && typeof existingAppData.theme !== "undefined") {
                    themeToPersist = existingAppData.theme;
                }
            }
            catch {
                // Ignore parse errors; fall back to undefined.
            }
        }
    }
    const dataToSave = {
        bars: Array.isArray(data.bars) ? data.bars : [],
        lastSynced: lastSyncedToPersist,
        sounds: soundsToPersist,
        theme: themeToPersist,
    };
    atomicWriteJson(filePath, dataToSave);
    console.info("[local] save-data success", {
        path: filePath,
        bytes: Buffer.byteLength(JSON.stringify(dataToSave)),
        bars: dataToSave.bars.length,
        hasSounds: typeof dataToSave.sounds !== "undefined",
        hasTheme: typeof dataToSave.theme !== "undefined",
        lastSynced: dataToSave.lastSynced,
    });
    return { success: true, path: filePath };
});
// Save a partial subset of AppData, preserving unspecified fields on disk.
handleInvoke("save-partial-data", async (partial) => {
    const filePath = path_1.default.join(electron_1.app.getPath("userData"), "my-data.json");
    console.info("[local] save-partial-data invoked", {
        path: filePath,
        hasBars: typeof partial?.bars !== "undefined",
        hasLastSynced: typeof partial?.lastSynced !== "undefined",
        hasSounds: typeof partial?.sounds !== "undefined",
        hasTheme: typeof partial?.theme !== "undefined",
    });
    let existing = {
        bars: [],
        lastSynced: null,
        sounds: undefined,
        theme: undefined,
    };
    if (fs_1.default.existsSync(filePath)) {
        try {
            const raw = fs_1.default.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                existing = parsed;
            }
        }
        catch {
            // Ignore parse errors; fall back to defaults
        }
    }
    const merged = {
        bars: typeof partial.bars !== "undefined"
            ? partial.bars
            : Array.isArray(existing.bars)
                ? existing.bars
                : [],
        lastSynced: typeof partial.lastSynced !== "undefined"
            ? (partial.lastSynced ?? null)
            : typeof existing.lastSynced !== "undefined"
                ? (existing.lastSynced ?? null)
                : null,
        sounds: typeof partial.sounds !== "undefined" ? partial.sounds : existing.sounds,
        theme: typeof partial.theme !== "undefined" ? partial.theme : existing.theme,
    };
    atomicWriteJson(filePath, merged);
    console.info("[local] save-partial-data success", {
        path: filePath,
        bytes: Buffer.byteLength(JSON.stringify(merged)),
        bars: merged.bars.length,
        hasSounds: typeof merged.sounds !== "undefined",
        hasTheme: typeof merged.theme !== "undefined",
        lastSynced: merged.lastSynced,
    });
    return { success: true, path: filePath };
});
// Handle loading bar data from local storage on app start.
handleInvoke("load-data", async () => {
    const filePath = path_1.default.join(electron_1.app.getPath("userData"), "my-data.json");
    try {
        if (fs_1.default.existsSync(filePath)) {
            const data = fs_1.default.readFileSync(filePath, "utf-8");
            const parsed = JSON.parse(data);
            console.info("[local] load-data success", {
                path: filePath,
                bytes: Buffer.byteLength(data),
                bars: Array.isArray(parsed?.bars) ? parsed.bars.length : 0,
                hasSounds: typeof parsed?.sounds !== "undefined",
                hasTheme: typeof parsed?.theme !== "undefined",
                lastSynced: parsed?.lastSynced ?? null,
            });
            return parsed;
        }
        else {
            console.info("[local] load-data: no file on disk", { path: filePath });
        }
    }
    catch (error) {
        console.error("Error loading data: ", error);
    }
    return {
        bars: [],
        lastSynced: null,
        sounds: undefined,
        theme: undefined,
    };
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
    setupDropboxIpc();
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
/** Atomically write pretty-printed JSON to a file by writing to a temporary file and renaming. */
function atomicWriteJson(filePath, payload) {
    const directoryPath = path_1.default.dirname(filePath);
    const baseName = path_1.default.basename(filePath);
    const tempPath = path_1.default.join(directoryPath, `${baseName}.tmp`);
    const jsonText = JSON.stringify(payload, null, 2);
    try {
        fs_1.default.writeFileSync(tempPath, jsonText, "utf-8");
        fs_1.default.renameSync(tempPath, filePath);
    }
    catch (error) {
        try {
            if (fs_1.default.existsSync(tempPath) === true) {
                fs_1.default.rmSync(tempPath, { force: true });
            }
        }
        catch {
            // Ignore cleanup errors
        }
        throw new main_process_errors_1.FilesystemError("Failed to write application data to disk.", {
            cause: error,
        });
    }
}
//# sourceMappingURL=main.js.map