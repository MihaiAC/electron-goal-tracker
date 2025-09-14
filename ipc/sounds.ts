import { app } from "electron";
import path from "path";
import fs from "fs";
import { handleInvoke } from "./ipc-helpers";
import { SoundEventId } from "../types/shared";
import { UnknownMainProcessError } from "../utils/main-process-errors";

/**
 * Sounds IPC Handlers
 *
 * This module manages sound file storage and retrieval for UI events.
 * Sound files are stored locally in the userData directory with canonical filenames.
 *
 * Handlers:
 * - sounds-save: Saves a user-uploaded .mp3 sound file for a specific event
 * - sounds-read: Retrieves the saved .mp3 bytes for an event, or null if not found
 *
 * File Management:
 * - Sounds are stored in userData/sounds/ directory
 * - Each event type has a canonical filename (e.g., ui_increment.mp3)
 * - Directory is created automatically if it doesn't exist
 */

// Canonical file names for .mp3 sounds per event
const SOUND_FILE_NAMES: Record<SoundEventId, string> = {
  progressIncrement: "ui_increment.mp3",
  progressDecrement: "ui_decrement.mp3",
  progressComplete: "ui_complete.mp3",
};

/**
 * Ensures a directory exists, creating parent directories as needed.
 * Uses recursive creation to handle nested directory structures.
 */
function ensureDirectorySync(directoryPath: string): void {
  if (fs.existsSync(directoryPath) === false) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

/**
 * Resolves the sounds folder path under userData directory.
 * This provides a consistent location for sound file storage across platforms.
 */
function getSoundsDirectory(): string {
  return path.join(app.getPath("userData"), "sounds");
}

/**
 * Sets up all sound-related IPC handlers.
 * Call this function during app initialization to register the handlers.
 */
export function setupSoundsIpc() {
  // Save a user-uploaded .mp3 sound under a canonical filename for the event
  handleInvoke(
    "sounds-save",
    async (eventId: SoundEventId, soundContent: Uint8Array) => {
      const canonicalFileName = SOUND_FILE_NAMES[eventId];
      if (typeof canonicalFileName !== "string") {
        throw new UnknownMainProcessError("Invalid sound event id");
      }

      const soundsDirectory = getSoundsDirectory();
      ensureDirectorySync(soundsDirectory);

      const soundFilePath = path.join(soundsDirectory, canonicalFileName);

      try {
        const soundBuffer = Buffer.from(soundContent);
        fs.writeFileSync(soundFilePath, soundBuffer);
        console.info("[local] sound saved", {
          eventId,
          filePath: soundFilePath,
          bytes: soundBuffer.length,
        });
      } catch (error) {
        console.error("[local] failed to save sound", {
          eventId,
          filePath: soundFilePath,
          error,
        });
        throw new UnknownMainProcessError(
          `Failed to save sound for ${String(eventId)}`
        );
      }
    }
  );

  // Read the saved .mp3 bytes for a given event, or null if not found
  handleInvoke(
    "sounds-read",
    async (eventId: SoundEventId): Promise<Uint8Array | null> => {
      const canonicalFileName = SOUND_FILE_NAMES[eventId];
      if (typeof canonicalFileName !== "string") {
        throw new UnknownMainProcessError("Invalid sound event id");
      }

      const soundsDirectory = getSoundsDirectory();
      const soundFilePath = path.join(soundsDirectory, canonicalFileName);

      try {
        if (fs.existsSync(soundFilePath) === false) {
          console.info("[local] sound not found", {
            eventId,
            filePath: soundFilePath,
          });
          return null;
        }

        const soundBuffer = fs.readFileSync(soundFilePath);
        console.info("[local] sound read", {
          eventId,
          filePath: soundFilePath,
          bytes: soundBuffer.length,
        });
        return new Uint8Array(soundBuffer);
      } catch (error) {
        console.error("[local] failed to read sound", {
          eventId,
          filePath: soundFilePath,
          error,
        });
        return null;
      }
    }
  );
}
