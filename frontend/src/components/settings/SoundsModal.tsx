import React, { useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon, PlayIcon, PauseIcon } from "../Icons";
import {
  getSoundManager,
  canonicalFilenameForEvent,
  readFileAsDataUrl,
} from "../../sound/soundManager";
import type { ProgressBarData, SoundEventId } from "../../../../types/shared";

// TODO
/**
 * Things to fix:
 * - master volume changer doesn't work;
 * - master volume changer should work while the sound is playing;
 * - clicking let's go doesn't stop the success sound;
 * - Passing the progress bar data into this function should not be necessary.
 * - Play/Pause button is more like Play/Stop. Seek bar instead (?). Buttons also change shape.
 */

/** UI metadata for supported sound events. */
const EVENT_ITEMS: Array<{ id: SoundEventId; label: string }> = [
  { id: "progressIncrement", label: "Increment" },
  { id: "progressDecrement", label: "Decrement" },
  { id: "progressComplete", label: "Complete" },
];

/** Default preferences for modal state when nothing is saved yet. */
const DEFAULT_MODAL_PREFS = {
  masterVolume: 0.6,
  muteAll: false,
  eventFiles: {
    ["progressIncrement"]: "",
    ["progressDecrement"]: "",
    ["progressComplete"]: "",
  } as Record<SoundEventId, string>,
};

export interface SoundsModalProps {
  open: boolean;
  onClose: () => void;
  /** Bars must be provided when saving sounds, as main currently overwrites bars if omitted. */
  currentBars: ProgressBarData[];
}

/**
 * SoundsModal lets users upload per-event .mp3 files and preview them.
 * - Uploaded bytes are saved via IPC under canonical filenames.
 * - Data URLs are persisted in AppData.sounds.preferences.eventFiles for sandbox-safe playback and sync.
 * - Preview uses an internal Audio element with a mini progress bar.
 */
