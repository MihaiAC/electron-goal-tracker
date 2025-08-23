import React from "react";
import Dialog from "./Dialog";
import { Button } from "../Button";
import { CheckmarkIcon } from "../Icons";

interface OperationSuccessDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

export default function OperationSuccessDialog({
  isOpen,
  title = "Success",
  message,
  onClose,
}: OperationSuccessDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose}>
      <div className="p-8 text-center space-y-4">
        <div className="flex flex-col items-center space-y-2">
          <CheckmarkIcon />
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-lg">{message}</p>
        </div>
        <div className="flex justify-center">
          <Button
            onClick={onClose}
            tailwindColors="bg-green-500 hover:bg-green-700 text-white"
          >
            Ok
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
