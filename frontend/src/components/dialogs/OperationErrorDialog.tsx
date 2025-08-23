import React from "react";
import Dialog from "./Dialog";
import { Button } from "../Button";
import { ErrorIcon } from "../Icons";

interface OperationErrorDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  code?: string;
  onClose: () => void;
}

export default function OperationErrorDialog({
  isOpen,
  title = "Something went wrong",
  message,
  code,
  onClose,
}: OperationErrorDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <div className="p-8 text-center space-y-4">
        <div className="flex flex-col items-center space-y-2">
          <ErrorIcon />
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-lg">{message}</p>
          {code && <p className="text-sm text-gray-400">Code: {code}</p>}
        </div>
        <div className="flex justify-center">
          <Button
            onClick={onClose}
            tailwindColors="bg-red-500 hover:bg-red-700 text-white"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
