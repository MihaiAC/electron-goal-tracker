import { useState } from "react";
import type { ProgressBarData } from "../../../types/shared";
import { useGoogleAuth } from "../hooks/useGoogleAuth";
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
export default function SettingsModal({
  open,
  onClose,
  currentBars,
  onDataRestored,
}: SettingsModalProps) {
  const [dialog, setDialog] = useState<
    "none" | "confirmRestore" | "passwordForSync" | "passwordForRestore"
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

  if (!open) {
    return null;
  }

  const combinedError = authError || syncError;

  const handleDismissError = () => {
    if (authError) clearAuthError();
    if (syncError) clearSyncError();
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
              onSync={() => setDialog("passwordForSync")}
              onRestore={() => setDialog("confirmRestore")}
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
        onConfirm={() => setDialog("passwordForRestore")}
        title="Restore from Google Drive?"
        message="This will overwrite your current local data. This action cannot be undone."
      />

      <PasswordDialog
        isOpen={dialog === "passwordForSync"}
        onCancel={() => setDialog("none")}
        onConfirm={async (password) => {
          await syncToDrive(password, currentBars);
          setDialog("none");
        }}
        title="Enter Encryption Password"
        message="Please enter the password to encrypt your data for Google Drive."
      />

      <PasswordDialog
        isOpen={dialog === "passwordForRestore"}
        onCancel={() => setDialog("none")}
        onConfirm={async (password) => {
          try {
            const restoredData = await restoreFromDrive(password);
            if (restoredData) {
              onDataRestored(restoredData);
            }
          } finally {
            setDialog("none");
          }
        }}
        title="Enter Decryption Password"
        message="Please enter the password to decrypt your data from Google Drive."
      />
    </div>
  );
}
