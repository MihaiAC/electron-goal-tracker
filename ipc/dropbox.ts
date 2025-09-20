import { safeStorage, ipcMain } from "electron";
import Store from "electron-store";
import { handleInvoke } from "./ipc-helpers";
import { refreshAccessToken } from "../utils/auth";
import {
  dropboxFileExists,
  uploadDropboxFile,
  downloadDropboxFile,
  resolveDropboxAppKey,
} from "../utils/dropbox";
import {
  CryptoError,
  NotAuthenticatedError,
  OAuthConfigError,
  TokenRefreshFailedError,
  NotFoundError,
  SafeStorageError,
} from "../utils/main-process-errors";

/**
 * Dropbox Cloud Sync IPC Handlers
 *
 * This module handles cloud synchronization operations with Dropbox.
 * It manages file uploads, downloads, and existence checks using the Dropbox API.
 *
 * Handlers:
 * - drive-sync: Uploads a file to Dropbox (maintains legacy naming for UI compatibility)
 * - drive-restore: Downloads a file from Dropbox
 * - drive-cancel: Cancels ongoing sync/restore operations
 * - auto-sync-on-close: Performs a sync operation before app close
 */

// Keys for OAuth token storage
const OAUTH_REFRESH_TOKEN_KEY = "oauthRefreshToken" as const;

interface DropboxStoreSchema {
  [OAUTH_REFRESH_TOKEN_KEY]?: string;
}

// Initialize electron-store for token access
const dropboxStore = new Store<DropboxStoreSchema>();

// Controllers for managing concurrent operations
let driveSyncController: AbortController | null = null;
let driveRestoreController: AbortController | null = null;
let autoSyncController: AbortController | null = null;

// Token cache to avoid unnecessary refreshes
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}
let tokenCache: TokenCache | null = null;

// Token expiry buffer (5 minutes in milliseconds)
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000;

// Conservative default token expiration time in seconds (1 hour)
// This is used only if the API doesn't return an expires_in value
const CONSERVATIVE_TOKEN_EXPIRY = 60 * 60; // 1 hour in seconds

/**
 * Retrieves and decrypts the stored refresh token.
 * Throws appropriate errors if token is missing or decryption fails.
 */
function getDecryptedRefreshToken(): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new CryptoError("Safe storage is not available on this system.");
  }

  const encryptedRefreshToken = dropboxStore.get(OAUTH_REFRESH_TOKEN_KEY);
  if (!encryptedRefreshToken || typeof encryptedRefreshToken !== "string") {
    throw new NotAuthenticatedError("Not authenticated.");
  }

  try {
    return safeStorage.decryptString(
      Buffer.from(encryptedRefreshToken, "base64")
    );
  } catch (error) {
    console.error("[auth] Failed to decrypt refresh token: ", error);
    throw new SafeStorageError("Failed to decrypt refresh token.", {
      cause: error,
    });
  }
}

/**
 * Obtains an access token, using a cached token if available and not expired.
 * Only refreshes the token when necessary.
 */
async function getAccessToken(signal?: AbortSignal): Promise<string> {
  // Check if we have a valid cached token
  const now = Date.now();
  if (
    tokenCache &&
    tokenCache.accessToken &&
    tokenCache.expiresAt > now + TOKEN_EXPIRY_BUFFER
  ) {
    console.info("[cloud] Using cached access token");
    return tokenCache.accessToken;
  }

  // No valid cached token, need to refresh
  const resolvedDropboxAppKey = resolveDropboxAppKey();

  console.info("[cloud] Refreshing access token...");
  const refreshToken = getDecryptedRefreshToken();

  const refreshedTokens = await refreshAccessToken(
    resolvedDropboxAppKey,
    refreshToken,
    signal
  );

  const accessToken = refreshedTokens.access_token;
  if (!accessToken) {
    throw new TokenRefreshFailedError("Failed to obtain access token.");
  }

  // Get the expiration time from the response, or use a conservative default
  // According to Dropbox docs, expires_in is returned but not guaranteed
  const tokenResponse = refreshedTokens as any;
  let expiresInSeconds = CONSERVATIVE_TOKEN_EXPIRY;

  if (
    typeof tokenResponse.expires_in === "number" &&
    tokenResponse.expires_in > 0
  ) {
    // If API provided a valid expiration time, use it
    // But cap it at our conservative default to be safe
    expiresInSeconds = Math.min(
      tokenResponse.expires_in,
      CONSERVATIVE_TOKEN_EXPIRY
    );
    console.info(
      `[cloud] Token expires in ${expiresInSeconds} seconds (from API)`
    );
  } else {
    console.info(
      `[cloud] No expiration provided by API, using conservative default of ${expiresInSeconds} seconds`
    );
  }

  tokenCache = {
    accessToken,
    expiresAt: now + expiresInSeconds * 1000,
  };

  console.info("[cloud] Access token obtained and cached (not logging token)");
  return accessToken;
}

