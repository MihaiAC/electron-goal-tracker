import type { SoundEventId } from "../../../types/shared";
import {
  DEFAULT_SOUND_PREFERENCES,
  DEFAULT_SOUND_FILES,
  SOUND_EVENT_IDS,
} from "./soundEvents";
import type { SoundPreferences } from "./soundEvents";

// TODO: Sync the sound files to GDrive as well.

/**
 * Renderer-side sound manager responsible for:
 * - Managing preferences (master volume, mute, event-to-file mapping)
 * - Preloading base audio elements for events
 * - Overlap-safe playback via cloning
 * - Simple precedence: new sound interrupts the previous
 */
export class SoundManager {
  private static singletonInstance: SoundManager | null = null;

  private preferences: SoundPreferences;
  private baseAudioElementsByEvent: Map<SoundEventId, HTMLAudioElement>;
  private currentPlayingAudio: HTMLAudioElement | null;
  private eventBlobUrls: Map<SoundEventId, string>;

  /**
   * Initialize with preferences and preload audio.
   * @param initialPreferences Optional initial preferences.
   */
  private constructor(initialPreferences?: SoundPreferences) {
    this.preferences = this.normalizePreferences(
      typeof initialPreferences !== "undefined"
        ? initialPreferences
        : DEFAULT_SOUND_PREFERENCES
    );

    this.baseAudioElementsByEvent = new Map<SoundEventId, HTMLAudioElement>();
    this.currentPlayingAudio = null;
    this.eventBlobUrls = new Map<SoundEventId, string>();

    this.preloadAllAudioElements();
  }

  /**
   * Get the singleton instance; updates prefs if provided.
   * @param initialPreferences Optional preferences to seed/update.
   * @returns Singleton SoundManager.
   */
  public static getInstance(
    initialPreferences?: SoundPreferences
  ): SoundManager {
    if (SoundManager.singletonInstance === null) {
      SoundManager.singletonInstance = new SoundManager(initialPreferences);
    } else {
      if (typeof initialPreferences !== "undefined") {
        SoundManager.singletonInstance.setPreferences(initialPreferences);
      }
    }

    return SoundManager.singletonInstance;
  }

  /**
   * Get a copy of the current preferences.
   * @returns Copy of SoundPreferences.
   */
  public getPreferences(): SoundPreferences {
    return {
      masterVolume: this.preferences.masterVolume,
      muteAll: this.preferences.muteAll,
      soundsFolder: this.preferences.soundsFolder,
      eventFiles: { ...this.preferences.eventFiles },
    };
  }

  /**
   * Replace preferences and reload audio.
   * @param newPreferences New preferences.
   */
  public setPreferences(newPreferences: SoundPreferences): void {
    this.preferences = this.normalizePreferences(newPreferences);
    this.baseAudioElementsByEvent.clear();
    this.revokeAllBlobUrls();
    this.preloadAllAudioElements();
  }

  /**
   * Set master volume (0..1).
   * @param masterVolume 0..1 inclusive.
   */
  public setMasterVolume(masterVolume: number): void {
    this.preferences.masterVolume = this.clampVolume(masterVolume);
  }

  /**
   * Mute or unmute all sounds.
   * @param muteAll True to mute all.
   */
  public setMuteAll(muteAll: boolean): void {
    this.preferences.muteAll = muteAll === true;
  }

  /**
   * Map an event to a sound file and preload.
   * @param soundEventId Event id.
   * @param fileRef File reference.
   */
  public setSoundFileForEvent(
    soundEventId: SoundEventId,
    fileRef: string
  ): void {
    this.preferences.eventFiles[soundEventId] = fileRef;
    void this.preloadAudioElementForEvent(soundEventId);
  }

  /**
   * Play a sound for an event, respecting mute. If another sound is playing,
   * it is stopped so the new one takes precedence.
   * @param soundEventId Event id.
   */
  public playEventSound(soundEventId: SoundEventId): void {
    // Stop any currently playing sound to give precedence to the new one
    if (this.currentPlayingAudio !== null) {
      try {
        this.currentPlayingAudio.pause();
        this.currentPlayingAudio.currentTime = 0;
      } catch {
        // Ignore errors
      }
      this.currentPlayingAudio = null;
    }

    if (this.preferences.muteAll === true) {
      return;
    }

    const baseAudioElement = this.baseAudioElementsByEvent.get(soundEventId);

    if (typeof baseAudioElement === "undefined") {
      void this.preloadFromDisk(soundEventId).then(() => {
        const loadedBaseAudioElement =
          this.baseAudioElementsByEvent.get(soundEventId);
        if (typeof loadedBaseAudioElement === "undefined") {
          return;
        }

        const clonedAudioElement = loadedBaseAudioElement.cloneNode(
          true
        ) as HTMLAudioElement;
        clonedAudioElement.volume = this.preferences.masterVolume;

        this.currentPlayingAudio = clonedAudioElement;
        const clearIfCurrent = () => {
          if (this.currentPlayingAudio === clonedAudioElement) {
            this.currentPlayingAudio = null;
          }
        };

        clonedAudioElement.addEventListener("ended", clearIfCurrent, {
          once: true,
        });

        clonedAudioElement.addEventListener("error", clearIfCurrent, {
          once: true,
        });

        const playPromise = clonedAudioElement.play();

        if (typeof playPromise?.catch === "function") {
          playPromise.catch(() => {
            // Ignore autoplay/gesture restrictions; actual click handlers will succeed
          });
        }
      });
      return;
    }

    const clonedAudioElement = baseAudioElement.cloneNode(
      true
    ) as HTMLAudioElement;
    clonedAudioElement.volume = this.preferences.masterVolume;

    this.currentPlayingAudio = clonedAudioElement;
    const clearIfCurrent = () => {
      if (this.currentPlayingAudio === clonedAudioElement) {
        this.currentPlayingAudio = null;
      }
    };

    clonedAudioElement.addEventListener("ended", clearIfCurrent, {
      once: true,
    });

    clonedAudioElement.addEventListener("error", clearIfCurrent, {
      once: true,
    });

    const playPromise = clonedAudioElement.play();

    if (typeof playPromise?.catch === "function") {
      playPromise.catch(() => {
        // Ignore autoplay/gesture restrictions; actual click handlers will succeed
      });
    }
  }

