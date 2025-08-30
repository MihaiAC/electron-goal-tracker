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
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
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
import type { ProgressBarData, SoundEventId } from "../../types/shared";
import type { SaveStatus } from "./types";
import { SuccessModal } from "./components/SuccessModal";
import { Button } from "./components/Button";
import SettingsRoot from "./components/settings/SettingsRoot";
import { useUiSounds } from "./hooks/useUiSounds";
import { getSoundManager } from "./sound/soundManager";

function App() {
  // Track save status for animations.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Success modal when a progress bar is completed.
  const [successModalBarId, setSuccessModalBarId] = useState<string | null>(
    null
  );

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

  // UI sounds: only wire increment/decrement/complete for now (no button click)
  const {
    playProgressIncrementSound,
    playProgressDecrementSound,
    playProgressCompleteSound,
  } = useUiSounds();

  const onIncrement = (id: string, sign: number = 1) => {
    // Play increment/decrement sound immediately; precedence handled in manager
    if (sign > 0) {
      playProgressIncrementSound();
    } else {
      playProgressDecrementSound();
    }
    setBars((prevBars) => {
      const updatedBars = prevBars.map((bar) =>
        bar.id === id
          ? {
              ...bar,
              current:
                sign > 0
                  ? Math.min(bar.current + bar.incrementDelta, bar.max)
                  : Math.max(bar.current - bar.incrementDelta, 0),
            }
          : bar
      );

      // Check if the bar was just completed
      const updatedBar = updatedBars.find((bar) => bar.id === id);
      if (updatedBar && updatedBar.current === updatedBar.max) {
        // Play completion sound
        playProgressCompleteSound();
        setSuccessModalBarId(id);
      }

      return updatedBars;
    });
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

  const handleRestoreData = (restoredBars: ProgressBarData[]) => {
    setBars(restoredBars);
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

  // Seed UI sounds from saved preferences on app startup so sounds work immediately.
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const savedData = await window.api.loadData();
        const savedPreferences = savedData?.sounds?.preferences;

        if (isMounted) {
          if (savedPreferences && typeof savedPreferences === "object") {
            const soundManager = getSoundManager();

            if (typeof savedPreferences.masterVolume === "number") {
              soundManager.setMasterVolume(savedPreferences.masterVolume);
            }

            if (typeof savedPreferences.muteAll === "boolean") {
              soundManager.setMuteAll(savedPreferences.muteAll);
            }

            const eventIds: SoundEventId[] = [
              "progressIncrement",
              "progressDecrement",
              "progressComplete",
            ];

            for (const eventId of eventIds) {
              const fileRef = savedPreferences.eventFiles?.[eventId];
              if (typeof fileRef === "string" && fileRef.length > 0) {
                soundManager.setSoundFileForEvent(eventId, fileRef);
              }
            }
          }
        }
      } catch {
        // Ignore errors; sounds remain at defaults if any
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

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

  // TODO: Too many things are happening here - modularise it.
  // TODO: Maybe add state management library.
  // TODO: Maybe add progress histories (or ++ extensions).
  return (
    <div className="app-container">
      <header className="titlebar">
        <span className="text-xs font-bold text-gray-400 pl-3">
          Progress Bars
        </span>
        <WindowControls />
      </header>
      <div className="content-container">
        <main className="flex flex-col items-center h-full my-16 space-y-8">
          <div className="w-3/4 space-y-16">
            {" "}
            {/* Added space-y-4 for margin between bars */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={bars.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {bars.map((bar) => (
                  <SortableProgressBar
                    key={bar.id}
                    bar={bar}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setEditingBarId(bar.id);
                    }}
                    onIncrement={() => onIncrement(bar.id, 1)}
                    onDecrement={() => onIncrement(bar.id, -1)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <Button
            onClick={addNewBar}
            tailwindColors="bg-lime-500 hover:bg-lime-700 text-black"
          >
            + Add new bar
          </Button>

          <SaveButton status={saveStatus} onClick={handleSave} />

          <SettingsRoot onDataRestored={handleRestoreData} currentBars={bars} />
        </main>
      </div>

      {/* Settings UI (drawer + modals) */}

      {editingBar && (
        <BarSettings
          bar={editingBar}
          onSave={handleSaveBar}
          onDelete={handleDeleteBar}
          onClose={() => setEditingBarId(null)}
        />
      )}

      {successModalBarId && (
        <SuccessModal
          barData={bars.find((bar) => bar.id === successModalBarId)!}
          isOpen={successModalBarId !== null}
          onRequestClose={() => setSuccessModalBarId(null)}
        />
      )}
    </div>
  );
}

export default App;
