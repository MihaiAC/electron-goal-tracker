import React from "react";
import Dialog from "./Dialog";
import { Button } from "../Button";
import { Loader2 } from "lucide-react";

interface SyncingDialogProps {
  isOpen: boolean;
  message?: string;
  onCancel?: () => void;
}

export function SyncingDialog({
  isOpen,
  message,
  onCancel,
}: SyncingDialogProps) {
  // TODO: Why on earth do I accept a prop rather than just not rendering it in the first place?
  if (isOpen === false) {
    return null;
  }

  return (
    <Dialog isOpen={isOpen}>
      <div className="p-8 text-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-white animate-spin stroke-3" />
          <p className="text-lg">{message ?? "Working..."}</p>
          {onCancel !== undefined ? (
            <Button
              tailwindColors="bg-transparent hover:bg-white/10 text-white border-2 border-white"
              onClick={onCancel}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
