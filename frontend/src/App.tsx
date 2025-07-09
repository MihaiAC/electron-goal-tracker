import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import WindowControls from "./components/WindowControls";
import BarSettings from "./components/BarSettings";
import SortableProgressBar from "./components/SortableProgressBar";
import SaveButton from "./components/SaveButton";
import type { ProgressBarData } from "../../types/shared";
import type { SaveStatus } from "./types";

function App() {
  // Track save status for animations.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const [bars, setBars] = useState<ProgressBarData[]>(() => {
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

  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedData = await window.api.loadData();
        if (savedData?.bars) {
          setBars(savedData.bars);
        }
      } catch (error) {
        console.error("Failed to load saved data", error);
      }
    };

    loadSavedData();
  }, []);

  const [editingBarId, setEditingBarId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setBars((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

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

  const handleSaveBar = (updates: Partial<ProgressBarData>) => {
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
    const newBar: ProgressBarData = {
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

  const handleSave = async () => {
    setSaveStatus("saving");

    try {
      await window.api.saveData({ bars });
      setSaveStatus("saved");
    } catch (error) {
      console.error("Save failed:", error);
      setSaveStatus("error");
    }

    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  const editingBar = bars.find((bar) => bar.id === editingBarId);

  // Trigger a save before the window closes.
  useEffect(() => {
    const handleBeforeUnload = () => {
      window.api.saveData({ bars }).catch(console.error);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [bars]);

  // TODO: button Tailwind class or React component
  // TODO: Too much things are happening here - modularise it.
  return (
    <div className="h-full text-white">
      <header className="titlebar">
        <span className="text-xs font-bold text-gray-400 pl-3">
          Progress Bars
        </span>
        <WindowControls />
      </header>

      <main className="flex flex-col items-center h-full my-16">
        <div className="w-3/4 space-y-16">
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

        <SaveButton
          status={saveStatus}
          onClick={handleSave}
          className="mt-8 ml-4"
        />
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
