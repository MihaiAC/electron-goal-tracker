// auth-helpers.ts
import { createServer, Server } from "http";
import type { AddressInfo } from "net";
import type { OAuthTokens } from "../types/shared";

/** App scopes: file-scoped Drive access + minimal identity for email. */
export const OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/drive.appdata",
  "openid",
  "email",
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
        // TODO: This is a really inelegant way to do it. Any way to style this somehow?
        res.end(
          "<html><body><p>Authentication complete. You can close this window.</p><script>window.close();</script></body></html>"
        );

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
 * Build the Google OAuth URL for PKCE.
 */
export function buildAuthUrl(
  clientId: string,
  redirectUri: string,
  pkceCodeChallenge: string
): string {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("code_challenge", pkceCodeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("scope", OAUTH_SCOPES.join(" "));

  return authUrl.toString();
}

/** Exchange authorization code for tokens. */
export async function exchangeAuthorizationCodeForTokens(params: {
  clientId: string;
  authorizationCode: string;
  pkceCodeVerifier: string;
  redirectUri: string;
  clientSecret?: string;
}): Promise<OAuthTokens> {
  const {
    clientId,
    authorizationCode: code,
    pkceCodeVerifier: codeVerifier,
    redirectUri,
    clientSecret,
  } = params;

  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  console.info(
    `[auth] Token request body keys: ${Array.from(body.keys()).join(", ")}`
  );

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenResp.ok) {
    let detail = await tokenResp.text();
    try {
      const json = JSON.parse(detail);
      const desc =
        (json && typeof json === "object"
          ? (json as any).error_description
          : "") || "";
      if (
        typeof desc === "string" &&
        desc.toLowerCase().includes("client_secret is missing")
      ) {
        // TODO: Revert this to something shorter once we finish debugging.
        throw new Error(
          "Token exchange failed: client_secret is missing. This typically means the OAuth Client ID is for a Web/confidential client. Ensure GOOGLE_OAUTH_CLIENT_ID is the Desktop app (installed) client for PKCE, or provide GOOGLE_OAUTH_CLIENT_SECRET if your client requires a secret."
        );
      }
      detail = JSON.stringify(json);
    } catch {}

    throw new Error(`Token exchange failed: ${tokenResp.status} ${detail}`);
  }

  return (await tokenResp.json()) as OAuthTokens;
}

/** Decode the payload of a JWT (id_token) to extract minimal user info. */
export function decodeJwtPayload(idToken: string): any {
  const parts = idToken.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const payload = Buffer.from(parts[1], "base64").toString("utf8");

  return JSON.parse(payload);
}

export async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
  clientSecret?: string,
  signal?: AbortSignal
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
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
