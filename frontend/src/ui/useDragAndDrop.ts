import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

/**
 * Hook for drag and drop functionality
 * @param onDragEnd Callback function when drag ends
 * @returns DnD sensors and handler
 */
export function useDragAndDrop(
  onDragEnd: (active: string, over: string) => void
) {
  // Initialize sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Handle drag end event
   * @param event Drag end event
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      onDragEnd(active.id.toString(), over.id.toString());
    }
  };

  return {
    sensors,
    handleDragEnd,
  };
}
