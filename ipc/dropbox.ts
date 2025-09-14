import { safeStorage } from "electron";
import Store from "electron-store";
import { handleInvoke } from "./ipc-helpers";
import { refreshAccessToken } from "../utils/auth";
import {
  dropboxFileExists,
  uploadDropboxFile,
  downloadDropboxFile,
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
 * Obtains a fresh access token by refreshing the stored refresh token.
 * Handles token refresh flow and validates the response.
 */
async function getAccessToken(signal?: AbortSignal): Promise<string> {
  const appKey = process.env.DROPBOX_APP_KEY;

  if (!appKey) {
    throw new OAuthConfigError("Missing DROPBOX_APP_KEY in .env");
  }

  console.info("[cloud] Refreshing access token...");
  const refreshToken = getDecryptedRefreshToken();

  const refreshedTokens = await refreshAccessToken(
    appKey,
    refreshToken,
    signal
  );

  const accessToken = refreshedTokens.access_token;
  if (!accessToken) {
    throw new TokenRefreshFailedError("Failed to obtain access token.");
  }

  console.info("[cloud] Access token obtained (not logging token)");
  return accessToken;
}

/**
 * Sets up all Dropbox cloud sync IPC handlers.
 * Call this function during app initialization to register the handlers.
 */
export function setupDropboxIpc() {
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
}
