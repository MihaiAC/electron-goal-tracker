import React from "react";
import clsx from "clsx";
import type { ProgressBarData } from "../../../types/shared";

interface ProgressBarProps {
  bar: Omit<ProgressBarData, "id">;
  onRightClick: (e: React.MouseEvent) => void;
  onIncrement: () => void;
  onCustomValueChange?: (value: number) => void;
}

export default function ProgressBar({
  bar: { title, current, max, unit, completedColor, remainingColor },
  onRightClick,
  onIncrement,
  onCustomValueChange,
}: ProgressBarProps) {
  const progress = Math.max(0, Math.min(100, (100 * current) / max));
  const isComplete = current >= max;

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
        onClick={onIncrement}
      >
        <div
          className={clsx(
            "h-6 rounded-xl transition-all duration-500",
            isComplete && "complete-progress"
          )}
          style={{
            width: `${progress}%`,
            backgroundColor: isComplete ? undefined : completedColor,
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
