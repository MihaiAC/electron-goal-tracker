import Modal from "react-modal";
import type { ProgressBarData } from "../../../types/shared";

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
  return (
    <Modal
      isOpen={isOpen}
      ariaHideApp={false}
      appElement={document.getElementById("root") as HTMLElement}
      shouldCloseOnOverlayClick={true}
      className="relative z-50 bg-white rounded-xl p-6 w-full max-w-md mx-auto mt-40 shadow-lg outline-none"
      overlayClassName="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex justify-center items-start"
    >
      <h1>
        {barData.title} {barData.unit} YAY!
      </h1>
      <button onClick={onRequestClose}>Click me to dismiss me</button>
    </Modal>
  );
}
