import React, { useEffect, useReducer } from "react";
import SettingsMenu from "./SettingsMenu";
import SyncModal from "../sync/SyncModal";
import SoundsModal from "./SoundsModal";
import ThemeModal from "./ThemeModal";
import HelpModal from "./HelpModal";
import type { ProgressBarData } from "../../../../types/shared";
import { Settings } from "lucide-react";

/**
 * Interface for the settings state managed by the reducer
 */
interface SettingsState {
  menuOpen: boolean;
  syncOpen: boolean;
  soundsOpen: boolean;
  themesOpen: boolean;
  helpOpen: boolean;
}

/**
 * Types of actions that can be dispatched to the settings reducer
 */
type SettingsAction =
  | { type: "TOGGLE_MENU"; open: boolean }
  | { type: "TOGGLE_SYNC"; open: boolean }
  | { type: "TOGGLE_SOUNDS"; open: boolean }
  | { type: "TOGGLE_THEMES"; open: boolean }
  | { type: "TOGGLE_HELP"; open: boolean };

/**
 * Reducer function to manage all settings modal states
 */
function settingsReducer(
  state: SettingsState,
  action: SettingsAction
): SettingsState {
  switch (action.type) {
    case "TOGGLE_MENU":
      return { ...state, menuOpen: action.open };
    case "TOGGLE_SYNC":
      return { ...state, syncOpen: action.open };
    case "TOGGLE_SOUNDS":
      return { ...state, soundsOpen: action.open };
    case "TOGGLE_THEMES":
      return { ...state, themesOpen: action.open };
    case "TOGGLE_HELP":
      return { ...state, helpOpen: action.open };
    default:
      return state;
  }
}

/**
 * SettingsRoot centralizes Settings UI:
 * - Floating gear button to open the SettingsMenu (left drawer)
 * - SettingsMenu navigation to Cloud Sync and Sounds
 * - Renders Cloud Sync modal here, not in App.tsx
 */
export default function SettingsRoot(props: {
  onDataRestored: (restored: ProgressBarData[]) => void;
  currentBars: ProgressBarData[];
}) {
  const { onDataRestored, currentBars } = props;

  const [settingsState, dispatch] = useReducer(settingsReducer, {
    menuOpen: false,
    syncOpen: false,
    soundsOpen: false,
    themesOpen: false,
    helpOpen: false,
  });

  const { menuOpen, syncOpen, soundsOpen, themesOpen, helpOpen } =
    settingsState;

  // Prevent background scroll and layout shift when any settings UI is open
  useEffect(() => {
    const anyOpen =
      menuOpen || syncOpen || soundsOpen || themesOpen || helpOpen;
    const body = document.body;
    const html = document.documentElement;
    if (anyOpen) {
      const scrollbarWidth = window.innerWidth - html.clientWidth;
      body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${scrollbarWidth}px`;
      }
    } else {
      body.style.overflow = "";
      body.style.paddingRight = "";
    }
    return () => {
      body.style.overflow = "";
      body.style.paddingRight = "";
    };
  }, [menuOpen, syncOpen, soundsOpen, themesOpen, helpOpen]);

  return (
    <>
      {/* Floating Settings button */}
      {!menuOpen && !syncOpen && !soundsOpen && !themesOpen && !helpOpen && (
        <button
          onClick={() => dispatch({ type: "TOGGLE_MENU", open: true })}
          className="fixed bottom-6 left-6 w-12 h-12 text-background rounded-md bg-foreground flex items-center justify-center shadow-lg hover:bg-background hover:text-foreground transition-colors duration-200 border border-foreground"
        >
          <Settings className="h-6 w-6 stroke-2;" />
        </button>
      )}

      {/* Animated drawer */}
      <SettingsMenu
        open={menuOpen}
        onClose={() => dispatch({ type: "TOGGLE_MENU", open: false })}
        onOpenDropboxSync={() => dispatch({ type: "TOGGLE_SYNC", open: true })}
        onOpenSounds={() => {
          dispatch({ type: "TOGGLE_SOUNDS", open: true });
        }}
        onOpenThemes={() => {
          dispatch({ type: "TOGGLE_THEMES", open: true });
        }}
        onOpenHelp={() => {
          dispatch({ type: "TOGGLE_HELP", open: true });
        }}
      />

      {/* Cloud Sync modal now lives under Settings */}
      <SyncModal
        open={syncOpen}
        onClose={() => dispatch({ type: "TOGGLE_SYNC", open: false })}
        onDataRestored={onDataRestored}
        currentBars={currentBars}
      />

      <SoundsModal
        open={soundsOpen}
        onClose={() => dispatch({ type: "TOGGLE_SOUNDS", open: false })}
      />

      <ThemeModal
        open={themesOpen}
        onClose={() => dispatch({ type: "TOGGLE_THEMES", open: false })}
      />

      <HelpModal
        open={helpOpen}
        onClose={() => dispatch({ type: "TOGGLE_HELP", open: false })}
      />
    </>
  );
}
