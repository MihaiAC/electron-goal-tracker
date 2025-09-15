import React from "react";
import { createPortal } from "react-dom";
import { Button } from "../Button";
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
    <div className="overlay-dim z-50" onClick={() => onClose()}>
      <div
        className="panel-base p-6 w-full max-w-lg"
        onClick={(mouseEvent) => {
          mouseEvent.stopPropagation();
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Help</h2>
          <Button variant="close" onClick={() => onClose()}>
            <X className="close-icon" />
          </Button>
        </div>

        <div className="space-y-3 text-sm">
          <p className="text-subtle">
            Quick tips for interacting with progress bars:
          </p>
          <ul className="list-disc list-inside space-y-1 text-subtle">
            <li>Increment progress: click the right half of a progress bar.</li>
            <li>Decrement progress: click the left half of a progress bar.</li>
            <li>Open bar settings: right-click anywhere on a bar.</li>
          </ul>
        </div>

        <div className="text-sm text-subtle pt-4">
          <p>
            Syncing is either done manually, or automatically when you close the
            app.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
