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
  onDecrement: () => void;
  className?: string;
}

export default function SortableProgressBar({
  bar,
  onContextMenu,
  onIncrement,
  onDecrement,
  className = "",
}: SortableProgressBarProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [isComplete, setIsComplete] = useState(bar.current === bar.max);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverSide, setHoverSide] = useState<"left" | "right" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!contentRef.current) return;
    const rect = contentRef.current.getBoundingClientRect();
    const xCoord = e.clientX - rect.left;
    setHoverSide(xCoord > rect.width / 2 ? "right" : "left");
  };

  const handleClick = () => {
    if (hoverSide === "right") {
      onIncrement();
    } else if (hoverSide === "left") {
      onDecrement();
    }
  };

  const content = (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition || undefined,
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 10 : 0,
      }}
      className={clsx(
        "flex items-center rounded-lg p-4",
        isComplete && "golden-pattern completed",
        isHovered &&
          hoverSide === "right" &&
          "shadow-[0_0_20px_5px_rgba(132,204,22,0.6)] transition-shadow duration-100",
        isHovered &&
          hoverSide === "left" &&
          "shadow-[0_0_20px_5px_rgba(234,88,12,0.6)] transition-shadow duration-100",
        className
      )}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoverSide(null);
      }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      <div ref={contentRef} className="relative z-10 w-full flex items-center">
        <div
          {...attributes}
          {...listeners}
          className="p-2 cursor-grab touch-none self-stretch flex items-center"
        >
          <GripVerticalIcon className="w-6 h-6 text-gray-500" />
        </div>

        <div className="flex-1 pr-2">
          <ProgressBar
            bar={bar}
            onRightClick={onContextMenu}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
          />
        </div>
      </div>
    </div>
  );

  if (!showConfetti) return content;

  return (
    <div ref={containerRef} className="relative w-full">
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