/**
 * Sets up all Dropbox cloud sync IPC handlers.
 * Call this function during app initialization to register the handlers.
 */
export function setupDropboxIpc() {
  // Listen for sign-out events to clear the token cache
  ipcMain.on("auth-sign-out", () => {
    console.info("[cloud] Sign-out detected, clearing token cache");
    tokenCache = null;
    dropboxStore.delete(OAUTH_REFRESH_TOKEN_KEY);
  });

  // Upload a file to Dropbox (sync operation)
  handleInvoke(
    "drive-sync",
    async (syncParameters: {
      fileName: string;
      content: Uint8Array;
      contentType?: string;
    }) => {
      // Guard against user spamming sync actions
      if (driveSyncController) {
        console.info("[cloud] Aborting previous sync operation");
        driveSyncController.abort();
      }

      driveSyncController = new AbortController();
      const signal = driveSyncController.signal;

      const accessToken = await getAccessToken(signal);
      const { fileName, content } = syncParameters;

      console.info("[cloud] Sync starting", {
        fileName,
        bytes: content?.length ?? 0,
      });

      try {
        await uploadDropboxFile(accessToken, fileName, content, signal);
        console.info("[cloud] Sync success", { fileName });
      } catch (error) {
        console.error("[cloud] Sync failed", { fileName, error });
        throw error;
      } finally {
        driveSyncController = null;
      }
    }
  );

  // Download a file from Dropbox (restore operation)
  handleInvoke(
    "drive-restore",
    async (restoreParameters: { fileName: string }) => {
      if (driveRestoreController) {
        console.info("[cloud] Aborting previous restore operation");
        driveRestoreController.abort();
      }

      driveRestoreController = new AbortController();
      const signal = driveRestoreController.signal;

      const accessToken = await getAccessToken(signal);
      const { fileName } = restoreParameters;

      console.info("[cloud] Restore starting", { fileName });

      // Check if file exists before attempting download
      const fileExists = await dropboxFileExists(accessToken, fileName, signal);
      console.info("[cloud] Restore existence check", { fileName, fileExists });

      if (!fileExists) {
        driveRestoreController = null;
        console.warn("[cloud] Restore file not found", { fileName });
        throw new NotFoundError("No backup found in Dropbox.");
      }

      const fileBytes = await downloadDropboxFile(
        accessToken,
        fileName,
        signal
      );
      console.info("[cloud] Restore success", {
        fileName,
        bytes: fileBytes.length,
      });

      driveRestoreController = null;
      return fileBytes;
    }
  );

  // Cancel ongoing sync or restore operations
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

  // Auto-sync on app close
  handleInvoke(
    "auto-sync-on-close",
    async (syncParameters: {
      fileName: string;
      content: Uint8Array;
      contentType?: string;
    }) => {
      // If we're already in the middle of a sync, don't start another one
      if (driveSyncController || autoSyncController) {
        console.info("[cloud] Sync already in progress, skipping auto-sync");
        return;
      }

      console.info("[cloud] Starting auto-sync before app close");
      autoSyncController = new AbortController();
      const signal = autoSyncController.signal;

      try {
        const accessToken = await getAccessToken(signal);
        const { fileName, content } = syncParameters;

        console.info("[cloud] Auto-sync uploading", {
          fileName,
          bytes: content?.length ?? 0,
        });

        await uploadDropboxFile(accessToken, fileName, content, signal);
        console.info("[cloud] Auto-sync success", { fileName });
      } catch (error) {
        console.error("[cloud] Auto-sync failed", { error });
        // We don't rethrow the error here, as we want to continue with app close
      } finally {
        autoSyncController = null;
      }
    }
  );
}
