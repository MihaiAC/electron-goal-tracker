import React from "react";

interface ProgressBarProps {
  progress: number;
}

function ProgressBar({ progress }: ProgressBarProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  return (
    <div className="w-full bg-red-200 rounded-full h-6 dark:bg-red-700">
      <div
        className="bg-green-600 h-6 rounded-full text-center text-white font-bold text-sm flex items-center justify-center transition-all duration-300 ease-out"
        style={{ width: `${clampedProgress}%` }}
      >
        {`${clampedProgress}%`}
      </div>
    </div>
  );
}

export default ProgressBar;
