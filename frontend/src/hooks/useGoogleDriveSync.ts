import { useEffect, useState } from "react";
import type {
  ProgressBarData,
  VersionedAppData,
  SoundEventId,
} from "../../../types/shared";
import { createVersionedData } from "../utils/dataMigration";
import { decryptData, encryptData } from "../utils/crypto";
import {
  canonicalFilenameForEvent,
  dataUrlToUint8Array,
  bytesToDataUrl,
  getSoundManager,
} from "../sound/soundManager";
import { SOUND_EVENT_IDS } from "../sound/soundEvents";

const DRIVE_FILE_NAME = "goal-tracker.appdata.enc" as const;

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

    // Include sounds preferences snapshot (if any) in encrypted payload.
    const savedAppData = await window.api.loadData();
    const versionedBase = createVersionedData(bars);
    const versionedData: VersionedAppData = savedAppData?.sounds
      ? { ...versionedBase, sounds: savedAppData.sounds }
      : versionedBase;
    const jsonData = JSON.stringify(versionedData);
    const encryptedData = await encryptData(jsonData, password);
    const bytesData = new TextEncoder().encode(encryptedData);

    await window.api.driveSync({
      fileName: DRIVE_FILE_NAME,
      content: bytesData,
      contentType: "application/octet-stream",
    });

    setLastSynced(versionedData.lastSynced);

    // Persist lastSynced alongside bars in local AppData (preserve sounds locally).
    await window.api.savePartialData({
      bars,
      lastSynced: versionedData.lastSynced,
    });

    // Also push raw .mp3s for each event to Drive (unencrypted, canonical filenames).
    try {
      const preferences = savedAppData?.sounds?.preferences;
      if (preferences && typeof preferences === "object") {
        for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
          const dataUrl = preferences.eventFiles?.[eventId];
          if (typeof dataUrl === "string" && dataUrl.length > 0) {
            const mp3Bytes = dataUrlToUint8Array(dataUrl);
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
    const versionedData = JSON.parse(jsonData) as VersionedAppData;

    setLastSynced(versionedData.lastSynced);

    // Attempt to restore raw .mp3s from Drive into local userData/sounds.
    const restoredDataUrls: Partial<Record<SoundEventId, string>> = {};

    for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
      try {
        const fileName = canonicalFilenameForEvent(eventId);
        const mp3Bytes = await window.api.driveRestore({ fileName });
        if (mp3Bytes && mp3Bytes.length > 0) {
          // Save bytes locally under canonical filename for the event.
          await window.api.saveSoundForEvent(eventId, mp3Bytes);
          // Build a data URL so we can seed preferences if needed.
          restoredDataUrls[eventId] = bytesToDataUrl(mp3Bytes, "audio/mpeg");
        }
      } catch {
        // Ignore if not found; not all events need to have a sound uploaded.
      }
    }

    // Determine final preferences to persist: prefer encrypted snapshot, fallback to rebuilt from restored bytes.
    const encryptedPrefs = versionedData.sounds?.preferences;
    const nextPreferences = encryptedPrefs
      ? encryptedPrefs
      : {
          masterVolume: 0.6,
          muteAll: false,
          eventFiles: ((): Record<SoundEventId, string> => {
            const map: Partial<Record<SoundEventId, string>> = {};
            for (const eventId of SOUND_EVENT_IDS as SoundEventId[]) {
              map[eventId] = restoredDataUrls[eventId] ?? "";
            }
            return map as Record<SoundEventId, string>;
          })(),
        };

    // Persist restored bars/lastSynced and sounds preferences.
    await window.api.savePartialData({
      bars: versionedData.bars,
      lastSynced: versionedData.lastSynced,
      sounds: nextPreferences ? { preferences: nextPreferences } : undefined,
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
          const dataUrl = nextPreferences.eventFiles?.[eventId];
          if (typeof dataUrl === "string" && dataUrl.length > 0) {
            soundManager.setSoundFileForEvent(eventId, dataUrl);
          }
        }
      }
    } catch {
      // Ignore manager errors
    }

    return versionedData.bars;
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
