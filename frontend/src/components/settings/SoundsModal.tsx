import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getSoundManager,
  canonicalFilenameForEvent,
} from "../../sound/soundManager";
import type { SoundEventId } from "../../../../types/shared";
import { Slider } from "../ui/slider";
import { createPortal } from "react-dom";
import { Pause, Play, X } from "lucide-react";

// TODO: Obviously, fix theming.
// TODO: Need a better way to signal visually whether a sound has been uploaded or not.

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
}

/**
 * SoundsModal lets users upload per-event .mp3 files and preview them.
 * - Uploaded bytes are saved via IPC under canonical filenames.
 * - Only canonical filenames are persisted in AppData.sounds.preferences.eventFiles (no base64/data URLs).
 * - Preview uses an internal Audio element with a mini progress bar, sourcing blob URLs created at runtime from raw bytes.
 */
export default function SoundsModal(props: SoundsModalProps) {
  const { open, onClose } = props;

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
                const fileRef = next.eventFiles[item.id];
                if (typeof fileRef === "string" && fileRef.length > 0) {
                  soundManager.setSoundFileForEvent(item.id, fileRef);
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

      // Prepare bytes
      const bytes = new Uint8Array(await file.arrayBuffer());

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

      // Update local prefs to store only canonical filename
      const canonicalFileName = canonicalFilenameForEvent(eventId);
      const nextEventFiles: Record<SoundEventId, string> = {
        ...preferences.eventFiles,
        [eventId]: canonicalFileName,
      };

      setPreferences((prev) => ({ ...prev, eventFiles: nextEventFiles }));

      soundManager.setSoundFileForEvent(eventId, canonicalFileName);

      // Persist to app data with current bars (main overwrites bars if omitted)
      await window.api.savePartialData({
        sounds: { preferences: { ...preferences, eventFiles: nextEventFiles } },
      });

      // Auto-start preview of the newly uploaded file from the freshly saved bytes
      try {
        const blob = new Blob([bytes], { type: "audio/mpeg" });
        const objectUrl = URL.createObjectURL(blob);
        playPreview(objectUrl, eventId);
      } catch {
        // Ignore preview errors
      }
    } catch (error) {
      console.error("Failed to save sound:", error);
      setErrorMessage("Failed to save the selected sound. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /** Toggle preview for a given event (pause/resume behavior). */
  const togglePreview = (eventId: SoundEventId): void => {
    const audioElement = audioRef.current;
    const isActiveEvent = playingEvent === eventId;

    if (isActiveEvent) {
      if (audioElement && audioElement.paused) {
        try {
          void audioElement.play();
        } catch {
          // Ignore playback errors
        }
      } else {
        pausePreview();
      }
    } else {
      // Load from disk via IPC and preview
      void playPreviewFromDisk(eventId);
    }
  };

  /** Read raw bytes for an event from disk and preview via a blob URL. */
  const playPreviewFromDisk = async (eventId: SoundEventId): Promise<void> => {
    try {
      const bytes = await window.api.readSoundForEvent(eventId);
      if (!bytes || bytes.length === 0) {
        return;
      }
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const objectUrl = URL.createObjectURL(blob);
      playPreview(objectUrl, eventId);
    } catch {
      // Ignore preview errors
    }
  };

  /** Start previewing a given blob URL. */
  const playPreview = (sourceUrl: string, eventId: SoundEventId): void => {
    stopPreview();

    try {
      const audioElement = new Audio(sourceUrl);
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
      await window.api.savePartialData({
        sounds: {
          preferences: { ...preferences, masterVolume: nextVolume },
        },
      });
    } catch {
      // Ignore persistence errors for volume change
    }
  };

  // Scroll locking is handled globally in SettingsRoot when modals/drawers are open.
  return open
    ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
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
                <X className="close-icon" />
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
                const fileRef = preferences.eventFiles[item.id];
                const isActiveEvent = playingEvent === item.id;
                const isActuallyPlaying =
                  isActiveEvent && audioRef.current
                    ? audioRef.current.paused === false
                    : false;
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
                            typeof fileRef !== "string" ||
                            fileRef.length === 0 ||
                            busy
                          }
                          className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-50 flex items-center gap-1 w-24 justify-center"
                        >
                          {isActuallyPlaying ? (
                            <Pause className="h-5 w-5 stroke-2" />
                          ) : (
                            <Play className="h-5 w-5 stroke-2" />
                          )}
                          <span className="text-sm">
                            {isActuallyPlaying ? "Pause" : "Play"}
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

                    <Slider
                      value={[isActiveEvent ? progress : 0]}
                      max={isActiveEvent && duration > 0 ? duration : 1}
                      min={0}
                      step={0.01}
                      onValueChange={(newValues) => {
                        const nextRawValue = Array.isArray(newValues)
                          ? (newValues[0] ?? 0)
                          : 0;
                        const clampedTime = Math.max(
                          0,
                          Math.min(nextRawValue, duration || 0)
                        );
                        const audioElement = audioRef.current;
                        if (audioElement && isActiveEvent) {
                          try {
                            audioElement.currentTime = clampedTime;
                            setProgress(clampedTime);
                          } catch {
                            // Ignore seek errors
                          }
                        }
                      }}
                      disabled={!isActiveEvent || duration <= 0}
                      aria-label={`Seek ${item.label} preview`}
                      className="w-full [&_.bg-primary]:bg-lime-500 [&_.border-primary]:border-lime-500"
                    />

                    <div className="mt-1 text-xs text-gray-400">
                      {typeof fileRef === "string" && fileRef.length > 0
                        ? "Custom sound selected"
                        : "No sound selected"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
}
