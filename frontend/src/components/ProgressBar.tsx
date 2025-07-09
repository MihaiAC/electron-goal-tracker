import React from "react";
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

  // TODO: On completion, need to display: Congratulations max / max unit! + dismiss bar button but do not remove right click listener.
  // TODO: Extension: stats for each progress bar -> how many days it took.
  return (
    <div className="flex flex-col space-y-2">
      <h3 className="text-center">{title}</h3>
      <div
        className="w-full h-6 rounded-xl overflow-hidden"
        style={{
          backgroundColor: remainingColor,
        }}
        onClick={onIncrement}
      >
        <div
          className="h-6 rounded-xl"
          style={{
            width: `${progress}%`,
            backgroundColor: completedColor,
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
