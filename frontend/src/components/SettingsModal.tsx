import { useState } from "react";
import type { ProgressBarData } from "../../../types/shared";
import { useGoogleAuth } from "../hooks/useGoogleAuth";
import { usePassword } from "../hooks/usePassword";
import { useGoogleDriveSync } from "../hooks/useGoogleDriveSync";
import { CloseIcon } from "./Icons";
import SyncingDialog from "./dialogs/SyncingDialog";
import ConfirmationDialog from "./dialogs/ConfirmationDialog";
import PasswordDialog from "./dialogs/PasswordDialog";
import AuthenticationSection from "./AuthSection";
import SyncSection from "./SyncSection";

interface SettingsModalProps {
  open: boolean;
  currentBars: ProgressBarData[];
  onClose: () => void;
  onDataRestored: (bars: ProgressBarData[]) => void;
}

// TODO: Store password using electron's safe storage -> maybe usePassword hook.
// TODO: Sync dialog -> flashes then disappears. Need to add a minimum time for it to be showing + success visual effect.
// TODO: Sign out -> password still saved? Don't know how that works out.
export default function SettingsModal({
  open,
  onClose,
  currentBars,
  onDataRestored,
}: SettingsModalProps) {
  const [dialog, setDialog] = useState<
    | "none"
    | "confirmRestore"
    | "passwordForSync"
    | "passwordForRestore"
    | "confirmSavePassword"
  >("none");

  const {
    isSyncing,
    lastSynced,
    error: syncError,
    syncToDrive,
    restoreFromDrive,
    clearError: clearSyncError,
  } = useGoogleDriveSync();

  const {
    user,
    isAuthenticated,
    isLoading: authIsLoading,
    error: authError,
    signIn,
    signOut,
    clearError: clearAuthError,
  } = useGoogleAuth();

  const { getPassword, savePassword, clearPassword } = usePassword();
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const combinedError = authError || syncError;

  const handleDismissError = () => {
    if (authError) clearAuthError();
    if (syncError) clearSyncError();
  };

  const handleAttemptSync = async () => {
    const savedPassword = await getPassword();
    if (savedPassword) {
      try {
        // Try to sync with saved password.
        await syncToDrive(savedPassword, currentBars);
      } catch {
        // TODO: Likely password was wrong - can we handle this better?
        await clearPassword();
        setDialog("passwordForSync");
      }
    } else {
      // No password was saved => ask for it.
      setDialog("passwordForSync");
    }
  };

  const handleAttemptRestore = () => {
    // Restoring is destructive => show confirmation dialog first.
    setDialog("confirmRestore");
  };

  // Handler for the "confirmRestore" dialog.
  // Tries to use a saved password first before asking the user for one.
  const handleConfirmRestore = async () => {
    setDialog("none");

    const savedPassword = await getPassword();

    if (savedPassword) {
      try {
        const restoredData = await restoreFromDrive(savedPassword);
        if (restoredData) {
          onDataRestored(restoredData);
        } else {
          // This case can mean decryption failure.
          // TODO: How to differentiate between different failures?
          await clearPassword();
          setDialog("passwordForRestore");
        }
      } catch {
        await clearPassword();
        setDialog("passwordForRestore");
      }
    }
  };

  // This handler is for the "Sync" password dialog.
  // On success, it triggers the "Save Password" flow.
  const handleSyncWithPassword = async (password: string) => {
    try {
      const success = await syncToDrive(password, currentBars);
      if (success) {
        setDialog("none");
        setTempPassword(password);
        setDialog("confirmSavePassword");
      }
    } catch {
      // Let the sync hook handle the error message, just close the dialog
      setDialog("none");
    }
  };

  // This handler is for the "Restore" password dialog.
  // On success, it triggers the "Save Password" flow.
  const handleRestoreWithPassword = async (password: string) => {
    try {
      const restoredData = await restoreFromDrive(password);
      if (restoredData) {
        onDataRestored(restoredData);
        setDialog("none");
        setTempPassword(password);
        setDialog("confirmSavePassword");
      }
    } catch {
      // Let the sync hook handle the error message, just close the dialog
      setDialog("none");
    }
  };

  // This handler is for the "Save Password" dialog's confirm button.
  const handleConfirmSavePassword = async () => {
    if (tempPassword) {
      await savePassword(tempPassword);
    }
    setDialog("none");
    setTempPassword(null);
  };

  // This handler is for the "Save Password" dialog's cancel button.
  const handleCancelSavePassword = () => {
    setDialog("none");
    setTempPassword(null);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={!isSyncing ? onClose : undefined}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            type="button"
            onClick={!isSyncing ? onClose : undefined}
            disabled={isSyncing}
            className="titlebar-button hover:bg-red-500 border-2 border-white hover:border-red-500"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-6">
          <AuthenticationSection
            isSyncing={isSyncing}
            authIsLoading={authIsLoading}
            isAuthenticated={isAuthenticated}
            user={user}
            onSignIn={signIn}
            onSignOut={signOut}
          />

          {isAuthenticated && (
            <SyncSection
              isSyncing={isSyncing}
              lastSynced={lastSynced}
              onSync={() => handleAttemptSync()}
              onRestore={() => handleAttemptRestore()}
            />
          )}

          {combinedError && (
            <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-md flex justify-between items-center">
              <p>Error: {combinedError}</p>
              <button
                onClick={handleDismissError}
                className="text-sm underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <SyncingDialog isOpen={isSyncing} />

      <ConfirmationDialog
        isOpen={dialog === "confirmRestore"}
        onCancel={() => setDialog("none")}
        onConfirm={handleConfirmRestore}
        title="Restore from Google Drive?"
        message="This will overwrite your current local data. This action cannot be undone."
      />

      <PasswordDialog
        isOpen={dialog === "passwordForSync"}
        onCancel={() => setDialog("none")}
        onConfirm={handleSyncWithPassword}
        title="Enter Encryption Password"
        message="Please enter the password to encrypt your data for Google Drive."
      />

      <PasswordDialog
        isOpen={dialog === "passwordForRestore"}
        onCancel={() => setDialog("none")}
        onConfirm={handleRestoreWithPassword}
        title="Enter Decryption Password"
        message="Please enter the password to decrypt your data from Google Drive."
      />

      <ConfirmationDialog
        isOpen={dialog === "confirmSavePassword"}
        onConfirm={handleConfirmSavePassword}
        onCancel={handleCancelSavePassword}
        title="Save Password?"
        message="Would you like to save this password securely on this computer for future use?"
      />
    </div>
  );
}
