import { useState } from "react";
import type { ProgressBarData } from "../../../types/shared";
import { useUiSounds } from "./useUiSounds";

/**
 * Hook for managing progress bars state and operations
 * @returns Progress bars state and operations
 */
export function useProgressBars() {
  // Success modal when a progress bar is completed
  const [successModalBarId, setSuccessModalBarId] = useState<string | null>(
    null
  );

  // Default progress bars
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

  // Bar editing state
  const [editingBarId, setEditingBarId] = useState<string | null>(null);
  const editingBar = bars.find((bar) => bar.id === editingBarId);

  // UI sounds for progress bar interactions
  const {
    playProgressIncrementSound,
    playProgressDecrementSound,
    playProgressCompleteSound,
  } = useUiSounds();

  /**
   * Increment or decrement a progress bar
   * @param id Bar ID to increment/decrement
   * @param sign Direction (1 for increment, -1 for decrement)
   */
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

  /**
   * Save changes to a progress bar
   * @param updates Partial bar data to update
   */
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

  /**
   * Delete a progress bar
   */
  const handleDeleteBar = () => {
    if (!editingBarId) {
      return;
    }

    setBars((prevBars) => prevBars.filter((bar) => bar.id !== editingBarId));
    setEditingBarId(null);
  };

  /**
   * Restore progress bars from backup
   * @param restoredBars Bars to restore
   */
  const handleRestoreData = (restoredBars: ProgressBarData[]) => {
    setBars(restoredBars);
  };

  /**
   * Add a new progress bar
   */
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
   * Update bar order after drag and drop
   * @param oldIndex Original index
   * @param newIndex New index
   */
  const updateBarOrder = (oldIndex: number, newIndex: number) => {
    setBars((items) => {
      const result = [...items];
      const [removed] = result.splice(oldIndex, 1);
      result.splice(newIndex, 0, removed);
      return result;
    });
  };

  return {
    bars,
    setBars,
    successModalBarId,
    setSuccessModalBarId,
    editingBarId,
    setEditingBarId,
    editingBar,
    onIncrement,
    handleSaveBar,
    handleDeleteBar,
    handleRestoreData,
    addNewBar,
    updateBarOrder,
  };
}
