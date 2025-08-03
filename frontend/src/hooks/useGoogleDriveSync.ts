import { useState } from "react";
import type { ProgressBarData } from "../../../types/shared";
import { createVersionedData } from "../utils/dataMigration";
import { encryptData } from "../utils/crypto";

export function useGoogleDriveSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncToDrive = async (
    password: string,
    bars: ProgressBarData[]
  ): Promise<boolean> => {
    setIsSyncing(true);
    setError(null);
    setShowSuccess(false);

    // Minimum time to show the spinner for.
    const minDisplayTimePromise = new Promise((resolve) =>
      setTimeout(resolve, 1000)
    );

    // Function that performs the actual sync.
    const syncOperation = async () => {
      const data = createVersionedData(bars);
      const encryptedData = await encryptData(JSON.stringify(data), password);
      // TODO: Upload to Google Drive.
      console.log("Upload encrypted data to Google Drive: ", encryptedData);
      return data;
    };

    try {
      // Wait for both the sync operation AND the timer to complete.
      const [syncResult] = await Promise.all([
        syncOperation(),
        minDisplayTimePromise,
      ]);

      // Now that at least 1s has passed and the sync is done, hide the spinner and show the success checkmark.
      setIsSyncing(false);
      setShowSuccess(true);
      setLastSynced(syncResult.lastSynced);

      // Hide the success message after 2 seconds.
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);

      return true;
    } catch (err) {
      // If the sync fails at any point, hide the spinner immediately and show an error.
      setIsSyncing(false);
      setError("Failed to sync with Google Drive.");
      console.error("Sync error: ", err);
      return false;
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

  // This function should be called when the user signs out.
  const clearLastSynced = () => {
    setLastSynced(null);
  };

  return {
    isSyncing,
    showSuccess,
    lastSynced,
    error,
    syncToDrive,
    restoreFromDrive,
    clearError: () => setError(null),
    clearLastSynced,
  };
}
