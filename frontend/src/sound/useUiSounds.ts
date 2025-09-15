import { useMemo } from "react";
import { getSoundManager } from "./soundManager";

/**
 * React hook exposing UI sound helpers backed by SoundManager.
 * Notes:
 * - Precedence: when multiple sounds are triggered quickly, the newest sound
 *   interrupts the previous (handled by SoundManager).
 * - Provides simple play helpers per event and volume/mute setters.
 */
export function useUiSounds() {
  const soundManager = useMemo(() => {
    return getSoundManager();
  }, []);

  /** Play the progress increment sound. */
  const playProgressIncrementSound = (): void => {
    soundManager.playEventSound("progressIncrement");
  };

  /** Play the progress decrement sound. */
  const playProgressDecrementSound = (): void => {
    soundManager.playEventSound("progressDecrement");
  };

  /** Play the progress complete sound. */
  const playProgressCompleteSound = (): void => {
    soundManager.playEventSound("progressComplete");
  };

  /** Set the master output volume (0..1 inclusive). */
  const setMasterVolume = (masterVolume: number): void => {
    soundManager.setMasterVolume(masterVolume);
  };

  /** Mute or unmute all sounds. */
  const setMuteAll = (muteAll: boolean): void => {
    soundManager.setMuteAll(muteAll);
  };

  return {
    playProgressIncrementSound,
    playProgressDecrementSound,
    playProgressCompleteSound,
    setMasterVolume,
    setMuteAll,
  } as const;
}
