import React from "react";
import Dialog from "./Dialog";
import { Button } from "../Button";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export default function ConfirmationDialog({
  isOpen,
  onCancel,
  onConfirm,
  title,
  message,
}: ConfirmationDialogProps) {
  return (
    <Dialog isOpen={isOpen} onClose={onCancel}>
      <div className="space-y-4">
        <h3 className="text-xl font-bold">{title}</h3>
        <p>{message}</p>
        <div className="flex justify-end space-x-4">
          <Button
            onClick={onCancel}
            tailwindColors="bg-red-500 hover:bg-red-700 text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            tailwindColors="bg-green-500 hover:bg-green-700 text-white"
          >
            Confirm
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
