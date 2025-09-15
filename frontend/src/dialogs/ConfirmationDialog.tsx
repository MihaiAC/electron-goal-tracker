import React from "react";
import Dialog from "./Dialog";
import { Button } from "../ui/Button";

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
        <div className="flex justify-center space-x-4">
          <Button onClick={onConfirm} variant="primary">
            Confirm
          </Button>
          <Button onClick={onCancel} variant="destructive">
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
