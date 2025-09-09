import React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * HelpModal displays basic usage instructions for progress bars.
 * - Close by clicking the overlay or the close button.
 * - Content is intentionally simple and uninteractive.
 */
export default function HelpModal(props: HelpModalProps) {
  const { open, onClose } = props;

  if (open === false) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => onClose()}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-full max-w-lg text-gray-100"
        onClick={(mouseEvent) => {
          mouseEvent.stopPropagation();
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Help</h2>
          <button
            type="button"
            onClick={() => onClose()}
            className="titlebar-button hover:bg-red-500 border-2 border-white hover:border-red-500"
          >
            <X className="close-icon" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <p className="text-gray-300">
            Quick tips for interacting with progress bars:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-300">
            <li>Increment progress: click the right half of a progress bar.</li>
            <li>Decrement progress: click the left half of a progress bar.</li>
            <li>Open bar settings: right-click anywhere on a bar.</li>
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
}
