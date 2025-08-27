import React, { useState, useEffect } from "react";
import SettingsMenu from "./SettingsMenu";
import SyncModal from "../sync/SyncModal";
import SoundsModal from "./SoundsModal";
import { SettingsIcon } from "../Icons";
import type { ProgressBarData } from "../../../../types/shared";

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

  const [menuOpen, setMenuOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [soundsOpen, setSoundsOpen] = useState(false);

  // Prevent background scroll and layout shift when any settings UI is open
  useEffect(() => {
    const anyOpen = menuOpen || syncOpen || soundsOpen;
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
  }, [menuOpen, syncOpen, soundsOpen]);

  return (
    <>
      {/* Floating Settings button */}
      {!menuOpen && !syncOpen && !soundsOpen && (
        <button
          onClick={() => setMenuOpen(true)}
          className="fixed bottom-6 left-6 w-12 h-12 text-slate-800 rounded-md bg-white flex items-center justify-center shadow-lg hover:bg-slate-800 hover:text-white transition-colors duration-200 border border-white"
        >
          <SettingsIcon />
        </button>
      )}

      {/* Animated drawer */}
      <SettingsMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenCloudSync={() => setSyncOpen(true)}
        onOpenSounds={() => {
          setSoundsOpen(true);
        }}
      />

      {/* Cloud Sync modal now lives under Settings */}
      <SyncModal
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        onDataRestored={onDataRestored}
        currentBars={currentBars}
      />

      <SoundsModal
        open={soundsOpen}
        onClose={() => setSoundsOpen(false)}
        currentBars={currentBars}
      />
    </>
  );
}
