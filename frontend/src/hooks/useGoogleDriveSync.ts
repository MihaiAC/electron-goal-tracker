import { useEffect, useState } from "react";
import type { ProgressBarData, VersionedAppData } from "../../../types/shared";
import { createVersionedData } from "../utils/dataMigration";
import { decryptData, encryptData } from "../utils/crypto";

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

    const versionedData = createVersionedData(bars);
    const jsonData = JSON.stringify(versionedData);
    const encryptedData = await encryptData(jsonData, password);
    const bytesData = new TextEncoder().encode(encryptedData);

    await window.api.driveSync({
      fileName: DRIVE_FILE_NAME,
      content: bytesData,
      contentType: "application/octet-stream",
    });

    setLastSynced(versionedData.lastSynced);

    // Persist lastSynced alongside bars in local AppData.
    await window.api.saveData({ bars, lastSynced: versionedData.lastSynced });
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

    // Persist restored bars and lastSynced to local AppData.
    await window.api.saveData({
      bars: versionedData.bars,
      lastSynced: versionedData.lastSynced,
    });
    return versionedData.bars;
  };

  const clearLastSynced = () => {
    (async () => {
      try {
        const savedAppData = await window.api.loadData();
        const barsToPersist = Array.isArray(savedAppData?.bars)
          ? savedAppData!.bars
          : [];
        await window.api.saveData({ bars: barsToPersist, lastSynced: null });
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
