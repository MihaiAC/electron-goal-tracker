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
import { SOUND_EVENT_IDS } from "../sound/soundEvents";
import { applyTheme, DEFAULT_THEME } from "../utils/theme";

const DRIVE_FILE_NAME = "goal-tracker.appdata.enc" as const;
/** Unencrypted settings (sounds + theme) file name on Drive. */
const SETTINGS_FILE_NAME = "goal-tracker.settings.json" as const;

/**
 * Drive file contract
 * - goal-tracker.appdata.enc: encrypted JSON of shape { lastSynced: string, bars: ProgressBarData[] }
 * - goal-tracker.settings.json: plaintext JSON { sounds?: SoundsData, theme?: ThemeData }
 * - Per-event mp3 files: plaintext binary, canonical filenames from canonicalFilenameForEvent(eventId)
 */

export function useGoogleDriveSync() {
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

  const syncToDrive = async (
    password: string,
    bars: ProgressBarData[]
  ): Promise<void> => {
    if (!password || password.length === 0) {
      throw new Error("Missing encryption password");
    }

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
      fileName: DRIVE_FILE_NAME,
      content: bytesData,
      contentType: "application/octet-stream",
    });

    setLastSynced(lastSyncedIso);

    // Persist lastSynced alongside bars in local AppData (preserve sounds locally).
    await window.api.savePartialData({
      bars,
      lastSynced: lastSyncedIso,
    });

    // Save unencrypted settings (sounds + theme) as a single JSON file to Drive.
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
    } catch {
      // Ignore settings upload errors; encrypted appdata already synced.
    }

    // Also push raw .mp3s for each event to Drive (unencrypted, canonical filenames).
    try {
      for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
        const mp3Bytes = await window.api.readSoundForEvent(eventId);
        if (mp3Bytes && mp3Bytes.length > 0) {
          await window.api.driveSync({
            fileName: canonicalFilenameForEvent(eventId),
            content: mp3Bytes,
            contentType: "audio/mpeg",
          });
        }
      }
    } catch {
      // Ignore Drive .mp3 upload failures; encrypted appdata already synced.
    }
  };

  const restoreFromDrive = async (
    password: string
  ): Promise<ProgressBarData[]> => {
    if (!password || password.length === 0) {
      throw new Error("Missing encryption password.");
    }

    const bytesData = await window.api.driveRestore({
      fileName: DRIVE_FILE_NAME,
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

    // Read unencrypted settings (sounds + theme) from Drive, if present.
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
    } catch {
      // If not found, we'll fall back to defaults below.
    }

    // Attempt to restore raw .mp3s from Drive into local userData/sounds.
    const restoredPresence: Partial<Record<SoundEventId, boolean>> = {};

    for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
      try {
        const fileName = canonicalFilenameForEvent(eventId);
        const mp3Bytes = await window.api.driveRestore({ fileName });
        if (mp3Bytes && mp3Bytes.length > 0) {
          // Save bytes locally under canonical filename for the event.
          await window.api.saveSoundForEvent(eventId, mp3Bytes);
          restoredPresence[eventId] = true;
        }
      } catch {
        // Ignore if not found; not all events need to have a sound uploaded.
      }
    }

    // Determine final preferences to persist: construct canonical-filename
    // preferences from restored .mp3 presence and saved settings file.
    const savedPrefs = settingsSounds?.preferences;
    const nextPreferences = ((): {
      masterVolume: number;
      muteAll: boolean;
      eventFiles: Record<SoundEventId, string>;
    } => {
      if (savedPrefs && typeof savedPrefs === "object") {
        const sanitizedEventFiles: Record<SoundEventId, string> = {} as Record<
          SoundEventId,
          string
        >;
        for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
          const hadBytes = restoredPresence[eventId] === true;
          sanitizedEventFiles[eventId] = hadBytes
            ? canonicalFilenameForEvent(eventId)
            : "";
        }
        const volume =
          typeof savedPrefs.masterVolume === "number"
            ? savedPrefs.masterVolume
            : 0.6;
        const mute = savedPrefs.muteAll === true;
        return {
          masterVolume: volume,
          muteAll: mute,
          eventFiles: sanitizedEventFiles,
        };
      } else {
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
        return {
          masterVolume: 0.6,
          muteAll: false,
          eventFiles,
        };
      }
    })();

    // Persist restored bars/lastSynced and sounds preferences plus theme.
    await window.api.savePartialData({
      bars: barsData.bars,
      lastSynced:
        typeof barsData.lastSynced === "string" ? barsData.lastSynced : null,
      sounds: nextPreferences ? { preferences: nextPreferences } : undefined,
      theme: settingsTheme,
    });

    // Update SoundManager immediately so sounds work without reopening modal.
    try {
      const soundManager = getSoundManager();
      if (nextPreferences) {
        if (typeof nextPreferences.masterVolume === "number") {
          soundManager.setMasterVolume(nextPreferences.masterVolume);
        }
        if (typeof nextPreferences.muteAll === "boolean") {
          soundManager.setMuteAll(nextPreferences.muteAll);
        }
        for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
          const fileRef = nextPreferences.eventFiles?.[eventId];
          if (typeof fileRef === "string" && fileRef.length > 0) {
            soundManager.setSoundFileForEvent(eventId, fileRef);
          }
        }
      }
    } catch {
      // Ignore manager errors
    }

    // Apply restored theme from settings to CSS variables (fallback to defaults if undefined)
    try {
      if (settingsTheme) {
        applyTheme(settingsTheme);
      } else {
        applyTheme(DEFAULT_THEME);
      }
    } catch {
      // Ignore theme application errors
    }

    return barsData.bars;
  };

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

  const cancelDriveOperation = async (): Promise<void> => {
    await window.api.driveCancel();
  };

  return {
    lastSynced,
    syncToDrive,
    restoreFromDrive,
    clearLastSynced,
    cancelDriveOperation,
  };
}
