import React from "react";
import Dialog from "./Dialog";
import { SpinnerIcon, CheckmarkIcon } from "../Icons";

interface SyncingDialogProps {
  isOpen: boolean;
  isSuccess: boolean;
}

export function SyncingDialog({ isOpen, isSuccess }: SyncingDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen}>
      <div className="p-8 text-center">
        {isSuccess ? (
          <div className="flex flex-col items-center">
            <CheckmarkIcon />
            <p className="text-lg">Sync Successful!</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <SpinnerIcon />
            <p className="text-lg">Syncing with Google Drive...</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
