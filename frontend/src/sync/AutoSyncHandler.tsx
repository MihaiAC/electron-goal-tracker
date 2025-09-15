import React, { useEffect, useState } from "react";
import { useDropboxSync } from "./useDropboxSync";
import { SyncingDialog } from "../dialogs/SyncingDialog";

/**
 * AutoSyncHandler Component
 *
 * This component handles auto-sync functionality when the app is closing.
 * It listens for the "start-auto-sync" event from the main process,
 * performs the sync operation, and then signals completion back to main.
 */
export function AutoSyncHandler() {
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncMessage, setSyncMessage] = useState("Syncing before closing...");
  const { syncToDropbox } = useDropboxSync();

  useEffect(() => {
    // Listen for the start-auto-sync event from the main process
    // This handles both showing the dialog and performing the sync
    const startAutoSyncHandler = async (message: string) => {
      // Show the syncing dialog
      setShowSyncDialog(true);
      if (message) {
        setSyncMessage(message);
      }

      try {
        console.info("[auto-sync] Starting auto-sync before app close");

        // Get the saved password
        const password = await window.api.getPassword();
        if (!password) {
          console.error("[auto-sync] No password found, cannot sync");
          window.api.sendAutoSyncComplete(false);
          return;
        }

        // Get the current app data
        const appData = await window.api.loadData();
        if (!appData || !Array.isArray(appData.bars)) {
          console.error("[auto-sync] No valid app data found, cannot sync");
          window.api.sendAutoSyncComplete(false);
          return;
        }

        // Perform the sync operation
        await syncToDropbox(password, appData.bars);

        console.info("[auto-sync] Auto-sync completed successfully");
        window.api.sendAutoSyncComplete(true);
      } catch (error) {
        console.error("[auto-sync] Error during auto-sync:", error);
        window.api.sendAutoSyncComplete(false);
      }
    };

    // Register event listener
    const removeStartAutoSyncListener =
      window.api.onStartAutoSync(startAutoSyncHandler);

    // Cleanup function
    return () => {
      removeStartAutoSyncListener();
    };
  }, [syncToDropbox]);

  // Render the syncing dialog when needed
  return showSyncDialog ? <SyncingDialog message={syncMessage} /> : null;
}
