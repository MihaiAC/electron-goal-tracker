import { safeStorage, shell } from "electron";
import Store from "electron-store";
import pkceChallenge from "pkce-challenge";
import { handleInvoke } from "./ipc-helpers";
import { OAuthUser } from "../types/shared";
import {
  startLoopbackRedirectServer,
  waitForAuthorizationCode,
  buildAuthUrl,
  exchangeAuthorizationCodeForTokens,
  getDropboxUserInfo,
} from "../utils/auth";
import {
  CryptoError,
  OAuthConfigError,
  SafeStorageError,
} from "../utils/main-process-errors";

/**
 * Authentication IPC Handlers
 *
 * This module handles OAuth authentication flow with Dropbox using PKCE (Proof Key for Code Exchange).
 * It manages the complete OAuth flow including token storage, refresh, and user info retrieval.
 *
 * Handlers:
 * - auth-start: Initiates OAuth flow with external browser
 * - auth-cancel: Cancels ongoing OAuth flow
 * - auth-sign-out: Clears stored tokens and user info
 * - auth-status: Returns current authentication status and user info
 *
 * Security:
 * - Uses PKCE for secure OAuth without client secrets
 * - Encrypts refresh tokens using Electron's safeStorage
 * - Supports token refresh for long-term authentication
 */

// Keys for storing OAuth data in electron-store
const OAUTH_REFRESH_TOKEN_KEY = "oauthRefreshToken" as const;
const OAUTH_USER_INFO_KEY = "oauthUser" as const;

interface AuthStoreSchema {
  [OAUTH_REFRESH_TOKEN_KEY]?: string;
  oauthUser?: OAuthUser;
}

// Initialize electron-store for OAuth data
const authStore = new Store<AuthStoreSchema>();

// Local controller to cancel an in-flight OAuth attempt
let authController: AbortController | null = null;

/**
 * Validates OAuth preconditions and returns required configuration.
 * Ensures environment variables and safe storage are available.
 */
function ensureOAuthPreconditions(): { appKey: string } {
  const appKey = process.env.DROPBOX_APP_KEY;

  if (!appKey) {
    throw new OAuthConfigError("Missing DROPBOX_APP_KEY in .env");
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new CryptoError("Safe storage is not available on this system.");
  }

  console.info("[auth] Preconditions OK (env and safeStorage)");
  return { appKey };
}

/**
 * Stores OAuth tokens and fetches user information.
 * Encrypts refresh token and stores user info for future use.
 */
async function storeTokensAndUserInfo(tokens: {
  refresh_token?: string;
  access_token?: string;
}) {
  const refreshToken = tokens.refresh_token;
  if (refreshToken) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new CryptoError("Safe storage is not available on this system.");
    }

    try {
      const encryptedRefreshToken = safeStorage.encryptString(refreshToken);
      authStore.set(
        OAUTH_REFRESH_TOKEN_KEY,
        encryptedRefreshToken.toString("base64")
      );
      console.info("[auth] refresh token stored (encrypted)");
    } catch (error) {
      console.error("[auth] Failed to encrypt refresh token: ", error);
      throw new SafeStorageError("Failed to encrypt refresh token.", {
        cause: error,
      });
    }
  } else {
    const existingEncryptedToken = authStore.get(OAUTH_REFRESH_TOKEN_KEY);
    if (!existingEncryptedToken || typeof existingEncryptedToken !== "string") {
      throw new OAuthConfigError(
        "No refresh_token returned. Please try again."
      );
    }
  }

  // Fetch and store user information if access token is available
  if (tokens.access_token) {
    try {
      const userInfo = await getDropboxUserInfo(tokens.access_token);
      authStore.set(OAUTH_USER_INFO_KEY, userInfo);
      console.info("[auth] user info fetched and stored", {
        hasEmail: Boolean(userInfo?.email),
        hasName: Boolean(userInfo?.name),
      });
    } catch {
      console.warn("[auth] failed to fetch user info; clearing stored user");
      authStore.delete(OAUTH_USER_INFO_KEY);
    }
  } else {
    authStore.delete(OAUTH_USER_INFO_KEY);
  }
}

/**
 * Sets up all authentication-related IPC handlers.
 * Call this function during app initialization to register the handlers.
 */
export function setupAuthIpc() {
  // Start OAuth authentication flow
  handleInvoke("auth-start", async () => {
    console.info("[auth] Starting Dropbox OAuth flow");
    const { appKey } = ensureOAuthPreconditions();

    // Generate PKCE challenge for secure OAuth
    const { code_verifier, code_challenge } = await pkceChallenge();
    console.info("[auth] PKCE challenge generated");

    // Abort previous attempt and create fresh controller
    if (authController) {
      console.info("[auth] Aborting previous OAuth attempt");
      authController.abort();
    }

    authController = new AbortController();
    const signal = authController.signal;

    // Start loopback server and build auth URL
    const { server, redirectUri } = await startLoopbackRedirectServer();
    console.info("[auth] Loopback server started", { redirectUri });
    const authUrl = buildAuthUrl(appKey, redirectUri, code_challenge);
    console.info("[auth] Opening external auth URL");
    await shell.openExternal(authUrl);

    // Wait for authorization code from OAuth flow
    let authorizationCode: string;
    try {
      console.info("[auth] Waiting for authorization code...");
      authorizationCode = await waitForAuthorizationCode(server, signal);
      console.info("[auth] Authorization code received (not logging value)");
    } finally {
      try {
        server.close();
        console.info("[auth] Loopback server closed");
      } catch {}
    }

    // Exchange authorization code for tokens
    console.info("[auth] Exchanging code for tokens...");
    const tokens = await exchangeAuthorizationCodeForTokens({
      appKey,
      authorizationCode,
      pkceCodeVerifier: code_verifier,
      redirectUri,
    });
    console.info("[auth] Token exchange successful (not logging tokens)");
    await storeTokensAndUserInfo(tokens);

    authController = null;
    console.info("[auth] OAuth flow completed successfully");
  });

  // Cancel ongoing OAuth flow
  handleInvoke("auth-cancel", async () => {
    console.info("[auth] OAuth cancel requested");
    authController?.abort();
    authController = null;
  });

  // Sign out and clear stored authentication data
  handleInvoke("auth-sign-out", async () => {
    console.info("[auth] Signing out and clearing stored tokens/user");
    authStore.delete(OAUTH_REFRESH_TOKEN_KEY);
    authStore.delete(OAUTH_USER_INFO_KEY);
  });

  // Get current authentication status and user info
  handleInvoke("auth-status", async () => {
    try {
      const encryptedRefreshToken = authStore.get(OAUTH_REFRESH_TOKEN_KEY);
      if (!encryptedRefreshToken || typeof encryptedRefreshToken !== "string") {
        console.info("[auth] auth-status: not authenticated (no token)");
        return { isAuthenticated: false, user: null as OAuthUser | null };
      }

      // Verify token can be decrypted (throws if corrupt)
      safeStorage.decryptString(Buffer.from(encryptedRefreshToken, "base64"));
      const userInfo = authStore.get(OAUTH_USER_INFO_KEY) ?? null;
      console.info("[auth] auth-status: authenticated", {
        hasUser: Boolean(userInfo),
      });
      return { isAuthenticated: true, user: userInfo };
    } catch {
      console.info("[auth] auth-status: not authenticated (decrypt failed)");
      return { isAuthenticated: false, user: null as OAuthUser | null };
    }
  });
}
