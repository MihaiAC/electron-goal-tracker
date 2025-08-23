// TODO: Is there a better way to build requests? Maybe Axios? This is a bit too low level.
// TODO: Is there a way to sneak in Tanstack?

import {
  CanceledError,
  NetworkError,
  DriveApiError,
} from "./main-process-errors";

/**
 * Return the ID of our save file.
 * @param accessToken JWT(?) token for querying GDrive's API.
 * @param fileName Name of the file whose ID we're looking for.
 * @param signal Abort signal if user cancels the request.
 * @returns ID of the file or null.
 */
export async function findAppDataFileIdByName(
  accessToken: string,
  fileName: string,
  signal?: AbortSignal
): Promise<string | null> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");

  // Set spaces query param to appDataFolder.
  url.searchParams.set("spaces", "appDataFolder");

  // Search for fileName in appDataFolder, ignore deleted files.
  url.searchParams.set(
    "q",
    `name = '${fileName.replace(/'/g, "\\'")}' and 'appDataFolder' in parents and trashed = false`
  );

  // Just return the file id in the response.
  url.searchParams.set("fields", "files(id)");

  // Only return one file.
  url.searchParams.set("pageSize", "1");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
  } catch (error) {
    if (signal && signal.aborted) {
      throw new CanceledError("Drive list aborted", { cause: error });
    } else {
      throw new NetworkError("Network error during Drive list", {
        cause: error,
      });
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new DriveApiError("Drive list failed", response.status, {
      cause: text,
    });
  }

  const json = (await response.json()) as { files?: Array<{ id: string }> };
  return json.files && json.files[0] ? json.files[0].id : null;
}

/**
 * Create save file on GDrive.
 * @param accessToken
 * @param fileName
 * @param signal
 * @throws If response fails or it doesn't contain the ID.
 * @returns ID of the file we created.
 */
export async function createAppDataFile(
  accessToken: string,
  fileName: string,
  signal?: AbortSignal
): Promise<string> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("fields", "id");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ name: fileName, parents: ["appDataFolder"] }),
      signal,
    });
  } catch (error) {
    if (signal && signal.aborted) {
      throw new CanceledError("Drive create aborted", { cause: error });
    } else {
      throw new NetworkError("Network error during Drive create", {
        cause: error,
      });
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new DriveApiError("Drive create failed", response.status, {
      cause: text,
    });
  }

  const json = (await response.json()) as { id?: string };
  if (json.id && json.id.length > 0) {
    return json.id;
  } else {
    throw new DriveApiError(
      "Drive create failed: missing file ID in the response."
    );
  }
}

/**
 * Updates save file.
 * @param accessToken
 * @param fileId
 * @param content
 * @param contentType
 * @param signal
 */
export async function updateAppDataFileContent(
  accessToken: string,
  fileId: string,
  content: Uint8Array,
  contentType?: string,
  signal?: AbortSignal
): Promise<void> {
  const url = new URL(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}`
  );
  url.searchParams.set("uploadType", "media");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": contentType || "application/octet-stream",
      },
      body: content,
      signal,
    });
  } catch (error) {
    if (signal && signal.aborted) {
      throw new CanceledError("Drive update aborted", { cause: error });
    } else {
      throw new NetworkError("Network error during Drive update", {
        cause: error,
      });
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new DriveApiError("Drive update failed", response.status, {
      cause: text,
    });
  }
}

/**
 * Download the save file from GDrive.
 * @param accessToken
 * @param fileId
 * @param signal
 * @returns
 */
export async function downloadAppDataFileContent(
  accessToken: string,
  fileId: string,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`
  );
  url.searchParams.set("alt", "media");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
  } catch (error) {
    if (signal && signal.aborted) {
      throw new CanceledError("Drive download aborted", { cause: error });
    } else {
      throw new NetworkError("Network error during Drive download", {
        cause: error,
      });
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new DriveApiError("Drive download failed", response.status, {
      cause: text,
    });
  }

  const ab = await response.arrayBuffer();
  return new Uint8Array(ab);
}

/**
 * Delete the save file from GDrive.
 * @param accessToken
 * @param fileId
 * @param signal
 */
export async function deleteAppDataFile(
  accessToken: string,
  fileId: string,
  signal?: AbortSignal
): Promise<void> {
  const url = new URL(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`
  );

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal,
    });
  } catch (error) {
    if (signal && signal.aborted) {
      throw new CanceledError("Drive delete aborted", { cause: error });
    } else {
      throw new NetworkError("Network error during Drive delete", {
        cause: error,
      });
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new DriveApiError("Drive delete failed", response.status, {
      cause: text,
    });
  }
}
