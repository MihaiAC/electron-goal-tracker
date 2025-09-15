import React from "react";
import Dialog from "./Dialog";
import { Button } from "../ui/Button";
import { CircleX } from "lucide-react";

interface OperationErrorDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  code?: string;
  status?: number;
  onClose: () => void;
}

export default function OperationErrorDialog({
  isOpen,
  title = "Something went wrong",
  message,
  code,
  status,
  onClose,
}: OperationErrorDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <div className="p-8 text-center space-y-4">
        <div className="flex flex-col items-center space-y-2">
          <CircleX className="h-12 w-12 icon-error stroke-2" />
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-lg">{message}</p>
          {code && <p className="text-sm text-muted">Code: {code}</p>}
          {typeof status === "number" ? (
            <p className="text-sm text-muted">HTTP Status: {status}</p>
          ) : null}
        </div>
        <div className="flex justify-center">
          <Button onClick={onClose} variant="destructive">
            Dismiss
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