  /**
   * Stop any currently playing sound immediately.
   */
  public stopAll(): void {
    if (this.currentPlayingAudio !== null) {
      try {
        this.currentPlayingAudio.pause();
        this.currentPlayingAudio.currentTime = 0;
      } catch {
        // Ignore errors
      }
      this.currentPlayingAudio = null;
    }
  }

  /**
   * Merge input with defaults and clamp values.
   * @param preferences Input preferences.
   * @returns Normalized preferences.
   */
  private normalizePreferences(
    preferences: SoundPreferences
  ): SoundPreferences {
    const normalizedMasterVolume = this.clampVolume(preferences.masterVolume);
    const normalizedMuteAll = preferences.muteAll === true;
    const normalizedSoundsFolder =
      typeof preferences.soundsFolder === "string" &&
      preferences.soundsFolder.length > 0
        ? preferences.soundsFolder
        : DEFAULT_SOUND_PREFERENCES.soundsFolder;
    const normalizedEventFiles: Record<SoundEventId, string> = {
      ...(DEFAULT_SOUND_PREFERENCES.eventFiles as Record<SoundEventId, string>),
      ...(preferences.eventFiles as Record<SoundEventId, string>),
    };

    return {
      masterVolume: normalizedMasterVolume,
      muteAll: normalizedMuteAll,
      soundsFolder: normalizedSoundsFolder,
      eventFiles: normalizedEventFiles,
    };
  }

  /**
   * Clamp volume to [0, 1].
   * @param volume Input volume.
   * @returns Clamped volume.
   */
  private clampVolume(volume: number): number {
    if (Number.isFinite(volume) === false) {
      return DEFAULT_SOUND_PREFERENCES.masterVolume;
    }

    if (volume < 0) {
      return 0;
    }

    if (volume > 1) {
      return 1;
    }

    return volume;
  }

  /**
   * Preload base audio for all events.
   */
  private preloadAllAudioElements(): void {
    for (const soundEventId of SOUND_EVENT_IDS as SoundEventId[]) {
      this.preloadAudioElementForEvent(soundEventId);
    }
  }

  /**
   * Preload base audio element for an event.
   * @param soundEventId Event id.
   */
  private preloadAudioElementForEvent(soundEventId: SoundEventId): void {
    const fileReference = this.preferences.eventFiles[soundEventId];
    if (typeof fileReference !== "string" || fileReference.length === 0) {
      // Attempt to load from disk in case preferences were not updated yet.
      void this.preloadFromDisk(soundEventId);
      return;
    }

    // Read raw bytes via IPC and create a blob URL at runtime.
    void this.preloadFromDisk(soundEventId);
  }

  /**
   * Load raw bytes for an event from disk via IPC and create a base audio element.
   */
  private async preloadFromDisk(soundEventId: SoundEventId): Promise<void> {
    try {
      const bytes = await window.api.readSoundForEvent(soundEventId);
      if (!bytes || bytes.length === 0) {
        return;
      }

      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const objectUrl = URL.createObjectURL(blob);

      // Revoke any previously created object URL for this event to avoid memory leaks.
      const previousUrl = this.eventBlobUrls.get(soundEventId);
      if (typeof previousUrl === "string" && previousUrl.length > 0) {
        try {
          URL.revokeObjectURL(previousUrl);
        } catch {
          // Ignore revoke errors
        }
      }
      this.eventBlobUrls.set(soundEventId, objectUrl);

      const baseAudioElement = new Audio(objectUrl);
      baseAudioElement.preload = "auto";
      baseAudioElement.volume = 1.0;
      this.baseAudioElementsByEvent.set(soundEventId, baseAudioElement);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Revoke all created blob URLs to free memory.
   */
  private revokeAllBlobUrls(): void {
    for (const [, objectUrl] of this.eventBlobUrls) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // Ignore revoke errors
      }
    }
    this.eventBlobUrls.clear();
  }
}

/**
 * Convenience accessor for the singleton.
 * @returns SoundManager instance.
 */
export function getSoundManager(): SoundManager {
  return SoundManager.getInstance();
}

// TODO: Not happy with those here. We should have a folder specifically for file operations,
// with the same folder structure as frontend/src.
/**
 * Return the canonical filename for a sound event. Uses DEFAULT_SOUND_FILES mapping.
 */
export function canonicalFilenameForEvent(eventId: SoundEventId): string {
  return DEFAULT_SOUND_FILES[eventId];
}
