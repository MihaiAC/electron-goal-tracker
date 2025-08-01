import React from "react";
import Dialog from "./Dialog";
import { SpinnerIcon } from "../Icons";

interface SyncingDialogProps {
  isOpen: boolean;
}

export default function SyncingDialog({ isOpen }: SyncingDialogProps) {
  return (
    <Dialog isOpen={isOpen}>
      <div className="flex flex-col items-center justify-center space-y-4">
        <SpinnerIcon />
        <p className="text-lg">Syncing...</p>
      </div>
    </Dialog>
  );
}
