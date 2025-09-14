import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ThemeData } from "../../../../types/shared";
import { applyTheme, DEFAULT_THEME } from "../../utils/theme";
import { Button } from "../Button";

export interface ThemeModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * ThemeModal lets users customize application colors (hex), excluding per-bar colors.
 * Simplified theme: background, foreground (text), and a single primary button color.
 * Values are applied live to CSS variables and saved to AppData.theme.
 */
export default function ThemeModal(props: ThemeModalProps) {
  const { open, onClose } = props;

  const [theme, setTheme] = useState<ThemeData>({
    backgroundHex: DEFAULT_THEME.backgroundHex,
    foregroundHex: DEFAULT_THEME.foregroundHex,
    buttonPrimaryHex: DEFAULT_THEME.buttonPrimaryHex,
    buttonSecondaryHex: DEFAULT_THEME.buttonSecondaryHex,
    buttonDestructiveHex: DEFAULT_THEME.buttonDestructiveHex,
  });
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load saved theme when opening; apply immediately so UI previews match.
  useEffect(() => {
    let isMounted = true;
    if (!open) {
      return;
    }

    (async () => {
      try {
        const data = await window.api.loadData();
        const savedTheme = data?.theme as Partial<ThemeData> | undefined;
        const next: ThemeData = {
          backgroundHex:
            savedTheme?.backgroundHex ?? DEFAULT_THEME.backgroundHex,
          foregroundHex:
            savedTheme?.foregroundHex ?? DEFAULT_THEME.foregroundHex,
          buttonPrimaryHex:
            savedTheme?.buttonPrimaryHex ?? DEFAULT_THEME.buttonPrimaryHex,
          buttonSecondaryHex:
            savedTheme?.buttonSecondaryHex ?? DEFAULT_THEME.buttonSecondaryHex,
          buttonDestructiveHex:
            savedTheme?.buttonDestructiveHex ??
            DEFAULT_THEME.buttonDestructiveHex,
        };
        if (isMounted) {
          setTheme(next);
        }
      } catch {
        if (isMounted) {
          setTheme({
            backgroundHex: DEFAULT_THEME.backgroundHex,
            foregroundHex: DEFAULT_THEME.foregroundHex,
            buttonPrimaryHex: DEFAULT_THEME.buttonPrimaryHex,
            buttonSecondaryHex: DEFAULT_THEME.buttonSecondaryHex,
            buttonDestructiveHex: DEFAULT_THEME.buttonDestructiveHex,
          });
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [open]);

  const handleChange = (key: keyof ThemeData, value: string): void => {
    setTheme((prev) => {
      const next = { ...prev, [key]: value } as ThemeData;
      return next;
    });
  };

  const handleSave = async (): Promise<void> => {
    setErrorMessage(null);
    setBusy(true);
    let success = false;
    try {
      await window.api.savePartialData({ theme });
      try {
        applyTheme(theme);
      } catch {}
      success = true;
    } catch {
      setErrorMessage("Failed to save theme. Please try again.");
    } finally {
      setBusy(false);
      if (success) {
        onClose();
      }
    }
  };

  const handleResetDefaults = (): void => {
    setTheme({
      backgroundHex: DEFAULT_THEME.backgroundHex,
      foregroundHex: DEFAULT_THEME.foregroundHex,
      buttonPrimaryHex: DEFAULT_THEME.buttonPrimaryHex,
      buttonSecondaryHex: DEFAULT_THEME.buttonSecondaryHex,
      buttonDestructiveHex: DEFAULT_THEME.buttonDestructiveHex,
    });
  };

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="overlay-dim z-50" onClick={() => onClose()}>
      <div
        className="panel-base p-6 w-full max-w-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Theme</h2>
          <Button variant="close" onClick={() => onClose()}>
            <X className="close-icon" />
          </Button>
        </div>

        {errorMessage ? (
          <div className="mb-4 bg-red-900/40 border border-red-500 text-red-300 p-3 rounded-md">
            {errorMessage}
          </div>
        ) : null}

        <div className="space-y-6">
          <section className="border border-white/10 rounded-md p-3">
            <h3 className="font-medium mb-2">App</h3>
            <div className="grid grid-cols-2 gap-4">
              <ColorInput
                label="Background"
                value={theme.backgroundHex}
                onChange={(v) => handleChange("backgroundHex", v)}
              />
              <ColorInput
                label="Text"
                value={theme.foregroundHex}
                onChange={(v) => handleChange("foregroundHex", v)}
              />
            </div>
          </section>

          <section className="border border-white/10 rounded-md p-3">
            <h3 className="font-medium mb-2">Primary Button</h3>
            <div className="grid grid-cols-1 gap-4">
              <ColorInput
                label="Primary"
                value={theme.buttonPrimaryHex}
                onChange={(v) => handleChange("buttonPrimaryHex", v)}
              />
            </div>
          </section>

          <section className="border border-white/10 rounded-md p-3">
            <h3 className="font-medium mb-2">Secondary Button</h3>
            <div className="grid grid-cols-1 gap-4">
              <ColorInput
                label="Secondary"
                value={theme.buttonSecondaryHex}
                onChange={(v) => handleChange("buttonSecondaryHex", v)}
              />
            </div>
          </section>

          <section className="border border-white/10 rounded-md p-3">
            <h3 className="font-medium mb-2">Destructive Button</h3>
            <div className="grid grid-cols-1 gap-4">
              <ColorInput
                label="Destructive"
                value={theme.buttonDestructiveHex}
                onChange={(v) => handleChange("buttonDestructiveHex", v)}
              />
            </div>
          </section>

          <div className="flex items-center justify-between">
            <Button
              onClick={handleResetDefaults}
              type="button"
              variant="secondary"
              disabled={busy}
            >
              Reset defaults
            </Button>

            <div className="space-x-3">
              <Button
                onClick={() => onClose()}
                type="button"
                variant="secondary"
                disabled={busy}
              >
                Close
              </Button>
              <Button
                onClick={() => void handleSave()}
                type="button"
                variant="primary"
                disabled={busy}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ColorInput(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { label, value, onChange } = props;
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full"
        />
        <span className="text-xs opacity-75">{value}</span>
      </div>
    </div>
  );
}
