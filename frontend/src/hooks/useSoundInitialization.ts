import { useEffect } from "react";
import { getSoundManager } from "../sound/soundManager";

/**
 * Hook for initializing sound manager with saved preferences on app startup
 */
export function useSoundInitialization() {
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

          // Get SoundManager instance with initial preferences
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
}
