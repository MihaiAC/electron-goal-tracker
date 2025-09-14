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
        console.info(
          "[sync][renderer] Loading saved AppData from local storage..."
        );
        const savedAppData = await window.api.loadData();
        if (isMounted) {
          if (
            savedAppData &&
            typeof savedAppData.lastSynced === "string" &&
            savedAppData.lastSynced.length > 0
          ) {
            setLastSynced(savedAppData.lastSynced);
            console.info("[sync][renderer] Loaded lastSynced from disk", {
              lastSynced: savedAppData.lastSynced,
            });
          } else {
            setLastSynced(null);
            console.info("[sync][renderer] No lastSynced found on disk");
          }
        }
      } catch {
        if (isMounted) {
          setLastSynced(null);
        }
        console.error("[sync][renderer] Failed to load AppData from disk");
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

    console.info("[sync][renderer] Starting sync to Dropbox", {
      bars: Array.isArray(bars) ? bars.length : 0,
    });

    // Build encrypted payload with bars only (no sounds/theme inside the cipher).
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
    console.info("[sync][renderer] Encrypted app data uploaded", {
      fileName: APPDATA_FILE_NAME,
      bytes: bytesData.length,
    });

    setLastSynced(lastSyncedIso);

    // Persist lastSynced alongside bars in local AppData (preserve sounds locally).
    await window.api.savePartialData({
      bars,
      lastSynced: lastSyncedIso,
    });
    console.info("[sync][renderer] Local AppData updated after sync", {
      lastSynced: lastSyncedIso,
      bars: Array.isArray(bars) ? bars.length : 0,
    });

    // Save unencrypted settings (sounds + theme) as a single JSON file to Dropbox.
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
        console.info("[sync][renderer] Settings uploaded", {
          fileName: SETTINGS_FILE_NAME,
          bytes: settingsBytes.length,
          hasSounds: Boolean(settingsPayload.sounds),
          hasTheme: Boolean(settingsPayload.theme),
        });
      } else {
        console.info("[sync][renderer] No settings to upload");
      }
    } catch {
      // Ignore settings upload errors; encrypted appdata already synced.
      console.warn("[sync][renderer] Settings upload failed (ignored)");
    }

    // Also push raw .mp3s for each event to Dropbox (unencrypted, canonical filenames).
    // Only upload sounds that are referenced in the saved preferences being synced.
    try {
      const soundPreferences = savedAppData?.sounds?.preferences;
      if (soundPreferences?.eventFiles) {
        let uploadedCount = 0;
        for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
          const fileRef = soundPreferences.eventFiles[eventId];
          // Only upload if this event has a sound file referenced in the synced preferences
          if (typeof fileRef === "string" && fileRef.length > 0) {
            const mp3Bytes = await window.api.readSoundForEvent(eventId);
            if (mp3Bytes && mp3Bytes.length > 0) {
              await window.api.driveSync({
                fileName: canonicalFilenameForEvent(eventId),
                content: mp3Bytes,
                contentType: "audio/mpeg",
              });
              uploadedCount += 1;
            }
          }
        }
        console.info("[sync][renderer] Sound files uploaded", {
          count: uploadedCount,
        });
      } else {
        console.info("[sync][renderer] No sound preferences to upload");
      }
    } catch {
      // Ignore Dropbox .mp3 upload failures; encrypted appdata already synced.
      console.warn("[sync][renderer] Sound upload failed (ignored)");
    }
  };

  const restoreFromDropbox = async (
    password: string
  ): Promise<ProgressBarData[]> => {
    if (!password || password.length === 0) {
      throw new Error("Missing encryption password.");
    }

    console.info("[sync][renderer] Starting restore from Dropbox");

    // Get the sound manager instance upfront.
    const soundManager = getSoundManager();

    const bytesData = await window.api.driveRestore({
      fileName: APPDATA_FILE_NAME,
    });
    console.info("[sync][renderer] Encrypted app data downloaded", {
      fileName: APPDATA_FILE_NAME,
      bytes: bytesData.length,
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

    // Read unencrypted settings (sounds + theme) from Dropbox, if present.
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
      console.info("[sync][renderer] Settings downloaded", {
        fileName: SETTINGS_FILE_NAME,
        bytes: settingsBytes.length,
        hasSounds: Boolean(parsed.sounds),
        hasTheme: Boolean(parsed.theme),
      });
    } catch {
      // If not found, we'll fall back to defaults below.
      console.info("[sync][renderer] No settings found on Dropbox");
    }

    // Attempt to restore raw .mp3s from Dropbox into local userData/sounds.
    const restoredPresence: Partial<Record<SoundEventId, boolean>> = {};

    console.log("[Sound Restore] Starting sound file restoration from Dropbox");
    for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
      try {
        const fileName = canonicalFilenameForEvent(eventId);
        console.log(
          `[Sound Restore] Attempting to restore sound file: ${fileName} for event: ${eventId}`
        );
        const mp3Bytes = await window.api.driveRestore({ fileName });
        if (mp3Bytes && mp3Bytes.length > 0) {
          console.log(
            `[Sound Restore] Successfully downloaded ${mp3Bytes.length} bytes for ${eventId}`
          );

          // Save the sound file to local disk for future sessions.
          await window.api.saveSoundForEvent(eventId, mp3Bytes);
          console.log(
            `[Sound Restore] Successfully saved sound file for ${eventId}`
          );

          // Also load the sound directly into the manager for the current session.
          soundManager.loadSoundFromBytes(eventId, mp3Bytes);

          restoredPresence[eventId] = true;
        } else {
          console.log(
            `[Sound Restore] No sound data found for ${eventId} (${fileName})`
          );
        }
      } catch (error) {
        console.log(
          `[Sound Restore] Failed to restore sound for ${eventId}:`,
          error
        );
        // Ignore if not found; not all events need to have a sound uploaded.
      }
    }

    console.log("[Sound Restore] Restored presence:", restoredPresence);

    // Determine final preferences to persist: construct canonical-filename
    // preferences from restored .mp3 presence and saved settings file.
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

    // Persist restored bars/lastSynced and sounds preferences plus theme.
    await window.api.savePartialData({
      bars: barsData.bars,
      lastSynced:
        typeof barsData.lastSynced === "string" ? barsData.lastSynced : null,
      sounds: nextPreferences ? { preferences: nextPreferences } : undefined,
      theme: settingsTheme,
    });
    console.info("[sync (renderer)] Local AppData updated after restore", {
      bars: Array.isArray(barsData?.bars) ? barsData.bars.length : 0,
      lastSynced:
        typeof barsData.lastSynced === "string" ? barsData.lastSynced : null,
      hasSoundsPrefs: Boolean(nextPreferences),
      hasTheme: Boolean(settingsTheme),
    });

    // Update SoundManager's preferences (volume/mute) without a full reload,
    // as sounds were already loaded from bytes directly.
    try {
      if (nextPreferences) {
        console.log(
          "[useDropboxSync] Updating SoundManager preferences (volume/mute):",
          nextPreferences
        );
        if (typeof nextPreferences.masterVolume === "number") {
          soundManager.setMasterVolume(nextPreferences.masterVolume);
        }
        if (typeof nextPreferences.muteAll === "boolean") {
          soundManager.setMuteAll(nextPreferences.muteAll);
        }
      }
    } catch (error) {
      console.error(
        "[useDropboxSync] Error updating SoundManager preferences after restore:",
        error
      );
    }

    // Apply restored theme from settings to CSS variables (fallback to defaults if undefined)
    try {
      if (settingsTheme) {
        applyTheme(settingsTheme);
        console.info("[sync][renderer] Theme applied from settings");
      } else {
        applyTheme(DEFAULT_THEME);
        console.info("[sync][renderer] Default theme applied");
      }
    } catch {
      // Ignore theme application errors
    }

    console.info("[sync][renderer] Restore from Dropbox completed");
    return barsData.bars;
  };

  const clearLastSynced = () => {
    (async () => {
      try {
        console.info("[sync][renderer] Clearing lastSynced locally");
        const savedAppData = await window.api.loadData();
        const barsToPersist = Array.isArray(savedAppData?.bars)
          ? savedAppData!.bars
          : [];
        await window.api.savePartialData({
          bars: barsToPersist,
          lastSynced: null,
        });
        console.info("[sync][renderer] lastSynced cleared");
      } finally {
        setLastSynced(null);
      }
    })();
  };

  const cancelDropboxOperation = async (): Promise<void> => {
    console.info("[sync][renderer] Cancel requested for cloud operation");
    await window.api.driveCancel();
    console.info("[sync][renderer] Cancel signal sent");
  };

  return {
    lastSynced,
    syncToDropbox,
    restoreFromDropbox,
    clearLastSynced,
    cancelDropboxOperation,
  };
}
