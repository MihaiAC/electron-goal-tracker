import React, { useState, useEffect } from "react";
import SettingsMenu from "./SettingsMenu";
import SyncModal from "../sync/SyncModal";
import SoundsModal from "./SoundsModal";
import ThemeModal from "./ThemeModal";
import HelpModal from "./HelpModal";
import type { ProgressBarData } from "../../../../types/shared";
import { Settings } from "lucide-react";

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

  // TODO: useReducer?
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [soundsOpen, setSoundsOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
          onClick={() => setMenuOpen(true)}
          className="fixed bottom-6 left-6 w-12 h-12 text-background rounded-md bg-foreground flex items-center justify-center shadow-lg hover:bg-background hover:text-foreground transition-colors duration-200 border border-foreground"
        >
          <Settings className="h-6 w-6 stroke-2;" />
        </button>
      )}

      {/* Animated drawer */}
      <SettingsMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenDropboxSync={() => setSyncOpen(true)}
        onOpenSounds={() => {
          setSoundsOpen(true);
        }}
        onOpenThemes={() => {
          setThemesOpen(true);
        }}
        onOpenHelp={() => {
          setHelpOpen(true);
        }}
      />

      {/* Cloud Sync modal now lives under Settings */}
      <SyncModal
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        onDataRestored={onDataRestored}
        currentBars={currentBars}
      />

      <SoundsModal open={soundsOpen} onClose={() => setSoundsOpen(false)} />

      <ThemeModal open={themesOpen} onClose={() => setThemesOpen(false)} />

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
