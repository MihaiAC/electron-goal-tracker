import Modal from "react-modal";
import type { ProgressBarData } from "../../../types/shared";
import { Button } from "./Button";
import ReactConfetti from "react-confetti";

interface SuccessModalProps {
  barData: ProgressBarData;
  isOpen: boolean;
  onRequestClose: () => void;
}

export function SuccessModal({
  isOpen,
  barData,
  onRequestClose,
}: SuccessModalProps) {
  // TODO: Add custom uplifting dismiss messages + congratulations messages.
  // TODO: Add completion stats? Completed after x days. Created on...
  // TODO: Add the golden experience mission success soundbite (it was a minified, slightly muted version of the main theme).
  return (
    <ReactConfetti className="flex flex-col">
      <Modal
        isOpen={isOpen}
        ariaHideApp={false}
        appElement={document.getElementById("root") as HTMLElement}
        shouldCloseOnOverlayClick={true}
        className="relative z-50 bg-black text-white rounded-2xl p-6 w-full max-w-md mx-auto mt-40 shadow-lg outline-none flex flex-col items-center space-y-2"
        overlayClassName="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex justify-center items-start"
      >
        <h1 className="font-bold text-2xl">Congratulations!</h1>
        <h2 className="font-bold text-xl">"{barData.title}" complete!</h2>
        <h3 className="text-lg">
          {barData.max} / {barData.max}
        </h3>
        <h4 className="font-thin">Placeholder for a short stats sentence</h4>

        <Button
          onClick={onRequestClose}
          tailwindColors="bg-lime-500 hover:bg-lime-600 text-black"
        >
          Let's goooooo!
        </Button>
      </Modal>
    </ReactConfetti>
  );
}
