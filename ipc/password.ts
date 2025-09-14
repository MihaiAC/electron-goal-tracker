import { safeStorage } from "electron";
import Store from "electron-store";
import { handleInvoke } from "./ipc-helpers";
import { CryptoError, SafeStorageError } from "../utils/main-process-errors";

/**
 * Password IPC Handlers
 *
 * This module handles secure password storage and retrieval using Electron's safeStorage API.
 * Passwords are encrypted before being stored in electron-store and decrypted when retrieved.
 *
 * Handlers:
 * - save-password: Encrypts and stores a password securely
 * - get-password: Retrieves and decrypts a stored password
 * - clear-password: Removes the stored password
 */

// Key for storing the encrypted password in electron-store
const SYNC_PASSWORD_KEY = "syncPassword" as const;

interface StoreSchema {
  [SYNC_PASSWORD_KEY]: string;
}

// Initialize electron-store for password storage
const passwordStore = new Store<StoreSchema>();

/**
 * Sets up all password-related IPC handlers.
 * Call this function during app initialization to register the handlers.
 */
export function setupPasswordIpc() {
  // Save the password securely using Electron's safeStorage
  handleInvoke("save-password", async (password: string) => {
    console.info("[password] save-password invoked");

    if (!safeStorage.isEncryptionAvailable()) {
      throw new CryptoError("Safe storage is not available on this system.");
    }

    try {
      const encryptedPassword = safeStorage.encryptString(password);

      // Store the encrypted password as a base64 string
      passwordStore.set(
        SYNC_PASSWORD_KEY,
        encryptedPassword.toString("base64")
      );
      console.info("[password] password saved (encrypted)");
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

  // Retrieve and decrypt the stored password
  handleInvoke("get-password", async () => {
    console.info("[password] get-password invoked");

    if (!safeStorage.isEncryptionAvailable()) {
      throw new CryptoError("Safe storage is not available on this system.");
    }

    try {
      const encryptedPasswordBase64 = passwordStore.get(SYNC_PASSWORD_KEY);
      if (
        !encryptedPasswordBase64 ||
        typeof encryptedPasswordBase64 !== "string"
      ) {
        console.info("[password] no password stored");
        return null;
      }

      const encryptedPassword = Buffer.from(encryptedPasswordBase64, "base64");
      const decryptedPassword = safeStorage.decryptString(encryptedPassword);
      console.info("[password] password retrieved (decrypted in-memory)");
      return decryptedPassword;
    } catch (error) {
      console.error(
        "Failed to get password, clearing potentially corrupt entry.",
        error
      );
      passwordStore.delete(SYNC_PASSWORD_KEY);
      return null;
    }
  });

  // Clear the stored password
  handleInvoke("clear-password", async () => {
    console.info("[password] clear-password invoked");
    passwordStore.delete(SYNC_PASSWORD_KEY);
  });
}
