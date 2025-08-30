import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import React from "react";
import { Cloud, Volume2, X } from "lucide-react";
import "./SettingsMenu.css";

/**
 * Left slide-out settings menu (drawer) with smooth animation.
 * - Provides navigation to Cloud Sync and Sounds settings.
 * - Closes when clicking the overlay or the close button.
 */
export interface SettingsMenuProps {
  open: boolean;
  onClose: () => void;
  onOpenCloudSync: () => void;
  onOpenSounds: () => void;
}

export default function SettingsMenu(props: SettingsMenuProps) {
  const { open, onClose, onOpenCloudSync, onOpenSounds } = props;

  return createPortal(
    <AnimatePresence initial={false}>
      {open ? (
        <>
          {/* Overlay (raised z-index, full viewport) */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => onClose()}
          />

          {/* Drawer (topmost) */}
          <motion.aside
            className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-gray-900 text-white border-r border-white/10 z-50 shadow-2xl flex flex-col"
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.22 }}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-lg font-semibold">Settings</h2>
              <button
                type="button"
                onClick={() => onClose()}
                className="titlebar-button hover:bg-red-500 border-2 border-white hover:border-red-500"
              >
                <X className="close-icon" />
              </button>
            </div>

            <nav className="flex-1 p-2">
              <ul className="space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCloudSync();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 transition"
                  >
                    <Cloud className="settings-section-icon" />
                    <span>Cloud Sync</span>
                  </button>
                </li>

                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSounds();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/20 transition"
                  >
                    <Volume2 className="settings-section-icon" />
                    <span>Sounds</span>
                  </button>
                </li>
              </ul>
            </nav>

            <div className="p-3 text-xs text-gray-400 border-t border-white/10">
              v1 Settings
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
