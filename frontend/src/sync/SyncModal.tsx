import { useEffect } from "react";
import type { ProgressBarData } from "../../../types/shared";
import { ErrorCodes } from "../../../types/shared";
import { isErrorWrapper } from "../utils/errorMapping";
import { useDropboxAuth } from "./useDropboxAuth";
import { usePassword } from "../storage/usePassword";
import { useDropboxSync } from "./useDropboxSync";
import { SyncingDialog } from "../dialogs/SyncingDialog";
import ConfirmationDialog from "../dialogs/ConfirmationDialog";
import PasswordDialog from "../dialogs/PasswordDialog";
import AuthenticationSection from "./AuthSection";
import SyncSection from "./SyncSection";
import { useSettingsState } from "./useSyncState";
import OperationSuccessDialog from "../dialogs/OperationSuccessDialog";
import OperationErrorDialog from "../dialogs/OperationErrorDialog";
import { getUserFriendlyErrorMessage } from "../utils/errorMessages";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { Separator } from "../ui/Separator";

interface SyncModalProps {
  open: boolean;
  currentBars: ProgressBarData[];
  onClose: () => void;
  onDataRestored: (bars: ProgressBarData[]) => void;
}

export default function SyncModal({
  open,
  onClose,
  currentBars,
  onDataRestored,
}: SyncModalProps) {
  const {
    user,
    isAuthenticated,
    isLoading: authIsLoading,
    error: authError,
    signIn,
    signOut,
    clearError: clearAuthError,
    cancelSignIn,
  } = useDropboxAuth();

  const {
    lastSynced,
    syncToDropbox,
    restoreFromDropbox,
    clearLastSynced,
    cancelDropboxOperation,
  } = useDropboxSync();

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
        await syncToDropbox(savedPassword, currentBars);
        dispatch({
          type: "OPERATION_SUCCESS",
          operation: "sync",
          message: "Data successfully backed up.",
        });
      } catch (error) {
        if (isErrorWrapper(error)) {
          if (error.code === ErrorCodes.Canceled) {
            dispatch({ type: "BACK_TO_IDLE" });
          } else {
            dispatch({
              type: "OPERATION_FAILED",
              message: getUserFriendlyErrorMessage(error.code, "sync"),
              code: error.code,
              status: error.status,
            });
          }
        } else {
          dispatch({
            type: "OPERATION_FAILED",
            message: getUserFriendlyErrorMessage(ErrorCodes.Unknown, "sync"),
            code: ErrorCodes.Unknown,
          });
        }
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
        const restoredData = await restoreFromDropbox(savedPassword);
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
      } catch (error) {
        if (isErrorWrapper(error)) {
          if (error.code === ErrorCodes.Canceled) {
            dispatch({ type: "BACK_TO_IDLE" });
          } else if (error.code === ErrorCodes.Crypto) {
            await clearPassword();
            dispatch({ type: "NEED_PASSWORD", purpose: "restore" });
          } else {
            dispatch({
              type: "OPERATION_FAILED",
              message: getUserFriendlyErrorMessage(error.code, "restore"),
              code: error.code,
              status: error.status,
            });
          }
        } else {
          dispatch({
            type: "OPERATION_FAILED",
            message: getUserFriendlyErrorMessage(ErrorCodes.Unknown, "restore"),
            code: ErrorCodes.Unknown,
          });
        }
      }
    } else {
      dispatch({ type: "NEED_PASSWORD", purpose: "restore" });
    }
  };

  const handleSyncWithPassword = async (password: string) => {
    dispatch({ type: "PASSWORD_PROVIDED", password, purpose: "sync" });
    try {
      await syncToDropbox(password, currentBars);
      dispatch({ type: "OFFER_SAVE_PASSWORD", password });
    } catch (error) {
      if (isErrorWrapper(error)) {
        if (error.code === ErrorCodes.Canceled) {
          dispatch({ type: "BACK_TO_IDLE" });
        } else {
          dispatch({
            type: "OPERATION_FAILED",
            message: getUserFriendlyErrorMessage(error.code, "sync"),
            code: error.code,
            status: error.status,
          });
        }
      } else {
        dispatch({
          type: "OPERATION_FAILED",
          message: getUserFriendlyErrorMessage(ErrorCodes.Unknown, "sync"),
          code: ErrorCodes.Unknown,
        });
      }
    }
  };

  const handleRestoreWithPassword = async (password: string) => {
    dispatch({ type: "PASSWORD_PROVIDED", password, purpose: "restore" });
    try {
      const restoredData = await restoreFromDropbox(password);
      if (restoredData) {
        onDataRestored(restoredData);
        dispatch({ type: "OFFER_SAVE_PASSWORD", password });
      } else {
        dispatch({
          type: "OPERATION_FAILED",
          message: "Restore failed",
          code: ErrorCodes.Unknown,
        });
      }
    } catch (error) {
      if (isErrorWrapper(error)) {
        if (error.code === ErrorCodes.Canceled) {
          dispatch({ type: "BACK_TO_IDLE" });
        } else {
          dispatch({
            type: "OPERATION_FAILED",
            message: getUserFriendlyErrorMessage(error.code, "restore"),
            code: error.code,
            status: error.status,
          });
        }
      } else {
        dispatch({
          type: "OPERATION_FAILED",
          message: getUserFriendlyErrorMessage(ErrorCodes.Unknown, "restore"),
          code: ErrorCodes.Unknown,
        });
      }
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
    <div className="overlay-dim z-50" onClick={canClose ? onClose : undefined}>
      <div
        className="panel-base p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Cloud sync</h2>
          <Button
            variant="close"
            onClick={canClose ? onClose : undefined}
            disabled={!canClose}
          >
            <X className="close-icon" />
          </Button>
        </div>

        <Separator className="-mx-6 mb-6" />

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
            <>
              <Separator className="-mx-6 my-6" />

              <SyncSection
                isSyncing={isBusy}
                lastSynced={lastSynced}
                onSync={() => handleAttemptSync()}
                onRestore={() => handleAttemptRestore()}
              />
            </>
          )}

          {authError && (
            <>
              <Separator className="-mx-6 my-6" />

              <div className="bg-error border border-error text-error p-3 rounded-md flex justify-between items-center">
                <p>Error: {authError}</p>
                <button
                  onClick={handleDismissError}
                  className="text-sm underline"
                >
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {state.type === "SYNCING" ? (
        <SyncingDialog
          message={
            state.operation === "sync"
              ? "Syncing with Dropbox..."
              : "Restoring from Dropbox..."
          }
          onCancel={cancelDropboxOperation}
        />
      ) : null}

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
        status={state.type === "ERROR" ? state.status : undefined}
        onClose={() => dispatch({ type: "BACK_TO_IDLE" })}
      />

      <ConfirmationDialog
        isOpen={state.type === "CONFIRM_RESTORE"}
        onCancel={() => dispatch({ type: "BACK_TO_IDLE" })}
        onConfirm={handleConfirmRestore} // Need to handle user input timing.
        title="Restore from Dropbox?"
        message="This will overwrite your current local data. This action cannot be undone."
      />

      <PasswordDialog
        isOpen={state.type === "PASSWORD_SYNC"}
        onCancel={() => dispatch({ type: "BACK_TO_IDLE" })}
        onConfirm={handleSyncWithPassword} // Probably need a dispatch here too.
        title="Enter Encryption Password"
        message="Please enter the password to encrypt your data for Dropbox."
      />

      <PasswordDialog
        isOpen={state.type === "PASSWORD_RESTORE"}
        onCancel={() => dispatch({ type: "BACK_TO_IDLE" })}
        onConfirm={handleRestoreWithPassword} // Probably need a dispatch here too.
        title="Enter Decryption Password"
        message="Please enter the password to decrypt your data from Dropbox."
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
