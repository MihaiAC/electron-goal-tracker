import React from "react";
import Dialog from "./Dialog";
import { Button } from "../ui/Button";
import { CircleCheck } from "lucide-react";

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
          <CircleCheck className="h-12 w-12 icon-success stroke-2" />
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-lg">{message}</p>
        </div>
        <div className="flex justify-center">
          <Button onClick={onClose} variant="primary">
            Ok
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
