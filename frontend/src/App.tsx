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
import { Button } from "./components/Button";
import SettingsRoot from "./components/settings/SettingsRoot";
import { useUiSounds } from "./hooks/useUiSounds";
import { getSoundManager } from "./sound/soundManager";
import { SuccessModal } from "./components/SuccessModal";
import type { ProgressBarData } from "../../types/shared";
import { applyTheme, DEFAULT_THEME } from "./utils/theme";

// TODO: Do a QA pass on the UI/UX.
// TODO: Too many things are happening here - modularise it.
function App() {
  // Success modal when a progress bar is completed.
  const [successModalBarId, setSuccessModalBarId] = useState<string | null>(
    null
  );

  const [bars, setBars] = useState<ProgressBarData[]>(() => {
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
        incrementHoverGlowHex: "#84cc16",
        decrementHoverGlowHex: "#ea580c",
        createdAt: new Date().toISOString(),
        notes: [],
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
        incrementHoverGlowHex: "#84cc16",
        decrementHoverGlowHex: "#ea580c",
        createdAt: new Date().toISOString(),
        notes: [],
      },
    ];
  });

  /**
   * Flag to prevent autosave from overwriting disk data before initial load completes
   */
  const [hasLoadedFromDisk, setHasLoadedFromDisk] = useState<boolean>(false);

  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedData = await window.api.loadData();
        if (savedData?.bars) {
          const normalizedBars = savedData.bars.map((barFromDisk) => {
            const createdAt =
              typeof barFromDisk.createdAt === "string" &&
              barFromDisk.createdAt.length > 0
                ? barFromDisk.createdAt
                : new Date().toISOString();
            const notes = Array.isArray(barFromDisk.notes)
              ? barFromDisk.notes
              : [];
            const normalizedBar: ProgressBarData = {
              ...barFromDisk,
              createdAt,
              notes,
            };
            return normalizedBar;
          });
          setBars(normalizedBars);
        }
        /**
         * Apply saved theme or default theme at startup
         */
        if (savedData && savedData.theme) {
          applyTheme(savedData.theme);
        } else {
          applyTheme(DEFAULT_THEME);
        }
      } catch (error) {
        console.error("Failed to load saved data", error);
        applyTheme(DEFAULT_THEME);
      } finally {
        setHasLoadedFromDisk(true);
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

  /**
   * UI sound hooks for progress bar interactions
   */
  const {
    playProgressIncrementSound,
    playProgressDecrementSound,
    playProgressCompleteSound,
  } = useUiSounds();

  const onIncrement = (id: string, sign: number = 1) => {
    // Play appropriate sound based on increment direction
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

      // Check if the bar was just completed and show success modal
      const updatedBar = updatedBars.find((bar) => bar.id === id);
      if (updatedBar && updatedBar.current === updatedBar.max) {
        playProgressCompleteSound();
        setSuccessModalBarId(id);
      }

      return updatedBars;
    });
  };

  const handleSaveBar = (updates: Partial<ProgressBarData>) => {
    if (!editingBarId) {
      return;
    }

    setBars((prevBars) =>
      prevBars.map((bar) =>
        bar.id === editingBarId ? { ...bar, ...updates } : bar
      )
    );
    setEditingBarId(null);
  };

  const handleDeleteBar = () => {
    if (!editingBarId) {
      return;
    }

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
      incrementHoverGlowHex: "#84cc16",
      decrementHoverGlowHex: "#ea580c",
      createdAt: new Date().toISOString(),
      notes: [],
    };
    setBars((prev) => [...prev, newBar]);
  };

  /**
   * Autosave progress bars to local storage whenever they change
   */
  useEffect(() => {
    if (hasLoadedFromDisk === false) {
      return;
    }

    window.api.savePartialData({ bars }).catch((error) => {
      console.error("Autosave failed:", error);
    });
  }, [bars, hasLoadedFromDisk]);

  const editingBar = bars.find((bar) => bar.id === editingBarId);

  /**
   * Initialize sound manager with saved preferences on app startup
   */
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const savedData = await window.api.loadData();
        const savedPreferences = savedData?.sounds?.preferences;

        if (
          isMounted &&
          savedPreferences &&
          typeof savedPreferences === "object"
        ) {
          const soundPreferences = {
            masterVolume:
              typeof savedPreferences.masterVolume === "number"
                ? savedPreferences.masterVolume
                : 0.6,
            muteAll: savedPreferences.muteAll === true,
            soundsFolder: "/home/sounds",
            eventFiles: savedPreferences.eventFiles || {},
          };

          const soundManager = getSoundManager();
          soundManager.setPreferences(soundPreferences);
        }
      } catch (error) {
        console.error("Failed to initialize sound preferences:", error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Save data before window closes
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      window.api.savePartialData({ bars }).catch(console.error);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [bars]);

  return (
    <div className="app-container">
      <header className="titlebar">
        <span className="text-xs font-bold text-muted pl-3">Progress Bars</span>
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

          <Button variant="primary" onClick={addNewBar}>
            + Add new bar
          </Button>

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
