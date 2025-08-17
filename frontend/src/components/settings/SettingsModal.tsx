import { useEffect } from "react";
import type { ProgressBarData } from "../../../../types/shared";
import { useGoogleAuth } from "../../hooks/useGoogleAuth";
import { usePassword } from "../../hooks/usePassword";
import { useGoogleDriveSync } from "../../hooks/useGoogleDriveSync";
import { CloseIcon } from "../Icons";
import { SyncingDialog } from "../dialogs/SyncingDialog";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";
import PasswordDialog from "../dialogs/PasswordDialog";
import AuthenticationSection from "./AuthSection";
import SyncSection from "./SyncSection";
import { useSettingsState } from "../../hooks/useSettingsState";
import OperationSuccessDialog from "../dialogs/OperationSuccessDialog";
import OperationErrorDialog from "../dialogs/OperationErrorDialog";

interface SettingsModalProps {
  open: boolean;
  currentBars: ProgressBarData[];
  onClose: () => void;
  onDataRestored: (bars: ProgressBarData[]) => void;
}

// TODO: Sync dialog -> flashes then disappears. Need to add a minimum time for it to be showing + success visual effect.
export default function SettingsModal({
  open,
  onClose,
  currentBars,
  onDataRestored,
}: SettingsModalProps) {
  const {
    user,
    isAuthenticated,
    isLoading: authIsLoading,
    error: authError,
    signIn,
    signOut,
    clearError: clearAuthError,
    cancelSignIn,
  } = useGoogleAuth();

  const { lastSynced, syncToDrive, restoreFromDrive, clearLastSynced } =
    useGoogleDriveSync();

  const { getPassword, savePassword, clearPassword } = usePassword();

  const { state, dispatch, isBusy, canClose } =
    useSettingsState(isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch({ type: "SIGN_IN_SUCCESS" });
    } else {
      dispatch({ type: "SIGN_OUT" });
    }
  }, [isAuthenticated, dispatch]);

  const handleDismissError = () => {
    if (authError) {
      clearAuthError();
    }
  };

  const handleAttemptSync = async () => {
    const savedPassword = await getPassword();
    if (savedPassword) {
      try {
        dispatch({ type: "START_SYNC" });
        const success = await syncToDrive(savedPassword, currentBars);
        if (success) {
          dispatch({
            type: "OPERATION_SUCCESS",
            operation: "sync",
            message: "Synced successfully",
          });
        } else {
          await clearPassword();
          dispatch({ type: "NEED_PASSWORD", purpose: "sync" });
        }
      } catch {
        await clearPassword();
        dispatch({ type: "NEED_PASSWORD", purpose: "sync" });
      }
    } else {
      dispatch({ type: "NEED_PASSWORD", purpose: "sync" });
    }
  };

  const handleAttemptRestore = () => {
    dispatch({ type: "START_RESTORE" });
  };

  const handleConfirmRestore = async () => {
    const savedPassword = await getPassword();
    if (savedPassword) {
      dispatch({ type: "CONFIRM_RESTORE" });

      try {
        const restoredData = await restoreFromDrive(savedPassword);
        if (restoredData) {
          onDataRestored(restoredData);
          dispatch({
            type: "OPERATION_SUCCESS",
            operation: "restore",
            message: "Restored successfully",
          });
        } else {
          await clearPassword();
          dispatch({ type: "NEED_PASSWORD", purpose: "restore" });
        }
      } catch {
        await clearPassword();
        dispatch({ type: "NEED_PASSWORD", purpose: "restore" });
      }
    } else {
      dispatch({ type: "NEED_PASSWORD", purpose: "restore" });
    }
  };

  const handleSyncWithPassword = async (password: string) => {
    dispatch({ type: "PASSWORD_PROVIDED", password, purpose: "sync" });
    try {
      const success = await syncToDrive(password, currentBars);
      if (success) {
        dispatch({ type: "OFFER_SAVE_PASSWORD", password });
      } else {
        dispatch({ type: "OPERATION_FAILED", message: "Sync failed" });
      }
    } catch {
      dispatch({ type: "OPERATION_FAILED", message: "Sync failed" });
    }
  };

  const handleRestoreWithPassword = async (password: string) => {
    dispatch({ type: "PASSWORD_PROVIDED", password, purpose: "restore" });
    try {
      const restoredData = await restoreFromDrive(password);
      if (restoredData) {
        onDataRestored(restoredData);
        dispatch({ type: "OFFER_SAVE_PASSWORD", password });
      } else {
        dispatch({ type: "OPERATION_FAILED", message: "Restore failed" });
      }
    } catch {
      dispatch({ type: "OPERATION_FAILED", message: "Restore failed" });
    }
  };

  const handleConfirmSavePassword = async () => {
    if (state.type === "SAVE_PASSWORD") {
      await savePassword(state.password);
    }
    dispatch({ type: "SAVE_PASSWORD_CONFIRMED" });
  };

  const handleCancelSavePassword = () => {
    dispatch({ type: "SAVE_PASSWORD_CANCELLED" });
  };

  const handleSignOut = async () => {
    await signOut();
    await clearPassword();
    clearLastSynced();
    dispatch({ type: "SIGN_OUT" });
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={canClose ? onClose : undefined}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Settings</h2>
          <button
            type="button"
            onClick={canClose ? onClose : undefined}
            disabled={!canClose}
            className="titlebar-button hover:bg-red-500 border-2 border-white hover:border-red-500"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-6">
          <AuthenticationSection
            isSyncing={isBusy}
            authIsLoading={authIsLoading}
            isAuthenticated={isAuthenticated}
            user={user}
            onSignIn={signIn}
            onCancelSignIn={cancelSignIn}
            onSignOut={handleSignOut}
          />

          {isAuthenticated && (
            <SyncSection
              isSyncing={isBusy}
              lastSynced={lastSynced}
              onSync={() => handleAttemptSync()}
              onRestore={() => handleAttemptRestore()}
            />
          )}

          {authError && (
            <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-md flex justify-between items-center">
              <p>Error: {authError}</p>
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
      <SyncingDialog
        isOpen={state.type === "SYNCING"}
        message={
          state.type === "SYNCING"
            ? state.operation === "sync"
              ? "Syncing with Google Drive..."
              : "Restoring from Google Drive..."
            : undefined
        }
      />

      <OperationSuccessDialog
        isOpen={state.type === "SUCCESS"}
        title={
          state.type === "SUCCESS"
            ? state.operation === "sync"
              ? "Sync successful"
              : "Restore successful"
            : undefined
        }
        message={state.type === "SUCCESS" ? state.message : ""}
        onClose={() => dispatch({ type: "BACK_TO_IDLE" })}
      />

      <OperationErrorDialog
        isOpen={state.type === "ERROR"}
        message={state.type === "ERROR" ? state.message : ""}
        code={state.type === "ERROR" ? state.code : undefined}
        onClose={() => dispatch({ type: "BACK_TO_IDLE" })}
      />

      <ConfirmationDialog
        isOpen={state.type === "CONFIRM_RESTORE"}
        onCancel={() => dispatch({ type: "BACK_TO_IDLE" })}
        onConfirm={handleConfirmRestore} // Need to handle user input timing.
        title="Restore from Google Drive?"
        message="This will overwrite your current local data. This action cannot be undone."
      />

      <PasswordDialog
        isOpen={state.type === "PASSWORD_SYNC"}
        onCancel={() => dispatch({ type: "BACK_TO_IDLE" })}
        onConfirm={handleSyncWithPassword} // Probably need a dispatch here too.
        title="Enter Encryption Password"
        message="Please enter the password to encrypt your data for Google Drive."
      />

      <PasswordDialog
        isOpen={state.type === "PASSWORD_RESTORE"}
        onCancel={() => dispatch({ type: "BACK_TO_IDLE" })}
        onConfirm={handleRestoreWithPassword} // Probably need a dispatch here too.
        title="Enter Decryption Password"
        message="Please enter the password to decrypt your data from Google Drive."
      />

      <ConfirmationDialog
        isOpen={state.type === "SAVE_PASSWORD"}
        onConfirm={handleConfirmSavePassword}
        onCancel={handleCancelSavePassword}
        title="Save Password?"
        message="Would you like to save this password securely on this computer for future use?"
      />
    </div>
  );
}
