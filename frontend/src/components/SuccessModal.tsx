import Modal from "react-modal";
import type { ProgressBarData } from "../../../types/shared";
import { Button } from "./Button";
import ReactConfetti from "react-confetti";
import { getSoundManager } from "../sound/soundManager";
import { useEffect, useState } from "react";

// Array of success messages to display randomly
const SUCCESS_MESSAGES = [
  "Good job, champ!",
  "Let's gooooo!",
  "Completing this task fills you with determination.",
  "One goal to rule them all!",
  "May the force be with... your next goal!",
  "Victory!",
  "戦え！",
];

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
  const soundManager = getSoundManager();
  const [successMessage, setSuccessMessage] = useState<string>("");

  const handleRequestClose = () => {
    soundManager.stopAll();
    onRequestClose();
  };

  // Track window size to keep confetti canvas in sync with resizes.
  const [windowSize, setWindowSize] = useState<{
    width: number;
    height: number;
  }>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Select a random success message when the modal opens
  useEffect(() => {
    if (isOpen) {
      const randomIndex = Math.floor(Math.random() * SUCCESS_MESSAGES.length);
      setSuccessMessage(SUCCESS_MESSAGES[randomIndex]);
    }
  }, [isOpen]);

  return (
    <>
      <ReactConfetti
        width={windowSize.width}
        height={windowSize.height}
        recycle={true}
        run={isOpen}
        className="confetti-overlay"
      />
      <Modal
        isOpen={isOpen}
        ariaHideApp={false}
        appElement={document.getElementById("root") as HTMLElement}
        shouldCloseOnOverlayClick={true}
        onRequestClose={handleRequestClose}
        className="relative z-50 panel-base p-6 w-full max-w-md mx-auto mt-40 shadow-lg outline-none flex flex-col items-center space-y-2"
        overlayClassName="overlay-dim z-40 items-start"
      >
        <h1 className="font-bold text-2xl">Congratulations!</h1>
        <h2 className="font-bold text-xl">"{barData.title}" complete!</h2>
        <h3 className="text-lg">
          {barData.max} / {barData.max}
        </h3>
        <h4 className="font-thin">Placeholder for a short stats sentence</h4>

        <Button onClick={handleRequestClose} variant="primary">
          {successMessage}
        </Button>
      </Modal>
    </>
  );
}
