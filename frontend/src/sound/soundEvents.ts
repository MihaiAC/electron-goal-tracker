/**
 * UI sound events and preferences.
 * - Linux-focused: user selects an absolute sounds folder (default: /home/sounds).
 * - No bundled defaults. If folder/file is missing, sound simply won't play.
 *
 */

export type SoundEventId =
  | "buttonClick"
  | "progressIncrement"
  | "progressDecrement"
  | "progressComplete";

export interface SoundPreferences {
  /** Master volume 0..1 */
  masterVolume: number;
  /** Mute all sounds */
  muteAll: boolean;
  /** Absolute path to the sounds folder (Linux default: /home/sounds) */
  soundsFolder: string;
  /** Mapping of event id -> file reference (basename or absolute path or full URL) */
  eventFiles: Record<SoundEventId, string>;
}

export const DEFAULT_SOUND_FILES: Record<SoundEventId, string> = {
  buttonClick: "ui_click.mp3",
  progressIncrement: "ui_increment.mp3",
  progressDecrement: "ui_decrement.mp3",
  progressComplete: "ui_complete.mp3",
};

export const DEFAULT_MASTER_VOLUME = 0.6;
export const DEFAULT_MUTE_ALL = false;
export const DEFAULT_SOUNDS_FOLDER = "/home/sounds";

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  masterVolume: DEFAULT_MASTER_VOLUME,
  muteAll: DEFAULT_MUTE_ALL,
  soundsFolder: DEFAULT_SOUNDS_FOLDER,
  eventFiles: { ...DEFAULT_SOUND_FILES },
};
