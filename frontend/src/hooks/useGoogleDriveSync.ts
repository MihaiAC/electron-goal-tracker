import { useState } from "react";
import type { ProgressBarData } from "../../../types/shared";
import { createVersionedData } from "../utils/dataMigration";
import { encryptData } from "../utils/crypto";

export function useGoogleDriveSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncToDrive = async (
    password: string,
    bars: ProgressBarData[]
  ): Promise<boolean> => {
    setIsSyncing(true);
    setError(null);

    try {
      // Create versioned data.
      const data = createVersionedData(bars);

      // Encrypt it.
      const encryptedData = await encryptData(JSON.stringify(data), password);

      // TODO: Upload to Google Drive.
      console.log("Upload encrypted data to Google Drive: ", encryptedData);

      setLastSynced(data.lastSynced);
      return true;
    } catch (err) {
      setError("Failed to sync with Google Drive.");
      console.error("Sync error: ", err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const restoreFromDrive = async (
    password: string
  ): Promise<ProgressBarData[] | null> => {
    setIsSyncing(true);
    setError(null);

    try {
      // TODO: Download from GDrive + eliminate debug statement.
      console.log("Downloading from Google Drive with password:", password);

      // Mock data, replace with downloaded + decrypted data.
      const mockData = createVersionedData([]);

      setLastSynced(mockData.lastSynced);

      return mockData.bars;
    } catch (err) {
      console.error("Restore error: ", err);
      setError("Failed to restore from Google Drive.");

      return null;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isSyncing,
    lastSynced,
    error,
    syncToDrive,
    restoreFromDrive,
    clearError: () => setError(null),
  };
}
