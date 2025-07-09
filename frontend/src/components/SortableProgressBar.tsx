import React, { useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ProgressBar from "./ProgressBar";

// Import the SVG as a React component.
// The `{ ReactComponent as GripVerticalIcon }` syntax is provided by svgr.
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
  console.log("GripVerticalIcon imported as:", GripVerticalIcon);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: bar.id });

  const [completed, setCompleted] = useState(bar.current === bar.max);

  useEffect(() => {
    if (bar.current === bar.max) {
      setCompleted(true);
    } else if (completed) {
      setCompleted(false);
    }
  }, [bar.current]);

  // TODO: Why is this here :/
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 10 : 0,
    boxShadow: isDragging
      ? "0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)"
      : "none",
  };

  // TODO: The confetti should be on the main window, when any bar gets completed.
  if (completed) {
    return (
      <div className="relative">
        <ReactConfetti numberOfPieces={200} recycle={false}></ReactConfetti>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center p-2 rounded-lg"
      onContextMenu={onContextMenu}
    >
      <div
        {...attributes}
        {...listeners}
        className="p-2 cursor-grab touch-none"
      >
        <GripVerticalIcon className="w-6 h-6 text-gray-500" />
      </div>

      <div className="flex-grow">
        <ProgressBar
          bar={bar}
          onRightClick={onContextMenu}
          onIncrement={onIncrement}
        />
      </div>
    </div>
  );
}