export default function SoundsModal(props: SoundsModalProps) {
  const { open, onClose, currentBars } = props;

  const soundManager = useMemo(() => {
    return getSoundManager();
  }, []);

  const [preferences, setPreferences] = useState(DEFAULT_MODAL_PREFS);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preview state (single audio element for simplicity)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingEvent, setPlayingEvent] = useState<SoundEventId | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  /** Load existing preferences when opening the modal. */
  useEffect(() => {
    let isMounted = true;

    async function loadPrefs() {
      try {
        const data = await window.api.loadData();
        const existing = data?.sounds?.preferences;

        if (isMounted) {
          if (existing && typeof existing === "object") {
            const next = {
              masterVolume:
                typeof existing.masterVolume === "number"
                  ? existing.masterVolume
                  : DEFAULT_MODAL_PREFS.masterVolume,
              muteAll: existing.muteAll === true,
              eventFiles: {
                ...DEFAULT_MODAL_PREFS.eventFiles,
                ...(existing.eventFiles as Record<SoundEventId, string>),
              },
            } as typeof DEFAULT_MODAL_PREFS;

            setPreferences(next);

            // Seed SoundManager so app playback reflects current saved choices.
            try {
              soundManager.setMasterVolume(next.masterVolume);
              for (const item of EVENT_ITEMS) {
                const dataUrl = next.eventFiles[item.id];
                if (typeof dataUrl === "string" && dataUrl.length > 0) {
                  soundManager.setSoundFileForEvent(item.id, dataUrl);
                }
              }
            } catch {
              // Ignore manager errors
            }
          } else {
            setPreferences(DEFAULT_MODAL_PREFS);
          }
        }
      } catch {
        if (isMounted) {
          setPreferences(DEFAULT_MODAL_PREFS);
        }
      }
    }

    if (open) {
      loadPrefs();
    }

    return () => {
      isMounted = false;
    };
  }, [open, soundManager]);

  /** Clean up preview audio when modal closes. */
  useEffect(() => {
    if (open === false) {
      stopPreview();
    }
  }, [open]);

  /** Attach timeupdate listeners for preview updates. */
  useEffect(() => {
    const audioElement = audioRef.current;

    if (!audioElement) {
      return;
    }

    const handleTime = () => {
      if (audioElement.duration && Number.isFinite(audioElement.duration)) {
        setDuration(audioElement.duration);
        setProgress(audioElement.currentTime);
      }
    };

    const handleEnd = () => {
      setPlayingEvent(null);
    };

    audioElement.addEventListener("timeupdate", handleTime);
    audioElement.addEventListener("ended", handleEnd);
    audioElement.addEventListener("error", handleEnd);

    return () => {
      audioElement.removeEventListener("timeupdate", handleTime);
      audioElement.removeEventListener("ended", handleEnd);
      audioElement.removeEventListener("error", handleEnd);
    };
  }, [audioRef.current]);

  /** Handle file upload for a given event. */
  const handleFileChange = async (
    eventId: SoundEventId,
    file: File | null
  ): Promise<void> => {
    setErrorMessage(null);

    if (file === null) {
      return;
    }

    if (
      file.type !== "audio/mpeg" &&
      file.name.toLowerCase().endsWith(".mp3") === false
    ) {
      setErrorMessage("Only .mp3 files are supported.");
      return;
    }

    try {
      setBusy(true);

      // Prepare bytes and data URL
      const bytes = new Uint8Array(await file.arrayBuffer());
      const dataUrl = await readFileAsDataUrl(file);

      // Save to disk under canonical filename via IPC
      await window.api.saveSoundForEvent(eventId, bytes);

      // Upload raw .mp3 to Google Drive (unencrypted), using canonical filename
      try {
        const canonicalFileName = canonicalFilenameForEvent(eventId);
        await window.api.driveSync({
          fileName: canonicalFileName,
          content: bytes,
          contentType: "audio/mpeg",
        });
      } catch {
        // Ignore Drive sync errors; local save and preferences still succeed
      }

      // Update local prefs and SoundManager immediately
      const nextEventFiles: Record<SoundEventId, string> = {
        ...preferences.eventFiles,
        [eventId]: dataUrl,
      };

      setPreferences((prev) => ({ ...prev, eventFiles: nextEventFiles }));

      soundManager.setSoundFileForEvent(eventId, dataUrl);

      // Persist to app data with current bars (main overwrites bars if omitted)
      await window.api.saveData({
        bars: currentBars,
        sounds: { preferences: { ...preferences, eventFiles: nextEventFiles } },
      });
    } catch (error) {
      console.error("Failed to save sound:", error);
      setErrorMessage("Failed to save the selected sound. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /** Toggle preview for a given event. */
  const togglePreview = (eventId: SoundEventId): void => {
    const sourceUrl = preferences.eventFiles[eventId];

    if (typeof sourceUrl !== "string" || sourceUrl.length === 0) {
      return;
    }

    if (playingEvent === eventId) {
      pausePreview();
    } else {
      playPreview(sourceUrl, eventId);
    }
  };

  /** Start previewing a given data URL. */
  const playPreview = (dataUrl: string, eventId: SoundEventId): void => {
    stopPreview();

    try {
      const audioElement = new Audio(dataUrl);
      audioElement.preload = "auto";
      // Initialize preview volume from current master volume
      let initialVolume = preferences.masterVolume;
      if (Number.isFinite(initialVolume) === false) {
        initialVolume = 1;
      }
      if (initialVolume < 0) {
        initialVolume = 0;
      } else if (initialVolume > 1) {
        initialVolume = 1;
      }

      audioElement.volume = initialVolume;
      audioRef.current = audioElement;
      setPlayingEvent(eventId);
      setProgress(0);
      setDuration(0);

      void audioElement.play().catch(() => {
        // Ignore autoplay restrictions inside modal
      });
    } catch {
      // Ignore invalid URL errors
    }
  };

  /** Pause current preview, if any. */
  const pausePreview = (): void => {
    const audioElement = audioRef.current;
    if (audioElement) {
      try {
        audioElement.pause();
      } catch {
        // Ignore errors
      }
    }
    setPlayingEvent(null);
  };

  /** Stop and reset preview, clearing element. */
  const stopPreview = (): void => {
    const audioElement = audioRef.current;
    if (audioElement) {
      try {
        audioElement.pause();
        audioElement.currentTime = 0;
      } catch {
        // Ignore errors
      }
    }
    audioRef.current = null;
    setPlayingEvent(null);
    setProgress(0);
    setDuration(0);
  };

  /** Handle master volume slider change and persist. */
  const handleMasterVolumeChange = async (
    changeEvent: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const rawValue = parseFloat(changeEvent.target.value);
    let nextVolume = Number.isFinite(rawValue) ? rawValue : 0;
    if (nextVolume < 0) {
      nextVolume = 0;
    } else if (nextVolume > 1) {
      nextVolume = 1;
    }

    setPreferences((prev) => ({ ...prev, masterVolume: nextVolume }));
    soundManager.setMasterVolume(nextVolume);

    // Update preview element volume live while playing.
    const currentAudioElement = audioRef.current;
    if (currentAudioElement) {
      try {
        currentAudioElement.volume = nextVolume;
      } catch {
        // Ignore errors updating preview volume
      }
    }

    try {
      await window.api.saveData({
        bars: currentBars,
        sounds: {
          preferences: { ...preferences, masterVolume: nextVolume },
        },
      });
    } catch {
      // Ignore persistence errors for volume change
    }
  };

  return open ? (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      onClick={() => onClose()}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-full max-w-xl"
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Sounds</h2>
          <button
            type="button"
            onClick={() => onClose()}
            className="titlebar-button hover:bg-red-500 border-2 border-white hover:border-red-500"
          >
            <CloseIcon />
          </button>
        </div>

        {errorMessage ? (
          <div className="mb-4 bg-red-900/40 border border-red-500 text-red-300 p-3 rounded-md">
            {errorMessage}
          </div>
        ) : null}

        <div className="space-y-4">
          <div className="border border-white/10 rounded-md p-3">
            <label className="block text-sm font-medium mb-2">
              Master volume
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={preferences.masterVolume}
                onChange={handleMasterVolumeChange}
                className="w-full"
              />
              <span className="text-sm tabular-nums">
                {Math.round(preferences.masterVolume * 100)}%
              </span>
            </div>
          </div>

          {EVENT_ITEMS.map((item) => {
            const dataUrl = preferences.eventFiles[item.id];
            const isPlaying = playingEvent === item.id;
            const percent =
              isPlaying && duration > 0
                ? Math.min(100, (progress / duration) * 100)
                : 0;
            const inputId = `file-${item.id}`;

            return (
              <div
                key={item.id}
                className="border border-white/10 rounded-md p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{item.label}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => togglePreview(item.id)}
                      disabled={
                        typeof dataUrl !== "string" ||
                        dataUrl.length === 0 ||
                        busy
                      }
                      className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 flex items-center gap-1"
                    >
                      {isPlaying ? <PauseIcon /> : <PlayIcon />}
                      <span className="text-sm">
                        {isPlaying ? "Pause" : "Play"}
                      </span>
                    </button>

                    <label
                      htmlFor={inputId}
                      className="px-3 py-1 rounded-md bg-blue-500 hover:bg-blue-600 text-black cursor-pointer"
                    >
                      Upload .mp3
                    </label>
                    <input
                      id={inputId}
                      type="file"
                      accept="audio/mpeg,.mp3"
                      className="hidden"
                      onChange={(changeEvent) =>
                        handleFileChange(
                          item.id,
                          changeEvent.target.files?.[0] ?? null
                        )
                      }
                      disabled={busy}
                    />
                  </div>
                </div>

                <div className="h-1 w-full bg-white/10 rounded">
                  <div
                    className="h-1 bg-lime-500 rounded"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="mt-1 text-xs text-gray-400">
                  {typeof dataUrl === "string" && dataUrl.length > 0
                    ? "Custom sound selected"
                    : "No sound selected"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;
}
