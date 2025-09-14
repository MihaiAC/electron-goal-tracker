import { app } from "electron";
import path from "path";
import fs from "fs";
import { handleInvoke } from "./ipc-helpers";
import { AppData } from "../types/shared";
import { FilesystemError } from "../utils/main-process-errors";

/**
 * Data Persistence IPC Handlers
 *
 * This module handles local application data storage and retrieval.
 * All data is stored as JSON in the userData directory with atomic write operations.
 *
 * Handlers:
 * - save-data: Saves complete AppData with field preservation logic
 * - save-partial-data: Saves partial AppData, merging with existing data
 * - load-data: Loads AppData from disk, returns defaults if not found
 *
 */

/**
 * Atomically writes pretty-printed JSON to a file using temporary file and rename.
 * This prevents data corruption if the write operation is interrupted.
 */
function atomicWriteJson(filePath: string, payload: unknown): void {
  const directoryPath = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const temporaryPath = path.join(directoryPath, `${baseName}.tmp`);

  const jsonText = JSON.stringify(payload, null, 2);

  try {
    fs.writeFileSync(temporaryPath, jsonText, "utf-8");
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(temporaryPath) === true) {
        fs.rmSync(temporaryPath, { force: true });
      }
    } catch {
      // Ignore cleanup errors
    }

    throw new FilesystemError("Failed to write application data to disk.", {
      cause: error,
    });
  }
}

/**
 * Sets up all data persistence IPC handlers.
 * Call this function during app initialization to register the handlers.
 */
export function setupDataIpc() {
  // Save complete application data with field preservation
  handleInvoke("save-data", async (data: AppData) => {
    const filePath = path.join(app.getPath("userData"), "my-data.json");
    console.info("[local] save-data invoked", {
      path: filePath,
      bars: Array.isArray(data?.bars) ? data.bars.length : 0,
      hasSounds: typeof data?.sounds !== "undefined",
      hasTheme: typeof data?.theme !== "undefined",
      hasLastSynced: typeof data?.lastSynced !== "undefined",
    });

    // If lastSynced is not provided by the renderer, preserve the existing value
    // from the current AppData on disk to avoid wiping it on ordinary saves
    let lastSyncedToPersist: string | null = null;
    if (typeof data.lastSynced !== "undefined") {
      lastSyncedToPersist = data.lastSynced ?? null;
    } else {
      if (fs.existsSync(filePath)) {
        try {
          const existingJson = fs.readFileSync(filePath, "utf-8");
          const existingAppData = JSON.parse(existingJson) as AppData;
          if (
            existingAppData &&
            typeof existingAppData.lastSynced !== "undefined"
          ) {
            lastSyncedToPersist = existingAppData.lastSynced ?? null;
          }
        } catch (error) {
          // Ignore parse errors; fall back to null
        }
      }
    }

    // If sounds is not provided, preserve existing sounds on disk
    let soundsToPersist = data.sounds;
    if (typeof soundsToPersist === "undefined") {
      if (fs.existsSync(filePath)) {
        try {
          const existingJson = fs.readFileSync(filePath, "utf-8");
          const existingAppData = JSON.parse(existingJson) as AppData;
          if (
            existingAppData &&
            typeof existingAppData.sounds !== "undefined"
          ) {
            soundsToPersist = existingAppData.sounds;
          }
        } catch (error) {
          // Ignore parse errors; fall back to undefined
        }
      }
    }

    // If theme is not provided, preserve existing theme on disk
    let themeToPersist = data.theme;
    if (typeof themeToPersist === "undefined") {
      if (fs.existsSync(filePath)) {
        try {
          const existingJson = fs.readFileSync(filePath, "utf-8");
          const existingAppData = JSON.parse(existingJson) as AppData;
          if (existingAppData && typeof existingAppData.theme !== "undefined") {
            themeToPersist = existingAppData.theme;
          }
        } catch {
          // Ignore parse errors; fall back to undefined
        }
      }
    }

    const dataToSave: AppData = {
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

  // Save a partial subset of AppData, preserving unspecified fields on disk
  handleInvoke("save-partial-data", async (partial: Partial<AppData>) => {
    const filePath = path.join(app.getPath("userData"), "my-data.json");
    console.info("[local] save-partial-data invoked", {
      path: filePath,
      hasBars: typeof partial?.bars !== "undefined",
      hasLastSynced: typeof partial?.lastSynced !== "undefined",
      hasSounds: typeof partial?.sounds !== "undefined",
      hasTheme: typeof partial?.theme !== "undefined",
    });

    let existingData: AppData = {
      bars: [],
      lastSynced: null,
      sounds: undefined,
      theme: undefined,
    };

    if (fs.existsSync(filePath)) {
      try {
        const rawData = fs.readFileSync(filePath, "utf-8");
        const parsedData = JSON.parse(rawData) as AppData;
        if (parsedData && typeof parsedData === "object") {
          existingData = parsedData;
        }
      } catch {
        // Ignore parse errors; fall back to defaults
      }
    }

    const mergedData: AppData = {
      bars:
        typeof partial.bars !== "undefined"
          ? partial.bars
          : Array.isArray(existingData.bars)
            ? existingData.bars
            : [],
      lastSynced:
        typeof partial.lastSynced !== "undefined"
          ? (partial.lastSynced ?? null)
          : typeof existingData.lastSynced !== "undefined"
            ? (existingData.lastSynced ?? null)
            : null,
      sounds:
        typeof partial.sounds !== "undefined"
          ? partial.sounds
          : existingData.sounds,
      theme:
        typeof partial.theme !== "undefined"
          ? partial.theme
          : existingData.theme,
    };

    atomicWriteJson(filePath, mergedData);
    console.info("[local] save-partial-data success", {
      path: filePath,
      bytes: Buffer.byteLength(JSON.stringify(mergedData)),
      bars: mergedData.bars.length,
      hasSounds: typeof mergedData.sounds !== "undefined",
      hasTheme: typeof mergedData.theme !== "undefined",
      lastSynced: mergedData.lastSynced,
    });
    return { success: true, path: filePath };
  });

  // Load application data from local storage on app start
  handleInvoke("load-data", async () => {
    const filePath = path.join(app.getPath("userData"), "my-data.json");
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        const parsedData = JSON.parse(data) as AppData;
        console.info("[local] load-data success", {
          path: filePath,
          bytes: Buffer.byteLength(data),
          bars: Array.isArray(parsedData?.bars) ? parsedData.bars.length : 0,
          hasSounds: typeof parsedData?.sounds !== "undefined",
          hasTheme: typeof parsedData?.theme !== "undefined",
          lastSynced: parsedData?.lastSynced ?? null,
        });
        return parsedData;
      } else {
        console.info("[local] load-data: no file on disk", { path: filePath });
      }
    } catch (error) {
      console.error("Error loading data: ", error);
    }

    return {
      bars: [],
      lastSynced: null,
      sounds: undefined,
      theme: undefined,
    } as AppData;
  });
}
