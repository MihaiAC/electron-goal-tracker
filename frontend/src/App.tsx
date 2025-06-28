import { useState } from "react";
// --- DND-KIT IMPORTS START ---
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
// Import types separately with the `type` keyword
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
// --- DND-KIT IMPORTS END ---

import WindowControls from "./components/WindowControls";
// REMOVE THIS IMPORT: import ProgressBar from "./components/ProgressBar";
import BarSettings from "./components/BarSettings";
import SortableProgressBar from "./components/SortableProgressBar"; // Import the new wrapper

// Keep your Bar interface
interface Bar {
  id: string;
  title: string;
  current: number;
  max: number;
  incrementDelta: number;
  unit: string;
  completedColor: string;
  remainingColor: string;
}

function App() {
  const [bars, setBars] = useState<Bar[]>(() => {
    // Let's add a second bar for easier testing of drag-and-drop
    return [
      {
        id: "1",
        title: "Weight Loss",
        current: 25,
        max: 100,
        unit: "lbs",
        incrementDelta: 1,
        completedColor: "#10B981",
        remainingColor: "#374151",
      },
      {
        id: "2",
        title: "Read Books",
        current: 5,
        max: 20,
        unit: "books",
        incrementDelta: 1,
        completedColor: "#3B82F6",
        remainingColor: "#374151",
      },
    ];
  });

  const [editingBarId, setEditingBarId] = useState<string | null>(null);

  // --- DND-KIT SENSORS AND HANDLER START ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBars((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }
  // --- DND-KIT SENSORS AND HANDLER END ---

  const onIncrement = (id: string) => {
    setBars((prevBars) =>
      prevBars.map((bar) =>
        bar.id === id
          ? {
              ...bar,
              current: Math.min(bar.current + bar.incrementDelta, bar.max),
            }
          : bar
      )
    );
  };

  const handleSaveBar = (updates: Partial<Bar>) => {
    if (!editingBarId) return;
    setBars((prevBars) =>
      prevBars.map((bar) =>
        bar.id === editingBarId ? { ...bar, ...updates } : bar
      )
    );
    setEditingBarId(null);
  };

  const handleDeleteBar = () => {
    if (!editingBarId) return;
    setBars((prevBars) => prevBars.filter((bar) => bar.id !== editingBarId));
    setEditingBarId(null);
  };

  const addNewBar = () => {
    const newBar: Bar = {
      id: Date.now().toString(),
      title: `Progress ${bars.length + 1}`,
      current: 0,
      max: 100,
      unit: "units",
      incrementDelta: 1,
      completedColor: "#555555",
      remainingColor: "#374151",
    };
    setBars((prev) => [...prev, newBar]);
    setEditingBarId(newBar.id);
  };

  const editingBar = bars.find((bar) => bar.id === editingBarId);

  return (
    <div className="h-full text-white">
      <header className="titlebar">
        <span className="text-xs font-bold text-gray-400 pl-3">
          Progress Bars
        </span>
        <WindowControls />
      </header>

      <main className="flex flex-col items-center h-full my-16">
        <div className="w-3/4 space-y-4">
          {" "}
          {/* Added space-y-4 for margin between bars */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={bars.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {bars.map((bar) => (
                // Use the new SortableProgressBar component here
                <SortableProgressBar
                  key={bar.id}
                  bar={bar}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setEditingBarId(bar.id);
                  }}
                  onIncrement={() => onIncrement(bar.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
        <button
          onClick={addNewBar}
          className="mt-8 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700" // Added margin top
        >
          + Add New Bar
        </button>
      </main>

      {editingBar && (
        <BarSettings
          bar={editingBar}
          onSave={handleSaveBar}
          onDelete={handleDeleteBar}
          onClose={() => setEditingBarId(null)}
        />
      )}
    </div>
  );
}

export default App;
