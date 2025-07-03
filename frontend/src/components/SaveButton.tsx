import { motion, AnimatePresence } from "framer-motion";
import CheckmarkIcon from "../assets/icons/checkmark.svg?react";
import ErrorIcon from "../assets/icons/error.svg?react";
import clsx from "clsx";

interface SaveButtonProps {
  status: "idle" | "saving" | "saved" | "error";
  onClick: () => void;
  className?: string;
}

export default function SaveButton({
  status,
  onClick,
  className = "",
}: SaveButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={status === "saving"}
      className={clsx(
        "px-4 py-2 rounded flex items-center justify-center min-w-[100px]",
        {
          "bg-green-600 hover:bg-green-700 disabled:bg-green-400":
            status !== "error",
          "bg-red-600 hover:bg-red-700 disabled:bg-red-400": status === "error",
        },
        className
      )}
    >
      <AnimatePresence mode="wait">
        {status === "idle" && (
          <motion.span
            key="save"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            Save
          </motion.span>
        )}
        {status === "saving" && (
          <motion.span
            key="saving"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center"
          >
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
            />
            Saving...
          </motion.span>
        )}
        {status === "saved" && (
          <motion.span
            key="saved"
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { delay: 0.1 },
            }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center"
          >
            <motion.span
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3 }}
            >
              <CheckmarkIcon className="w-4 h-4 mr-1.5" />
            </motion.span>
            Saved!
          </motion.span>
        )}
        {status === "error" && (
          <motion.span
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center"
          >
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            >
              <ErrorIcon className="w-4 h-4 mr-1.5" />
            </motion.span>
            Error!
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
