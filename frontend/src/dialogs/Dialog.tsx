import React from "react";
import clsx from "clsx";

interface DialogProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  overlayClassName?: string;
  containerClassName?: string;
}

export default function Dialog({
  isOpen,
  onClose,
  children,
  overlayClassName = "",
  containerClassName = "",
}: DialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className={clsx("overlay-dim z-[60]", overlayClassName)}
      onClick={onClose}
    >
      <div
        className={clsx("panel-base p-6 w-full max-w-sm", containerClassName)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
