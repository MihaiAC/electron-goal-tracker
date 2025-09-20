import {
  CanceledError,
  NetworkError,
  DropboxApiError,
  OAuthConfigError,
} from "./main-process-errors";

/**
 * Built-in Dropbox app key fallback for production builds where .env is not available.
 * This is a public identifier, safe to embed in the client. Prefer overriding via
 * the DROPBOX_APP_KEY environment variable in development.
 */
const BUILT_IN_DROPBOX_APP_KEY = "infsw3y8bz1yxkx";

/**
 * Resolves the Dropbox app key from environment variable or built-in fallback.
 * Throws OAuthConfigError if no valid key is available.
 */
export function resolveDropboxAppKey(): string {
  const appKeyFromEnvironment = process.env.DROPBOX_APP_KEY;
  const resolvedDropboxAppKey =
    typeof appKeyFromEnvironment === "string" &&
    appKeyFromEnvironment.length > 0
      ? appKeyFromEnvironment
      : BUILT_IN_DROPBOX_APP_KEY;

  if (!resolvedDropboxAppKey || resolvedDropboxAppKey.length === 0) {
    throw new OAuthConfigError(
      "Dropbox app key is missing. Set the DROPBOX_APP_KEY environment variable or define BUILT_IN_DROPBOX_APP_KEY."
    );
  }

  return resolvedDropboxAppKey;
}

/**
 * Check if a file exists in Dropbox app folder.
 * @param accessToken Dropbox access token
 * @param fileName Name of the file to check
 * @param signal Abort signal if user cancels the request
 * @returns true if file exists, false otherwise
 */
export async function dropboxFileExists(
  accessToken: string,
  fileName: string,
  signal?: AbortSignal
): Promise<boolean> {
  const path = `/${fileName}`;

  let response: Response;
  try {
    response = await fetch("https://api.dropboxapi.com/2/files/get_metadata", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: path,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
      }),
      signal,
    });
  } catch (error) {
    if (signal && signal.aborted) {
      throw new CanceledError("Dropbox metadata check aborted", {
        cause: error,
      });
    } else {
      throw new NetworkError("Network error during Dropbox metadata check", {
        cause: error,
      });
    }
  }

  if (response.status === 409) {
    // File not found (path/not_found error)
    return false;
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("[dropbox] get metadata failed", {
      status: response.status,
      body: text,
    });
    throw new DropboxApiError(
      "Dropbox metadata check failed",
      response.status,
      {
        cause: text,
      }
    );
  }

  return true;
}

/**
 * Upload file content to Dropbox app folder.
 * @param accessToken Dropbox access token
 * @param fileName Name of the file to upload
 * @param content File content as Uint8Array
 * @param signal Abort signal if user cancels the request
 */
export async function uploadDropboxFile(
  accessToken: string,
  fileName: string,
  content: Uint8Array,
  signal?: AbortSignal
): Promise<void> {
  const path = `/${fileName}`;

  let response: Response;
  try {
    response = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: path,
          mode: "overwrite",
          autorename: false,
          mute: false,
          strict_conflict: false,
        }),
      },
      body: content,
      signal,
    });
  } catch (error) {
    if (signal && signal.aborted) {
      throw new CanceledError("Dropbox upload aborted", { cause: error });
    } else {
      throw new NetworkError("Network error during Dropbox upload", {
        cause: error,
      });
    }
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("[dropbox] upload failed", {
      status: response.status,
      body: text,
    });
    throw new DropboxApiError("Dropbox upload failed", response.status, {
      cause: text,
    });
  }
}

/**
 * Download file content from Dropbox app folder.
 * @param accessToken Dropbox access token
 * @param fileName Name of the file to download
 * @param signal Abort signal if user cancels the request
 * @returns File content as Uint8Array
 */
export async function downloadDropboxFile(
  accessToken: string,
  fileName: string,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const path = `/${fileName}`;

  let response: Response;
  try {
    response = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Dropbox-API-Arg": JSON.stringify({
          path: path,
        }),
      },
      signal,
    });
  } catch (error) {
    if (signal && signal.aborted) {
      throw new CanceledError("Dropbox download aborted", { cause: error });
    } else {
      throw new NetworkError("Network error during Dropbox download", {
        cause: error,
      });
    }
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("[dropbox] download failed", {
      status: response.status,
      body: text,
    });
    throw new DropboxApiError("Dropbox download failed", response.status, {
      cause: text,
    });
  }

  const ab = await response.arrayBuffer();
  return new Uint8Array(ab);
}

/**
 * Delete file from Dropbox app folder.
 * @param accessToken Dropbox access token
 * @param fileName Name of the file to delete
 * @param signal Abort signal if user cancels the request
 */
export async function deleteDropboxFile(
  accessToken: string,
  fileName: string,
  signal?: AbortSignal
): Promise<void> {
  const path = `/${fileName}`;

  let response: Response;
  try {
    response = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: path,
      }),
      signal,
    });
  } catch (error) {
    if (signal && signal.aborted) {
      throw new CanceledError("Dropbox delete aborted", { cause: error });
    } else {
      throw new NetworkError("Network error during Dropbox delete", {
        cause: error,
      });
    }
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("[dropbox] delete failed", {
      status: response.status,
      body: text,
    });
    throw new DropboxApiError("Dropbox delete failed", response.status, {
      cause: text,
    });
  }
}
