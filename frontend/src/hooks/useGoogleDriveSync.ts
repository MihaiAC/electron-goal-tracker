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
    const versionedData = JSON.parse(jsonData) as VersionedAppData;

    setLastSynced(versionedData.lastSynced);

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
    // preferences from restored .mp3 presence.
    const encryptedPrefs = versionedData.sounds?.preferences;
    const nextPreferences = ((): {
      masterVolume: number;
      muteAll: boolean;
      eventFiles: Record<SoundEventId, string>;
    } => {
      if (encryptedPrefs && typeof encryptedPrefs === "object") {
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
          typeof encryptedPrefs.masterVolume === "number"
            ? encryptedPrefs.masterVolume
            : 0.6;
        const mute = encryptedPrefs.muteAll === true;
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
          const fileRef = nextPreferences.eventFiles?.[eventId];
          if (typeof fileRef === "string" && fileRef.length > 0) {
            soundManager.setSoundFileForEvent(eventId, fileRef);
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
