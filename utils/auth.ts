// auth-helpers.ts
import { createServer, Server } from "http";
import type { AddressInfo } from "net";
import type { OAuthTokens } from "../types/shared";
import {
  oauthCallbackSuccessHtml,
  oauthCallbackErrorHtml,
} from "./oauthSuccessPage";

/** Dropbox OAuth scopes for file access. */
export const OAUTH_SCOPES = [
  "files.content.write",
  "files.content.read",
] as const;

/** Max time to wait for the OAuth redirect before timing out. */
export const OAUTH_REDIRECT_TIMEOUT_MS = 30_000;

/**
 * Start a loopback HTTP server on 127.0.0.1 and return the /callback redirect URI.
 * Caller is responsible for closing the server when done.
 */
export async function startLoopbackRedirectServer(): Promise<{
  server: Server;
  redirectUri: string;
}> {
  const server = createServer();

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const redirectUri = `http://127.0.0.1:${address.port}/callback`;

  return { server, redirectUri };
}

/**
 * Wait until the server receives /callback with an auth code (or error).
 * Supports cancellation via AbortSignal and enforces a timeout.
 */
export function waitForAuthorizationCode(
  server: Server,
  signal: AbortSignal,
  timeoutMs: number = OAUTH_REDIRECT_TIMEOUT_MS
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      try {
        server.removeAllListeners("request");
      } catch {}
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;

      try {
        server.close();
      } catch {}

      cleanup();
      reject(new Error("User cancelled."));
    };

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;

      try {
        server.close();
      } catch {}

      cleanup();
      reject(new Error("OAuth timed out."));
    }, timeoutMs);

    signal.addEventListener("abort", onAbort, { once: true });

    server.on("request", (req, res) => {
      if (settled) {
        return;
      }

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
        if (err) {
          res.end(oauthCallbackErrorHtml());
        } else {
          res.end(oauthCallbackSuccessHtml());
        }

        clearTimeout(timeout);
        signal.removeEventListener("abort", onAbort);

        try {
          server.close();
        } catch {}

        settled = true;

        if (err) {
          return reject(new Error(String(err)));
        }

        if (!code) {
          return reject(new Error("Missing authorization code"));
        }

        resolve(code);
      } catch (e) {
        clearTimeout(timeout);
        signal.removeEventListener("abort", onAbort);

        try {
          server.close();
        } catch {}

        settled = true;
        reject(e);
      } finally {
        cleanup();
      }
    });
  });
}

/**
 * Build the Dropbox OAuth URL for PKCE.
 */
export function buildAuthUrl(
  appKey: string,
  redirectUri: string,
  pkceCodeChallenge: string
): string {
  const authUrl = new URL("https://www.dropbox.com/oauth2/authorize");
  authUrl.searchParams.set("client_id", appKey);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("code_challenge", pkceCodeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("scope", OAUTH_SCOPES.join(" "));
  authUrl.searchParams.set("token_access_type", "offline");

  return authUrl.toString();
}

/** Exchange authorization code for tokens with Dropbox. */
export async function exchangeAuthorizationCodeForTokens(params: {
  appKey: string;
  authorizationCode: string;
  pkceCodeVerifier: string;
  redirectUri: string;
}): Promise<OAuthTokens> {
  const {
    appKey,
    authorizationCode: code,
    pkceCodeVerifier: codeVerifier,
    redirectUri,
  } = params;

  const body = new URLSearchParams({
    client_id: appKey,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  console.info(
    `[auth] Token request body keys: ${Array.from(body.keys()).join(", ")}`
  );

  const tokenResp = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenResp.ok) {
    let detail = await tokenResp.text();
    try {
      const json = JSON.parse(detail);
      detail = JSON.stringify(json);
    } catch {}

    throw new Error(`Token exchange failed: ${tokenResp.status} ${detail}`);
  }

  return (await tokenResp.json()) as OAuthTokens;
}

/** Get user info from Dropbox access token. */
export async function getDropboxUserInfo(accessToken: string): Promise<{
  email?: string;
  name?: string;
  picture?: string;
}> {
  const response = await fetch(
    "https://api.dropboxapi.com/2/users/get_current_account",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get user info: ${response.status}`);
  }

  const data = await response.json();
  return {
    email: data.email,
    name: data.name?.display_name || data.name?.given_name,
    picture: data.profile_photo_url,
  };
}

export async function refreshAccessToken(
  appKey: string,
  refreshToken: string,
  signal?: AbortSignal
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_id: appKey,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Refreshing token failed: ${response.status} ${text}`);
  }

  return (await response.json()) as OAuthTokens;
}
