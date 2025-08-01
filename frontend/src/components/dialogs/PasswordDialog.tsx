import React, { useState } from "react";
import Dialog from "./Dialog";
import { Button } from "../Button";

interface PasswordDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (password: string) => void;
  title: string;
  message: string;
}

export default function PasswordDialog({
  isOpen,
  onCancel,
  onConfirm,
  title,
  message,
}: PasswordDialogProps) {
  const [password, setPassword] = useState("");

  const handleConfirm = () => {
    onConfirm(password);
    setPassword("");
  };

  return (
    <Dialog isOpen={isOpen} onClose={onCancel}>
      <div className="space-y-4">
        <h3 className="text-xl font-bold">{title}</h3>
        <p>{message}</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-gray-700 text-white rounded-md p-2 w-full"
          placeholder="Enter password"
        />
        <div className="flex justify-end space-x-4">
          <Button
            onClick={onCancel}
            tailwindColors="text-red-500 hover:text-red-700 text-white"
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </div>
      </div>
    </Dialog>
  );
}
