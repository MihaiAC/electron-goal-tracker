import React from "react";
import Dialog from "./Dialog";
import { SpinnerIcon } from "../Icons";

interface SyncingDialogProps {
  isOpen: boolean;
  message?: string;
}

export function SyncingDialog({ isOpen, message }: SyncingDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen}>
      <div className="p-8 text-center">
        <div className="flex flex-col items-center">
          <SpinnerIcon />
          <p className="text-lg">{message ?? "Working..."}</p>
        </div>
      </div>
    </Dialog>
  );
}
