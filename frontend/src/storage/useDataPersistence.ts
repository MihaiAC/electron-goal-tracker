import { useEffect, useState } from "react";
import type { ProgressBarData } from "../../../types/shared";
import { applyTheme, DEFAULT_THEME } from "../theme/theme";

/**
 * Hook for handling data persistence (loading/saving)
 * @param bars Current progress bars state
 * @param setBars Function to update bars state
 * @returns Data persistence state and handlers
 */
export function useDataPersistence(
  bars: ProgressBarData[],
  setBars?: (bars: ProgressBarData[]) => void
) {
  /**
   * Flag to prevent autosave from overwriting disk data before initial load completes
   */
  const [hasLoadedFromDisk, setHasLoadedFromDisk] = useState<boolean>(false);

  /**
   * Load saved data from disk on component mount
   */
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedData = await window.api.loadData();

        // Process loaded bars if available
        if (savedData?.bars && setBars) {
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

          // Update bars state if setBars function is provided
          setBars(normalizedBars);
        }

        // Apply saved theme or default theme
        if (savedData && savedData.theme) {
          applyTheme(savedData.theme);
        } else {
          applyTheme(DEFAULT_THEME);
        }

        setHasLoadedFromDisk(true);
        return true;
      } catch (error) {
        console.error("Failed to load saved data", error);
        applyTheme(DEFAULT_THEME);
        setHasLoadedFromDisk(true);
        return false;
      }
    };

    loadSavedData();
  }, [setBars]);

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

  return {
    hasLoadedFromDisk,
  };
}
