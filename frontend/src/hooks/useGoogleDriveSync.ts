import { useState } from "react";
import type { ProgressBarData } from "../../../types/shared";
import { createVersionedData } from "../utils/dataMigration";
import { encryptData } from "../utils/crypto";

export function useGoogleDriveSync() {
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const syncToDrive = async (
    password: string,
    bars: ProgressBarData[]
  ): Promise<boolean> => {
    try {
      const data = createVersionedData(bars);
      const encryptedData = await encryptData(JSON.stringify(data), password);

      // TODO: Upload to Google Drive.
      console.log("Upload encrypted data to Google Drive: ", encryptedData);

      setLastSynced(data.lastSynced);
      return true;
    } catch (err) {
      console.error("Sync error: ", err);
      return false;
    }
  };

  const restoreFromDrive = async (
    password: string
  ): Promise<ProgressBarData[] | null> => {
    try {
      // TODO: Download from GDrive + eliminate debug statement.
      console.log("Downloading from Google Drive with password:", password);

      // Mock data, replace with downloaded + decrypted data.
      const mockData = createVersionedData([]);
      setLastSynced(mockData.lastSynced);

      return mockData.bars;
    } catch (err) {
      console.error("Restore error: ", err);

      return null;
    }
  };

  // This function should be called when the user signs out.
  const clearLastSynced = () => {
    setLastSynced(null);
  };

  return {
    lastSynced,
    syncToDrive,
    restoreFromDrive,
    clearLastSynced,
  };
}
