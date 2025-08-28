import type { SoundEventId } from "../../../types/shared";
import {
  DEFAULT_SOUND_PREFERENCES,
  DEFAULT_SOUND_FILES,
  DEFAULT_SOUNDS_FOLDER,
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
   * @param fileUrl URL or path to audio.
   */
  public setSoundFileForEvent(
    soundEventId: SoundEventId,
    fileUrl: string
  ): void {
    this.preferences.eventFiles[soundEventId] = fileUrl;
    this.preloadAudioElementForEvent(soundEventId);
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

    let baseAudioElement = this.baseAudioElementsByEvent.get(soundEventId);

    if (typeof baseAudioElement === "undefined") {
      this.preloadAudioElementForEvent(soundEventId);
      baseAudioElement = this.baseAudioElementsByEvent.get(soundEventId);
    }

    if (typeof baseAudioElement === "undefined") {
      // Could not create base element; nothing to play
      return;
    }

    const clonedAudioElement = baseAudioElement.cloneNode(
      true
    ) as HTMLAudioElement;
    clonedAudioElement.volume = this.preferences.masterVolume;

    // Track as current; clear reference when done
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
      ...DEFAULT_SOUND_FILES,
      ...preferences.eventFiles,
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
    const soundEventIds = Object.keys(
      this.preferences.eventFiles
    ) as SoundEventId[];

    for (const soundEventId of soundEventIds) {
      this.preloadAudioElementForEvent(soundEventId);
    }
  }

  /**
   * Preload base audio element for an event.
   * @param soundEventId Event id.
   */
  private preloadAudioElementForEvent(soundEventId: SoundEventId): void {
    const ref = this.preferences.eventFiles[soundEventId];
    if (typeof ref !== "string" || ref.length === 0) {
      return;
    }

    const url = this.resolveToPlayableUrl(ref);
    if (!url) {
      return;
    }

    try {
      const baseAudioElement = new Audio(url);
      baseAudioElement.preload = "auto";
      baseAudioElement.volume = 1.0;
      this.baseAudioElementsByEvent.set(soundEventId, baseAudioElement);
    } catch {
      // Ignore invalid URLs
    }
  }

  /**
   * Convert a ref (URL, absolute path, or basename) to a file URL for Audio.
   */
  private resolveToPlayableUrl(ref: string): string | null {
    // Already a URL
    if (ref.includes("://")) {
      return ref;
    }

    // Data URL (sandbox-safe)
    if (ref.startsWith("data:")) {
      return ref;
    }

    // Absolute Linux path
    if (ref.startsWith("/")) {
      return this.linuxPathToFileUrl(ref);
    }

    // Basename -> resolve against soundsFolder
    const folder = this.preferences.soundsFolder || DEFAULT_SOUNDS_FOLDER;
    const abs = this.joinLinux(folder, ref);

    if (!abs.startsWith("/")) {
      return null;
    }

    return this.linuxPathToFileUrl(abs);
  }

  /**
   * Minimal Linux path join (renderer-safe).
   */
  private joinLinux(dir: string, name: string): string {
    if (!dir) {
      return name;
    }

    if (dir.endsWith("/")) {
      return dir + name;
    }

    return `${dir}/${name}`;
  }

  /**
   * Convert absolute Linux path to file:// URL with encoding.
   */
  private linuxPathToFileUrl(p: string): string {
    // Ensure absolute
    if (!p.startsWith("/")) {
      return "";
    }

    const encoded = p
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    // Ensure exactly three slashes after file:
    const stripped = encoded.startsWith("/") ? encoded.slice(1) : encoded;

    return `file:///${stripped}`;
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

/**
 * Read a File into a data URL string (e.g. "data:audio/mpeg;base64, ...").
 * Sandbox-safe for playback and easy to persist/sync.
 */
export async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(reader.error);
    };

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Failed to read file as data URL"));
      }
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Convert a data URL (data:...;base64,...) into raw bytes.
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    return new Uint8Array();
  }

  const base64Part = dataUrl.slice(commaIndex + 1);
  const binaryString = atob(base64Part);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

/**
 * Convert raw bytes to a data URL with the given content type.
 */
export function bytesToDataUrl(bytes: Uint8Array, contentType: string): string {
  let binaryString = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binaryString += String.fromCharCode(bytes[index]);
  }
  const base64 = btoa(binaryString);
  return `data:${contentType};base64,${base64}`;
}
