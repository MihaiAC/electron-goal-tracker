import { useState, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ProgressBar from "./ProgressBar";
import clsx from "clsx";
import GripVerticalIcon from "../assets/icons/grip-vertical.svg?react";
import type { ProgressBarData } from "../../../types/shared";
import ReactConfetti from "react-confetti";

interface SortableProgressBarProps {
  bar: ProgressBarData;
  onContextMenu: (e: React.MouseEvent) => void;
  onIncrement: () => void;
}

export default function SortableProgressBar({
  bar,
  onContextMenu,
  onIncrement,
}: SortableProgressBarProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [isComplete, setIsComplete] = useState(bar.current === bar.max);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bar.id });

  useEffect(() => {
    if (bar.current === bar.max) {
      setIsComplete(true);
      setShowConfetti(true);
    } else if (isComplete) {
      setIsComplete(false);
    }
  }, [bar.current, bar.max, isComplete]);

  const content = (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 10 : 0,
      }}
      className={clsx(
        "flex items-center p-2 rounded-lg relative",
        isComplete && "golden-pattern completed"
      )}
      onContextMenu={onContextMenu}
    >
      <div className="relative z-10 w-full">
        <div
          {...attributes}
          {...listeners}
          className="p-2 cursor-grab touch-none absolute left-0 top-1/2 -translate-y-1/2"
        >
          <GripVerticalIcon className="w-6 h-6 text-gray-500" />
        </div>
        <div className="pl-10">
          <ProgressBar
            bar={bar}
            onRightClick={onContextMenu}
            onIncrement={onIncrement}
          />
        </div>
      </div>
    </div>
  );

  if (!showConfetti) return content;

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <ReactConfetti
        width={containerRef.current?.offsetWidth}
        height={containerRef.current?.offsetHeight}
        run={true}
        recycle={true}
        numberOfPieces={30}
        colors={["#FFD700", "#FFC000", "#FFA500"]}
        gravity={0.05}
        initialVelocityY={0.05}
        confettiSource={{
          w: containerRef.current?.offsetWidth || 0,
          h: containerRef.current?.offsetHeight || 0,
          x: 0,
          y: 0,
        }}
        className="absolute inset-0"
        style={{ pointerEvents: "none", zIndex: 20 }}
      />
      {content}
    </div>
  );
}
