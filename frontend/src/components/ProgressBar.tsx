import React from "react";
import clsx from "clsx";
import type { ProgressBarData } from "../../../types/shared";

interface ProgressBarProps {
  bar: Omit<ProgressBarData, "id">;
  onRightClick: (e: React.MouseEvent) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  onCustomValueChange?: (value: number) => void;
}

export default function ProgressBar({
  bar: { title, current, max, unit, completedColor, remainingColor },
  onRightClick,
  onIncrement,
  onDecrement,
  onCustomValueChange,
}: ProgressBarProps) {
  const progress = Math.max(0, Math.min(100, (100 * current) / max));
  const isComplete = current >= max;

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xCoord = e.clientX - rect.left;

    if (xCoord > rect.width / 2) {
      onIncrement();
    } else {
      onDecrement();
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <h3 className="text-center">{title}</h3>
      <div
        className={`w-full h-6 rounded-xl overflow-hidden ${
          isComplete ? "shadow-md shadow-amber-200/30" : ""
        }`}
        style={{
          backgroundColor: remainingColor,
        }}
        onClick={handleClick}
      >
        <div
          className={clsx(
            "h-6 rounded-xl transition-all duration-500",
            isComplete && "complete-progress"
          )}
          style={{
            width: `${progress}%`,
            background: isComplete
              ? undefined
              : `linear-gradient(to right, ${completedColor}, ${completedColor})`,
          }}
        ></div>
      </div>
      <div className="flex flex-col items-center">
        <span className="">
          {current} {unit} - {progress.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
