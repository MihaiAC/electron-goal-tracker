import React from "react";
import Dialog from "./Dialog";
import { Button } from "../ui/Button";
import { Loader2 } from "lucide-react";

interface SyncingDialogProps {
  message?: string;
  onCancel?: () => void;
}

export function SyncingDialog({ message, onCancel }: SyncingDialogProps) {
  return (
    <Dialog isOpen={true}>
      <div className="p-8 text-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="loader-icon h-8 w-8 stroke-3" />
          <p className="text-lg">{message ?? "Working..."}</p>
          {onCancel !== undefined ? (
            <Button variant="destructive" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
