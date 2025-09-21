import React from "react";
import clsx from "clsx";
import type { ProgressBarData } from "../../../types/shared";
import { getPatternUrl, DEFAULT_PATTERN_COLOR } from "../utils/patterns";

interface ProgressBarProps {
  bar: Omit<ProgressBarData, "id">;
}

export default function ProgressBar({
  bar: {
    title,
    current,
    max,
    unit,
    completedColor,
    remainingColor,
    patternId,
    patternColorHex,
  },
}: ProgressBarProps) {
  const progress = Math.max(0, Math.min(100, (100 * current) / max));
  const isComplete = current >= max;

  // Get pattern URL if a pattern is specified
  const patternUrl = patternId
    ? getPatternUrl(patternId, patternColorHex || DEFAULT_PATTERN_COLOR)
    : "";

  return (
    <div className="flex flex-col space-y-3">
      <h3 className="text-center">{title}</h3>
      <div
        className={clsx(
          "w-full h-8 rounded-xl overflow-hidden",
          isComplete && "gold-glow"
        )}
        style={{
          backgroundColor: remainingColor,
        }}
      >
        <div
          className={clsx(
            "h-8 rounded-xl transition-all duration-500",
            isComplete && "complete-progress"
          )}
          style={{
            width: `${progress}%`,
            background: isComplete
              ? undefined
              : patternUrl
                ? `${patternUrl}, ${completedColor}`
                : completedColor,
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
