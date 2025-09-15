import type { ThemeData } from "../../../types/shared";

/** Validate a hex color (#rgb or #rrggbb). */
function isHexColor(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value);
}

/** Apply theme to document root CSS variables. */
export function applyTheme(theme: ThemeData): void {
  const root = document.documentElement;

  const safe = (hex: unknown, fallback: string): string => {
    if (isHexColor(hex)) {
      return hex;
    } else {
      return fallback;
    }
  };

  root.style.setProperty(
    "--background",
    safe(theme.backgroundHex, DEFAULT_THEME.backgroundHex)
  );
  root.style.setProperty(
    "--foreground",
    safe(theme.foregroundHex, DEFAULT_THEME.foregroundHex)
  );
  root.style.setProperty(
    "--button-primary",
    safe(theme.buttonPrimaryHex, DEFAULT_THEME.buttonPrimaryHex)
  );
  root.style.setProperty(
    "--button-secondary",
    safe(theme.buttonSecondaryHex, DEFAULT_THEME.buttonSecondaryHex)
  );
  root.style.setProperty(
    "--button-destructive",
    safe(theme.buttonDestructiveHex, DEFAULT_THEME.buttonDestructiveHex)
  );
  root.style.setProperty(
    "--neutral",
    safe(theme.neutralHex, DEFAULT_THEME.neutralHex)
  );
}

/** Default theme (hex) approximating the app's current appearance. */
export const DEFAULT_THEME: ThemeData = {
  backgroundHex: "#0f172a", // slate-900
  foregroundHex: "#ffffff",
  buttonPrimaryHex: "#84cc16", // lime-500
  buttonSecondaryHex: "#4b5563", // gray-600
  buttonDestructiveHex: "#dc2626", // red-600
  neutralHex: "#6b7280", // gray-500
};
