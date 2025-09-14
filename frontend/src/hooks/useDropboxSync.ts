import { useEffect, useState } from "react";
import type {
  ProgressBarData,
  SoundEventId,
  ThemeData,
  SoundsData,
} from "../../../types/shared";
import { decryptData, encryptData } from "../utils/crypto";
import {
  canonicalFilenameForEvent,
  getSoundManager,
} from "../sound/soundManager";
import {
  SOUND_EVENT_IDS,
  DEFAULT_MASTER_VOLUME,
} from "../sound/soundConfiguration";
import { applyTheme, DEFAULT_THEME } from "../utils/theme";

const APPDATA_FILE_NAME = "goal-tracker.appdata.enc" as const;
/** Unencrypted settings (sounds + theme) file name on Dropbox. */
const SETTINGS_FILE_NAME = "goal-tracker.settings.json" as const;

/**
 * Dropbox file contract
 * - goal-tracker.appdata.enc: encrypted JSON of shape { lastSynced: string, bars: ProgressBarData[] }
 * - goal-tracker.settings.json: plaintext JSON { sounds?: SoundsData, theme?: ThemeData }
 * - Per-event mp3 files: plaintext binary, canonical filenames from canonicalFilenameForEvent(eventId)
 */

export function useDropboxSync() {
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Initialize lastSynced from locally saved AppData when the app starts.
  useEffect(() => {
    let isMounted = true;

    const loadSavedLastSyncedFromLocalData = async () => {
      try {
        const savedAppData = await window.api.loadData();
        if (isMounted) {
          if (
            savedAppData &&
            typeof savedAppData.lastSynced === "string" &&
            savedAppData.lastSynced.length > 0
          ) {
            setLastSynced(savedAppData.lastSynced);
          } else {
            setLastSynced(null);
          }
        }
      } catch {
        if (isMounted) {
          setLastSynced(null);
        }
      }
    };

    loadSavedLastSyncedFromLocalData();

    return () => {
      isMounted = false;
    };
  }, []);

  const syncToDropbox = async (
    password: string,
    bars: ProgressBarData[]
  ): Promise<void> => {
    if (!password || password.length === 0) {
      throw new Error("Missing encryption password");
    }

    /**
     * Build encrypted payload with bars data
     * Sound and theme preferences are handled separately
     */
    const savedAppData = await window.api.loadData();
    const lastSyncedIso = new Date().toISOString();
    const encryptedBars = {
      lastSynced: lastSyncedIso,
      bars,
    } as { lastSynced: string; bars: ProgressBarData[] };
    const jsonData = JSON.stringify(encryptedBars);
    const encryptedData = await encryptData(jsonData, password);
    const bytesData = new TextEncoder().encode(encryptedData);

    await window.api.driveSync({
      fileName: APPDATA_FILE_NAME,
      content: bytesData,
      contentType: "application/octet-stream",
    });

    setLastSynced(lastSyncedIso);

    /**
     * Persist lastSynced timestamp and bars to local storage
     */
    await window.api.savePartialData({
      bars,
      lastSynced: lastSyncedIso,
    });

    /**
     * Save unencrypted settings as a separate JSON file
     * This includes sound preferences and theme data
     */
    try {
      const settingsPayload: { sounds?: SoundsData; theme?: ThemeData } = {};
      if (savedAppData?.sounds) {
        settingsPayload.sounds = savedAppData.sounds as SoundsData;
      }
      if (savedAppData?.theme) {
        settingsPayload.theme = savedAppData.theme as ThemeData;
      }
      if (Object.keys(settingsPayload).length > 0) {
        const settingsBytes = new TextEncoder().encode(
          JSON.stringify(settingsPayload)
        );
        await window.api.driveSync({
          fileName: SETTINGS_FILE_NAME,
          content: settingsBytes,
          contentType: "application/json",
        });
      }
    } catch (error) {
      // Ignore settings upload errors; encrypted appdata already synced.
      console.error("Failed to upload settings to Dropbox:", error);
    }

    /**
     * Upload sound files referenced in preferences to Dropbox
     * Only uploads files that are actually referenced in settings
     */
    try {
      const soundPreferences = savedAppData?.sounds?.preferences;
      if (soundPreferences?.eventFiles) {
        for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
          const fileRef = soundPreferences.eventFiles[eventId];
          // Only upload if this event has a sound file referenced in preferences
          if (typeof fileRef === "string" && fileRef.length > 0) {
            const mp3Bytes = await window.api.readSoundForEvent(eventId);
            if (mp3Bytes && mp3Bytes.length > 0) {
              await window.api.driveSync({
                fileName: canonicalFilenameForEvent(eventId),
                content: mp3Bytes,
                contentType: "audio/mpeg",
              });
            }
          }
        }
      }
    } catch (error) {
      // Sound file upload errors shouldn't prevent the overall sync from succeeding
      // since the encrypted app data was already synced successfully
      console.error("Failed to upload sound files to Dropbox:", error);
    }
  };

  const restoreFromDropbox = async (
    password: string
  ): Promise<ProgressBarData[]> => {
    if (!password || password.length === 0) {
      throw new Error("Missing encryption password.");
    }

    /**
     * Initialize sound manager for restoring sound files
     */
    const soundManager = getSoundManager();

    const bytesData = await window.api.driveRestore({
      fileName: APPDATA_FILE_NAME,
    });
    const encryptedData = new TextDecoder().decode(bytesData);
    const jsonData = await decryptData(encryptedData, password);
    const barsData = JSON.parse(jsonData) as {
      lastSynced?: string;
      bars: ProgressBarData[];
    };

    if (typeof barsData.lastSynced === "string") {
      setLastSynced(barsData.lastSynced);
    } else {
      setLastSynced(null);
    }

    /**
     * Download and restore settings file (sounds and theme)
     */
    let settingsTheme: ThemeData | undefined = undefined;
    let settingsSounds: SoundsData | undefined = undefined;
    try {
      const settingsBytes = await window.api.driveRestore({
        fileName: SETTINGS_FILE_NAME,
      });
      const settingsJson = new TextDecoder().decode(settingsBytes);
      const parsed = JSON.parse(settingsJson) as {
        theme?: ThemeData;
        sounds?: SoundsData;
      };
      settingsTheme = parsed.theme;
      settingsSounds = parsed.sounds;
    } catch (error) {
      // If settings file is not found, we'll fall back to defaults
      console.error(
        "No settings found on Dropbox or error reading settings:",
        error
      );
    }

    /**
     * Restore sound files from Dropbox to local storage
     * Tracks which files were successfully restored
     */
    const restoredPresence: Partial<Record<SoundEventId, boolean>> = {};

    for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
      try {
        const fileName = canonicalFilenameForEvent(eventId);
        const mp3Bytes = await window.api.driveRestore({ fileName });
        if (mp3Bytes && mp3Bytes.length > 0) {
          // Save the sound file to local disk for future sessions.
          await window.api.saveSoundForEvent(eventId, mp3Bytes);

          // Also load the sound directly into the manager for the current session.
          soundManager.loadSoundFromBytes(eventId, mp3Bytes);

          restoredPresence[eventId] = true;
        }
      } catch (error) {
        // Individual sound file restore failures shouldn't block the overall restore
        console.error(
          `Sound file for ${eventId} not found or error restoring:`,
          error
        );
      }
    }

    /**
     * Create final sound preferences by combining restored files
     * with settings from the settings file
     */
    const savedPrefs = settingsSounds?.preferences;
    const nextPreferences: SoundsData["preferences"] | undefined = savedPrefs
      ? {
          masterVolume:
            typeof savedPrefs.masterVolume === "number"
              ? savedPrefs.masterVolume
              : DEFAULT_MASTER_VOLUME,
          muteAll: savedPrefs.muteAll === true,
          eventFiles: (() => {
            const eventFiles: Record<SoundEventId, string> = {} as Record<
              SoundEventId,
              string
            >;
            for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
              eventFiles[eventId] =
                restoredPresence[eventId] === true
                  ? canonicalFilenameForEvent(eventId)
                  : "";
            }
            return eventFiles;
          })(),
        }
      : undefined;

    /**
     * Save all restored data to local storage
     */
    await window.api.savePartialData({
      bars: barsData.bars,
      lastSynced:
        typeof barsData.lastSynced === "string" ? barsData.lastSynced : null,
      sounds: nextPreferences ? { preferences: nextPreferences } : undefined,
      theme: settingsTheme,
    });

    /**
     * Update SoundManager with restored preferences
     */
    try {
      if (nextPreferences) {
        if (typeof nextPreferences.masterVolume === "number") {
          soundManager.setMasterVolume(nextPreferences.masterVolume);
        }
        if (typeof nextPreferences.muteAll === "boolean") {
          soundManager.setMuteAll(nextPreferences.muteAll);
        }
      }
    } catch (error) {
      // Sound manager update errors shouldn't prevent the overall restore
      console.error("Error updating sound manager preferences:", error);
    }

    /**
     * Apply theme settings from restore
     */
    try {
      if (settingsTheme) {
        applyTheme(settingsTheme);
      } else {
        applyTheme(DEFAULT_THEME);
      }
    } catch (error) {
      // Theme application errors shouldn't prevent the overall restore
      console.error("Error applying theme:", error);
    }

    return barsData.bars;
  };

  /**
   * Clear sync timestamp from local storage
   */
  const clearLastSynced = () => {
    (async () => {
      try {
        const savedAppData = await window.api.loadData();
        const barsToPersist = Array.isArray(savedAppData?.bars)
          ? savedAppData!.bars
          : [];
        await window.api.savePartialData({
          bars: barsToPersist,
          lastSynced: null,
        });
      } finally {
        setLastSynced(null);
      }
    })();
  };

  const cancelDropboxOperation = async (): Promise<void> => {
    await window.api.driveCancel();
  };

  return {
    lastSynced,
    syncToDropbox,
    restoreFromDropbox,
    clearLastSynced,
    cancelDropboxOperation,
  };
}
