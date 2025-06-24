import React from "react";

interface ProgressBarProps {
  title: string;
  current: number;
  max: number;
  unit: string;
  completedColor: string;
  remainingColor: string;
  onRightClick: (e: React.MouseEvent) => void;
  onIncrement: () => void;
  onCustomValueChange?: (value: number) => void;
}

export default function ProgressBar({
  title,
  current,
  max,
  unit,
  completedColor,
  remainingColor,
  onRightClick,
  onIncrement,
  onCustomValueChange,
}: ProgressBarProps) {
  const progress = Math.max(0, Math.min(100, (100 * current) / max));

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
